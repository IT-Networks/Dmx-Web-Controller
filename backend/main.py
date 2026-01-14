"""
DMX Web Controller - FastAPI Backend
Echtzeit-Steuerung über WebSocket
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import json
import asyncio
from pathlib import Path
from typing import List, Dict
import socket
import struct
from threading import Thread
import time
import os

app = FastAPI(title="DMX Web Controller")

# Determine base path for files
BASE_DIR = Path(__file__).parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"
if not FRONTEND_DIR.exists():
    FRONTEND_DIR = Path("/app/frontend")  # Docker fallback

# CORS für mehrere Clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Datenpfade
DATA_DIR = Path("/data") if Path("/data").exists() else BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)
CONFIG_FILE = DATA_DIR / "dmx_config.json"
SCENES_FILE = DATA_DIR / "dmx_scenes.json"
GROUPS_FILE = DATA_DIR / "dmx_groups.json"
EFFECTS_FILE = DATA_DIR / "dmx_effects.json"

# Mount static files
app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")

# Globale States
devices = []
scenes = []
groups = []
effects = []
fixtures = []
connected_clients: List[WebSocket] = []
is_fading = False
active_effects: Dict[str, asyncio.Task] = {}  # effect_id -> Task
current_audio_data: Dict[str, float] = {  # Current audio levels from clients
    'bass': 0.0,
    'mid': 0.0,
    'high': 0.0,
    'overall': 0.0,
    'peak': 0
}


class ArtNetController:
    """Art-Net DMX Controller"""
    
    ARTNET_PORT = 6454
    ARTNET_HEADER = b'Art-Net\x00'
    OPCODE_DMX = 0x5000
    PROTOCOL_VERSION = 14
    
    def __init__(self):
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
    
    def send_dmx(self, ip, universe, channels):
        """Sendet DMX via Art-Net"""
        packet = bytearray(530)
        packet[0:8] = self.ARTNET_HEADER
        packet[8:10] = struct.pack('<H', self.OPCODE_DMX)
        packet[10:12] = struct.pack('>H', self.PROTOCOL_VERSION)
        packet[12] = 0
        packet[13] = 0
        packet[14:16] = struct.pack('<H', universe)
        packet[16:18] = struct.pack('>H', len(channels))
        
        for i, value in enumerate(channels):
            if i < 512:
                packet[18 + i] = int(value)
        
        try:
            self.sock.sendto(packet, (ip, self.ARTNET_PORT))
        except Exception as e:
            print(f"DMX Send Error: {e}")


controller = ArtNetController()


# WebSocket-Broadcast
async def broadcast_update(data: dict):
    """Sendet Updates an alle verbundenen Clients"""
    disconnected = []
    for client in connected_clients:
        try:
            await client.send_json(data)
        except:
            disconnected.append(client)
    
    for client in disconnected:
        connected_clients.remove(client)


# Daten laden/speichern
def load_data():
    """Lädt Geräte, Szenen, Gruppen, Effekte und Fixtures"""
    global devices, scenes, groups, effects, fixtures

    if CONFIG_FILE.exists():
        with open(CONFIG_FILE, 'r') as f:
            devices = json.load(f)

    if SCENES_FILE.exists():
        with open(SCENES_FILE, 'r') as f:
            scenes = json.load(f)

    if GROUPS_FILE.exists():
        with open(GROUPS_FILE, 'r') as f:
            groups = json.load(f)

    if EFFECTS_FILE.exists():
        with open(EFFECTS_FILE, 'r') as f:
            effects = json.load(f)

    # Load fixture library
    fixtures_file = BASE_DIR / "backend" / "fixtures.json"
    if fixtures_file.exists():
        with open(fixtures_file, 'r') as f:
            fixture_data = json.load(f)
            fixtures = fixture_data.get('fixtures', [])


def save_devices():
    """Speichert Geräte"""
    with open(CONFIG_FILE, 'w') as f:
        json.dump(devices, f, indent=2)


def save_scenes():
    """Speichert Szenen"""
    with open(SCENES_FILE, 'w') as f:
        json.dump(scenes, f, indent=2)


def save_groups():
    """Speichert Gruppen"""
    with open(GROUPS_FILE, 'w') as f:
        json.dump(groups, f, indent=2)


def save_effects():
    """Speichert Effekte"""
    with open(EFFECTS_FILE, 'w') as f:
        json.dump(effects, f, indent=2)


# DMX Senden
def send_device_dmx(device):
    """Sendet DMX für ein Gerät"""
    channels = [0] * 512
    for i, val in enumerate(device['values']):
        ch = device['start_channel'] - 1 + i
        if ch < 512:
            channels[ch] = int(val)

    controller.send_dmx(device['ip'], device['universe'], channels)


# Gruppen-Hilfsfunktionen
def get_group_devices(group_id: str):
    """Gibt alle Geräte einer Gruppe zurück"""
    group = next((g for g in groups if g['id'] == group_id), None)
    if not group:
        return []

    return [d for d in devices if d['id'] in group.get('device_ids', [])]


def set_group_values(group_id: str, values: dict):
    """Setzt Werte für alle Geräte in einer Gruppe"""
    group_devices = get_group_devices(group_id)

    for device in group_devices:
        # Setze Intensität wenn vorhanden
        if 'intensity' in values:
            intensity = values['intensity']
            for i in range(len(device['values'])):
                device['values'][i] = int(intensity)

        # Setze RGB Werte wenn vorhanden
        if 'rgb' in values and device['device_type'] in ['rgb', 'rgbw']:
            r, g, b = values['rgb']
            if len(device['values']) >= 3:
                device['values'][0] = int(r)
                device['values'][1] = int(g)
                device['values'][2] = int(b)

        send_device_dmx(device)

    save_devices()


# Effekt-Engine
class EffectEngine:
    """Verwaltet und führt Lichteffekte aus"""

    @staticmethod
    async def strobe(target_ids: List[str], speed: float = 0.1, is_group: bool = False):
        """Stroboskop-Effekt"""
        while True:
            target_devices = []
            if is_group:
                for group_id in target_ids:
                    target_devices.extend(get_group_devices(group_id))
            else:
                target_devices = [d for d in devices if d['id'] in target_ids]

            # An
            for device in target_devices:
                for i in range(len(device['values'])):
                    device['values'][i] = 255
                send_device_dmx(device)

            await asyncio.sleep(speed)

            # Aus
            for device in target_devices:
                for i in range(len(device['values'])):
                    device['values'][i] = 0
                send_device_dmx(device)

            await asyncio.sleep(speed)

    @staticmethod
    async def rainbow(target_ids: List[str], speed: float = 0.05, is_group: bool = False):
        """Regenbogen-Effekt (nur RGB/RGBW)"""
        hue = 0
        while True:
            target_devices = []
            if is_group:
                for group_id in target_ids:
                    target_devices.extend(get_group_devices(group_id))
            else:
                target_devices = [d for d in devices if d['id'] in target_ids]

            # Konvertiere HSV zu RGB
            import colorsys
            r, g, b = colorsys.hsv_to_rgb(hue / 360, 1.0, 1.0)

            for device in target_devices:
                if device['device_type'] in ['rgb', 'rgbw'] and len(device['values']) >= 3:
                    device['values'][0] = int(r * 255)
                    device['values'][1] = int(g * 255)
                    device['values'][2] = int(b * 255)
                    send_device_dmx(device)

            hue = (hue + 1) % 360
            await asyncio.sleep(speed)

    @staticmethod
    async def chase(target_ids: List[str], speed: float = 0.2, is_group: bool = False):
        """Chase-Effekt (Lauflicht)"""
        idx = 0
        while True:
            target_devices = []
            if is_group:
                for group_id in target_ids:
                    target_devices.extend(get_group_devices(group_id))
            else:
                target_devices = [d for d in devices if d['id'] in target_ids]

            if not target_devices:
                await asyncio.sleep(speed)
                continue

            # Alle aus
            for device in target_devices:
                for i in range(len(device['values'])):
                    device['values'][i] = 0
                send_device_dmx(device)

            # Aktuelles an
            if idx < len(target_devices):
                for i in range(len(target_devices[idx]['values'])):
                    target_devices[idx]['values'][i] = 255
                send_device_dmx(target_devices[idx])

            idx = (idx + 1) % len(target_devices)
            await asyncio.sleep(speed)

    @staticmethod
    async def pulse(target_ids: List[str], speed: float = 0.02, is_group: bool = False):
        """Pulsierender Effekt (Atmung)"""
        direction = 1
        brightness = 0

        while True:
            target_devices = []
            if is_group:
                for group_id in target_ids:
                    target_devices.extend(get_group_devices(group_id))
            else:
                target_devices = [d for d in devices if d['id'] in target_ids]

            for device in target_devices:
                for i in range(len(device['values'])):
                    device['values'][i] = int(brightness)
                send_device_dmx(device)

            brightness += direction * 5
            if brightness >= 255:
                brightness = 255
                direction = -1
            elif brightness <= 0:
                brightness = 0
                direction = 1

            await asyncio.sleep(speed)

    @staticmethod
    async def color_fade(target_ids: List[str], colors: List[tuple], speed: float = 2.0, is_group: bool = False):
        """Langsamer Fade zwischen Farben"""
        color_idx = 0

        while True:
            target_devices = []
            if is_group:
                for group_id in target_ids:
                    target_devices.extend(get_group_devices(group_id))
            else:
                target_devices = [d for d in devices if d['id'] in target_ids]

            start_color = colors[color_idx]
            next_color = colors[(color_idx + 1) % len(colors)]

            steps = 50
            delay = speed / steps

            for step in range(steps + 1):
                progress = step / steps

                r = int(start_color[0] + (next_color[0] - start_color[0]) * progress)
                g = int(start_color[1] + (next_color[1] - start_color[1]) * progress)
                b = int(start_color[2] + (next_color[2] - start_color[2]) * progress)

                for device in target_devices:
                    if device['device_type'] in ['rgb', 'rgbw'] and len(device['values']) >= 3:
                        device['values'][0] = r
                        device['values'][1] = g
                        device['values'][2] = b
                        send_device_dmx(device)

                await asyncio.sleep(delay)

            color_idx = (color_idx + 1) % len(colors)

    @staticmethod
    async def sound_reactive(target_ids: List[str], mode: str = 'intensity',
                            frequency_band: str = 'overall', sensitivity: float = 1.0,
                            is_group: bool = False):
        """Sound-reaktiver Effekt"""
        global current_audio_data
        import colorsys

        last_trigger = 0
        flash_duration = 0.05

        while True:
            target_devices = []
            if is_group:
                for group_id in target_ids:
                    target_devices.extend(get_group_devices(group_id))
            else:
                target_devices = [d for d in devices if d['id'] in target_ids]

            # Get audio level for selected frequency band
            audio_level = current_audio_data.get(frequency_band, 0.0)
            adjusted_level = min(1.0, audio_level * sensitivity)

            if mode == 'flash':
                # Flash on beat detection (simple threshold)
                threshold = 0.7 / sensitivity
                if audio_level > threshold and (asyncio.get_event_loop().time() - last_trigger) > 0.1:
                    for device in target_devices:
                        for i in range(len(device['values'])):
                            device['values'][i] = 255
                        send_device_dmx(device)

                    last_trigger = asyncio.get_event_loop().time()
                    await asyncio.sleep(flash_duration)

                    # Turn off
                    for device in target_devices:
                        for i in range(len(device['values'])):
                            device['values'][i] = 0
                        send_device_dmx(device)
                else:
                    await asyncio.sleep(0.02)

            elif mode == 'intensity':
                # Map audio level to brightness
                brightness = int(adjusted_level * 255)

                for device in target_devices:
                    for i in range(len(device['values'])):
                        device['values'][i] = brightness
                    send_device_dmx(device)

                await asyncio.sleep(0.02)

            elif mode == 'color':
                # Map audio level to color hue
                hue = adjusted_level * 270  # 0-270 degrees (blue to red)
                r, g, b = colorsys.hsv_to_rgb(hue / 360, 1.0, 1.0)

                for device in target_devices:
                    if device['device_type'] in ['rgb', 'rgbw'] and len(device['values']) >= 3:
                        device['values'][0] = int(r * 255)
                        device['values'][1] = int(g * 255)
                        device['values'][2] = int(b * 255)
                        send_device_dmx(device)

                await asyncio.sleep(0.02)

    @staticmethod
    async def fire(target_ids: List[str], speed: float = 0.05, intensity: float = 1.0, is_group: bool = False):
        """Flackerndes Feuer-Effekt (Orange/Rot)"""
        import random

        while True:
            target_devices = []
            if is_group:
                for group_id in target_ids:
                    target_devices.extend(get_group_devices(group_id))
            else:
                target_devices = [d for d in devices if d['id'] in target_ids]

            for device in target_devices:
                # Random flicker with orange/red tones
                base_red = int(255 * intensity)
                base_green = int(100 * intensity * random.uniform(0.3, 0.7))
                base_blue = 0

                # Add flicker
                flicker = random.uniform(0.7, 1.0)
                red = int(base_red * flicker)
                green = int(base_green * flicker)

                if device['device_type'] in ['rgb', 'rgbw'] and len(device['values']) >= 3:
                    device['values'][0] = red
                    device['values'][1] = green
                    device['values'][2] = base_blue
                elif device['device_type'] == 'dimmer':
                    device['values'][0] = red

                send_device_dmx(device)

            await asyncio.sleep(speed)

    @staticmethod
    async def lightning(target_ids: List[str], min_delay: float = 0.5, max_delay: float = 3.0, is_group: bool = False):
        """Zufällige Blitz-Effekte"""
        import random

        while True:
            target_devices = []
            if is_group:
                for group_id in target_ids:
                    target_devices.extend(get_group_devices(group_id))
            else:
                target_devices = [d for d in devices if d['id'] in target_ids]

            # Random lightning strike
            flash_count = random.randint(1, 3)

            for _ in range(flash_count):
                # Flash on
                for device in target_devices:
                    for i in range(len(device['values'])):
                        device['values'][i] = 255
                    send_device_dmx(device)

                await asyncio.sleep(random.uniform(0.03, 0.08))

                # Flash off
                for device in target_devices:
                    for i in range(len(device['values'])):
                        device['values'][i] = 0
                    send_device_dmx(device)

                if flash_count > 1:
                    await asyncio.sleep(random.uniform(0.05, 0.15))

            # Wait for next lightning
            await asyncio.sleep(random.uniform(min_delay, max_delay))

    @staticmethod
    async def scanner(target_ids: List[str], speed: float = 0.1, range_degrees: int = 180, is_group: bool = False):
        """Scanner-Effekt für Moving Heads (Pan/Tilt Sweep)"""
        direction = 1
        position = 0

        while True:
            target_devices = []
            if is_group:
                for group_id in target_ids:
                    target_devices.extend(get_group_devices(group_id))
            else:
                target_devices = [d for d in devices if d['id'] in target_ids]

            # Calculate pan position (0-255)
            pan_value = int((position / range_degrees) * 255)

            for device in target_devices:
                # Set pan if available
                if len(device['values']) > 0:
                    device['values'][0] = pan_value

                # Keep light on
                if len(device['values']) > 5:
                    device['values'][5] = 255  # Dimmer

                send_device_dmx(device)

            # Update position
            position += direction * 5
            if position >= range_degrees:
                position = range_degrees
                direction = -1
            elif position <= 0:
                position = 0
                direction = 1

            await asyncio.sleep(speed)

    @staticmethod
    async def matrix(target_ids: List[str], speed: float = 0.2, pattern: str = 'wave', is_group: bool = False):
        """Matrix-Effekt für Grid-Arrangements"""
        import math
        frame = 0

        while True:
            target_devices = []
            if is_group:
                for group_id in target_ids:
                    target_devices.extend(get_group_devices(group_id))
            else:
                target_devices = [d for d in devices if d['id'] in target_ids]

            num_devices = len(target_devices)
            if num_devices == 0:
                await asyncio.sleep(speed)
                continue

            # Calculate grid dimensions (approximate square)
            cols = int(math.sqrt(num_devices))
            rows = (num_devices + cols - 1) // cols

            for idx, device in enumerate(target_devices):
                x = idx % cols
                y = idx // cols

                if pattern == 'wave':
                    # Horizontal wave
                    intensity = (math.sin(frame * 0.1 + x * 0.5) + 1) / 2
                elif pattern == 'circle':
                    # Circular pattern
                    center_x = cols / 2
                    center_y = rows / 2
                    distance = math.sqrt((x - center_x) ** 2 + (y - center_y) ** 2)
                    intensity = (math.sin(frame * 0.2 - distance * 0.5) + 1) / 2
                else:
                    # Checkerboard
                    intensity = 1.0 if (x + y + frame // 5) % 2 == 0 else 0.0

                brightness = int(intensity * 255)

                for i in range(len(device['values'])):
                    device['values'][i] = brightness
                send_device_dmx(device)

            frame += 1
            await asyncio.sleep(speed)

    @staticmethod
    async def twinkle(target_ids: List[str], speed: float = 0.1, density: float = 0.3, is_group: bool = False):
        """Glitzer-Effekt mit zufälligen Blitzen"""
        import random

        while True:
            target_devices = []
            if is_group:
                for group_id in target_ids:
                    target_devices.extend(get_group_devices(group_id))
            else:
                target_devices = [d for d in devices if d['id'] in target_ids]

            for device in target_devices:
                # Random chance to twinkle
                if random.random() < density:
                    # Bright flash
                    brightness = random.randint(200, 255)
                    for i in range(len(device['values'])):
                        device['values'][i] = brightness
                else:
                    # Dim or off
                    brightness = random.randint(0, 50)
                    for i in range(len(device['values'])):
                        device['values'][i] = brightness

                send_device_dmx(device)

            await asyncio.sleep(speed)


effect_engine = EffectEngine()


async def start_effect(effect_id: str, effect_type: str, target_ids: List[str],
                       params: dict, is_group: bool = False):
    """Startet einen Effekt"""
    global active_effects

    # Stoppe existierenden Effekt
    if effect_id in active_effects:
        active_effects[effect_id].cancel()

    # Starte neuen Effekt
    try:
        if effect_type == 'strobe':
            task = asyncio.create_task(
                effect_engine.strobe(target_ids, params.get('speed', 0.1), is_group)
            )
        elif effect_type == 'rainbow':
            task = asyncio.create_task(
                effect_engine.rainbow(target_ids, params.get('speed', 0.05), is_group)
            )
        elif effect_type == 'chase':
            task = asyncio.create_task(
                effect_engine.chase(target_ids, params.get('speed', 0.2), is_group)
            )
        elif effect_type == 'pulse':
            task = asyncio.create_task(
                effect_engine.pulse(target_ids, params.get('speed', 0.02), is_group)
            )
        elif effect_type == 'color_fade':
            colors = params.get('colors', [(255, 0, 0), (0, 255, 0), (0, 0, 255)])
            task = asyncio.create_task(
                effect_engine.color_fade(target_ids, colors, params.get('speed', 2.0), is_group)
            )
        elif effect_type == 'sound_reactive':
            task = asyncio.create_task(
                effect_engine.sound_reactive(
                    target_ids,
                    mode=params.get('mode', 'intensity'),
                    frequency_band=params.get('frequency_band', 'overall'),
                    sensitivity=params.get('sensitivity', 1.0),
                    is_group=is_group
                )
            )
        elif effect_type == 'fire':
            task = asyncio.create_task(
                effect_engine.fire(
                    target_ids,
                    speed=params.get('speed', 0.05),
                    intensity=params.get('intensity', 1.0),
                    is_group=is_group
                )
            )
        elif effect_type == 'lightning':
            task = asyncio.create_task(
                effect_engine.lightning(
                    target_ids,
                    min_delay=params.get('min_delay', 0.5),
                    max_delay=params.get('max_delay', 3.0),
                    is_group=is_group
                )
            )
        elif effect_type == 'scanner':
            task = asyncio.create_task(
                effect_engine.scanner(
                    target_ids,
                    speed=params.get('speed', 0.1),
                    range_degrees=params.get('range', 180),
                    is_group=is_group
                )
            )
        elif effect_type == 'matrix':
            task = asyncio.create_task(
                effect_engine.matrix(
                    target_ids,
                    speed=params.get('speed', 0.2),
                    pattern=params.get('pattern', 'wave'),
                    is_group=is_group
                )
            )
        elif effect_type == 'twinkle':
            task = asyncio.create_task(
                effect_engine.twinkle(
                    target_ids,
                    speed=params.get('speed', 0.1),
                    density=params.get('density', 0.3),
                    is_group=is_group
                )
            )
        else:
            return False

        active_effects[effect_id] = task
        return True

    except Exception as e:
        print(f"Error starting effect: {e}")
        return False


async def stop_effect(effect_id: str):
    """Stoppt einen Effekt"""
    if effect_id in active_effects:
        active_effects[effect_id].cancel()
        del active_effects[effect_id]
        return True
    return False


# Fade-Funktion
async def fade_to_scene(scene_id: str):
    """Führt Fade zur Szene durch"""
    global is_fading

    if is_fading:
        return

    is_fading = True
    scene = next((s for s in scenes if s['id'] == scene_id), None)

    if not scene:
        is_fading = False
        return

    steps = 50
    delay = 2.0 / steps

    # Sammle Fade-Daten
    fade_data = []
    for device in devices:
        if device['name'] in scene['device_values']:
            start_values = device['values'].copy()
            target_values = scene['device_values'][device['name']]
            fade_data.append({
                'device': device,
                'start': start_values,
                'target': target_values
            })

    # Führe Fade durch
    for step in range(steps + 1):
        progress = step / steps

        for data in fade_data:
            device = data['device']
            start = data['start']
            target = data['target']

            for i in range(len(device['values'])):
                if i < len(target):
                    device['values'][i] = int(start[i] + (target[i] - start[i]) * progress)

            send_device_dmx(device)

        await asyncio.sleep(delay)

    save_devices()
    is_fading = False

    # Broadcast Update
    await broadcast_update({
        'type': 'devices_updated',
        'devices': devices
    })


# API Endpoints
@app.on_event("startup")
async def startup():
    load_data()


@app.get("/")
async def root():
    """Serve Frontend"""
    return FileResponse(str(FRONTEND_DIR / "Index.html"))


@app.get("/api/devices")
async def get_devices():
    """Gibt alle Geräte zurück"""
    return {"devices": devices}


@app.post("/api/devices")
async def add_device(device: dict):
    """Fügt neues Gerät hinzu"""
    device['id'] = f"device_{int(time.time() * 1000)}"
    device['values'] = [0] * device['channel_count']
    devices.append(device)
    save_devices()
    
    await broadcast_update({
        'type': 'devices_updated',
        'devices': devices
    })
    
    return {"success": True, "device": device}


@app.delete("/api/devices/{device_id}")
async def delete_device(device_id: str):
    """Löscht Gerät"""
    global devices
    devices = [d for d in devices if d.get('id') != device_id]
    save_devices()
    
    await broadcast_update({
        'type': 'devices_updated',
        'devices': devices
    })
    
    return {"success": True}


@app.post("/api/devices/{device_id}/values")
async def update_device_values(device_id: str, data: dict):
    """Aktualisiert Gerätewerte"""
    device = next((d for d in devices if d.get('id') == device_id), None)
    
    if device:
        device['values'] = data['values']
        send_device_dmx(device)
        save_devices()
        
        await broadcast_update({
            'type': 'device_values_updated',
            'device_id': device_id,
            'values': data['values']
        })
        
        return {"success": True}
    
    return {"success": False}


@app.get("/api/scenes")
async def get_scenes():
    """Gibt alle Szenen zurück"""
    return {"scenes": scenes}


@app.post("/api/scenes")
async def add_scene(scene: dict):
    """Erstellt neue Szene"""
    scene['id'] = f"scene_{int(time.time() * 1000)}"
    
    # Erfasse aktuelle Werte
    scene['device_values'] = {}
    for device in devices:
        scene['device_values'][device['name']] = device['values'].copy()
    
    scenes.append(scene)
    save_scenes()
    
    await broadcast_update({
        'type': 'scenes_updated',
        'scenes': scenes
    })
    
    return {"success": True, "scene": scene}


@app.delete("/api/scenes/{scene_id}")
async def delete_scene(scene_id: str):
    """Löscht Szene"""
    global scenes
    scenes = [s for s in scenes if s.get('id') != scene_id]
    save_scenes()
    
    await broadcast_update({
        'type': 'scenes_updated',
        'scenes': scenes
    })
    
    return {"success": True}


@app.post("/api/scenes/{scene_id}/activate")
async def activate_scene(scene_id: str):
    """Aktiviert Szene mit Fade"""
    # Start fade as background task
    asyncio.create_task(fade_to_scene(scene_id))

    return {"success": True, "fading": True}


# Gruppen API
@app.get("/api/groups")
async def get_groups():
    """Gibt alle Gruppen zurück"""
    return {"groups": groups}


@app.post("/api/groups")
async def add_group(group: dict):
    """Erstellt neue Gruppe"""
    group['id'] = f"group_{int(time.time() * 1000)}"
    group['device_ids'] = group.get('device_ids', [])

    groups.append(group)
    save_groups()

    await broadcast_update({
        'type': 'groups_updated',
        'groups': groups
    })

    return {"success": True, "group": group}


@app.put("/api/groups/{group_id}")
async def update_group(group_id: str, data: dict):
    """Aktualisiert Gruppe"""
    group = next((g for g in groups if g['id'] == group_id), None)

    if group:
        group.update(data)
        save_groups()

        await broadcast_update({
            'type': 'groups_updated',
            'groups': groups
        })

        return {"success": True, "group": group}

    return {"success": False}


@app.delete("/api/groups/{group_id}")
async def delete_group(group_id: str):
    """Löscht Gruppe"""
    global groups
    groups = [g for g in groups if g['id'] != group_id]
    save_groups()

    await broadcast_update({
        'type': 'groups_updated',
        'groups': groups
    })

    return {"success": True}


@app.post("/api/groups/{group_id}/values")
async def update_group_values(group_id: str, data: dict):
    """Setzt Werte für alle Geräte in einer Gruppe"""
    set_group_values(group_id, data)

    await broadcast_update({
        'type': 'devices_updated',
        'devices': devices
    })

    return {"success": True}


# Effekte API
@app.get("/api/effects")
async def get_effects():
    """Gibt verfügbare Effekttypen und gespeicherte Effekte zurück"""
    return {
        "effects": effects,
        "available_types": [
            {"id": "strobe", "name": "Stroboskop", "params": ["speed"]},
            {"id": "rainbow", "name": "Regenbogen", "params": ["speed"]},
            {"id": "chase", "name": "Lauflicht", "params": ["speed"]},
            {"id": "pulse", "name": "Pulsieren", "params": ["speed"]},
            {"id": "color_fade", "name": "Farbwechsel", "params": ["speed", "colors"]}
        ]
    }


@app.post("/api/effects")
async def create_effect(effect: dict):
    """Erstellt und speichert Effekt"""
    effect['id'] = f"effect_{int(time.time() * 1000)}"
    effects.append(effect)
    save_effects()

    await broadcast_update({
        'type': 'effects_updated',
        'effects': effects
    })

    return {"success": True, "effect": effect}


@app.post("/api/effects/{effect_id}/start")
async def start_effect_endpoint(effect_id: str):
    """Startet einen gespeicherten Effekt"""
    effect = next((e for e in effects if e['id'] == effect_id), None)

    if not effect:
        return {"success": False, "error": "Effect not found"}

    # Merge sound_config into params for sound_reactive effects
    params = effect.get('params', {}).copy()
    if effect.get('sound_reactive') and effect.get('sound_config'):
        params.update(effect['sound_config'])

    success = await start_effect(
        effect_id,
        effect['type'],
        effect.get('target_ids', []),
        params,
        effect.get('is_group', False)
    )

    return {"success": success}


@app.post("/api/effects/{effect_id}/stop")
async def stop_effect_endpoint(effect_id: str):
    """Stoppt einen laufenden Effekt"""
    success = await stop_effect(effect_id)
    return {"success": success}


@app.delete("/api/effects/{effect_id}")
async def delete_effect(effect_id: str):
    """Löscht Effekt"""
    global effects

    # Stoppe Effekt falls aktiv
    await stop_effect(effect_id)

    effects = [e for e in effects if e['id'] != effect_id]
    save_effects()

    await broadcast_update({
        'type': 'effects_updated',
        'effects': effects
    })

    return {"success": True}


# Companion API (für Stream Deck Integration)
@app.get("/api/companion/actions")
async def get_companion_actions():
    """Gibt alle verfügbaren Aktionen für Companion zurück"""
    actions = []

    # Szenen-Aktionen
    for scene in scenes:
        actions.append({
            "id": f"scene_{scene['id']}",
            "type": "scene",
            "name": f"Szene: {scene['name']}",
            "color": scene.get('color', 'blue')
        })

    # Gruppen-Aktionen
    for group in groups:
        actions.append({
            "id": f"group_{group['id']}",
            "type": "group",
            "name": f"Gruppe: {group['name']}",
            "actions": ["on", "off", "toggle"]
        })

    # Effekt-Aktionen
    for effect in effects:
        actions.append({
            "id": f"effect_{effect['id']}",
            "type": "effect",
            "name": f"Effekt: {effect['name']}",
            "effect_type": effect['type']
        })

    return {"actions": actions}


@app.post("/api/companion/trigger")
async def trigger_companion_action(data: dict):
    """Führt eine Companion-Aktion aus"""
    action_type = data.get('type')
    action_id = data.get('id')
    params = data.get('params', {})

    if action_type == 'scene':
        scene_id = action_id.replace('scene_', '')
        await activate_scene(scene_id)
        return {"success": True}

    elif action_type == 'group':
        group_id = action_id.replace('group_', '')
        action = params.get('action', 'toggle')

        if action == 'on':
            set_group_values(group_id, {'intensity': 255})
        elif action == 'off':
            set_group_values(group_id, {'intensity': 0})
        elif action == 'toggle':
            # Toggle basierend auf erstem Gerät
            group_devices = get_group_devices(group_id)
            if group_devices:
                current = group_devices[0]['values'][0]
                new_val = 0 if current > 0 else 255
                set_group_values(group_id, {'intensity': new_val})

        await broadcast_update({'type': 'devices_updated', 'devices': devices})
        return {"success": True}

    elif action_type == 'effect':
        effect_id = action_id.replace('effect_', '')
        if params.get('stop'):
            await stop_effect_endpoint(effect_id)
        else:
            await start_effect_endpoint(effect_id)
        return {"success": True}

    return {"success": False, "error": "Unknown action type"}


# Fixture Library API
@app.get("/api/fixtures")
async def get_fixtures():
    """Gibt alle verfügbaren Fixtures aus der Library zurück"""
    return {"fixtures": fixtures}


@app.get("/api/fixtures/categories")
async def get_fixture_categories():
    """Gibt alle verfügbaren Fixture-Kategorien zurück"""
    categories = {}
    for fixture in fixtures:
        category = fixture.get('category', 'other')
        if category not in categories:
            categories[category] = []
        categories[category].append({
            'id': fixture['id'],
            'manufacturer': fixture['manufacturer'],
            'model': fixture['model'],
            'channels': fixture['channels']
        })
    return {"categories": categories}


@app.get("/api/fixtures/{fixture_id}")
async def get_fixture(fixture_id: str):
    """Gibt Details zu einem spezifischen Fixture zurück"""
    fixture = next((f for f in fixtures if f['id'] == fixture_id), None)
    if fixture:
        return {"fixture": fixture}
    return {"error": "Fixture not found"}, 404


# WebSocket für Echtzeit-Updates
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.append(websocket)
    
    # Sende initiale Daten
    await websocket.send_json({
        'type': 'initial_data',
        'devices': devices,
        'scenes': scenes,
        'groups': groups,
        'effects': effects
    })
    
    try:
        while True:
            data = await websocket.receive_json()
            
            if data['type'] == 'update_device_value':
                device = next((d for d in devices if d.get('id') == data['device_id']), None)
                if device:
                    channel_idx = data['channel_idx']
                    value = data['value']
                    device['values'][channel_idx] = value
                    send_device_dmx(device)
                    save_devices()

                    # Broadcast an alle anderen Clients
                    await broadcast_update({
                        'type': 'device_values_updated',
                        'device_id': data['device_id'],
                        'values': device['values']
                    })

            elif data['type'] == 'audio_data':
                # Update global audio data from client
                global current_audio_data
                audio_info = data.get('data', {})
                current_audio_data.update({
                    'bass': audio_info.get('bass', 0.0),
                    'mid': audio_info.get('mid', 0.0),
                    'high': audio_info.get('high', 0.0),
                    'overall': audio_info.get('overall', 0.0),
                    'peak': audio_info.get('peak', 0)
                })
    
    except WebSocketDisconnect:
        connected_clients.remove(websocket)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

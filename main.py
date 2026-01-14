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

app = FastAPI(title="DMX Web Controller")

# CORS für mehrere Clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Datenpfade
DATA_DIR = Path("/data")
DATA_DIR.mkdir(exist_ok=True)
CONFIG_FILE = DATA_DIR / "dmx_config.json"
SCENES_FILE = DATA_DIR / "dmx_scenes.json"

# Globale States
devices = []
scenes = []
connected_clients: List[WebSocket] = []
is_fading = False


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
    """Lädt Geräte und Szenen"""
    global devices, scenes
    
    if CONFIG_FILE.exists():
        with open(CONFIG_FILE, 'r') as f:
            devices = json.load(f)
    
    if SCENES_FILE.exists():
        with open(SCENES_FILE, 'r') as f:
            scenes = json.load(f)


def save_devices():
    """Speichert Geräte"""
    with open(CONFIG_FILE, 'w') as f:
        json.dump(devices, f, indent=2)


def save_scenes():
    """Speichert Szenen"""
    with open(SCENES_FILE, 'w') as f:
        json.dump(scenes, f, indent=2)


# DMX Senden
def send_device_dmx(device):
    """Sendet DMX für ein Gerät"""
    channels = [0] * 512
    for i, val in enumerate(device['values']):
        ch = device['start_channel'] - 1 + i
        if ch < 512:
            channels[ch] = int(val)
    
    controller.send_dmx(device['ip'], device['universe'], channels)


# Fade-Funktion
def fade_to_scene(scene_id: str):
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
        
        time.sleep(delay)
    
    save_devices()
    is_fading = False
    
    # Broadcast Update
    asyncio.create_task(broadcast_update({
        'type': 'devices_updated',
        'devices': devices
    }))


# API Endpoints
@app.on_event("startup")
async def startup():
    load_data()


@app.get("/")
async def root():
    """Serve Frontend"""
    return FileResponse('/app/frontend/index.html')


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
    thread = Thread(target=fade_to_scene, args=(scene_id,))
    thread.daemon = True
    thread.start()
    
    return {"success": True, "fading": True}


# WebSocket für Echtzeit-Updates
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.append(websocket)
    
    # Sende initiale Daten
    await websocket.send_json({
        'type': 'initial_data',
        'devices': devices,
        'scenes': scenes
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
    
    except WebSocketDisconnect:
        connected_clients.remove(websocket)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

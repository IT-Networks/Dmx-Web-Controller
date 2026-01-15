"""
DMX Web Controller - FastAPI Backend
Echtzeit-Steuerung über WebSocket
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
import json
import asyncio
from pathlib import Path
from typing import List, Dict, Optional
import socket
import struct
from threading import Thread
import time
import os
import logging
import shutil
from datetime import datetime
import ipaddress
import math
from contextlib import asynccontextmanager

# Logging Configuration
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('dmx_controller.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# System Limits & Configuration
class Config:
    MAX_ACTIVE_EFFECTS = 20
    MAX_ACTIVE_SEQUENCES = 5
    MAX_DEVICES = 100
    MAX_SCENES = 200
    MAX_GROUPS = 50
    MAX_SEQUENCE_STEPS = 100
    MAX_NAME_LENGTH = 100
    BACKUP_RETENTION_DAYS = 7
    AUTO_SAVE_INTERVAL = 30  # seconds
    DMX_CHANNEL_MIN = 1
    DMX_CHANNEL_MAX = 512
    EFFECT_TIMEOUT = 3600  # 1 hour max runtime
    SEQUENCE_TIMEOUT = 7200  # 2 hours max runtime

config = Config()

# Determine base path for files
BASE_DIR = Path(__file__).parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"
if not FRONTEND_DIR.exists():
    FRONTEND_DIR = Path("/app/frontend")  # Docker fallback

# Lifespan event handler (defined early, but load_data() is defined later)
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    load_data()  # Function defined below
    yield
    # Shutdown (if needed in future)

# Create FastAPI app with lifespan
app = FastAPI(title="DMX Web Controller", lifespan=lifespan)

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
BACKUP_DIR = DATA_DIR / "backups"
BACKUP_DIR.mkdir(exist_ok=True)
CONFIG_FILE = DATA_DIR / "dmx_config.json"
SCENES_FILE = DATA_DIR / "dmx_scenes.json"
GROUPS_FILE = DATA_DIR / "dmx_groups.json"
EFFECTS_FILE = DATA_DIR / "dmx_effects.json"
SEQUENCES_FILE = DATA_DIR / "dmx_sequences.json"

# Mount static files
app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")

# Globale States
devices = []
scenes = []
groups = []
effects = []
fixtures = []
sequences = []  # Timeline sequences
connected_clients: List[WebSocket] = []
is_fading = False
active_effects: Dict[str, asyncio.Task] = {}  # effect_id -> Task
active_sequences: Dict[str, asyncio.Task] = {}  # sequence_id -> Task
current_audio_data: Dict[str, float] = {  # Current audio levels from clients
    'bass': 0.0,
    'mid': 0.0,
    'high': 0.0,
    'overall': 0.0,
    'peak': 0
}
# DMX Performance Optimization - Channel Cache per device
dmx_channel_cache: Dict[str, List[int]] = {}  # device_id -> last sent channel values
last_save_time = time.time()  # For auto-save debouncing


class ArtNetController:
    """Art-Net DMX Controller with error handling and reconnection"""

    ARTNET_PORT = 6454
    ARTNET_HEADER = b'Art-Net\x00'
    OPCODE_DMX = 0x5000
    PROTOCOL_VERSION = 14

    def __init__(self):
        self.sock = None
        self.error_count = 0
        self.last_error_time = 0
        self._init_socket()

    def _init_socket(self):
        """Initialize or reinitialize socket"""
        try:
            if self.sock:
                self.sock.close()
            self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
            self.sock.settimeout(1.0)  # 1 second timeout
            logger.info("Art-Net socket initialized")
        except Exception as e:
            logger.error(f"Failed to initialize Art-Net socket: {e}")
            raise

    def send_dmx(self, ip: str, universe: int, channels: List[int]) -> bool:
        """Sendet DMX via Art-Net with error handling"""
        try:
            # Validate inputs
            if not channels or len(channels) > 512:
                logger.warning(f"Invalid channel count: {len(channels)}")
                return False

            # Build packet
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
                    packet[18 + i] = max(0, min(255, int(value)))  # Clamp to 0-255

            # Send packet
            self.sock.sendto(packet, (ip, self.ARTNET_PORT))

            # Reset error count on success
            if self.error_count > 0:
                self.error_count = 0
                logger.info(f"Art-Net communication recovered for {ip}")

            return True

        except socket.timeout:
            logger.warning(f"DMX send timeout to {ip}")
            return False
        except socket.error as e:
            self.error_count += 1
            current_time = time.time()

            # Log only if it's a new error or 10 seconds passed
            if current_time - self.last_error_time > 10:
                logger.error(f"DMX socket error to {ip}: {e} (count: {self.error_count})")
                self.last_error_time = current_time

            # Try to reinitialize socket after 5 errors
            if self.error_count >= 5:
                logger.warning("Attempting to reinitialize Art-Net socket")
                try:
                    self._init_socket()
                    self.error_count = 0
                except Exception as reinit_error:
                    logger.error(f"Socket reinit failed: {reinit_error}")

            return False
        except Exception as e:
            logger.error(f"Unexpected DMX send error to {ip}: {e}", exc_info=True)
            return False


controller = ArtNetController()


# Pydantic Models for Input Validation
class DeviceCreate(BaseModel):
    name: str = Field(..., max_length=config.MAX_NAME_LENGTH, min_length=1)
    ip: str
    universe: int = Field(ge=0, le=15)
    start_channel: int = Field(ge=config.DMX_CHANNEL_MIN, le=config.DMX_CHANNEL_MAX)
    channel_count: int = Field(ge=1, le=512)
    device_type: str
    fixture_id: Optional[str] = None
    channel_layout: Optional[Dict] = None

    @field_validator('ip')
    @classmethod
    def validate_ip(cls, v):
        try:
            ipaddress.ip_address(v)
            return v
        except ValueError:
            raise ValueError('Invalid IP address')

    @field_validator('name')
    @classmethod
    def validate_name(cls, v):
        if not v.strip():
            raise ValueError('Name cannot be empty')
        return v.strip()


class SceneCreate(BaseModel):
    name: str = Field(..., max_length=config.MAX_NAME_LENGTH, min_length=1)
    color: str = Field(default="blue")
    device_values: Dict[str, List[int]]


class GroupCreate(BaseModel):
    name: str = Field(..., max_length=config.MAX_NAME_LENGTH, min_length=1)
    device_ids: List[str] = Field(..., min_length=1)


class EffectCreate(BaseModel):
    name: str = Field(..., max_length=config.MAX_NAME_LENGTH, min_length=1)
    type: str
    target_ids: List[str] = Field(..., min_length=1)
    params: Dict = Field(default_factory=dict)
    is_group: bool = False


class SequenceCreate(BaseModel):
    name: str = Field(..., max_length=config.MAX_NAME_LENGTH, min_length=1)
    loop: bool = False
    steps: List[Dict] = Field(..., max_length=config.MAX_SEQUENCE_STEPS)


# Backup & Data Persistence Functions
def create_backup(file_path: Path) -> bool:
    """Creates a backup of a data file"""
    try:
        if not file_path.exists():
            return False

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_name = f"{file_path.stem}_{timestamp}.json"
        backup_path = BACKUP_DIR / backup_name

        shutil.copy2(file_path, backup_path)
        logger.info(f"Backup created: {backup_name}")

        # Clean old backups
        cleanup_old_backups(file_path.stem)
        return True
    except Exception as e:
        logger.error(f"Backup creation failed for {file_path}: {e}")
        return False


def cleanup_old_backups(file_prefix: str):
    """Removes backups older than retention period"""
    try:
        retention_seconds = config.BACKUP_RETENTION_DAYS * 24 * 3600
        current_time = time.time()

        for backup_file in BACKUP_DIR.glob(f"{file_prefix}_*.json"):
            file_age = current_time - backup_file.stat().st_mtime
            if file_age > retention_seconds:
                backup_file.unlink()
                logger.info(f"Deleted old backup: {backup_file.name}")
    except Exception as e:
        logger.error(f"Backup cleanup failed: {e}")


def atomic_write(file_path: Path, data: any):
    """Atomic file write with backup"""
    try:
        # Create backup before writing
        create_backup(file_path)

        # Write to temporary file first
        temp_path = file_path.with_suffix('.tmp')
        with open(temp_path, 'w') as f:
            json.dump(data, f, indent=2)

        # Atomic rename
        temp_path.replace(file_path)
        return True
    except Exception as e:
        logger.error(f"Atomic write failed for {file_path}: {e}")
        return False


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
    """Lädt Geräte, Szenen, Gruppen, Effekte, Sequences und Fixtures mit Error Handling"""
    global devices, scenes, groups, effects, sequences, fixtures

    def safe_load(file_path: Path, data_type: str) -> list:
        """Safely load JSON file with error handling"""
        try:
            if file_path.exists():
                with open(file_path, 'r') as f:
                    data = json.load(f)
                    logger.info(f"Loaded {len(data)} {data_type}")
                    return data
        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error in {file_path}: {e}")
            # Try to restore from backup
            backups = sorted(BACKUP_DIR.glob(f"{file_path.stem}_*.json"), reverse=True)
            if backups:
                logger.info(f"Attempting to restore from backup: {backups[0]}")
                try:
                    with open(backups[0], 'r') as f:
                        data = json.load(f)
                        logger.info(f"Successfully restored {data_type} from backup")
                        return data
                except Exception as backup_error:
                    logger.error(f"Backup restore failed: {backup_error}")
        except Exception as e:
            logger.error(f"Error loading {file_path}: {e}")

        return []

    devices = safe_load(CONFIG_FILE, "devices")
    scenes = safe_load(SCENES_FILE, "scenes")
    groups = safe_load(GROUPS_FILE, "groups")
    effects = safe_load(EFFECTS_FILE, "effects")
    sequences = safe_load(SEQUENCES_FILE, "sequences")

    # Load fixture library
    fixtures_file = BASE_DIR / "backend" / "fixtures.json"
    try:
        if fixtures_file.exists():
            with open(fixtures_file, 'r') as f:
                fixture_data = json.load(f)
                fixtures = fixture_data.get('fixtures', [])
                logger.info(f"Loaded {len(fixtures)} fixtures from library")
    except Exception as e:
        logger.error(f"Error loading fixture library: {e}")
        fixtures = []


def save_devices():
    """Speichert Geräte mit atomic write und backup"""
    global last_save_time
    try:
        success = atomic_write(CONFIG_FILE, devices)
        if success:
            last_save_time = time.time()
            logger.debug("Devices saved successfully")
        return success
    except Exception as e:
        logger.error(f"Failed to save devices: {e}")
        return False


def save_scenes():
    """Speichert Szenen mit atomic write und backup"""
    try:
        success = atomic_write(SCENES_FILE, scenes)
        if success:
            logger.debug("Scenes saved successfully")
        return success
    except Exception as e:
        logger.error(f"Failed to save scenes: {e}")
        return False


def save_groups():
    """Speichert Gruppen mit atomic write und backup"""
    try:
        success = atomic_write(GROUPS_FILE, groups)
        if success:
            logger.debug("Groups saved successfully")
        return success
    except Exception as e:
        logger.error(f"Failed to save groups: {e}")
        return False


def save_effects():
    """Speichert Effekte mit atomic write und backup"""
    try:
        success = atomic_write(EFFECTS_FILE, effects)
        if success:
            logger.debug("Effects saved successfully")
        return success
    except Exception as e:
        logger.error(f"Failed to save effects: {e}")
        return False


def save_sequences():
    """Speichert Sequences mit atomic write und backup"""
    try:
        success = atomic_write(SEQUENCES_FILE, sequences)
        if success:
            logger.debug("Sequences saved successfully")
        return success
    except Exception as e:
        logger.error(f"Failed to save sequences: {e}")
        return False


# DMX Senden mit Performance-Optimierung
def send_device_dmx(device) -> bool:
    """Sendet DMX für ein Gerät mit Channel-Caching"""
    try:
        device_id = device.get('id')
        if not device_id:
            logger.warning("Device without ID, cannot cache")
            return False

        channels = [0] * 512
        for i, val in enumerate(device.get('values', [])):
            ch = device['start_channel'] - 1 + i
            if 0 <= ch < 512:
                channels[ch] = max(0, min(255, int(val)))  # Clamp values

        # Check cache - only send if values changed
        if device_id in dmx_channel_cache:
            if dmx_channel_cache[device_id] == channels:
                logger.debug(f"DMX cache hit for {device.get('name')}, skipping send")
                return True  # Values unchanged, skip send

        # Send DMX
        success = controller.send_dmx(device['ip'], device['universe'], channels)

        # Update cache on successful send
        if success:
            dmx_channel_cache[device_id] = channels.copy()

        return success

    except Exception as e:
        logger.error(f"Error sending DMX for device {device.get('name')}: {e}")
        return False


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


    @staticmethod
    async def custom(target_ids: List[str], keyframes: List[Dict], duration: float = 10.0,
                     mode: str = 'spot', is_group: bool = False):
        """
        Custom Keyframe-basierter Effekt für Spots und Strips

        Args:
            target_ids: Liste der Ziel-Geräte/Gruppen
            keyframes: Liste von Keyframes mit {time, values, easing}
            duration: Gesamtdauer des Effekts in Sekunden
            mode: 'spot' für einzelne Lichter, 'strip' für LED-Streifen
            is_group: Ob target_ids Gruppen sind
        """
        target_devices = []
        if is_group:
            for group_id in target_ids:
                target_devices.extend(get_group_devices(group_id))
        else:
            target_devices = [d for d in devices if d['id'] in target_ids]

        if not keyframes or len(keyframes) < 2:
            logger.warning("Custom effect needs at least 2 keyframes")
            return

        # Sort keyframes by time
        sorted_keyframes = sorted(keyframes, key=lambda k: k.get('time', 0))

        start_time = time.time()
        fps = 30  # 30 frames per second
        frame_duration = 1.0 / fps

        while True:
            elapsed = time.time() - start_time
            progress = (elapsed % duration) / duration  # 0.0 to 1.0
            current_time = progress * 100  # Convert to 0-100 percentage

            # Find surrounding keyframes
            prev_kf = sorted_keyframes[0]
            next_kf = sorted_keyframes[-1]

            for i in range(len(sorted_keyframes) - 1):
                if sorted_keyframes[i]['time'] <= current_time <= sorted_keyframes[i + 1]['time']:
                    prev_kf = sorted_keyframes[i]
                    next_kf = sorted_keyframes[i + 1]
                    break

            # Interpolate between keyframes
            if prev_kf['time'] == next_kf['time']:
                factor = 0
            else:
                factor = (current_time - prev_kf['time']) / (next_kf['time'] - prev_kf['time'])

            # Apply easing
            easing = next_kf.get('easing', 'linear')
            factor = EffectEngine._apply_easing(factor, easing)

            if mode == 'strip':
                # Strip mode: Interpolate pixel-by-pixel for LED strips
                await EffectEngine._apply_strip_effect(target_devices, prev_kf, next_kf, factor)
            else:
                # Spot mode: Interpolate all channels uniformly
                await EffectEngine._apply_spot_effect(target_devices, prev_kf, next_kf, factor)

            await asyncio.sleep(frame_duration)

    @staticmethod
    def _apply_easing(t: float, easing: str) -> float:
        """Apply easing function to interpolation factor"""
        if easing == 'ease-in':
            return t * t
        elif easing == 'ease-out':
            return 1 - (1 - t) * (1 - t)
        elif easing == 'ease-in-out':
            return 3 * t * t - 2 * t * t * t
        else:  # linear
            return t

    @staticmethod
    async def _apply_spot_effect(devices_list: List, prev_kf: Dict, next_kf: Dict, factor: float):
        """Apply interpolated values to spot devices (uniform color)"""
        prev_values = prev_kf.get('values', {})
        next_values = next_kf.get('values', {})

        for device in devices_list:
            device_id = device.get('id')

            # Get RGB values from keyframes
            prev_rgb = prev_values.get(device_id, prev_values.get('default', [255, 255, 255]))
            next_rgb = next_values.get(device_id, next_values.get('default', [255, 255, 255]))

            # Interpolate
            interpolated = []
            for i in range(min(len(prev_rgb), len(next_rgb))):
                value = int(prev_rgb[i] + (next_rgb[i] - prev_rgb[i]) * factor)
                interpolated.append(max(0, min(255, value)))

            # Apply to device
            for i in range(len(device['values'])):
                if i < len(interpolated):
                    device['values'][i] = interpolated[i]

            send_device_dmx(device)

    @staticmethod
    async def _apply_strip_effect(devices_list: List, prev_kf: Dict, next_kf: Dict, factor: float):
        """Apply interpolated values to strip devices (pixel-by-pixel)"""
        prev_pattern = prev_kf.get('pattern', {})
        next_pattern = next_kf.get('pattern', {})
        pattern_type = next_kf.get('pattern_type', 'solid')

        for device in devices_list:
            device_id = device.get('id')
            num_channels = len(device['values'])
            channels_per_pixel = 3  # Assume RGB
            num_pixels = num_channels // channels_per_pixel

            if pattern_type == 'wave':
                # Create RGB wave pattern
                wavelength = next_pattern.get('wavelength', 10)
                amplitude = next_pattern.get('amplitude', 255)
                wave_color = next_pattern.get('color', [255, 255, 255])
                offset = factor * wavelength

                for pixel in range(num_pixels):
                    # Calculate wave value for this pixel
                    wave_value = (math.sin((pixel + offset) * 2 * math.pi / wavelength) + 1) / 2
                    brightness_factor = wave_value * (amplitude / 255.0)

                    # Apply to RGB channels
                    for c in range(channels_per_pixel):
                        channel_idx = pixel * channels_per_pixel + c
                        if channel_idx < num_channels:
                            device['values'][channel_idx] = int(wave_color[c] * brightness_factor)

            elif pattern_type == 'gradient':
                # Create gradient across strip with temporal interpolation
                start_color = next_pattern.get('start_color', [255, 0, 0])
                end_color = next_pattern.get('end_color', [0, 0, 255])

                for pixel in range(num_pixels):
                    pixel_factor = pixel / max(1, num_pixels - 1)
                    for c in range(channels_per_pixel):
                        value = int(start_color[c] + (end_color[c] - start_color[c]) * pixel_factor)
                        channel_idx = pixel * channels_per_pixel + c
                        if channel_idx < num_channels:
                            device['values'][channel_idx] = max(0, min(255, value))

            elif pattern_type == 'chase':
                # Moving RGB light chase across strip
                chase_width = next_pattern.get('width', 3)
                chase_color = next_pattern.get('color', [255, 255, 255])
                position = factor * num_pixels  # Position in pixels, not channels

                for pixel in range(num_pixels):
                    distance = abs(pixel - position)
                    if distance < chase_width:
                        brightness_factor = 1 - (distance / chase_width)
                        for c in range(channels_per_pixel):
                            channel_idx = pixel * channels_per_pixel + c
                            if channel_idx < num_channels:
                                device['values'][channel_idx] = int(chase_color[c] * brightness_factor)
                    else:
                        for c in range(channels_per_pixel):
                            channel_idx = pixel * channels_per_pixel + c
                            if channel_idx < num_channels:
                                device['values'][channel_idx] = 0

            else:  # solid or default
                # Uniform color interpolation
                prev_color = prev_pattern.get('color', [255, 255, 255])
                next_color = next_pattern.get('color', [255, 255, 255])

                interpolated = []
                for i in range(3):
                    value = int(prev_color[i] + (next_color[i] - prev_color[i]) * factor)
                    interpolated.append(max(0, min(255, value)))

                # Apply to all pixels
                for i in range(num_channels):
                    device['values'][i] = interpolated[i % 3]

            send_device_dmx(device)


effect_engine = EffectEngine()


# Resource Management & Cleanup
async def cleanup_task(task: asyncio.Task, task_dict: Dict, task_id: str, task_type: str):
    """Cleans up task after completion or cancellation"""
    try:
        await task
    except asyncio.CancelledError:
        logger.info(f"{task_type} {task_id} cancelled")
    except Exception as e:
        logger.error(f"{task_type} {task_id} error: {e}", exc_info=True)
    finally:
        if task_id in task_dict:
            del task_dict[task_id]
            logger.debug(f"{task_type} {task_id} cleaned up")


async def enforce_resource_limits():
    """Enforces resource limits on active effects and sequences"""
    # Check effect limits
    if len(active_effects) >= config.MAX_ACTIVE_EFFECTS:
        logger.warning(f"Effect limit reached ({config.MAX_ACTIVE_EFFECTS}), stopping oldest")
        # Stop oldest effect
        if active_effects:
            oldest_id = next(iter(active_effects))
            active_effects[oldest_id].cancel()
            logger.info(f"Stopped oldest effect: {oldest_id}")

    # Check sequence limits
    if len(active_sequences) >= config.MAX_ACTIVE_SEQUENCES:
        logger.warning(f"Sequence limit reached ({config.MAX_ACTIVE_SEQUENCES}), stopping oldest")
        if active_sequences:
            oldest_id = next(iter(active_sequences))
            active_sequences[oldest_id].cancel()
            logger.info(f"Stopped oldest sequence: {oldest_id}")


async def start_effect(effect_id: str, effect_type: str, target_ids: List[str],
                       params: dict, is_group: bool = False):
    """Startet einen Effekt mit Resource Management"""
    # Enforce resource limits
    await enforce_resource_limits()

    # Stoppe existierenden Effekt
    if effect_id in active_effects:
        active_effects[effect_id].cancel()
        await asyncio.sleep(0.1)  # Give time to cleanup

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
        elif effect_type == 'custom':
            task = asyncio.create_task(
                effect_engine.custom(
                    target_ids,
                    keyframes=params.get('keyframes', []),
                    duration=params.get('duration', 10.0),
                    mode=params.get('mode', 'spot'),
                    is_group=is_group
                )
            )
        else:
            logger.warning(f"Unknown effect type: {effect_type}")
            return False

        # Wrap task with timeout
        async def effect_with_timeout():
            try:
                await asyncio.wait_for(task, timeout=config.EFFECT_TIMEOUT)
            except asyncio.TimeoutError:
                logger.warning(f"Effect {effect_id} timed out after {config.EFFECT_TIMEOUT}s")
                task.cancel()

        timeout_task = asyncio.create_task(effect_with_timeout())
        active_effects[effect_id] = timeout_task

        # Setup cleanup
        asyncio.create_task(cleanup_task(timeout_task, active_effects, effect_id, "Effect"))

        logger.info(f"Started effect {effect_id} (type: {effect_type})")
        return True

    except Exception as e:
        logger.error(f"Error starting effect {effect_id}: {e}", exc_info=True)
        return False


async def stop_effect(effect_id: str):
    """Stoppt einen Effekt"""
    if effect_id in active_effects:
        active_effects[effect_id].cancel()
        del active_effects[effect_id]
        return True
    return False


# Timeline/Sequence Playback Engine
async def play_sequence(sequence_id: str, loop: bool = False):
    """Spielt eine Sequence ab"""
    sequence = next((s for s in sequences if s['id'] == sequence_id), None)
    if not sequence:
        return False

    try:
        while True:
            for step in sequence.get('steps', []):
                step_type = step.get('type')
                duration = step.get('duration', 0) / 1000  # ms to seconds

                if step_type == 'scene':
                    # Activate scene
                    scene_id = step.get('target_id')
                    await activate_scene(scene_id)

                elif step_type == 'effect':
                    # Start effect
                    effect_id = step.get('target_id')
                    effect = next((e for e in effects if e['id'] == effect_id), None)
                    if effect:
                        await start_effect(
                            f"{effect_id}_seq",
                            effect['type'],
                            effect.get('target_ids', []),
                            effect.get('params', {}),
                            effect.get('is_group', False)
                        )

                elif step_type == 'wait':
                    # Just wait
                    pass

                # Wait for step duration
                await asyncio.sleep(duration)

                # Stop effect after duration if it was an effect
                if step_type == 'effect':
                    effect_id = step.get('target_id')
                    await stop_effect(f"{effect_id}_seq")

            # Break if not looping
            if not loop:
                break

        return True

    except asyncio.CancelledError:
        # Clean up on cancel
        return False


async def start_sequence(sequence_id: str):
    """Startet eine Sequence"""
    # Stop existing sequence
    if sequence_id in active_sequences:
        active_sequences[sequence_id].cancel()

    # Get sequence config
    sequence = next((s for s in sequences if s['id'] == sequence_id), None)
    if not sequence:
        return False

    # Start sequence playback
    task = asyncio.create_task(
        play_sequence(sequence_id, sequence.get('loop', False))
    )
    active_sequences[sequence_id] = task

    return True


async def stop_sequence(sequence_id: str):
    """Stoppt eine Sequence"""
    if sequence_id in active_sequences:
        active_sequences[sequence_id].cancel()
        del active_sequences[sequence_id]
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


@app.get("/")
async def root():
    """Serve Frontend"""
    return FileResponse(str(FRONTEND_DIR / "index.html"))


@app.get("/api/devices")
async def get_devices():
    """Gibt alle Geräte zurück"""
    return {"devices": devices}


@app.post("/api/devices")
async def add_device(device_data: DeviceCreate):
    """Fügt neues Gerät hinzu mit Validation"""
    try:
        # Check device limit
        if len(devices) >= config.MAX_DEVICES:
            raise HTTPException(status_code=400, detail=f"Maximum device limit ({config.MAX_DEVICES}) reached")

        # Check for duplicate device on same IP/universe/channel
        for existing in devices:
            if (existing['ip'] == device_data.ip and
                existing['universe'] == device_data.universe and
                existing['start_channel'] == device_data.start_channel):
                raise HTTPException(status_code=400, detail="Device with same IP, universe, and channel already exists")

        device = device_data.model_dump()
        device['id'] = f"device_{int(time.time() * 1000)}"
        device['values'] = [0] * device['channel_count']

        devices.append(device)
        save_devices()

        await broadcast_update({
            'type': 'devices_updated',
            'devices': devices
        })

        logger.info(f"Added device: {device['name']} ({device['id']})")
        return {"success": True, "device": device}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding device: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


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
async def add_scene(scene_data: SceneCreate):
    """Erstellt neue Szene mit Validation"""
    try:
        # Check scene limit
        if len(scenes) >= config.MAX_SCENES:
            raise HTTPException(status_code=400, detail=f"Maximum scene limit ({config.MAX_SCENES}) reached")

        scene = scene_data.model_dump()
        scene['id'] = f"scene_{int(time.time() * 1000)}"

        # If device_values not provided, capture current values
        if not scene.get('device_values'):
            scene['device_values'] = {}
            for device in devices:
                scene['device_values'][device['name']] = device['values'].copy()

        scenes.append(scene)
        save_scenes()

        await broadcast_update({
            'type': 'scenes_updated',
            'scenes': scenes
        })

        logger.info(f"Added scene: {scene['name']} ({scene['id']})")
        return {"success": True, "scene": scene}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding scene: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


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
            {"id": "color_fade", "name": "Farbwechsel", "params": ["speed", "colors"]},
            {"id": "fire", "name": "Feuer", "params": ["speed", "intensity"]},
            {"id": "lightning", "name": "Blitz", "params": ["min_delay", "max_delay"]},
            {"id": "scanner", "name": "Scanner", "params": ["speed", "range"]},
            {"id": "matrix", "name": "Matrix", "params": ["speed", "pattern"]},
            {"id": "twinkle", "name": "Funkeln", "params": ["speed", "density"]}
        ]
    }


@app.post("/api/effects")
async def create_effect(effect_data: EffectCreate):
    """Erstellt und speichert Effekt mit Validation"""
    try:
        effect = effect_data.model_dump()
        effect['id'] = f"effect_{int(time.time() * 1000)}"
        effects.append(effect)
        save_effects()

        await broadcast_update({
            'type': 'effects_updated',
            'effects': effects
        })

        logger.info(f"Created effect: {effect['name']} ({effect['id']})")
        return {"success": True, "effect": effect}

    except Exception as e:
        logger.error(f"Error creating effect: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


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


# Sequence/Timeline API
@app.get("/api/sequences")
async def get_sequences():
    """Gibt alle Sequences zurück"""
    return {"sequences": sequences}


@app.post("/api/sequences")
async def create_sequence(sequence_data: SequenceCreate):
    """Erstellt eine neue Sequence mit Validation"""
    try:
        sequence = sequence_data.model_dump()
        sequence['id'] = f"seq_{int(time.time() * 1000)}"
        sequences.append(sequence)
        save_sequences()

        await broadcast_update({
            'type': 'sequences_updated',
            'sequences': sequences
        })

        logger.info(f"Created sequence: {sequence['name']} ({sequence['id']})")
        return {"success": True, "sequence": sequence}

    except Exception as e:
        logger.error(f"Error creating sequence: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/sequences/{sequence_id}")
async def update_sequence(sequence_id: str, sequence: dict):
    """Aktualisiert eine Sequence"""
    idx = next((i for i, s in enumerate(sequences) if s['id'] == sequence_id), None)
    if idx is not None:
        sequences[idx] = {**sequences[idx], **sequence, 'id': sequence_id}
        save_sequences()

        await broadcast_update({
            'type': 'sequences_updated',
            'sequences': sequences
        })

        return {"success": True}

    return {"success": False, "error": "Sequence not found"}


@app.post("/api/sequences/{sequence_id}/play")
async def play_sequence_endpoint(sequence_id: str):
    """Startet eine Sequence"""
    success = await start_sequence(sequence_id)
    return {"success": success}


@app.post("/api/sequences/{sequence_id}/stop")
async def stop_sequence_endpoint(sequence_id: str):
    """Stoppt eine Sequence"""
    success = await stop_sequence(sequence_id)
    return {"success": success}


@app.delete("/api/sequences/{sequence_id}")
async def delete_sequence(sequence_id: str):
    """Löscht eine Sequence"""
    global sequences

    # Stop sequence if active
    await stop_sequence(sequence_id)

    sequences = [s for s in sequences if s['id'] != sequence_id]
    save_sequences()

    await broadcast_update({
        'type': 'sequences_updated',
        'sequences': sequences
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
        'effects': effects,
        'sequences': sequences
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

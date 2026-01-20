"""Configuration and paths for DMX Web Controller"""
from pathlib import Path


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
BASE_DIR = Path(__file__).parent.parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"
if not FRONTEND_DIR.exists():
    FRONTEND_DIR = Path("/app/frontend")  # Docker fallback

# Data paths
DATA_DIR = Path("/data") if Path("/data").exists() else BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)
BACKUP_DIR = DATA_DIR / "backups"
BACKUP_DIR.mkdir(exist_ok=True)
CONFIG_FILE = DATA_DIR / "dmx_config.json"
SCENES_FILE = DATA_DIR / "dmx_scenes.json"
GROUPS_FILE = DATA_DIR / "dmx_groups.json"
EFFECTS_FILE = DATA_DIR / "dmx_effects.json"
SEQUENCES_FILE = DATA_DIR / "dmx_sequences.json"

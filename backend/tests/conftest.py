"""
Pytest configuration and shared fixtures for DMX Web Controller tests.
"""
import pytest
import asyncio
from typing import Generator
from fastapi.testclient import TestClient


@pytest.fixture(scope="session")
def event_loop() -> Generator:
    """Create an event loop for async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def client() -> TestClient:
    """Create a test client for the FastAPI app."""
    # Import here to avoid circular imports
    from backend.main import app
    return TestClient(app)


@pytest.fixture
def sample_device() -> dict:
    """Sample device configuration for testing."""
    return {
        "name": "Test RGB Light",
        "ip": "192.168.1.100",
        "universe": 0,
        "start_channel": 1,
        "type": "rgb"
    }


@pytest.fixture
def sample_scene() -> dict:
    """Sample scene configuration for testing."""
    return {
        "name": "Test Scene",
        "color": "#ff0000",
        "device_values": {
            "device_1": [255, 0, 0]
        }
    }


@pytest.fixture
def sample_group() -> dict:
    """Sample group configuration for testing."""
    return {
        "name": "Test Group",
        "device_ids": ["device_1", "device_2"]
    }


@pytest.fixture
def sample_effect() -> dict:
    """Sample effect configuration for testing."""
    return {
        "name": "Test Rainbow",
        "type": "rainbow",
        "target_ids": ["device_1"],
        "params": {
            "speed": 1.0,
            "intensity": 200
        },
        "is_group": False
    }


@pytest.fixture
def sample_custom_effect_spot() -> dict:
    """Sample custom effect for spot mode."""
    return {
        "name": "Test Spot Effect",
        "type": "custom",
        "target_ids": ["device_1"],
        "params": {
            "keyframes": [
                {"time": 0, "values": {"default": [255, 0, 0]}, "easing": "linear"},
                {"time": 100, "values": {"default": [0, 0, 255]}, "easing": "linear"}
            ],
            "duration": 5.0,
            "mode": "spot"
        },
        "is_group": False
    }


@pytest.fixture
def sample_custom_effect_strip() -> dict:
    """Sample custom effect for strip mode."""
    return {
        "name": "Test Strip Effect",
        "type": "custom",
        "target_ids": ["device_1"],
        "params": {
            "keyframes": [
                {
                    "time": 0,
                    "pattern_type": "wave",
                    "pattern": {
                        "color": [255, 0, 0],
                        "wavelength": 10,
                        "amplitude": 255
                    },
                    "easing": "linear"
                }
            ],
            "duration": 5.0,
            "mode": "strip"
        },
        "is_group": False
    }


@pytest.fixture
def sample_sequence() -> dict:
    """Sample sequence configuration for testing."""
    return {
        "name": "Test Sequence",
        "steps": [
            {"type": "scene", "id": "scene_1", "duration": 5},
            {"type": "effect", "id": "effect_1", "duration": 10},
            {"type": "pause", "duration": 2}
        ],
        "loop": False
    }

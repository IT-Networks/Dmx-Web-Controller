"""
Tests for main API endpoints and basic functionality.
"""
import pytest
from fastapi.testclient import TestClient


class TestHealthEndpoints:
    """Test health and status endpoints."""

    def test_root_endpoint(self, client: TestClient):
        """Test root endpoint returns HTML."""
        response = client.get("/")
        assert response.status_code == 200
        assert "text/html" in response.headers["content-type"]

    def test_docs_endpoint(self, client: TestClient):
        """Test API docs are accessible."""
        response = client.get("/docs")
        assert response.status_code == 200


class TestDeviceEndpoints:
    """Test device management endpoints."""

    def test_get_devices_empty(self, client: TestClient):
        """Test getting devices returns empty list initially."""
        response = client.get("/api/devices")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_add_device_rgb(self, client: TestClient, sample_device: dict):
        """Test adding an RGB device."""
        response = client.post("/api/devices", json=sample_device)
        assert response.status_code == 200
        data = response.json()
        assert "device" in data
        assert data["device"]["name"] == sample_device["name"]
        assert data["device"]["type"] == "rgb"

    def test_add_device_invalid_ip(self, client: TestClient):
        """Test adding device with invalid IP fails."""
        invalid_device = {
            "name": "Invalid Device",
            "ip": "not-an-ip",
            "universe": 0,
            "start_channel": 1,
            "type": "rgb"
        }
        response = client.post("/api/devices", json=invalid_device)
        assert response.status_code == 422  # Validation error

    def test_add_device_invalid_channel(self, client: TestClient):
        """Test adding device with invalid channel fails."""
        invalid_device = {
            "name": "Invalid Device",
            "ip": "192.168.1.100",
            "universe": 0,
            "start_channel": 600,  # > 512
            "type": "rgb"
        }
        response = client.post("/api/devices", json=invalid_device)
        assert response.status_code == 422

    def test_update_device_values(self, client: TestClient, sample_device: dict):
        """Test updating device channel values."""
        # First add device
        add_response = client.post("/api/devices", json=sample_device)
        device_id = add_response.json()["device"]["id"]

        # Update values
        update_data = {
            "device_id": device_id,
            "values": [255, 128, 64]
        }
        response = client.post("/api/devices/values", json=update_data)
        assert response.status_code == 200
        assert response.json()["success"] is True

    def test_delete_device(self, client: TestClient, sample_device: dict):
        """Test deleting a device."""
        # First add device
        add_response = client.post("/api/devices", json=sample_device)
        device_id = add_response.json()["device"]["id"]

        # Delete device
        response = client.delete(f"/api/devices/{device_id}")
        assert response.status_code == 200
        assert response.json()["success"] is True


class TestSceneEndpoints:
    """Test scene management endpoints."""

    def test_get_scenes_empty(self, client: TestClient):
        """Test getting scenes returns empty list initially."""
        response = client.get("/api/scenes")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_create_scene(self, client: TestClient, sample_scene: dict):
        """Test creating a scene."""
        response = client.post("/api/scenes", json=sample_scene)
        assert response.status_code == 200
        data = response.json()
        assert "scene" in data
        assert data["scene"]["name"] == sample_scene["name"]

    def test_activate_scene(self, client: TestClient, sample_scene: dict):
        """Test activating a scene."""
        # First create scene
        create_response = client.post("/api/scenes", json=sample_scene)
        scene_id = create_response.json()["scene"]["id"]

        # Activate scene
        response = client.post(f"/api/scenes/{scene_id}/activate")
        assert response.status_code == 200
        assert response.json()["success"] is True

    def test_delete_scene(self, client: TestClient, sample_scene: dict):
        """Test deleting a scene."""
        # First create scene
        create_response = client.post("/api/scenes", json=sample_scene)
        scene_id = create_response.json()["scene"]["id"]

        # Delete scene
        response = client.delete(f"/api/scenes/{scene_id}")
        assert response.status_code == 200
        assert response.json()["success"] is True


class TestGroupEndpoints:
    """Test group management endpoints."""

    def test_get_groups_empty(self, client: TestClient):
        """Test getting groups returns empty list initially."""
        response = client.get("/api/groups")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_create_group(self, client: TestClient, sample_group: dict):
        """Test creating a group."""
        response = client.post("/api/groups", json=sample_group)
        assert response.status_code == 200
        data = response.json()
        assert "group" in data
        assert data["group"]["name"] == sample_group["name"]

    def test_create_group_empty_devices(self, client: TestClient):
        """Test creating group with no devices fails."""
        invalid_group = {
            "name": "Empty Group",
            "device_ids": []
        }
        response = client.post("/api/groups", json=invalid_group)
        assert response.status_code == 422  # Validation error

    def test_set_group_master(self, client: TestClient, sample_group: dict):
        """Test setting group master intensity."""
        # First create group
        create_response = client.post("/api/groups", json=sample_group)
        group_id = create_response.json()["group"]["id"]

        # Set master
        update_data = {
            "group_id": group_id,
            "master": 128
        }
        response = client.post("/api/groups/master", json=update_data)
        assert response.status_code == 200


class TestEffectEndpoints:
    """Test effect management endpoints."""

    def test_get_effects_empty(self, client: TestClient):
        """Test getting effects returns empty list initially."""
        response = client.get("/api/effects")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_create_rainbow_effect(self, client: TestClient, sample_effect: dict):
        """Test creating a rainbow effect."""
        response = client.post("/api/effects", json=sample_effect)
        assert response.status_code == 200
        data = response.json()
        assert "effect" in data
        assert data["effect"]["type"] == "rainbow"

    def test_start_effect(self, client: TestClient, sample_effect: dict):
        """Test starting an effect."""
        # First create effect
        create_response = client.post("/api/effects", json=sample_effect)
        effect_id = create_response.json()["effect"]["id"]

        # Start effect
        response = client.post(f"/api/effects/{effect_id}/start")
        assert response.status_code == 200

    def test_stop_effect(self, client: TestClient, sample_effect: dict):
        """Test stopping an effect."""
        # First create and start effect
        create_response = client.post("/api/effects", json=sample_effect)
        effect_id = create_response.json()["effect"]["id"]
        client.post(f"/api/effects/{effect_id}/start")

        # Stop effect
        response = client.post(f"/api/effects/{effect_id}/stop")
        assert response.status_code == 200

    def test_delete_effect(self, client: TestClient, sample_effect: dict):
        """Test deleting an effect."""
        # First create effect
        create_response = client.post("/api/effects", json=sample_effect)
        effect_id = create_response.json()["effect"]["id"]

        # Delete effect
        response = client.delete(f"/api/effects/{effect_id}")
        assert response.status_code == 200


class TestFixtureLibrary:
    """Test fixture library endpoints."""

    def test_get_fixtures(self, client: TestClient):
        """Test getting fixture library."""
        response = client.get("/api/fixtures")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Should have fixtures from fixtures.json
        assert len(data) > 0

    def test_fixtures_have_required_fields(self, client: TestClient):
        """Test fixtures have all required fields."""
        response = client.get("/api/fixtures")
        fixtures = response.json()

        for fixture in fixtures:
            assert "name" in fixture
            assert "manufacturer" in fixture
            assert "type" in fixture
            assert "channels" in fixture

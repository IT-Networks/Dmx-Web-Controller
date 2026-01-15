"""
Tests for main API endpoints of DMX Web Controller.
"""
import pytest
from fastapi.testclient import TestClient


class TestHealthEndpoints:
    """Test health check and documentation endpoints."""

    def test_root_endpoint(self, client: TestClient):
        """Test root endpoint returns 200."""
        response = client.get("/")
        assert response.status_code == 200

    def test_docs_endpoint(self, client: TestClient):
        """Test OpenAPI docs are available."""
        response = client.get("/docs")
        assert response.status_code == 200


class TestDeviceEndpoints:
    """Test device management endpoints."""

    def test_get_devices(self, client: TestClient):
        """Test getting device list."""
        response = client.get("/api/devices")
        assert response.status_code == 200
        data = response.json()
        assert "devices" in data
        assert isinstance(data["devices"], list)

    def test_add_device_rgb(self, client: TestClient, sample_device: dict):
        """Test adding an RGB device."""
        response = client.post("/api/devices", json=sample_device)
        assert response.status_code == 200
        data = response.json()
        assert "device" in data

    def test_update_device_values(self, client: TestClient, sample_device: dict):
        """Test updating device values."""
        # First add a device
        add_response = client.post("/api/devices", json=sample_device)
        assert add_response.status_code == 200
        device_id = add_response.json()["device"]["id"]

        # Then update its values
        values = {"values": [255, 128, 64]}
        response = client.post(f"/api/devices/{device_id}/values", json=values)
        assert response.status_code == 200


class TestSceneEndpoints:
    """Test scene management endpoints."""

    def test_get_scenes(self, client: TestClient):
        """Test getting scenes list."""
        response = client.get("/api/scenes")
        assert response.status_code == 200
        data = response.json()
        assert "scenes" in data
        assert isinstance(data["scenes"], list)

    def test_create_scene(self, client: TestClient, sample_scene: dict):
        """Test creating a scene."""
        response = client.post("/api/scenes", json=sample_scene)
        assert response.status_code == 200
        data = response.json()
        assert "scene" in data

    def test_activate_scene(self, client: TestClient, sample_scene: dict):
        """Test activating a scene."""
        # First create a scene
        create_response = client.post("/api/scenes", json=sample_scene)
        assert create_response.status_code == 200
        scene_id = create_response.json()["scene"]["id"]

        # Then activate it
        response = client.post(f"/api/scenes/{scene_id}/activate")
        assert response.status_code == 200

    def test_delete_scene(self, client: TestClient, sample_scene: dict):
        """Test deleting a scene."""
        # First create a scene
        create_response = client.post("/api/scenes", json=sample_scene)
        assert create_response.status_code == 200
        scene_id = create_response.json()["scene"]["id"]

        # Then delete it
        response = client.delete(f"/api/scenes/{scene_id}")
        assert response.status_code == 200


class TestGroupEndpoints:
    """Test group management endpoints."""

    def test_get_groups(self, client: TestClient):
        """Test getting groups list."""
        response = client.get("/api/groups")
        assert response.status_code == 200
        data = response.json()
        assert "groups" in data
        assert isinstance(data["groups"], list)

    def test_create_group(self, client: TestClient, sample_group: dict):
        """Test creating a group."""
        response = client.post("/api/groups", json=sample_group)
        assert response.status_code == 200
        data = response.json()
        assert "group" in data


class TestEffectEndpoints:
    """Test effect management endpoints."""

    def test_get_effects(self, client: TestClient):
        """Test getting effects list."""
        response = client.get("/api/effects")
        assert response.status_code == 200
        data = response.json()
        assert "effects" in data
        assert isinstance(data["effects"], list)

    def test_create_rainbow_effect(self, client: TestClient, sample_effect: dict):
        """Test creating a rainbow effect."""
        response = client.post("/api/effects", json=sample_effect)
        assert response.status_code == 200
        data = response.json()
        assert "effect" in data

    def test_start_effect(self, client: TestClient, sample_effect: dict):
        """Test starting an effect."""
        # First create an effect
        create_response = client.post("/api/effects", json=sample_effect)
        assert create_response.status_code == 200
        effect_id = create_response.json()["effect"]["id"]

        # Then start it
        response = client.post(f"/api/effects/{effect_id}/start")
        assert response.status_code == 200

    def test_stop_effect(self, client: TestClient, sample_effect: dict):
        """Test stopping an effect."""
        # First create and start an effect
        create_response = client.post("/api/effects", json=sample_effect)
        assert create_response.status_code == 200
        effect_id = create_response.json()["effect"]["id"]

        client.post(f"/api/effects/{effect_id}/start")

        # Then stop it
        response = client.post(f"/api/effects/{effect_id}/stop")
        assert response.status_code == 200

    def test_delete_effect(self, client: TestClient, sample_effect: dict):
        """Test deleting an effect."""
        # First create an effect
        create_response = client.post("/api/effects", json=sample_effect)
        assert create_response.status_code == 200
        effect_id = create_response.json()["effect"]["id"]

        # Then delete it
        response = client.delete(f"/api/effects/{effect_id}")
        assert response.status_code == 200


class TestFixtureLibrary:
    """Test fixture library endpoints."""

    def test_get_fixtures(self, client: TestClient):
        """Test getting fixtures library."""
        response = client.get("/api/fixtures")
        assert response.status_code == 200
        data = response.json()
        assert "fixtures" in data
        assert isinstance(data["fixtures"], list)

    def test_fixtures_have_required_fields(self, client: TestClient):
        """Test that fixtures have required fields."""
        response = client.get("/api/fixtures")
        data = response.json()
        fixtures = data.get("fixtures", [])

        if len(fixtures) > 0:
            fixture = fixtures[0]
            assert "id" in fixture
            assert "name" in fixture
            assert "manufacturer" in fixture
            assert "channels" in fixture

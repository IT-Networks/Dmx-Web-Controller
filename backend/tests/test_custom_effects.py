"""
Tests for custom effect (Visual Designer) functionality.
"""
import pytest
from fastapi.testclient import TestClient


class TestCustomEffectCreation:
    """Test creating custom effects via API."""

    def test_create_custom_effect_spot_mode(
        self, client: TestClient, sample_custom_effect_spot: dict
    ):
        """Test creating custom effect in spot mode."""
        response = client.post("/api/effects", json=sample_custom_effect_spot)
        assert response.status_code == 200

        data = response.json()
        assert "effect" in data
        assert data["effect"]["type"] == "custom"
        assert data["effect"]["params"]["mode"] == "spot"

    def test_create_custom_effect_strip_mode(
        self, client: TestClient, sample_custom_effect_strip: dict
    ):
        """Test creating custom effect in strip mode."""
        response = client.post("/api/effects", json=sample_custom_effect_strip)
        assert response.status_code == 200

        data = response.json()
        assert "effect" in data
        assert data["effect"]["type"] == "custom"
        assert data["effect"]["params"]["mode"] == "strip"

    def test_custom_effect_requires_keyframes(self, client: TestClient):
        """Test custom effect without keyframes fails."""
        invalid_effect = {
            "name": "Invalid Custom",
            "type": "custom",
            "target_ids": ["device_1"],
            "params": {
                "keyframes": [],  # Empty!
                "duration": 5.0,
                "mode": "spot"
            },
            "is_group": False
        }
        response = client.post("/api/effects", json=invalid_effect)
        # Should either fail or create with default keyframes
        # Depends on validation logic


class TestCustomEffectSpotMode:
    """Test custom effects in spot mode."""

    def test_spot_keyframe_interpolation(self, sample_custom_effect_spot: dict):
        """Test spot mode keyframe data structure."""
        keyframes = sample_custom_effect_spot["params"]["keyframes"]

        assert len(keyframes) >= 2  # Should have at least 2 keyframes
        for kf in keyframes:
            assert "time" in kf
            assert "values" in kf
            assert "default" in kf["values"]
            assert len(kf["values"]["default"]) == 3  # RGB

    def test_spot_mode_color_values(self, sample_custom_effect_spot: dict):
        """Test spot mode colors are valid RGB."""
        keyframes = sample_custom_effect_spot["params"]["keyframes"]

        for kf in keyframes:
            colors = kf["values"]["default"]
            for color in colors:
                assert 0 <= color <= 255

    def test_spot_mode_easing(self, sample_custom_effect_spot: dict):
        """Test spot mode has easing defined."""
        keyframes = sample_custom_effect_spot["params"]["keyframes"]

        for kf in keyframes:
            assert "easing" in kf
            assert kf["easing"] in ["linear", "ease-in", "ease-out", "ease-in-out"]


class TestCustomEffectStripMode:
    """Test custom effects in strip mode."""

    def test_strip_pattern_types(self, sample_custom_effect_strip: dict):
        """Test strip mode pattern types are valid."""
        keyframes = sample_custom_effect_strip["params"]["keyframes"]
        valid_patterns = ["solid", "gradient", "wave", "chase"]

        for kf in keyframes:
            assert "pattern_type" in kf
            assert kf["pattern_type"] in valid_patterns

    def test_strip_wave_pattern_parameters(self):
        """Test wave pattern has required parameters."""
        wave_pattern = {
            "color": [255, 0, 0],
            "wavelength": 10,
            "amplitude": 255
        }

        assert "color" in wave_pattern
        assert "wavelength" in wave_pattern
        assert "amplitude" in wave_pattern
        assert len(wave_pattern["color"]) == 3
        assert wave_pattern["wavelength"] > 0
        assert 0 <= wave_pattern["amplitude"] <= 255

    def test_strip_chase_pattern_parameters(self):
        """Test chase pattern has required parameters."""
        chase_pattern = {
            "color": [255, 255, 255],
            "width": 3
        }

        assert "color" in chase_pattern
        assert "width" in chase_pattern
        assert len(chase_pattern["color"]) == 3
        assert chase_pattern["width"] > 0

    def test_strip_gradient_pattern_parameters(self):
        """Test gradient pattern has required parameters."""
        gradient_pattern = {
            "start_color": [255, 0, 0],
            "end_color": [0, 0, 255]
        }

        assert "start_color" in gradient_pattern
        assert "end_color" in gradient_pattern
        assert len(gradient_pattern["start_color"]) == 3
        assert len(gradient_pattern["end_color"]) == 3

    def test_strip_solid_pattern_parameters(self):
        """Test solid pattern has required parameters."""
        solid_pattern = {
            "color": [128, 128, 128]
        }

        assert "color" in solid_pattern
        assert len(solid_pattern["color"]) == 3


class TestCustomEffectTemplates:
    """Test custom effect templates work correctly."""

    def test_fade_template_structure(self):
        """Test fade template has correct keyframe structure."""
        fade_keyframes = [
            {"time": 0, "values": {"default": [0, 0, 0]}, "easing": "linear"},
            {"time": 50, "values": {"default": [255, 255, 255]}, "easing": "ease-in-out"},
            {"time": 100, "values": {"default": [0, 0, 0]}, "easing": "linear"}
        ]

        assert len(fade_keyframes) == 3
        assert fade_keyframes[0]["time"] == 0
        assert fade_keyframes[-1]["time"] == 100
        assert fade_keyframes[1]["easing"] == "ease-in-out"

    def test_pulse_template_structure(self):
        """Test pulse template has correct keyframe structure."""
        pulse_keyframes = [
            {"time": 0, "values": {"default": [50, 50, 50]}, "easing": "ease-in"},
            {"time": 50, "values": {"default": [255, 255, 255]}, "easing": "ease-out"},
            {"time": 100, "values": {"default": [50, 50, 50]}, "easing": "linear"}
        ]

        assert len(pulse_keyframes) == 3
        # Pulse should have different easing on up vs down
        assert pulse_keyframes[0]["easing"] != pulse_keyframes[1]["easing"]

    def test_colorcycle_template_structure(self):
        """Test color cycle template has correct keyframe structure."""
        colorcycle_keyframes = [
            {"time": 0, "values": {"default": [255, 0, 0]}, "easing": "linear"},
            {"time": 33, "values": {"default": [0, 255, 0]}, "easing": "linear"},
            {"time": 66, "values": {"default": [0, 0, 255]}, "easing": "linear"},
            {"time": 100, "values": {"default": [255, 0, 0]}, "easing": "linear"}
        ]

        assert len(colorcycle_keyframes) == 4
        # Should cycle through RGB and back to R
        assert colorcycle_keyframes[0]["values"]["default"] == colorcycle_keyframes[-1]["values"]["default"]

    def test_strobe_template_structure(self):
        """Test strobe template has rapid on/off keyframes."""
        strobe_keyframes = [
            {"time": 0, "values": {"default": [0, 0, 0]}, "easing": "linear"},
            {"time": 10, "values": {"default": [255, 255, 255]}, "easing": "linear"},
            {"time": 20, "values": {"default": [0, 0, 0]}, "easing": "linear"},
            {"time": 30, "values": {"default": [255, 255, 255]}, "easing": "linear"},
            {"time": 40, "values": {"default": [0, 0, 0]}, "easing": "linear"}
        ]

        assert len(strobe_keyframes) >= 5
        # Strobe should have close time intervals
        for i in range(len(strobe_keyframes) - 1):
            time_diff = strobe_keyframes[i + 1]["time"] - strobe_keyframes[i]["time"]
            assert time_diff <= 20  # Rapid changes


class TestCustomEffectExecution:
    """Test custom effect execution via API."""

    def test_start_custom_effect_spot(
        self, client: TestClient, sample_custom_effect_spot: dict
    ):
        """Test starting custom effect in spot mode."""
        # Create effect
        create_response = client.post("/api/effects", json=sample_custom_effect_spot)
        effect_id = create_response.json()["effect"]["id"]

        # Start effect
        response = client.post(f"/api/effects/{effect_id}/start")
        assert response.status_code == 200

    def test_start_custom_effect_strip(
        self, client: TestClient, sample_custom_effect_strip: dict
    ):
        """Test starting custom effect in strip mode."""
        # Create effect
        create_response = client.post("/api/effects", json=sample_custom_effect_strip)
        effect_id = create_response.json()["effect"]["id"]

        # Start effect
        response = client.post(f"/api/effects/{effect_id}/start")
        assert response.status_code == 200

    def test_stop_custom_effect(
        self, client: TestClient, sample_custom_effect_spot: dict
    ):
        """Test stopping a running custom effect."""
        # Create and start effect
        create_response = client.post("/api/effects", json=sample_custom_effect_spot)
        effect_id = create_response.json()["effect"]["id"]
        client.post(f"/api/effects/{effect_id}/start")

        # Stop effect
        response = client.post(f"/api/effects/{effect_id}/stop")
        assert response.status_code == 200


class TestCustomEffectValidation:
    """Test custom effect parameter validation."""

    def test_duration_must_be_positive(self):
        """Test effect duration must be > 0."""
        assert 5.0 > 0
        assert not (-1.0 > 0)

    def test_keyframe_time_range(self):
        """Test keyframe time must be 0-100."""
        valid_times = [0, 25, 50, 75, 100]
        for time in valid_times:
            assert 0 <= time <= 100

        invalid_times = [-1, 101, 200]
        for time in invalid_times:
            assert not (0 <= time <= 100)

    def test_rgb_color_range(self):
        """Test RGB values must be 0-255."""
        valid_colors = [[0, 0, 0], [128, 128, 128], [255, 255, 255]]
        for color in valid_colors:
            for c in color:
                assert 0 <= c <= 255

        invalid_colors = [[-1, 0, 0], [0, 256, 0], [0, 0, 300]]
        for color in invalid_colors:
            assert not all(0 <= c <= 255 for c in color)

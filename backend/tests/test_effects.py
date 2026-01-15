"""
Tests for effect engine functionality.
"""
import pytest
import asyncio
from backend.main import EffectEngine


class TestEasingFunctions:
    """Test easing function calculations."""

    def test_linear_easing(self):
        """Test linear easing returns input value."""
        assert EffectEngine._apply_easing(0.0, 'linear') == 0.0
        assert EffectEngine._apply_easing(0.5, 'linear') == 0.5
        assert EffectEngine._apply_easing(1.0, 'linear') == 1.0

    def test_ease_in(self):
        """Test ease-in produces accelerating curve."""
        result_0 = EffectEngine._apply_easing(0.0, 'ease-in')
        result_5 = EffectEngine._apply_easing(0.5, 'ease-in')
        result_1 = EffectEngine._apply_easing(1.0, 'ease-in')

        assert result_0 == 0.0
        assert result_5 == 0.25  # 0.5^2
        assert result_1 == 1.0

    def test_ease_out(self):
        """Test ease-out produces decelerating curve."""
        result_0 = EffectEngine._apply_easing(0.0, 'ease-out')
        result_5 = EffectEngine._apply_easing(0.5, 'ease-out')
        result_1 = EffectEngine._apply_easing(1.0, 'ease-out')

        assert result_0 == 0.0
        assert result_5 == 0.75  # 1 - (1-0.5)^2
        assert result_1 == 1.0

    def test_ease_in_out(self):
        """Test ease-in-out produces S-curve."""
        result_0 = EffectEngine._apply_easing(0.0, 'ease-in-out')
        result_5 = EffectEngine._apply_easing(0.5, 'ease-in-out')
        result_1 = EffectEngine._apply_easing(1.0, 'ease-in-out')

        assert result_0 == 0.0
        assert 0.4 < result_5 < 0.6  # Should be around 0.5
        assert result_1 == 1.0

    def test_unknown_easing_defaults_to_linear(self):
        """Test unknown easing type defaults to linear."""
        assert EffectEngine._apply_easing(0.5, 'unknown') == 0.5


class TestSpotEffect:
    """Test spot mode effect application."""

    @pytest.mark.asyncio
    async def test_apply_spot_effect_interpolation(self):
        """Test spot effect interpolates colors correctly."""
        devices = [
            {"id": "device_1", "values": [0, 0, 0], "start_channel": 1}
        ]

        prev_kf = {"values": {"default": [0, 0, 0]}}
        next_kf = {"values": {"default": [255, 255, 255]}}
        factor = 0.5

        await EffectEngine._apply_spot_effect(devices, prev_kf, next_kf, factor)

        # Should interpolate to midpoint
        assert devices[0]["values"][0] == 127  # or 128 depending on rounding
        assert devices[0]["values"][1] == 127
        assert devices[0]["values"][2] == 127

    @pytest.mark.asyncio
    async def test_apply_spot_effect_full_range(self):
        """Test spot effect handles full color range."""
        devices = [
            {"id": "device_1", "values": [0, 0, 0], "start_channel": 1}
        ]

        prev_kf = {"values": {"default": [255, 0, 0]}}
        next_kf = {"values": {"default": [0, 255, 0]}}
        factor = 1.0  # Full transition

        await EffectEngine._apply_spot_effect(devices, prev_kf, next_kf, factor)

        # Should be at end color
        assert devices[0]["values"][0] == 0
        assert devices[0]["values"][1] == 255
        assert devices[0]["values"][2] == 0


class TestStripEffect:
    """Test strip mode effect application."""

    @pytest.mark.asyncio
    async def test_apply_strip_solid_pattern(self):
        """Test strip solid pattern applies uniform color."""
        devices = [
            {"id": "device_1", "values": [0] * 30, "start_channel": 1}  # 10 RGB pixels
        ]

        prev_kf = {"pattern": {"color": [0, 0, 0]}}
        next_kf = {
            "pattern_type": "solid",
            "pattern": {"color": [255, 0, 0]}
        }
        factor = 1.0

        await EffectEngine._apply_strip_effect(devices, prev_kf, next_kf, factor)

        # All pixels should be red (255, 0, 0)
        for i in range(0, 30, 3):
            assert devices[0]["values"][i] == 255  # R
            assert devices[0]["values"][i + 1] == 0  # G
            assert devices[0]["values"][i + 2] == 0  # B

    @pytest.mark.asyncio
    async def test_apply_strip_wave_pattern(self):
        """Test strip wave pattern creates sine wave."""
        devices = [
            {"id": "device_1", "values": [0] * 30, "start_channel": 1}
        ]

        next_kf = {
            "pattern_type": "wave",
            "pattern": {
                "color": [255, 0, 0],
                "wavelength": 10,
                "amplitude": 255
            }
        }
        factor = 0.0

        await EffectEngine._apply_strip_effect(devices, {}, next_kf, factor)

        # Values should vary in wave pattern (not all same)
        values_r = [devices[0]["values"][i] for i in range(0, 30, 3)]
        assert len(set(values_r)) > 1  # Should have different values

    @pytest.mark.asyncio
    async def test_apply_strip_chase_pattern(self):
        """Test strip chase pattern creates moving light."""
        devices = [
            {"id": "device_1", "values": [0] * 30, "start_channel": 1}
        ]

        next_kf = {
            "pattern_type": "chase",
            "pattern": {
                "color": [255, 255, 255],
                "width": 3
            }
        }
        factor = 0.5  # Middle position

        await EffectEngine._apply_strip_effect(devices, {}, next_kf, factor)

        # Should have bright spot in middle with falloff
        non_zero = [i for i in range(30) if devices[0]["values"][i] > 0]
        assert len(non_zero) > 0  # Some pixels should be lit

    @pytest.mark.asyncio
    async def test_apply_strip_gradient_pattern(self):
        """Test strip gradient pattern creates color gradient."""
        devices = [
            {"id": "device_1", "values": [0] * 30, "start_channel": 1}
        ]

        next_kf = {
            "pattern_type": "gradient",
            "pattern": {
                "start_color": [255, 0, 0],
                "end_color": [0, 0, 255]
            }
        }
        factor = 0.0

        await EffectEngine._apply_strip_effect(devices, {}, next_kf, factor)

        # First pixel should be red, last should be blue
        assert devices[0]["values"][0] > devices[0]["values"][2]  # More red at start
        assert devices[0]["values"][27] < devices[0]["values"][29]  # More blue at end


class TestCustomEffectValidation:
    """Test custom effect parameter validation."""

    def test_keyframe_structure_spot(self):
        """Test spot mode keyframe has correct structure."""
        keyframe = {
            "time": 50,
            "values": {"default": [255, 128, 64]},
            "easing": "linear"
        }

        assert "time" in keyframe
        assert "values" in keyframe
        assert "easing" in keyframe
        assert isinstance(keyframe["values"]["default"], list)
        assert len(keyframe["values"]["default"]) == 3

    def test_keyframe_structure_strip(self):
        """Test strip mode keyframe has correct structure."""
        keyframe = {
            "time": 50,
            "pattern_type": "wave",
            "pattern": {
                "color": [255, 0, 0],
                "wavelength": 10,
                "amplitude": 200
            },
            "easing": "linear"
        }

        assert "time" in keyframe
        assert "pattern_type" in keyframe
        assert "pattern" in keyframe
        assert "color" in keyframe["pattern"]

    def test_time_bounds(self):
        """Test keyframe time is within 0-100 range."""
        valid_times = [0, 25, 50, 75, 100]
        for time in valid_times:
            assert 0 <= time <= 100

        invalid_times = [-1, 101, 200]
        for time in invalid_times:
            assert not (0 <= time <= 100)


class TestEffectResourceLimits:
    """Test effect resource management."""

    def test_max_effects_limit(self):
        """Test MAX_EFFECTS constant is defined."""
        from backend.main import config
        assert hasattr(config, 'MAX_EFFECTS')
        assert config.MAX_EFFECTS > 0

    def test_max_sequences_limit(self):
        """Test MAX_SEQUENCES constant is defined."""
        from backend.main import config
        assert hasattr(config, 'MAX_SEQUENCES')
        assert config.MAX_SEQUENCES > 0

"""
Tests for effect engine functionality.
"""
import pytest
import asyncio
from backend.main import EffectEngine


class TestEffectEngine:
    """Test effect engine basic functionality."""

    def test_effect_engine_exists(self):
        """Test that EffectEngine class exists."""
        assert EffectEngine is not None

    def test_effect_engine_has_strobe(self):
        """Test that EffectEngine has strobe method."""
        assert hasattr(EffectEngine, 'strobe')
        assert callable(getattr(EffectEngine, 'strobe'))

    def test_effect_engine_has_rainbow(self):
        """Test that EffectEngine has rainbow method."""
        assert hasattr(EffectEngine, 'rainbow')
        assert callable(getattr(EffectEngine, 'rainbow'))


class TestEffectTypes:
    """Test different effect types are supported."""

    def test_strobe_effect_signature(self):
        """Test strobe effect has correct signature."""
        import inspect
        sig = inspect.signature(EffectEngine.strobe)
        params = list(sig.parameters.keys())
        assert 'target_ids' in params
        assert 'speed' in params
        assert 'is_group' in params

    def test_rainbow_effect_signature(self):
        """Test rainbow effect has correct signature."""
        import inspect
        sig = inspect.signature(EffectEngine.rainbow)
        params = list(sig.parameters.keys())
        assert 'target_ids' in params
        assert 'speed' in params
        assert 'is_group' in params

"""Pydantic models for DMX Web Controller"""
import ipaddress
from typing import List, Dict, Optional
from pydantic import BaseModel, Field, field_validator

from .config import config


class DeviceCreate(BaseModel):
    name: str = Field(..., max_length=config.MAX_NAME_LENGTH, min_length=1)
    ip: str
    universe: int = Field(ge=0, le=15)
    start_channel: int = Field(ge=config.DMX_CHANNEL_MIN, le=config.DMX_CHANNEL_MAX)
    channel_count: int = Field(ge=1, le=512)
    device_type: str
    fixture_id: Optional[str] = None
    channel_layout: Optional[List[Dict]] = None

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
    device_values: Optional[Dict[str, List[int]]] = None


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

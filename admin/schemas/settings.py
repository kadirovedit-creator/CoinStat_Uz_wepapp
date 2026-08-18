"""Settings schemas"""
from datetime import datetime
from pydantic import BaseModel


class SettingUpdate(BaseModel):
    key: str
    value: str


class SettingInfo(BaseModel):
    id: int
    key: str
    value: str
    description: str | None = None
    category: str = "general"
    updated_at: datetime | None = None
    updated_by: int | None = None

    class Config:
        from_attributes = True


class SettingsListResponse(BaseModel):
    settings: list[SettingInfo]

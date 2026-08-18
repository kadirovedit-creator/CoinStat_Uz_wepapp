"""Broadcast schemas"""
from datetime import datetime
from pydantic import BaseModel


class BroadcastCreate(BaseModel):
    message_type: str = "text"  # text, photo, video, document
    content: str | None = None
    file_id: str | None = None
    file_url: str | None = None
    buttons: str | None = None  # JSON string
    filters: str | None = None  # JSON string


class BroadcastInfo(BaseModel):
    id: int
    admin_id: int
    message_type: str
    content: str | None = None
    file_id: str | None = None
    file_url: str | None = None
    buttons: str | None = None
    filters: str | None = None
    status: str
    sent_count: int = 0
    total_count: int = 0
    error_count: int = 0
    created_at: datetime | None = None
    completed_at: datetime | None = None

    class Config:
        from_attributes = True


class BroadcastListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    broadcasts: list[BroadcastInfo]


class BroadcastStatusResponse(BaseModel):
    id: int
    status: str
    sent_count: int
    total_count: int
    error_count: int

"""Log schemas"""
from datetime import datetime
from pydantic import BaseModel


class LogInfo(BaseModel):
    id: int
    admin_id: int
    admin_username: str
    action: str
    entity_type: str | None = None
    entity_id: str | None = None
    details: str | None = None
    ip_address: str | None = None
    created_at: datetime | None = None

    class Config:
        from_attributes = True


class LogListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    logs: list[LogInfo]

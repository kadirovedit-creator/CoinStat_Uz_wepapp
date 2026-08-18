"""Auth schemas"""
from pydantic import BaseModel


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    admin: "AdminUserInfo"


class AdminUserInfo(BaseModel):
    id: int
    username: str
    role: str
    telegram_id: int | None = None


class TelegramAuthRequest(BaseModel):
    init_data: str


class TokenRefreshRequest(BaseModel):
    token: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

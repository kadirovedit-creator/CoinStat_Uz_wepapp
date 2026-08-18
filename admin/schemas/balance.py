"""Balance schemas"""
from datetime import datetime
from pydantic import BaseModel, Field


class BalanceChangeRequest(BaseModel):
    telegram_id: int
    amount: int = Field(..., gt=0)
    reason: str | None = None


class BalanceSetRequest(BaseModel):
    telegram_id: int
    amount: int = Field(..., ge=0)
    reason: str | None = None


class BalanceDeductRequest(BaseModel):
    telegram_id: int
    amount: int = Field(..., gt=0)
    reason: str | None = None


class BalanceResetRequest(BaseModel):
    telegram_id: int
    reason: str | None = None


class BalanceResponse(BaseModel):
    ok: bool = True
    telegram_id: int
    balance_before: int
    balance_after: int
    amount: int
    operation: str


class TransactionInfo(BaseModel):
    id: int
    telegram_id: int
    amount: int
    type: str
    balance_before: int
    balance_after: int
    reason: str | None = None
    admin_id: int | None = None
    created_at: datetime | None = None

    class Config:
        from_attributes = True


class TransactionHistoryResponse(BaseModel):
    total: int
    page: int
    page_size: int
    transactions: list[TransactionInfo]

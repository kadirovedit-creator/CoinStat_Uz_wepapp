"""Dashboard schemas"""
from pydantic import BaseModel


class DashboardStats(BaseModel):
    total_users: int
    active_users: int
    new_users_today: int
    new_users_week: int
    new_users_month: int
    total_balance: int
    total_transactions: int
    total_orders: int
    total_revenue: int


class ChartDataPoint(BaseModel):
    date: str
    value: int


class DashboardResponse(BaseModel):
    stats: DashboardStats
    user_growth: list[ChartDataPoint]
    transaction_volume: list[ChartDataPoint]
    revenue_data: list[ChartDataPoint]

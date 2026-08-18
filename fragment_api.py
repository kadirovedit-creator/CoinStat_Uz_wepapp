import os
import aiohttp
from typing import Optional, Dict, Any
from config import FRAGMENT_API_KEY, FRAGMENT_API_URL, SHOP_ID, SHOP_KEY


class FragmentAPI:
    """Класс для работы с Fragment API (fragment-api.uz)"""
    
    def __init__(self):
        self.api_key = FRAGMENT_API_KEY
        self.shop_id = SHOP_ID
        self.shop_key = SHOP_KEY
        self.base_url = FRAGMENT_API_URL
        
    async def _make_request(self, method: str, endpoint: str, data: Optional[Dict] = None) -> Dict[str, Any]:
        """Выполнение запроса к API"""
        url = f"{self.base_url}/{endpoint}"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        async with aiohttp.ClientSession() as session:
            if method == "GET":
                async with session.get(url, headers=headers, params=data) as response:
                    return await response.json()
            elif method == "POST":
                async with session.post(url, headers=headers, json=data) as response:
                    return await response.json()
                    
    async def create_payment(self, amount: int, order_id: str, user_id: int) -> Dict[str, Any]:
        """Создание платежа"""
        data = {
            "shop_id": self.shop_id,
            "amount": amount,
            "order_id": order_id,
            "user_id": user_id,
            "callback_url": os.getenv("API_PUBLIC_URL", "https://your-domain.com") + "/webhook/payment"
        }
        
        return await self._make_request("POST", "payment/create", data)
        
    async def check_payment(self, order_id: str) -> Dict[str, Any]:
        """Проверка статуса платежа"""
        data = {
            "shop_id": self.shop_id,
            "order_id": order_id
        }
        
        return await self._make_request("GET", "payment/check", data)
        
    async def buy_stars(self, user_id: int, amount: int) -> Dict[str, Any]:
        """Покупка Telegram Stars"""
        data = {
            "user_id": user_id,
            "amount": amount
        }
        
        return await self._make_request("POST", "stars/buy", data)
        
    async def buy_premium(self, user_id: int, months: int) -> Dict[str, Any]:
        """Покупка Telegram Premium"""
        data = {
            "user_id": user_id,
            "months": months
        }
        
        return await self._make_request("POST", "premium/buy", data)
        
    async def get_available_numbers(self) -> Dict[str, Any]:
        """Получение доступных номеров"""
        return await self._make_request("GET", "numbers/available")
        
    async def buy_number(self, number: str, user_id: int) -> Dict[str, Any]:
        """Покупка номера"""
        data = {
            "number": number,
            "user_id": user_id
        }
        
        return await self._make_request("POST", "numbers/buy", data)
        
    async def get_available_gifts(self) -> Dict[str, Any]:
        """Получение доступных подарков"""
        return await self._make_request("GET", "gifts/available")
        
    async def buy_gift(self, gift_id: str, user_id: int, recipient_id: int) -> Dict[str, Any]:
        """Покупка подарка"""
        data = {
            "gift_id": gift_id,
            "user_id": user_id,
            "recipient_id": recipient_id
        }
        
        return await self._make_request("POST", "gifts/buy", data)
        
    async def verify_webhook(self, data: Dict[str, Any]) -> bool:
        """Проверка webhook от платежной системы"""
        # Здесь должна быть логика проверки подписи
        return data.get("shop_key") == self.shop_key


# Создаем экземпляр API
fragment_api = FragmentAPI()

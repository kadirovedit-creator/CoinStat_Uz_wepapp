"""Telethon client for sending Telegram gifts"""

import logging
from typing import Any

from telethon import TelegramClient, functions
from telethon.errors import (
    FloodWaitError,
    UserIdInvalidError,
)
from telethon.sessions import StringSession
from telethon.tl.types import InputStickerSetShortName

logger = logging.getLogger(__name__)


class TelethonGiftSender:
    """Отправка подарков через Telegram User Client"""

    def __init__(self, api_id: int, api_hash: str, session: str | StringSession = "session"):
        self.api_id = api_id
        self.api_hash = api_hash
        self.session = session
        self.client: TelegramClient | None = None

    async def start(self, phone: str | None = None):
        """Запуск клиента"""
        if not self.api_id or not self.api_hash:
            raise ValueError("API_ID and API_HASH are required")

        # Если передана строка сессии, используем StringSession
        if isinstance(self.session, str) and len(self.session) > 50:
            try:
                session = StringSession(self.session)
            except Exception as e:
                logger.warning("Invalid session string: %s, falling back to file session", e)
                session = self.session
        else:
            session = self.session

        self.client = TelegramClient(session, self.api_id, self.api_hash)
        await self.client.connect()
        if not await self.client.is_user_authorized():
            logger.warning("Telethon user is not authorized. Run 'python generate_session.py' to authorize.")
            return
        logger.info("Telethon client started successfully")


    async def stop(self):
        """Остановка клиента"""
        if self.client:
            await self.client.disconnect()
            logger.info("Telethon client stopped")

    async def send_gift(
        self, username: str, gift_sticker_id: str, message: str = ""
    ) -> dict[str, Any]:
        """
        Отправка подарка пользователю через Telethon MTProto
        Использует правильный метод: InputInvoiceStarGift + GetPaymentForm + SendStarsForm
        
        Args:
            username: Username получателя (без @)
            gift_sticker_id: ID стикера подарка из Telegram
            message: Опциональное сообщение к подарку
            
        Returns:
            dict с результатом операции
        """
        if not self.client or not self.client.is_connected():
            return {
                "ok": False,
                "error": "Telethon client not connected",
            }

        username = username.lstrip("@")

        try:
            # Пытаемся получить InputPeer пользователя через ResolveUsername
            # Это самый надёжный способ найти пользователя в MTProto
            try:
                resolved = await self.client(
                    functions.contacts.ResolveUsernameRequest(username=username)
                )
                if resolved.peer and resolved.users:
                    user = resolved.users[0]
                    receiver_peer = await self.client.get_input_entity(user.id)
                    logger.info(f"Resolved @{username} via ResolveUsername: id={user.id}")
                else:
                    raise ValueError(f"ResolveUsername returned no peer for @{username}")
            except Exception as e:
                logger.warning(f"ResolveUsername failed for @{username}: {e}, trying fallback...")
                # Fallback: пробуем get_entity
                try:
                    entity = await self.client.get_entity(username)
                    receiver_peer = await self.client.get_input_entity(entity)
                    logger.info(f"Got peer for @{username} via get_entity fallback")
                except Exception as e2:
                    logger.error(f"User not found: @{username}, error: {e2}")
                    return {
                        "ok": False,
                        "error": f"Username @{username} topilmadi",
                    }

            # Создаем инвойс для подарка
            from telethon.tl.types import InputInvoiceStarGift
            from telethon.tl.functions.payments import GetPaymentFormRequest, SendStarsFormRequest
            
            try:
                # Шаг 1: Создаем invoice для подарка
                invoice = InputInvoiceStarGift(
                    peer=receiver_peer,
                    gift_id=int(gift_sticker_id)
                )
                logger.info(f"Created invoice for gift {gift_sticker_id}")
                
                # Шаг 2: Получаем форму оплаты
                payment_form = await self.client(GetPaymentFormRequest(invoice=invoice))
                logger.info(f"Got payment form: form_id={payment_form.form_id}")
                
                # Шаг 3: Отправляем подарок через форму
                result = await self.client(
                    SendStarsFormRequest(
                        form_id=payment_form.form_id,
                        invoice=invoice
                    )
                )
                
                logger.info(f"Star gift sent to @{username}: {gift_sticker_id}, result: {result}")
                return {
                    "ok": True,
                    "username": username,
                    "gift_id": gift_sticker_id,
                    "result": str(result),
                }
                
            except Exception as e:
                error_msg = str(e)
                logger.error(f"Failed to send star gift: {error_msg}")
                
                # Проверяем специфические ошибки
                if "STARGIFT_USAGE_LIMITED" in error_msg:
                    return {
                        "ok": False,
                        "error": "Bu sovg'a tugab qolgan. Boshqa sovg'a tanlang.",
                    }
                elif "PEER_ID_INVALID" in error_msg:
                    return {
                        "ok": False,
                        "error": f"Username @{username} noto'g'ri yoki mavjud emas",
                    }
                elif "BALANCE_TOO_LOW" in error_msg:
                    return {
                        "ok": False,
                        "error": "Telegram Stars yetarli emas (bot hisobida)",
                    }
                else:
                    return {
                        "ok": False,
                        "error": f"Xatolik: {error_msg}",
                    }

        except FloodWaitError as e:
            logger.error(f"FloodWait: need to wait {e.seconds}s")
            return {
                "ok": False,
                "error": f"Juda ko'p so'rovlar. {e.seconds} soniya kuting",
                "retry_after": e.seconds,
            }

        except Exception as e:
            logger.exception(f"Failed to send gift: {e}")
            return {
                "ok": False,
                "error": f"Xatolik: {str(e)}",
            }

    async def get_available_gifts(self) -> dict[str, Any]:
        """Получить список доступных Star Gifts из Telegram"""
        if not self.client or not self.client.is_connected():
            return {"ok": False, "error": "Client not connected"}

        try:
            # Получаем список доступных Star Gifts
            from telethon.tl.functions.payments import GetStarGiftsRequest
            
            result = await self.client(GetStarGiftsRequest(hash=0))
            
            gifts = []
            if hasattr(result, 'gifts'):
                for gift in result.gifts:
                    gift_info = {
                        "id": str(gift.id),
                        "stars": getattr(gift, 'stars', 0),
                        "availability_remains": getattr(gift, 'availability_remains', None),
                        "availability_total": getattr(gift, 'availability_total', None),
                        "limited": getattr(gift, 'limited', False),
                    }
                    
                    # Получаем sticker info если есть
                    if hasattr(gift, 'sticker'):
                        sticker = gift.sticker
                        if hasattr(sticker, 'id'):
                            gift_info['sticker_id'] = str(sticker.id)
                    
                    gifts.append(gift_info)
            
            logger.info(f"Got {len(gifts)} available Star Gifts from Telegram")
            return {"ok": True, "gifts": gifts, "count": len(gifts)}

        except Exception as e:
            logger.exception(f"Failed to get Star Gifts: {e}")
            return {"ok": False, "error": str(e)}


# Глобальный экземпляр (инициализируется при запуске бота)
gift_sender: TelethonGiftSender | None = None


async def init_gift_sender(api_id: int, api_hash: str, session: str = "", phone: str | None = None):
    """Инициализация отправителя подарков"""
    global gift_sender
    gift_sender = TelethonGiftSender(api_id, api_hash, session or "starpayuz_session")
    await gift_sender.start(phone)
    return gift_sender


async def stop_gift_sender():
    """Остановка отправителя подарков"""
    global gift_sender
    if gift_sender:
        await gift_sender.stop()


async def process_pending_gifts():
    """Avtomatik ravishda kutilayotgan gift buyurtmalarini Telethon orqali yuboradi"""
    global gift_sender
    if not gift_sender or not gift_sender.client or not gift_sender.client.is_connected():
        return
    try:
        from services.database import db_conn
        pending_orders = await db_conn.fetch(
            "SELECT * FROM orders WHERE product_type = 'gift' AND status = 'pending' ORDER BY id ASC"
        )
        if not pending_orders:
            return
        logger.info(f"Avto-yuborish: {len(pending_orders)} ta kutilayotgan gift buyurtmasi topildi")
        for order in pending_orders:
            target_username = order.get("target_username")
            gift_id = order.get("external_id")
            order_id = order.get("id")
            if not target_username or not gift_id:
                continue
            logger.info(f"Gift #{order_id} @{target_username} ga avtomatik yuborilmoqda (Gift ID: {gift_id})...")
            res = await gift_sender.send_gift(target_username, gift_id, "🎁 Sovg'a")
            if res.get("ok"):
                await db_conn.execute("UPDATE orders SET status = 'completed' WHERE id = $1", order_id)
                logger.info(f"Gift #{order_id} muvaffaqiyatli avto-yuborildi!")
            else:
                logger.error(f"Gift #{order_id} avto-yuborishda xatolik: {res.get('error')}")
    except Exception as e:
        logger.error(f"process_pending_gifts xatolik: {e}")


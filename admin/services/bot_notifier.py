"""Bot notification service - sends messages to users via Telegram bot"""
import json
import logging

import aiohttp

from admin.config import BOT_TOKEN

logger = logging.getLogger(__name__)


async def send_telegram_message(
    chat_id: int,
    text: str,
    parse_mode: str = "HTML",
    reply_markup: dict | None = None,
) -> bool:
    """Send a message to a Telegram user via the bot API"""
    if not BOT_TOKEN:
        logger.warning("BOT_TOKEN not set, cannot send message")
        return False

    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": parse_mode,
    }
    if reply_markup:
        payload["reply_markup"] = json.dumps(reply_markup)

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload) as resp:
                result = await resp.json()
                if result.get("ok"):
                    return True
                logger.error(f"Telegram API error: {result}")
                return False
    except Exception as e:
        logger.error(f"Failed to send message to {chat_id}: {e}")
        return False


async def send_telegram_photo(
    chat_id: int,
    photo: str,
    caption: str | None = None,
    parse_mode: str = "HTML",
    reply_markup: dict | None = None,
) -> bool:
    """Send a photo to a Telegram user"""
    if not BOT_TOKEN:
        return False

    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendPhoto"
    payload = {
        "chat_id": chat_id,
        "photo": photo,
    }
    if caption:
        payload["caption"] = caption
        payload["parse_mode"] = parse_mode
    if reply_markup:
        payload["reply_markup"] = json.dumps(reply_markup)

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload) as resp:
                result = await resp.json()
                return result.get("ok", False)
    except Exception as e:
        logger.error(f"Failed to send photo to {chat_id}: {e}")
        return False


async def send_telegram_document(
    chat_id: int,
    document: str,
    caption: str | None = None,
    parse_mode: str = "HTML",
) -> bool:
    """Send a document to a Telegram user"""
    if not BOT_TOKEN:
        return False

    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendDocument"
    payload = {
        "chat_id": chat_id,
        "document": document,
    }
    if caption:
        payload["caption"] = caption
        payload["parse_mode"] = parse_mode

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload) as resp:
                result = await resp.json()
                return result.get("ok", False)
    except Exception as e:
        logger.error(f"Failed to send document to {chat_id}: {e}")
        return False


async def send_telegram_video(
    chat_id: int,
    video: str,
    caption: str | None = None,
    parse_mode: str = "HTML",
) -> bool:
    """Send a video to a Telegram user"""
    if not BOT_TOKEN:
        return False

    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendVideo"
    payload = {
        "chat_id": chat_id,
        "video": video,
    }
    if caption:
        payload["caption"] = caption
        payload["parse_mode"] = parse_mode

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload) as resp:
                result = await resp.json()
                return result.get("ok", False)
    except Exception as e:
        logger.error(f"Failed to send video to {chat_id}: {e}")
        return False


async def send_broadcast_message(
    chat_id: int,
    message_type: str,
    content: str | None = None,
    file_id: str | None = None,
    file_url: str | None = None,
    buttons: str | None = None,
) -> bool:
    """Send a broadcast message to a single user based on type"""
    reply_markup = None
    if buttons:
        try:
            reply_markup = json.loads(buttons)
        except json.JSONDecodeError:
            pass

    if message_type == "photo" and (file_id or file_url):
        return await send_telegram_photo(
            chat_id,
            file_id or file_url or "",
            caption=content,
            reply_markup=reply_markup,
        )
    elif message_type == "video" and (file_id or file_url):
        return await send_telegram_video(
            chat_id,
            file_id or file_url or "",
            caption=content,
        )
    elif message_type == "document" and (file_id or file_url):
        return await send_telegram_document(
            chat_id,
            file_id or file_url or "",
            caption=content,
        )
    else:
        # text or fallback
        return await send_telegram_message(
            chat_id,
            content or "",
            reply_markup=reply_markup,
        )

import asyncio
import logging
import sys

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode

from bot.config import settings
from bot.handlers import router
from services.database import init_db

logging.basicConfig(
  level=logging.INFO,
  format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


async def main() -> None:
  if not settings.bot_token:
    logger.error("BOT_TOKEN is not set. Copy .env.example to .env")
    sys.exit(1)

  await init_db()

  bot = Bot(
    token=settings.bot_token,
    default=DefaultBotProperties(parse_mode=ParseMode.HTML),
  )
  dp = Dispatcher()
  dp.include_router(router)

  logger.info("StarPayUz bot starting...")
  await dp.start_polling(bot)


if __name__ == "__main__":
  asyncio.run(main())

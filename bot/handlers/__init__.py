from aiogram import Router

from bot.handlers.callbacks import router as callbacks_router
from bot.handlers.menu import router as menu_router
from bot.handlers.start import router as start_router

router = Router()
router.include_router(start_router)
router.include_router(callbacks_router)
router.include_router(menu_router)

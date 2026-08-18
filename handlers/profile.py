from aiogram import Router, F
from aiogram.types import Message
import keyboards
from services.database import db
import config

router = Router()


@router.message(F.text == "📦 Buyurtmalarim")
async def my_orders(message: Message):
    """Show user's orders"""
    user_id = message.from_user.id
    
    orders = await db.get_user_orders(user_id, limit=10)
    
    if not orders:
        await message.answer(
            "📦 <b>Buyurtmalarim</b>\n\n"
            "Sizda hali buyurtmalar yo'q.",
            parse_mode="HTML",
            reply_markup=keyboards.get_main_keyboard()
        )
        return
    
    text = "📦 <b>So'nggi 10 ta buyurtma:</b>\n\n"
    
    for order in orders:
        status_emoji = {
            "pending": "⏳",
            "processing": "🔄",
            "completed": "✅",
            "failed": "❌",
            "cancelled": "🚫"
        }.get(order['status'], "❓")
        
        product_name = {
            "stars": "⭐ Stars",
            "premium": "💎 Premium",
            "topup": "💰 Hisobni to'ldirish",
            "phone": "📱 Virtual raqam",
            "gift": "🎁 Gift"
        }.get(order['product_type'], order['product_type'])
        
        text += (
            f"{status_emoji} <b>{product_name}</b>\n"
            f"   ID: <code>{order['order_id']}</code>\n"
            f"   Summa: {order['price']:,.0f} so'm\n"
            f"   Sana: {order['created_at'][:19].replace('T', ' ')}\n\n"
        )
    
    await message.answer(
        text,
        parse_mode="HTML",
        reply_markup=keyboards.get_main_keyboard()
    )


@router.message(F.text == "👥 Referallar")
async def referrals_menu(message: Message):
    """Show referral information"""
    user_id = message.from_user.id
    
    user = await db.get_user(user_id)
    
    if not user:
        await message.answer("❌ Foydalanuvchi topilmadi!")
        return
    
    # Get referral link
    bot_username = (await message.bot.me()).username
    referral_link = f"https://t.me/{bot_username}?start={user_id}"
    
    # Count referrals
    referrals = await db.get_referrals(user_id)
    
    text = (
        f"👥 <b>Referral dasturi</b>\n\n"
        f"Do'stlaringizni taklif qiling va har bir taklif uchun <b>300 so'm</b> bonus oling!\n\n"
        f"📊 <b>Sizning statistikangiz:</b>\n"
        f"👤 Taklif qilinganlar: {len(referrals)} ta\n"
        f"💰 Referal bonusi: {len(referrals) * 300:,.0f} so'm\n\n"
        f"🎁 Har bir do'stingiz uchun: <b>300 so'm</b>\n\n"
        f"🔗 <b>Sizning havolangiz:</b>\n"
        f"<code>{referral_link}</code>\n\n"
        f"Havolani nusxalab, do'stlaringizga yuboring!"
    )
    
    await message.answer(
        text,
        parse_mode="HTML",
        reply_markup=keyboards.get_main_keyboard()
    )


@router.message(F.text == "🔒 Qo'llab-quvvatlash")
async def support_menu(message: Message):
    """Show support information"""
    text = (
        "🔒 <b>Qo'llab-quvvatlash</b>\n\n"
        "Savol yoki muammo bo'lsa, biz bilan bog'laning:\n\n"
        "👤 Admin: @StarPayUz_Admin\n"
        "📢 Kanal: @StarPayUz_Channel\n"
        "💬 Guruh: @StarPayUz_Chat\n\n"
        "⏰ Ish vaqti: 9:00 - 22:00 (har kuni)\n\n"
        "📧 Email: support@starpayuz.com"
    )
    
    await message.answer(
        text,
        parse_mode="HTML",
        reply_markup=keyboards.get_main_keyboard()
    )

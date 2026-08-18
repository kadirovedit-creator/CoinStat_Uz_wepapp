import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services import database

async def main():
    print("Connecting to DB via services.database...")
    await database.init_db()
    db = database.db_conn
    
    # 1. Reset all users balance to 0
    await db.execute("UPDATE users SET balance = 0")
    print("[SUCCESS] All users balance reset to 0 in database.")

    # 2. Clear all orders
    try:
        await db.execute("DELETE FROM orders")
        print("[SUCCESS] All orders cleared from database.")
    except Exception as e:
        print("Orders table error:", e)

    # 3. Clear balance history
    try:
        await db.execute("DELETE FROM balance_history")
        print("[SUCCESS] Balance history cleared.")
    except Exception as e:
        print("Balance history error:", e)

    # 4. View users
    users = await db.fetch("SELECT telegram_id, username, balance FROM users LIMIT 25")
    print("\n--- ALL USERS IN DB (BALANCES ZERO) ---")
    for u in users:
        print(f"ID: {u['telegram_id']} | Username: @{u['username']} | Balance: {u['balance']} UZS")

    print("\n[COMPLETE] Fresh reset completed successfully!")

if __name__ == "__main__":
    asyncio.run(main())

from aiohttp import web
import json
import logging
from datetime import datetime

import config
from services.database import db
from api_client import api_client

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def payment_callback(request):
    """Handle payment callbacks from fragment-api.uz"""
    try:
        data = await request.json()
        logger.info(f"Received payment callback: {data}")
        
        # Verify signature
        if not api_client.verify_callback(data):
            logger.warning("Invalid signature in payment callback")
            return web.json_response({"status": "error", "message": "Invalid signature"}, status=400)
        
        order_id = data.get("order_id")
        status = data.get("status")
        amount = data.get("amount")
        
        # Update order status
        order = await db.get_order(order_id)
        
        if not order:
            logger.warning(f"Order not found: {order_id}")
            return web.json_response({"status": "error", "message": "Order not found"}, status=404)
        
        if order['status'] != "pending":
            logger.info(f"Order {order_id} already processed")
            return web.json_response({"status": "ok", "message": "Already processed"})
        
        if status == "paid":
            await db.update_order(
                order_id,
                status="completed",
                completed_at=datetime.utcnow().isoformat()
            )
            
            # Update user balance if this is a top-up
            if order['product_type'] == "topup":
                await db.update_balance(order['user_id'], amount, 'add')
                logger.info(f"Added {amount} to user {order['user_id']} balance")
            
            logger.info(f"Order {order_id} completed successfully")
            
            return web.json_response({"status": "ok", "message": "Payment processed"})
        else:
            await db.update_order(order_id, status="failed")
            logger.info(f"Order {order_id} payment failed")
            
            return web.json_response({"status": "ok", "message": "Payment failed"})
        
    except Exception as e:
        logger.error(f"Error processing payment callback: {e}")
        return web.json_response({"status": "error", "message": str(e)}, status=500)


async def payment_success(request):
    """Handle successful payment redirect"""
    return web.Response(text="""
        <!DOCTYPE html>
        <html>
        <head>
            <title>To'lov muvaffaqiyatli</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {
                    font-family: Arial, sans-serif;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    margin: 0;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                }
                .container {
                    text-align: center;
                    padding: 40px;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 20px;
                    backdrop-filter: blur(10px);
                }
                .icon {
                    font-size: 80px;
                    margin-bottom: 20px;
                }
                h1 {
                    font-size: 28px;
                    margin-bottom: 16px;
                }
                p {
                    font-size: 18px;
                    margin-bottom: 30px;
                }
                .button {
                    display: inline-block;
                    padding: 15px 40px;
                    background: white;
                    color: #667eea;
                    text-decoration: none;
                    border-radius: 10px;
                    font-weight: bold;
                    font-size: 16px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="icon">✅</div>
                <h1>To'lov muvaffaqiyatli!</h1>
                <p>Hisobingiz to'ldirildi. Botga qaytishingiz mumkin.</p>
                <a href="https://t.me/YourBot" class="button">Botga qaytish</a>
            </div>
        </body>
        </html>
    """, content_type='text/html')


async def init_app():
    """Initialize web application"""
    app = web.Application()
    
    # Routes
    app.router.add_post('/payment/callback', payment_callback)
    app.router.add_get('/payment/success', payment_success)
    
    # Serve web app
    app.router.add_static('/webapp', path='webapp', name='webapp')
    
    return app


if __name__ == '__main__':
    import os
    port = int(os.environ.get('PORT', 8080))
    app = init_app()
    web.run_app(app, host='0.0.0.0', port=port)

# Payment Server

Node.js payment server for processing payments and auto-crediting user balances.

## Endpoints

### `POST /api/humopay/create`
Create a payment order.

### `GET /api/humopay/check/:order_id`
Check payment status. If paid — credits user balance automatically.

### `GET /api/humopay/pending`
Get all pending orders.

### `GET /health`
Health check endpoint.

## Environment Variables

```env
# Required
DATABASE_URL=postgresql://user:pass@host:5432/db
BOT_TOKEN=your_telegram_bot_token

# HumoPay credentials
HUMOPAY_API_URL=https://humo-pay-api.com
HUMOPAY_SHOP_ID=your_shop_id
HUMOPAY_SHOP_KEY=your_shop_key

# Optional
PORT=3000
ADMIN_SECRET=your_admin_secret
CARD_NUMBER=your_card_number
CARD_OWNER=Card Owner Name
```

## Installation

```bash
cd humopay-api
npm install
npm start
```

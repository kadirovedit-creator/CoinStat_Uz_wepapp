# Telegram Bot

Telegram bot for purchasing Telegram Stars, Premium, and other services.

## Quick Start

### Prerequisites
- Python 3.11+
- PostgreSQL (optional, SQLite works for development)
- Node.js 18+ (for payment server)

### Installation

1. **Clone and install dependencies:**
```bash
pip install -r requirements.txt
```

2. **Set up environment:**
```bash
cp .env.example .env
# Edit .env with your tokens and credentials
```

3. **Start the bot:**
```bash
python run_bot.py
```

4. **Start the API server (optional):**
```bash
python run_server.py
```

5. **Start the payment server (optional):**
```bash
cd humopay-api
npm install
npm start
```

### Docker Deployment
```bash
docker-compose up -d
```

## Project Structure

```
├── bot.py                 # Main bot entry point
├── config.py             # Configuration
├── handlers/             # Bot command handlers
├── services/             # Database, payment, API clients
├── admin/                # Admin panel (FastAPI)
├── humopay-api/          # Payment server (Node.js)
├── webapp/               # Web App (HTML/JS)
└── .env.example          # Environment template
```

## License

MIT

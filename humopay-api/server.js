const express = require('express');
const cors = require('cors');
require('dotenv').config();

const paymentRoutes = require('./routes/payments');
const webhookRoutes = require('./routes/webhooks');
const humopayRoutes = require('./routes/humopay');
const paymentPoller = require('./services/paymentPoller');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${req.method} ${req.path}`);
  next();
});

app.get('/', (req, res) => {
  res.json({
    ok: true,
    service: 'Payment Server',
    version: '2.1.0',
    endpoints: {
      health: 'GET /health',
      humopay_create: 'POST /api/humopay/create',
      humopay_check: 'GET /api/humopay/check/:order_id',
      humopay_pending: 'GET /api/humopay/pending',
      payment_check: 'POST /api/payment/check',
      payment_confirm: 'POST /api/payment/confirm',
      payment_pending: 'GET /api/payment/pending',
      payment_webhook: 'POST /payment/webhook',
      click_webhook: 'POST /webhook/click',
      admin_orders: 'GET /admin/orders',
    },
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'Payment Server',
    uptime: process.uptime(),
    db_connected: !!db.getPool(),
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/payment', paymentRoutes);

// HumoPay routes
app.use('/api/humopay', humopayRoutes);

// Webhook routes
app.use('/', webhookRoutes);

// Admin routes
app.get('/admin/orders', async (req, res) => {
  try {
    const orders = await db.getPendingOrders();
    let html = '<html><head><meta charset="utf-8"><title>Pending Orders</title>';
    html += '<style>body{font-family:sans-serif;max-width:800px;margin:20px auto;padding:0 20px}';
    html += 'table{width:100%;border-collapse:collapse}th,td{padding:8px 12px;text-align:left;border-bottom:1px solid #ddd}';
    html += '.pending{color:orange}.completed{color:green}.cancel{color:red}';
    html += '</style></head><body>';
    html += '<h1>Pending Orders</h1>';
    html += `<p>Total: ${orders.length}</p>`;
    html += '<table><tr><th>ID</th><th>Order ID</th><th>User</th><th>Amount</th><th>Status</th><th>Created</th></tr>';
    
    for (const o of orders) {
      const user = await db.getUser(o.telegram_id);
      html += `<tr>
        <td>${o.id}</td>
        <td><code>${o.external_id}</code></td>
        <td>@${user?.username || o.telegram_id}</td>
        <td>${Number(o.amount).toLocaleString()} so'm</td>
        <td class="${o.status}">${o.status}</td>
        <td>${new Date(o.created_at).toLocaleString()}</td>
      </tr>`;
    }
    
    html += '</table></body></html>';
    res.send(html);
  } catch (err) {
    res.status(500).send('Error: ' + err.message);
  }
});

app.use((req, res) => {
  res.status(404).json({ ok: false, error: 'Not found', path: req.path });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    ok: false,
    error: err.message || 'Internal server error',
  });
});

async function start() {
  try {
    const pool = db.getPool();
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    console.log('[DB] Connected to PostgreSQL');
  } catch (err) {
    console.error('[DB] Connection failed:', err.message);
  }

  paymentPoller.start();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Payment Server running on port ${PORT}`);
    console.log(`[Server] Pending orders: GET /admin/orders`);
    console.log(`[Server] HumoPay create: POST /api/humopay/create`);
    console.log(`[Server] HumoPay check: GET /api/humopay/check/:order_id`);
    console.log(`[Server] Auto-poller ACTIVE — платежи проверяются каждые 15 секунд`);
  });
}

start();

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down...');
  process.exit(0);
});

const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Database connection
const connectionString = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_whMk3x5XVFTz@ep-aged-voice-ax3rogww-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require';
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});

// Helper: Parse telegram_id from query, body, or headers
function parseUserId(req) {
  let uid = null;
  if (req.query) {
    uid = req.query.telegram_id || req.query.user_id || req.query.id || req.query.uid;
  }
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch(e) {}
  }
  if (!uid && body) {
    uid = body.telegram_id || body.user_id || body.id || body.uid;
    if (!uid && body.initData) {
      try {
        const params = new URLSearchParams(body.initData);
        const userStr = params.get('user');
        if (userStr) {
          const u = JSON.parse(userStr);
          uid = u.id;
        }
      } catch (e) {}
    }
  }
  const initHeader = req.headers ? (req.headers['x-telegram-init-data'] || req.headers['X-Telegram-Init-Data']) : null;
  if (!uid && initHeader) {
    try {
      const params = new URLSearchParams(initHeader);
      const userStr = params.get('user');
      if (userStr) {
        const u = JSON.parse(userStr);
        uid = u.id;
      }
    } catch (e) {}
  }
  return uid ? parseInt(uid, 10) : null;
}

// Health check
app.get('/health', (req, res) => {
  res.json({ ok: true, server: 'Node.js Express', time: new Date().toISOString() });
});

// 1. User Balance API
app.all(['/api/user/balance', '/api/balance'], async (req, res) => {
  const userId = parseUserId(req);
  if (!userId || isNaN(userId)) {
    return res.json({ ok: true, balance: 0, referrals: 0, language: 'uz' });
  }

  try {
    const result = await pool.query('SELECT balance, referrals, language FROM users WHERE telegram_id = $1', [userId]);
    if (result.rows.length > 0) {
      const user = result.rows[0];
      return res.json({
        ok: true,
        balance: Number(user.balance || 0),
        referrals: Number(user.referrals || 0),
        language: user.language || 'uz',
      });
    }

    await pool.query(
      'INSERT INTO users (telegram_id, balance, referrals, language) VALUES ($1, 0, 0, $2) ON CONFLICT (telegram_id) DO NOTHING',
      [userId, 'uz']
    );

    return res.json({ ok: true, balance: 0, referrals: 0, language: 'uz' });
  } catch (err) {
    console.error('Balance error:', err.message);
    return res.json({ ok: true, balance: 0, referrals: 0, language: 'uz' });
  }
});

// 2. User Transactions API
app.all(['/api/user/transactions', '/api/transactions'], async (req, res) => {
  const userId = parseUserId(req);
  if (!userId || isNaN(userId)) {
    return res.json({ ok: true, orders: [], balance_history: [], total_spent: 0, orders_count: 0 });
  }

  try {
    let orders = [];
    try {
      const ordersRes = await pool.query(
        `SELECT id, telegram_id, product_type, target_username, quantity, amount, status, external_id, created_at 
         FROM orders 
         WHERE telegram_id = $1 
         ORDER BY id DESC 
         LIMIT 100`,
        [userId]
      );
      orders = ordersRes.rows || [];
    } catch (e) {
      console.warn('Orders query error:', e.message);
    }

    let balanceHistory = [];
    try {
      const balRes = await pool.query(
        `SELECT id, telegram_id, amount, type, balance_before, balance_after, reason, created_at 
         FROM balance_history 
         WHERE telegram_id = $1 
         ORDER BY id DESC 
         LIMIT 100`,
        [userId]
      );
      balanceHistory = balRes.rows || [];
    } catch (e) {
      console.warn('Balance history query error:', e.message);
    }

    const validOrders = orders.filter(o => {
      const pt = String(o.product_type || '').toLowerCase();
      return !pt.startsWith('topup') && 
             pt !== 'deposit' && 
             pt !== 'balance' && 
             o.status !== 'cancelled' && 
             o.status !== 'failed' && 
             o.status !== 'rejected';
    });
    let totalSpent = 0;
    validOrders.forEach(o => {
      if (o.status === 'completed' || o.status === 'paid') {
        totalSpent += Number(o.amount || 0);
      }
    });

    return res.json({
      ok: true,
      orders,
      balance_history: balanceHistory,
      total_spent: totalSpent,
      orders_count: validOrders.length,
    });
  } catch (err) {
    console.error('Transactions error:', err.message);
    return res.json({ ok: true, orders: [], balance_history: [], total_spent: 0, orders_count: 0 });
  }
});

// 3. Rating API (Ranks ONLY by actual purchases / spending)
app.all(['/api/rating', '/api/leaderboard'], async (req, res) => {
  const period = req.query.period || req.body?.period || 'all';

  let timeFilter = "";
  if (period === 'today') {
    timeFilter = "AND o.created_at >= CURRENT_DATE";
  } else if (period === 'week') {
    timeFilter = "AND o.created_at >= NOW() - INTERVAL '7 days'";
  } else if (period === 'month') {
    timeFilter = "AND o.created_at >= NOW() - INTERVAL '30 days'";
  }

  try {
    const query = `
      SELECT 
        u.telegram_id, 
        u.username, 
        u.full_name,
        COALESCE((
          SELECT SUM(o.amount) 
          FROM orders o 
          WHERE o.telegram_id = u.telegram_id 
            AND o.status IN ('completed', 'paid') 
            AND o.product_type NOT LIKE 'topup%'
            AND o.product_type NOT IN ('deposit', 'balance')
            ${timeFilter}
        ), 0)::BIGINT as total
      FROM users u
      WHERE EXISTS (
        SELECT 1 FROM orders o 
        WHERE o.telegram_id = u.telegram_id 
          AND o.status IN ('completed', 'paid') 
          AND o.product_type NOT LIKE 'topup%'
          AND o.product_type NOT IN ('deposit', 'balance')
          ${timeFilter}
      )
      ORDER BY total DESC, u.id ASC
      LIMIT 50
    `;

    const result = await pool.query(query);
    let rating = result.rows.map(r => ({
      telegram_id: Number(r.telegram_id),
      username: r.username || (r.full_name ? r.full_name : `User#${r.telegram_id}`),
      total: Number(r.total || 0),
    }));

    return res.json({ ok: true, period, rating });
  } catch (err) {
    console.error('Rating error:', err.message);
    return res.json({ ok: true, period, rating: [] });
  }
});

// 4. Referrals API
app.all('/api/user/referrals', async (req, res) => {
  const userId = parseUserId(req);
  if (!userId || isNaN(userId)) {
    return res.json({ ok: true, referrals: 0, earned: 0, referral_list: [] });
  }

  try {
    const userRes = await pool.query('SELECT referrals, balance FROM users WHERE telegram_id = $1', [userId]);
    const refsCount = userRes.rows.length > 0 ? Number(userRes.rows[0].referrals || 0) : 0;
    const earned = refsCount * 300;

    let referralList = [];
    try {
      const refUsers = await pool.query(
        'SELECT telegram_id, username, full_name, created_at FROM users WHERE referred_by = $1 ORDER BY id DESC LIMIT 50',
        [userId]
      );
      referralList = refUsers.rows.map(u => ({
        telegram_id: Number(u.telegram_id),
        username: u.username || u.full_name || `User#${u.telegram_id}`,
        date: u.created_at ? u.created_at.toISOString().slice(0, 10) : '',
        reward: 300,
      }));
    } catch (e) {}

    return res.json({
      ok: true,
      referrals: refsCount,
      earned,
      referral_list: referralList,
    });
  } catch (err) {
    console.error('Referrals error:', err.message);
    return res.json({ ok: true, referrals: 0, earned: 0, referral_list: [] });
  }
});

// Order endpoints
const starsOrderHandler = require('./api/order/stars.js');
const topupOrderHandler = require('./api/order/topup.js');
const giftOrderHandler = require('./api/order/gift.js');

app.all('/api/order/stars', (req, res) => starsOrderHandler(req, res));
app.all('/api/order/topup', (req, res) => topupOrderHandler(req, res));
app.all('/api/order/gift', (req, res) => giftOrderHandler(req, res));

// Fresh reset endpoint: reset all users balance to 0 and clear orders/rating
app.all('/api/admin/reset-fresh', async (req, res) => {
  try {
    await pool.query('UPDATE users SET balance = 0');
    try { await pool.query('DELETE FROM orders'); } catch (e) {}
    try { await pool.query('DELETE FROM balance_history'); } catch (e) {}
    try { await pool.query('DELETE FROM transactions'); } catch (e) {}
    return res.json({ ok: true, message: 'All balances, orders and leaderboard reset to 0!' });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// 5. Serve static WebApp files
app.use(express.static(path.join(__dirname)));
app.use('/webapp', express.static(path.join(__dirname, 'webapp')));

// Root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`========================================`);
  console.log(`🚀 CoinStatUz Node.js Server is RUNNING!`);
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`⚡ PostgreSQL connected to NeonDB`);
  console.log(`========================================`);

  // Perform database fresh reset on launch
  try {
    const r1 = await pool.query('UPDATE users SET balance = 0');
    try { await pool.query('DELETE FROM orders'); } catch (e) {}
    try { await pool.query('DELETE FROM balance_history'); } catch (e) {}
    try { await pool.query('DELETE FROM transactions'); } catch (e) {}
    console.log(`✨ Fresh database reset: ${r1.rowCount} users reset to 0 balance, orders & rating reset to 0!`);
  } catch (e) {
    console.error('Initial reset error:', e.message);
  }
});

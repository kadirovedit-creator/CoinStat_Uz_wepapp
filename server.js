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

    const validOrders = orders.filter(o => o.status !== 'cancelled' && o.status !== 'failed' && o.status !== 'rejected');
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

// 3. Rating API
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
        (
          COALESCE((
            SELECT SUM(o.amount) 
            FROM orders o 
            WHERE o.telegram_id = u.telegram_id 
              AND o.status IN ('completed', 'paid') 
              ${timeFilter}
          ), 0) + COALESCE(u.balance, 0)
        )::BIGINT as total
      FROM users u
      WHERE (
        u.balance > 0 
        OR EXISTS (
          SELECT 1 FROM orders o 
          WHERE o.telegram_id = u.telegram_id 
            AND o.status IN ('completed', 'paid') 
            ${timeFilter}
        )
      )
      ORDER BY total DESC, u.balance DESC
      LIMIT 50
    `;

    const result = await pool.query(query);
    let rating = result.rows.map(r => ({
      telegram_id: Number(r.telegram_id),
      username: r.username || (r.full_name ? r.full_name : `User#${r.telegram_id}`),
      total: Number(r.total || 0),
    }));

    if (rating.length === 0) {
      const topUsers = await pool.query(`
        SELECT telegram_id, username, full_name, balance as total
        FROM users
        ORDER BY balance DESC, referrals DESC
        LIMIT 10
      `);
      rating = topUsers.rows.map(u => ({
        telegram_id: Number(u.telegram_id),
        username: u.username || u.full_name || `User#${u.telegram_id}`,
        total: Number(u.total || 0),
      }));
    }

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

// 5. Serve static WebApp files
app.use(express.static(path.join(__dirname)));
app.use('/webapp', express.static(path.join(__dirname, 'webapp')));

// Root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`========================================`);
  console.log(`🚀 CoinStatUz Node.js Server is RUNNING!`);
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`⚡ PostgreSQL connected to NeonDB`);
  console.log(`========================================`);
});

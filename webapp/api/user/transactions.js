const { Pool } = require('pg');

let pool;
function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_whMk3x5XVFTz@ep-aged-voice-ax3rogww-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require';
    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 5,
    });
  }
  return pool;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let userId = req.query?.telegram_id || req.body?.telegram_id;
  if (!userId && req.body?.initData) {
    try {
      const params = new URLSearchParams(req.body.initData);
      const userStr = params.get('user');
      if (userStr) {
        const u = JSON.parse(userStr);
        userId = u.id;
      }
    } catch (e) {}
  }

  if (!userId) {
    return res.status(400).json({ ok: false, error: 'telegram_id is required' });
  }

  try {
    const db = getPool();
    const result = await db.query(
      'SELECT id, product_type, amount, status, created_at FROM orders WHERE telegram_id = $1 ORDER BY id DESC LIMIT 20',
      [parseInt(userId, 10)]
    );

    return res.status(200).json({
      ok: true,
      orders: result.rows,
    });
  } catch (err) {
    console.error('Transactions query error:', err);
    return res.status(500).json({ ok: false, error: err.message, orders: [] });
  }
};

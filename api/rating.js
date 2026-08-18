const { Pool } = require('pg');

let pool;
function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_whMk3x5XVFTz@ep-aged-voice-ax3rogww-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require';
    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30000,
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

  let period = 'all';
  if (req.query && req.query.period) {
    period = req.query.period;
  } else if (req.body && req.body.period) {
    period = req.body.period;
  }

  let timeFilter = "";
  if (period === 'today') {
    timeFilter = "AND o.created_at >= CURRENT_DATE";
  } else if (period === 'week') {
    timeFilter = "AND o.created_at >= NOW() - INTERVAL '7 days'";
  } else if (period === 'month') {
    timeFilter = "AND o.created_at >= NOW() - INTERVAL '30 days'";
  }

  try {
    const db = getPool();
    
    // Rank users by total activity: completed orders + balance
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

    const result = await db.query(query);

    let rating = result.rows.map(r => ({
      telegram_id: Number(r.telegram_id),
      username: r.username || (r.full_name ? r.full_name : `User#${r.telegram_id}`),
      total: Number(r.total || 0),
    }));

    // Fallback if completely empty
    if (rating.length === 0) {
      const topUsers = await db.query(`
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

    return res.status(200).json({
      ok: true,
      period,
      rating,
    });
  } catch (err) {
    console.error('Rating query error:', err);
    return res.status(500).json({ ok: false, error: err.message, rating: [] });
  }
};

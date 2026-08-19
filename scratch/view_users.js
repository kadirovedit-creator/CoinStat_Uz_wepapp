const { Pool } = require('pg');

async function checkAndSync() {
  const connectionString = 'postgresql://neondb_owner:npg_FOH4kIY9gEte@ep-dawn-pond-axw9wntv-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require';
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const userRes = await pool.query('SELECT * FROM users WHERE telegram_id = 8202423244');
    console.log('Current User in Neon DB:', userRes.rows);
    const orderRes = await pool.query('SELECT * FROM orders WHERE telegram_id = 8202423244 ORDER BY id DESC LIMIT 5');
    console.log('Orders in Neon DB:', orderRes.rows);

    // Sync Neon DB to 25000
    await pool.query('UPDATE users SET balance = 25000 WHERE telegram_id = 8202423244');
    await pool.query("UPDATE orders SET status = 'completed' WHERE external_id = 'TOP_1787134586373'");
    console.log('Updated Neon DB balance to 25000!');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

checkAndSync();












const { Pool } = require('pg');

async function viewUsers() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_whMk3x5XVFTz@ep-aged-voice-ax3rogww-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require';
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const allUsers = await pool.query('SELECT telegram_id, username, balance FROM users WHERE telegram_id = 8202423244');
    console.log('User:');
    console.table(allUsers.rows);
    const orders = await pool.query('SELECT id, telegram_id, product_type, amount, status FROM orders WHERE telegram_id = 8202423244');
    console.log('Orders:');
    console.table(orders.rows);
  } catch (err) {
    console.error('Error viewing users:', err);
  } finally {
    await pool.end();
  }
}

viewUsers();

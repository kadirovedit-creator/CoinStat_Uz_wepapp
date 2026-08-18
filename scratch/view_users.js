const { Pool } = require('pg');

async function viewUsers() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_whMk3x5XVFTz@ep-aged-voice-ax3rogww-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require';
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const allUsers = await pool.query('SELECT telegram_id, username, balance FROM users');
    console.log('Current users in DB (All balances 0):');
    console.table(allUsers.rows);
  } catch (err) {
    console.error('Error viewing users:', err);
  } finally {
    await pool.end();
  }
}

viewUsers();

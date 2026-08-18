const { Pool } = require('pg');

async function resetAllBalances() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_whMk3x5XVFTz@ep-aged-voice-ax3rogww-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require';
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const res = await pool.query('UPDATE users SET balance = 0 RETURNING telegram_id, balance');
    console.log(`Successfully reset balances for ${res.rowCount} users to 0!`);
    
    // Also display users
    const allUsers = await pool.query('SELECT telegram_id, username, first_name, balance FROM users');
    console.log('Current users in DB:');
    console.table(allUsers.rows);
  } catch (err) {
    console.error('Error resetting balances:', err);
  } finally {
    await pool.end();
  }
}

resetAllBalances();

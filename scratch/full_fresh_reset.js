const { Pool } = require('pg');

async function fullFreshReset() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_whMk3x5XVFTz@ep-aged-voice-ax3rogww-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require';
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log('--- STARTING FRESH DATABASE RESET ---');

    // 1. Reset all users balance to 0
    const userRes = await pool.query('UPDATE users SET balance = 0');
    console.log(`✅ Reset balance to 0 for ${userRes.rowCount} users.`);

    // 2. Clear all orders
    try {
      const orderRes = await pool.query('DELETE FROM orders');
      console.log(`✅ Cleared ${orderRes.rowCount} test orders from orders table.`);
    } catch (e) {
      console.log('Orders table clear info:', e.message);
    }

    // 3. Clear balance history / transactions if exist
    try {
      await pool.query('DELETE FROM balance_history');
      console.log('✅ Cleared balance_history table.');
    } catch (e) {}

    try {
      await pool.query('DELETE FROM transactions');
      console.log('✅ Cleared transactions table.');
    } catch (e) {}

    // 4. Verify fresh state
    const users = await pool.query('SELECT telegram_id, username, balance FROM users');
    console.log('\n📊 USERS CURRENT STATE:');
    console.table(users.rows);

    const ordersCount = await pool.query('SELECT COUNT(*) FROM orders');
    console.log(`📦 TOTAL ORDERS COUNT: ${ordersCount.rows[0].count}`);

    console.log('\n🎉 FRESH RESET COMPLETED SUCCESSFULLY!');
  } catch (err) {
    console.error('Error during fresh reset:', err);
  } finally {
    await pool.end();
  }
}

fullFreshReset();

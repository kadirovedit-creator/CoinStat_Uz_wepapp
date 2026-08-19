const { Pool } = require('pg');

async function viewUsers() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_whMk3x5XVFTz@ep-aged-voice-ax3rogww-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require';
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const upd = await pool.query("UPDATE orders SET product_type = 'topup' WHERE product_type LIKE 'topup_%'");
    console.log('Normalized rows:', upd.rowCount);
  } catch (err) {
    console.error('Error updating DB:', err);
  } finally {
    await pool.end();
  }
}

viewUsers();

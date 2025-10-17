import pg from 'pg';

const { Pool } = pg;

// Replace this with your new database URL
const DATABASE_URL = process.argv[2] || process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('Usage: node test-db-connection.js "postgres://user:pass@host/db"');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

console.log('Testing connection to:', DATABASE_URL.replace(/:[^:@]+@/, ':****@'));

try {
  const { rows } = await pool.query('SELECT version()');
  console.log('✅ Connection successful!');
  console.log('PostgreSQL version:', rows[0].version);
  await pool.end();
  process.exit(0);
} catch (error) {
  console.error('❌ Connection failed:', error.message);
  await pool.end();
  process.exit(1);
}

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadEnv } from './env.js';

loadEnv();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false,
  // Improve connection stability on managed providers
  keepAlive: true,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: Number(process.env.PG_POOL_MAX || 10),
});

// Optional debug: print DB connection info (non-sensitive) when diagnosing prod issues
try {
  const debug = process.env.DEBUG_AUTH === 'true';
  if (debug && process.env.DATABASE_URL) {
    const u = new URL(process.env.DATABASE_URL);
    console.log('[db] connecting', {
      host: u.hostname,
      database: u.pathname.replace('/', ''),
      ssl: process.env.PG_SSL === 'true' ? 'enabled' : 'disabled',
    });
  }
} catch {}

export const query = (text, params) => pool.query(text, params);

export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const res = await fn(client);
    await client.query('COMMIT');
    return res;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function execSqlFile(filePath) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const absolute = path.isAbsolute(filePath) ? filePath : path.join(__dirname, '..', filePath);
  const sql = fs.readFileSync(absolute, 'utf8');
  return pool.query(sql);
}

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadEnv } from './env.js';

loadEnv();

const { Pool } = pg;

// Build effective connection string and options
const pgSslEnabled = process.env.PG_SSL === 'true';
let connectionString = process.env.DATABASE_URL || '';

// Clean up connection string: remove sslmode params to avoid conflicts with ssl config
try {
  if (connectionString && pgSslEnabled) {
    const url = new URL(connectionString);
    // Remove any ssl-related query params - we'll handle SSL via the ssl config object
    url.searchParams.delete('ssl');
    url.searchParams.delete('sslmode');
    connectionString = url.toString();
  }
} catch {}

const pool = new Pool({
  connectionString,
  // For Supabase and other managed providers with self-signed certs
  ssl: pgSslEnabled ? { rejectUnauthorized: false } : false,
  // Improve connection stability on managed providers
  keepAlive: true,
  connectionTimeoutMillis: 15000,
  idleTimeoutMillis: 30000,
  max: Number(process.env.PG_POOL_MAX || 10),
  application_name: process.env.PG_APP_NAME || 'ecommerce-app',
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

// Log pool-level errors for better diagnostics in production
pool.on('error', (err) => {
  try {
    console.error('[db] Pool error', { message: err?.message || String(err), code: err?.code });
  } catch {}
});

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

// Simple connectivity check to run at startup
export async function initDb(retries = 12) {
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const { rows } = await pool.query('SELECT 1 as ok');
      if (rows && rows[0] && rows[0].ok === 1) {
        console.log('[db] connectivity check OK');
        return;
      }
      console.warn('[db] connectivity check returned unexpected result');
      return;
    } catch (e) {
      lastErr = e;
      console.error(`[db] connectivity check FAILED (attempt ${attempt}/${retries})`, { message: e?.message || String(e) });
      // exponential backoff up to 5s per attempt
      const delay = Math.min(500 * Math.pow(1.5, attempt - 1), 5000);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

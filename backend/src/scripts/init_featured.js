import { query } from '../config/db.js';

async function run() {
  try {
    const { rows: existing } = await query('SELECT COUNT(*)::int AS n FROM featured_products');
    const n = existing[0]?.n || 0;
    if (n > 0) {
      console.log(`featured_products already has ${n} rows; leaving as-is.`);
      process.exit(0);
      return;
    }
    const { rows: ids } = await query(`
      SELECT p.id
      FROM products p
      ORDER BY p.created_at ASC
      LIMIT 30
    `);
    if (ids.length === 0) {
      console.log('No products found to feature.');
      process.exit(0);
      return;
    }
    await query('BEGIN');
    for (let i = 0; i < ids.length; i++) {
      await query('INSERT INTO featured_products (product_id, position) VALUES ($1,$2)', [ids[i].id, i + 1]);
    }
    await query('COMMIT');
    console.log(`Initialized featured_products with ${ids.length} products.`);
    process.exit(0);
  } catch (e) {
    try { await query('ROLLBACK'); } catch {}
    console.error('Init featured failed:', e);
    process.exit(1);
  }
}

run();

import { loadEnv } from '../config/env.js';
import { query, withTransaction } from '../config/db.js';

loadEnv();

async function run() {
  try {
    const res = await withTransaction(async () => {
      // Find vendor created by seeding
      const { rows: vu } = await query(
        'SELECT v.id as vendor_id, u.id as user_id FROM vendors v JOIN users u ON u.id=v.user_id WHERE u.email=$1',
        ['catalog@seed.local']
      );
      if (!vu[0]) return { deletedProducts: 0, removedVendor: false, removedUser: false };

      const vendorId = vu[0].vendor_id;
      const userId = vu[0].user_id;

      // Delete product images records if table exists (best-effort)
      try { await query('DELETE FROM product_images WHERE product_id IN (SELECT id FROM products WHERE vendor_id=$1)', [vendorId]); } catch {}

      // Delete products for that vendor
      const del = await query('DELETE FROM products WHERE vendor_id=$1 RETURNING id', [vendorId]);

      // Remove vendor
      await query('DELETE FROM vendors WHERE id=$1', [vendorId]);

      // Optionally remove the seed user
      await query('DELETE FROM users WHERE id=$1', [userId]);

      return { deletedProducts: del.rowCount, removedVendor: true, removedUser: true };
    });

    console.log(`Cleanup complete. Removed ${res.deletedProducts} products. Vendor removed: ${res.removedVendor}. User removed: ${res.removedUser}.`);
    process.exit(0);
  } catch (e) {
    console.error('Cleanup failed:', e);
    process.exit(1);
  }
}

run();

import path from 'path';
import { execSqlFile } from '../config/db.js';

async function run() {
  try {
    const files = [
      path.join('sql', 'schema.sql'),
      path.join('sql', '20250812_vendor.sql'),
      path.join('sql', '20250813_user_status.sql'),
      path.join('sql', '20250813_vendor_status.sql'),
      path.join('sql', '20250813_compare_price.sql'),
      path.join('sql', '20250813_user_profile.sql'),
      path.join('sql', '20250812_product_images.sql'),
      path.join('sql', '20250813_was_admin.sql'),
      path.join('sql', '20250814_featured_products.sql'),
      path.join('sql', '20250817_ribbon_items.sql'),
    ];
    for (const f of files) {
      console.log('Applying', f);
      await execSqlFile(f);
    }
    console.log('Migrations applied successfully');
    process.exit(0);
  } catch (e) {
    console.error('Migration failed:', e);
    process.exit(1);
  }
}

run();

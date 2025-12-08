import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { execSqlFile } from '../config/db.js';

async function run() {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const files = [
      path.join('..', 'create_extensions.sql'),
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
      path.join('sql', '20250819_add_ribbon_mobile_bg_fields.sql'),
      path.join('sql', '20250820_user_extras.sql'),
    ];
    for (const f of files) {
      const abs = path.isAbsolute(f) ? f : path.join(__dirname, '..', f);
      if (!fs.existsSync(abs)) {
        console.log('Skipping missing migration', f);
        continue;
      }
      console.log('Applying', f);
      try {
        await execSqlFile(f);
      } catch (e) {
        if (f.includes('create_extensions.sql')) {
          console.warn('Ignoring extension migration error:', e?.message || e);
          continue;
        }
        throw e;
      }
    }
    console.log('Migrations applied successfully');
    process.exit(0);
  } catch (e) {
    console.error('Migration failed:', e);
    process.exit(1);
  }
}

run();

import app from './app.js';
import { loadEnv } from './config/env.js';
import { execSqlFile, initDb } from './config/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

loadEnv();

// Optionally run DB migrations on startup (useful on free tiers without shell/jobs)
if (process.env.AUTO_MIGRATE === 'true') {
  try {
    // Basic connectivity check before running migrations
    await initDb();
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const files = [
      '../create_extensions.sql',
      'sql/schema.sql',
      'sql/20250812_vendor.sql',
      'sql/20250813_user_status.sql',
      'sql/20250813_vendor_status.sql',
      'sql/20250813_compare_price.sql',
      'sql/20250813_user_profile.sql',
      'sql/20250812_product_images.sql',
      'sql/20250813_was_admin.sql',
      'sql/20250817_ribbon_items.sql',
      'sql/20250819_add_ribbon_mobile_bg_fields.sql',
    ];
    console.log('AUTO_MIGRATE=true: applying migrations...');
    for (const f of files) {
      const abs = path.isAbsolute(f) ? f : path.join(__dirname, f);
      if (!fs.existsSync(abs)) {
        console.log('Skipping missing migration', f);
        continue;
      }
      console.log('Applying', f);
      try {
        await execSqlFile(f);
      } catch (e) {
        // Gracefully ignore extension creation errors on managed providers
        if (f.includes('create_extensions.sql')) {
          console.warn('Ignoring extension migration error:', e?.message || e);
          continue;
        }
        throw e;
      }
    }
    console.log('AUTO_MIGRATE: migrations applied successfully');
  } catch (e) {
    console.error('AUTO_MIGRATE failed:', e);
  }
}

const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});

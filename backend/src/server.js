import app from './app.js';
import { loadEnv } from './config/env.js';
import { execSqlFile } from './config/db.js';

loadEnv();

// Optionally run DB migrations on startup (useful on free tiers without shell/jobs)
if (process.env.AUTO_MIGRATE === 'true') {
  try {
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
    ];
    console.log('AUTO_MIGRATE=true: applying migrations...');
    for (const f of files) {
      console.log('Applying', f);
      await execSqlFile(f);
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

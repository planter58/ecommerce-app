import { query } from './src/config/db.js';
import { loadEnv } from './src/config/env.js';

loadEnv();

const vendorEmail = process.argv[2];

if (!vendorEmail) {
  console.error('Usage: node approve-vendor.js <vendor-email>');
  console.log('Example: node approve-vendor.js vendor@example.com');
  process.exit(1);
}

try {
  // Find the vendor by email
  const { rows: userRows } = await query(
    'SELECT id, email, role FROM users WHERE email = $1',
    [vendorEmail]
  );

  if (!userRows[0]) {
    console.error(`❌ User not found with email: ${vendorEmail}`);
    process.exit(1);
  }

  const user = userRows[0];
  console.log(`Found user: ${user.email} (${user.role})`);

  if (user.role !== 'vendor') {
    console.error(`❌ User is not a vendor. Role: ${user.role}`);
    process.exit(1);
  }

  // Check vendor status
  const { rows: vendorRows } = await query(
    'SELECT * FROM vendors WHERE user_id = $1',
    [user.id]
  );

  if (!vendorRows[0]) {
    console.error('❌ Vendor record not found for this user');
    process.exit(1);
  }

  const vendor = vendorRows[0];
  console.log(`\nCurrent vendor status: ${vendor.status}`);
  console.log(`Business name: ${vendor.business_name || 'N/A'}`);

  if (vendor.status === 'approved') {
    console.log('✅ Vendor is already approved!');
    process.exit(0);
  }

  // Approve the vendor
  const { rows: updated } = await query(
    'UPDATE vendors SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    ['approved', vendor.id]
  );

  console.log('\n✅ Vendor approved successfully!');
  console.log(`New status: ${updated[0].status}`);
  console.log(`\nThe vendor can now access their dashboard at: /vendor`);

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}

process.exit(0);

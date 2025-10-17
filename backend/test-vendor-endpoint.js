import { query } from './src/config/db.js';
import { loadEnv } from './src/config/env.js';

loadEnv();

const vendorEmail = process.argv[2] || 'maliya@example.com';

console.log(`🔍 Testing vendor endpoint for: ${vendorEmail}\n`);

try {
  // Get user
  const { rows: userRows } = await query(
    'SELECT id, email, name, role FROM users WHERE email = $1',
    [vendorEmail]
  );

  if (!userRows[0]) {
    console.error('❌ User not found');
    process.exit(1);
  }

  const user = userRows[0];
  console.log('✅ User found:');
  console.log(`   Email: ${user.email}`);
  console.log(`   Name: ${user.name}`);
  console.log(`   Role: ${user.role}\n`);

  // Get vendor
  const { rows: vendorRows } = await query(
    'SELECT * FROM vendors WHERE user_id = $1',
    [user.id]
  );

  if (!vendorRows[0]) {
    console.error('❌ Vendor record not found');
    process.exit(1);
  }

  const vendor = vendorRows[0];
  console.log('✅ Vendor found:');
  console.log(`   ID: ${vendor.id}`);
  console.log(`   Business Name: ${vendor.business_name || 'N/A'}`);
  console.log(`   Status: ${vendor.status}`);
  console.log(`   Created: ${vendor.created_at}\n`);

  // Simulate the approval check
  console.log('🔐 Approval Check:');
  const isAdmin = user.role === 'admin' || user.role === 'admin2' || user.role === 'super_admin';
  console.log(`   Is Admin: ${isAdmin}`);
  console.log(`   Vendor Status: ${vendor.status}`);

  if (vendor.status !== 'approved' && !isAdmin) {
    console.log('   ❌ WOULD BE BLOCKED - Not approved and not an admin');
    const msg = vendor.status === 'suspended'
      ? 'Your vendor account is suspended. Contact admin for access.'
      : 'Your vendor account is pending approval. Contact admin for access.';
    console.log(`   Error Message: ${msg}`);
  } else {
    console.log('   ✅ WOULD PASS - Vendor is approved or user is admin');
  }

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}

process.exit(0);

import { query } from './src/config/db.js';
import { loadEnv } from './src/config/env.js';

loadEnv();

try {
  console.log('📋 Listing all vendors...\n');

  const { rows } = await query(`
    SELECT 
      v.id,
      v.business_name,
      v.status,
      v.created_at,
      u.email,
      u.name,
      u.role
    FROM vendors v
    JOIN users u ON u.id = v.user_id
    ORDER BY v.created_at DESC
  `);

  if (rows.length === 0) {
    console.log('⚠️  No vendors found in the database.');
    console.log('\nTo create a test vendor, register with role="vendor" at /register');
    process.exit(0);
  }

  console.log(`Found ${rows.length} vendor(s):\n`);

  rows.forEach((v, i) => {
    const statusEmoji = v.status === 'approved' ? '✅' : v.status === 'suspended' ? '🚫' : '⏳';
    console.log(`${i + 1}. ${statusEmoji} ${v.business_name || 'Unnamed Business'}`);
    console.log(`   Vendor ID: ${v.id}`);
    console.log(`   Email: ${v.email}`);
    console.log(`   User Name: ${v.name}`);
    console.log(`   Status: ${v.status}`);
    console.log(`   Created: ${new Date(v.created_at).toLocaleString()}`);
    console.log('');
  });

  const pending = rows.filter(v => v.status === 'pending').length;
  const approved = rows.filter(v => v.status === 'approved').length;
  const suspended = rows.filter(v => v.status === 'suspended').length;

  console.log('📊 Summary:');
  console.log(`   ⏳ Pending: ${pending}`);
  console.log(`   ✅ Approved: ${approved}`);
  console.log(`   🚫 Suspended: ${suspended}`);

  if (pending > 0) {
    console.log('\n💡 To approve a vendor, run:');
    console.log('   node approve-vendor.js <vendor-email>');
  }

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}

process.exit(0);

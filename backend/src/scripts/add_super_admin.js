import { query } from '../config/db.js';
import { hashPassword } from '../utils/password.js';
import { loadEnv } from '../config/env.js';

loadEnv();

/**
 * Adds or updates a super admin user with the specified credentials.
 * If the user exists, it updates their password and role.
 * If the user doesn't exist, it creates a new user.
 */
async function addSuperAdmin() {
  const email = 'johnsonmbuguamuhabi@gmail.com';
  const password = 'Admin@0010';
  const name = 'Super Admin';
  const role = 'super_admin';

  try {
    // Check if user exists
    const { rows } = await query('SELECT id, role FROM users WHERE email=$1', [email]);
    
    if (rows.length > 0) {
      // User exists, update password and role
      const userId = rows[0].id;
      const hash = await hashPassword(password);
      await query(
        'UPDATE users SET password_hash=$1, role=$2, updated_at=NOW() WHERE id=$3',
        [hash, role, userId]
      );
      console.log(`✅ Super admin user updated successfully!`);
      console.log(`   Email: ${email}`);
      console.log(`   Role: ${role}`);
    } else {
      // User doesn't exist, create new user
      const hash = await hashPassword(password);
      await query(
        'INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, $4)',
        [email, hash, name, role]
      );
      console.log(`✅ Super admin user created successfully!`);
      console.log(`   Email: ${email}`);
      console.log(`   Name: ${name}`);
      console.log(`   Role: ${role}`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding super admin:', error.message);
    process.exit(1);
  }
}

addSuperAdmin();

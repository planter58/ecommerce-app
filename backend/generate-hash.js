import bcrypt from 'bcryptjs';

const password = process.argv[2] || 'Admin@0010';
const hash = await bcrypt.hash(password, 10);
console.log('Password:', password);
console.log('Hash:', hash);

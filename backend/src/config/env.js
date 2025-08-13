import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

export function loadEnv() {
  // Try default from current working directory
  let result = dotenv.config();
  if (result.error) {
    // Fallback to backend directory (two levels up from this file to backend/)
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const backendEnv = path.join(__dirname, '..', '..', '.env');
    result = dotenv.config({ path: backendEnv });
  }
  if (result.error && process.env.NODE_ENV !== 'production') {
    console.warn('No .env found, relying on environment variables.');
  }
}

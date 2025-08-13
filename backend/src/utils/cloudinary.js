import { v2 as cloudinary } from 'cloudinary';
import { loadEnv } from '../config/env.js';

loadEnv();

const enabled = !!process.env.CLOUDINARY_URL;

if (enabled) {
  // CLOUDINARY_URL format: cloudinary://<api_key>:<api_secret>@<cloud_name>
  cloudinary.config({
    secure: true
  });
}

export function isCloudEnabled() {
  return enabled;
}

export async function uploadBuffer(buffer, options = {}) {
  if (!enabled) throw new Error('Cloudinary not configured');
  const { folder = 'ecommerce-app', resource_type = 'image' } = options;
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type },
      (err, result) => {
        if (err) return reject(err);
        resolve(result);
      }
    );
    stream.end(buffer);
  });
}

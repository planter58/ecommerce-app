import { v2 as cloudinary } from 'cloudinary';
import { loadEnv } from './src/config/env.js';

loadEnv();

if (!process.env.CLOUDINARY_URL) {
  console.error('❌ CLOUDINARY_URL not configured in .env');
  console.log('\nAdd this to your .env file:');
  console.log('CLOUDINARY_URL=cloudinary://api_key:api_secret@cloud_name');
  process.exit(1);
}

cloudinary.config({ secure: true });

console.log('🔍 Fetching all images from Cloudinary...\n');

try {
  // List all resources in the ecommerce-app folder
  const result = await cloudinary.api.resources({
    type: 'upload',
    prefix: 'ecommerce-app/',
    max_results: 500
  });

  if (result.resources.length === 0) {
    console.log('⚠️  No images found in ecommerce-app/ folder');
    console.log('\nTrying root folder...\n');
    
    // Try listing from root
    const rootResult = await cloudinary.api.resources({
      type: 'upload',
      max_results: 500
    });
    
    if (rootResult.resources.length === 0) {
      console.log('❌ No images found in Cloudinary');
      process.exit(0);
    }
    
    console.log(`✅ Found ${rootResult.resources.length} images:\n`);
    rootResult.resources.forEach((img, i) => {
      console.log(`${i + 1}. ${img.public_id}`);
      console.log(`   URL: ${img.secure_url}`);
      console.log(`   Created: ${img.created_at}`);
      console.log('');
    });
  } else {
    console.log(`✅ Found ${result.resources.length} images in ecommerce-app/ folder:\n`);
    result.resources.forEach((img, i) => {
      console.log(`${i + 1}. ${img.public_id}`);
      console.log(`   URL: ${img.secure_url}`);
      console.log(`   Created: ${img.created_at}`);
      console.log('');
    });
  }

  console.log('\n📋 Summary:');
  console.log(`Total images: ${result.resources.length || 0}`);
  console.log('\nYou can use these URLs to re-create your products via the admin panel.');
  
} catch (error) {
  console.error('❌ Error fetching images:', error.message);
  if (error.error?.message) {
    console.error('Details:', error.error.message);
  }
  process.exit(1);
}

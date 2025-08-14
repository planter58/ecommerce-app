import { loadEnv } from '../config/env.js';
import { query, withTransaction } from '../config/db.js';

loadEnv();

const curated = {
  electronics: [
    'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9',
    'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5',
    'https://images.unsplash.com/photo-1517336714731-489689fd1ca8',
    'https://images.unsplash.com/photo-1512496015851-a90fb38ba796',
    'https://images.unsplash.com/photo-1518770660439-4636190af475'
  ],
  clothing: [
    'https://images.unsplash.com/photo-1520975916090-3105956dac38',
    'https://images.unsplash.com/photo-1519741497674-611481863552',
    'https://images.unsplash.com/photo-1520974735194-6cde32d58e9a',
    'https://images.unsplash.com/photo-1512436991641-6745cdb1723f',
    'https://images.unsplash.com/photo-1521334884684-d80222895322'
  ],
  kitchenware: [
    'https://images.unsplash.com/photo-1519681393784-d120267933ba',
    'https://images.unsplash.com/photo-1504754524776-8f4f37790ca0',
    'https://images.unsplash.com/photo-1473091534298-04dcbce3278c',
    'https://images.unsplash.com/photo-1498654200943-1088dd4438ae',
    'https://images.unsplash.com/photo-1506368249639-73a05d6f6488'
  ],
  home: [
    'https://images.unsplash.com/photo-1493666438817-866a91353ca9',
    'https://images.unsplash.com/photo-1484101403633-562f891dc89a',
    'https://images.unsplash.com/photo-1501045661006-fcebe0257c3f',
    'https://images.unsplash.com/photo-1505691723518-36a5ac3b2a59',
    'https://images.unsplash.com/photo-1505691938895-1758d7feb511'
  ],
  beauty: [
    'https://images.unsplash.com/photo-1512203492609-8b43f81e1b06',
    'https://images.unsplash.com/photo-1515378960530-7c0da6231fb1',
    'https://images.unsplash.com/photo-1519666213638-9f075f9a5ff8',
    'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9',
    'https://images.unsplash.com/photo-1522335789202-c39eabe2dab4'
  ],
  sports: [
    'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b',
    'https://images.unsplash.com/photo-1517960413843-0aee8e2b3285',
    'https://images.unsplash.com/photo-1502872364588-894d7d6c63e2',
    'https://images.unsplash.com/photo-1521417531101-1b1c7d8d8459',
    'https://images.unsplash.com/photo-1518611012118-696072aa579a'
  ],
  outdoors: [
    'https://images.unsplash.com/photo-1504280390368-3971bf2ca5b8',
    'https://images.unsplash.com/photo-1501706362039-c06b2d715385',
    'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee',
    'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429',
    'https://images.unsplash.com/photo-1469474968028-56623f02e42e'
  ],
  books: [
    'https://images.unsplash.com/photo-1516979187457-637abb4f9353',
    'https://images.unsplash.com/photo-1519681393781-9ad481f1f1d2',
    'https://images.unsplash.com/photo-1507842217343-583bb7270b66',
    'https://images.unsplash.com/photo-1495446815901-a7297e633e8d',
    'https://images.unsplash.com/photo-1491841550275-ad7854e35ca6'
  ]
};

function chooseUrl(catSlug, index) {
  const arr = curated[catSlug] || curated['home'];
  return arr[index % arr.length] + '?auto=format&fit=crop&w=1200&q=80';
}

async function run() {
  try {
    const result = await withTransaction(async () => {
      // Find the vendor used by the seed (Global Imports) if exists
      const { rows: vend } = await query("SELECT v.id FROM vendors v JOIN users u ON u.id=v.user_id WHERE u.email='catalog@seed.local' LIMIT 1");
      const vendorId = vend[0]?.id || null;

      const params = [];
      let where = '';
      if (vendorId) { where = 'WHERE p.vendor_id=$1'; params.push(vendorId); }

      // Get seeded products with their categories
      const { rows: prods } = await query(
        `SELECT p.id, p.title, p.image_url, c.slug AS category_slug
         FROM products p
         LEFT JOIN categories c ON c.id = p.category_id
         ${where}
         ORDER BY p.created_at ASC`
      , params);

      let updated = 0;
      let idxByCat = {};

      for (const p of prods) {
        const slug = (p.category_slug || 'home');
        const i = (idxByCat[slug] || 0);
        const url = chooseUrl(slug, i);
        idxByCat[slug] = i + 1;

        // Update main image_url
        await query('UPDATE products SET image_url=$2, updated_at=NOW() WHERE id=$1', [p.id, url]);

        // Reset product_images and insert one primary image
        try {
          await query('DELETE FROM product_images WHERE product_id=$1', [p.id]);
          await query('INSERT INTO product_images (product_id, url, position) VALUES ($1,$2,$3)', [p.id, url, 0]);
        } catch {}
        updated += 1;
      }
      return { updated, total: prods.length };
    });

    console.log(`Updated images for ${result.updated}/${result.total} products.`);
    process.exit(0);
  } catch (e) {
    console.error('Update seed images failed:', e);
    process.exit(1);
  }
}

run();

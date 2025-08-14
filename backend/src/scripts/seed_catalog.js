import { loadEnv } from '../config/env.js';
import { query, withTransaction } from '../config/db.js';
import { hashPassword } from '../utils/password.js';

loadEnv();

async function upsertUser(email, name, password, role) {
  const { rows } = await query('SELECT id FROM users WHERE email=$1', [email]);
  if (rows[0]) {
    await query('UPDATE users SET role=$2, name=$3, updated_at=NOW() WHERE id=$1', [rows[0].id, role, name]);
    return rows[0].id;
  }
  const hash = await hashPassword(password || 'Seed@123');
  const { rows: ins } = await query(
    'INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, $4) RETURNING id',
    [email, hash, name, role]
  );
  return ins[0].id;
}

async function upsertVendor(userId, businessName) {
  const { rows } = await query('SELECT id FROM vendors WHERE user_id=$1', [userId]);
  if (rows[0]) return rows[0].id;
  const ins = await query('INSERT INTO vendors (user_id, business_name, status) VALUES ($1,$2,$3) RETURNING id', [userId, businessName, 'approved']);
  return ins.rows[0].id;
}

async function upsertCategory(name, slug) {
  const { rows } = await query('SELECT id FROM categories WHERE slug=$1', [slug]);
  if (rows[0]) return rows[0].id;
  const ins = await query('INSERT INTO categories (name, slug) VALUES ($1,$2) RETURNING id', [name, slug]);
  return ins.rows[0].id;
}

async function productExists(title) {
  const { rows } = await query('SELECT 1 FROM products WHERE title=$1', [title]);
  return !!rows[0];
}

function priceFor(category, index) {
  const ranges = {
    Electronics: [15000, 120000],
    Clothing: [800, 6000],
    Kitchenware: [600, 15000],
    Home: [1200, 35000],
    Beauty: [500, 12000],
    Sports: [1500, 45000],
    Outdoors: [1500, 60000],
    Books: [600, 3500],
  };
  const [min, max] = ranges[category] || [1000, 100000];
  const span = max - min;
  const v = min + ((index * 9301 + 49297) % span); // deterministic-ish
  return Math.max(min, Math.min(max, v));
}

function stockFor(index) {
  return 5 + ((index * 17) % 46); // 5..50
}

function imgUrl(keyword, item) {
  const q = encodeURIComponent(`${keyword}, ${item}`);
  return `https://source.unsplash.com/600x400/?${q}`;
}

const adjectives = ['Elite', 'Pro', 'Classic', 'Urban', 'Voyager', 'Eco', 'Signature', 'Prime', 'Fusion', 'Modern'];

const catalog = [
  { name: 'Electronics', slug: 'electronics', keyword: 'electronics,gadget,tech', items: ['Smartphone', 'Laptop', 'Bluetooth Speaker', 'Noise Cancelling Headphones', 'Smartwatch', 'Tablet', 'DSLR Camera', 'Gaming Console', 'Power Bank', 'Wireless Earbuds'] },
  { name: 'Clothing', slug: 'clothing', keyword: 'clothing,fashion,apparel', items: ['Hoodie', 'Denim Jacket', 'Chinos', 'Polo Shirt', 'Sneakers', 'Sports T-Shirt', 'Dress', 'Cardigan', 'Jeans', 'Running Shoes'] },
  { name: 'Kitchenware', slug: 'kitchenware', keyword: 'kitchen,cookware,utensils', items: ['Chef Knife', 'Nonstick Pan', 'Blender', 'Air Fryer', 'Electric Kettle', 'Coffee Maker', 'Cutlery Set', 'Pressure Cooker', 'Stand Mixer', 'Food Processor'] },
  { name: 'Home', slug: 'home', keyword: 'home,decor,furniture', items: ['Table Lamp', 'Throw Blanket', 'Area Rug', 'Wall Clock', 'Curtains', 'Cushion Set', 'Bookshelf', 'Side Table', 'Laundry Basket', 'Storage Organizer'] },
  { name: 'Beauty', slug: 'beauty', keyword: 'beauty,skincare,cosmetics', items: ['Moisturizer', 'Serum', 'Sunscreen', 'Shampoo', 'Hair Dryer', 'Face Cleanser', 'Body Lotion', 'Makeup Palette', 'Lipstick', 'Perfume'] },
  { name: 'Sports', slug: 'sports', keyword: 'sports,fitness,gear', items: ['Yoga Mat', 'Dumbbell Set', 'Tennis Racket', 'Football', 'Cycling Helmet', 'Jump Rope', 'Running Backpack', 'Knee Support', 'Gym Gloves', 'Water Bottle'] },
  { name: 'Outdoors', slug: 'outdoors', keyword: 'outdoor,camping,hiking', items: ['Tent', 'Sleeping Bag', 'Camping Stove', 'Hiking Boots', 'Headlamp', 'Backpacking Pack', 'Camp Chair', 'Trekking Poles', 'Portable Filter', 'Cooler Box'] },
  { name: 'Books', slug: 'books', keyword: 'books,reading,novel', items: ['Mystery Novel', 'Sci-Fi Epic', 'Cookbook', 'Self-Help Guide', 'Travelogue', 'Historical Fiction', 'Business Strategy', 'Personal Finance', 'Programming Guide', 'Photography Basics'] },
];

async function run() {
  try {
    const res = await withTransaction(async () => {
      // Ensure a vendor exists for seeded products
      const vendorUserId = await upsertUser('catalog@seed.local', 'Catalog Vendor', 'Seed@123', 'vendor');
      const vendorId = await upsertVendor(vendorUserId, 'Global Imports');

      const summary = [];
      let idx = 0;

      for (const cat of catalog) {
        const catId = await upsertCategory(cat.name, cat.slug);
        for (let i = 0; i < cat.items.length; i++) {
          const item = cat.items[i];
          const title = `${adjectives[(i + idx) % adjectives.length]} ${item}`;
          if (await productExists(title)) {
            summary.push({ title, skipped: true });
            continue;
          }
          const priceKsh = priceFor(cat.name, i + idx);
          const priceCents = Math.round(priceKsh * 100);
          const stock = stockFor(i + idx);
          const image_url = imgUrl(cat.keyword, item);
          const description = `Carefully selected ${item.toLowerCase()} from our ${cat.name.toLowerCase()} collection. Durable, reliable, and designed for everyday use. Ideal for gift or personal use.`;

          const ins = await query(
            `INSERT INTO products (title, description, price_cents, currency, stock, category_id, image_url, vendor_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
             RETURNING id`,
            [title, description, priceCents, 'kes', stock, catId, image_url, vendorId]
          );
          summary.push({ id: ins.rows[0].id, title, category: cat.name, priceKsh, stock });
          idx++;
        }
      }
      return summary;
    });

    const created = res.filter(r => !r.skipped).length;
    console.log(`Seed catalog complete. Created ${created} products. Skipped ${res.length - created} (already existed).`);
    process.exit(0);
  } catch (e) {
    console.error('Seed catalog failed:', e);
    process.exit(1);
  }
}

run();

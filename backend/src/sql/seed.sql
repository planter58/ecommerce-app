INSERT INTO users (email, password_hash, name, role)
VALUES ('admin@example.com', '$2a$10$2nF8oJ0uGkBzI6Gm0v0zEezk3y2wQkqv1f1u1v6Yx4JwH4d7G6yha', 'Admin', 'admin')
ON CONFLICT (email) DO NOTHING;

INSERT INTO categories (name, slug) VALUES
('Electronics', 'electronics'),
('Books', 'books'),
('Apparel', 'apparel')
ON CONFLICT (name) DO NOTHING;

INSERT INTO products (title, description, price_cents, currency, stock, category_id, image_url)
SELECT 'Wireless Headphones', 'Noise cancelling over-ear', 12999, 'usd', 50, c.id, 'https://picsum.photos/seed/wh/600/400'
FROM categories c WHERE c.slug = 'electronics'
UNION ALL
SELECT 'E-book Reader', '6-inch e-ink display', 8999, 'usd', 100, c.id, 'https://picsum.photos/seed/er/600/400'
FROM categories c WHERE c.slug = 'electronics'
UNION ALL
SELECT 'Novel: The Great Tale', 'Bestselling fiction', 1999, 'usd', 200, c.id, 'https://picsum.photos/seed/novel/600/400'
FROM categories c WHERE c.slug = 'books';

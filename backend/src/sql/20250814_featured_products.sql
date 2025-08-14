-- Create table to pin the first 30 products shown on the homepage
-- Each position 1..30 is unique and maps to a specific product

CREATE TABLE IF NOT EXISTS featured_products (
  product_id UUID PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  position INT NOT NULL UNIQUE CHECK (position >= 1 AND position <= 30),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Helpful index for ordering
CREATE INDEX IF NOT EXISTS idx_featured_products_position ON featured_products(position);

-- Optional: ensure no more than 30 rows exist (best-effort via trigger would be ideal,
-- but we will enforce in API). Keeping it simple here.

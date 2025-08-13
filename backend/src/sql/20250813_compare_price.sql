-- Add optional compare_at_price_cents to products for strike-through original price
ALTER TABLE products
ADD COLUMN IF NOT EXISTS compare_at_price_cents integer;

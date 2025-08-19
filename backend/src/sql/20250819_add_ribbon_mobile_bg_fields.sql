-- Add mobile-specific and background fields to ribbon_items
ALTER TABLE ribbon_items
  ADD COLUMN IF NOT EXISTS title_mobile TEXT,
  ADD COLUMN IF NOT EXISTS body_mobile TEXT,
  ADD COLUMN IF NOT EXISTS cta_label_mobile TEXT,
  ADD COLUMN IF NOT EXISTS bg_color TEXT,
  ADD COLUMN IF NOT EXISTS background TEXT;

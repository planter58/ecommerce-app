-- Ribbon items for promotional banner
CREATE TABLE IF NOT EXISTS ribbon_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT,
  body TEXT,
  cta_label TEXT,
  cta_url TEXT,
  media_url TEXT,
  media_type TEXT CHECK (media_type IN ('image','gif','video')),
  media_poster_url TEXT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  position INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ribbon_enabled ON ribbon_items(enabled);
CREATE INDEX IF NOT EXISTS idx_ribbon_position ON ribbon_items(position);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ribbon_updated_at ON ribbon_items;
CREATE TRIGGER trg_ribbon_updated_at
BEFORE UPDATE ON ribbon_items
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

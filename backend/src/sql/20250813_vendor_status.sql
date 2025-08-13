-- Add status to vendors for admin approval workflow
BEGIN;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
CREATE INDEX IF NOT EXISTS idx_vendors_status ON vendors(status);
COMMIT;

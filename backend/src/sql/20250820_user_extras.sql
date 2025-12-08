-- Add extras field to users table for additional user information
ALTER TABLE users ADD COLUMN IF NOT EXISTS extras text;

-- Track whether a user has ever been an admin
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS was_admin boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_users_was_admin ON users(was_admin);

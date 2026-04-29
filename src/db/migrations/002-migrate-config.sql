-- Migrate existing ~/.liver/config file to SQLite config table
-- This is a one-time migration that runs only if user_version < 2

-- Check if ~/.liver/config exists and migrate it
-- Note: This is handled in application code, not SQL,
-- because SQL cannot read files outside the database.
-- The application code in src/config/index.ts handles the migration
-- by checking for the file and migrating its contents.

PRAGMA user_version = 2;

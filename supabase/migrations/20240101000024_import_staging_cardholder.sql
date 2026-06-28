-- AI-import improvements:
--  1. Show which Amex card member made a purchase (cardholder first name)
--  2. Nothing is "skipped" by default — every staged row starts selected
ALTER TABLE import_staging ADD COLUMN IF NOT EXISTS cardholder TEXT;
ALTER TABLE import_staging ALTER COLUMN selected SET DEFAULT TRUE;

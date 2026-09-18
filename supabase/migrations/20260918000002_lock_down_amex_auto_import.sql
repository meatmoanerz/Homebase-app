-- The app only accesses these tables as an authenticated user or through the
-- service-role cron. Do not expose their schema to the anonymous API role.
REVOKE ALL ON public.import_batches FROM anon;
REVOKE ALL ON public.amex_sync_transactions FROM anon;

CREATE INDEX IF NOT EXISTS amex_sync_transactions_staging_batch_idx
  ON public.amex_sync_transactions (staging_batch_id)
  WHERE staging_batch_id IS NOT NULL;


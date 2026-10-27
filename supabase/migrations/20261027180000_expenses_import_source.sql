-- Where an expense came from. 'csv' = a transaction file read in by the app or
-- by Claude (AI-import); 'auto' = Era bank sync or Wallet/Amex auto-import
-- (set by the backfill below; the sync RPCs leave new rows NULL).
-- NULL = manual, auto-synced or unknown. The import page uses the latest 'csv'
-- date per bank to tell from which date the next bank file must be downloaded.
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS import_source text;

ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_import_source_check;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_import_source_check
  CHECK (import_source IS NULL OR import_source IN ('csv', 'auto'));

CREATE INDEX IF NOT EXISTS expenses_import_source_bank_date_idx
  ON public.expenses (user_id, bank, date DESC) WHERE import_source = 'csv';

-- Backfill: automatic rows are those created after their sync transaction was
-- first seen (rows the sync merely matched as duplicates were created earlier,
-- i.e. by a CSV import). Mortgage splits from the bank sync are automatic too.
UPDATE public.expenses e SET import_source = 'auto'
WHERE e.import_source IS NULL AND e.bank IS NOT NULL AND (
  EXISTS (SELECT 1 FROM public.amex_sync_transactions a
    WHERE a.user_id = e.user_id AND a.bank = e.bank AND a.status = 'imported'
      AND a.amount = coalesce(e.group_purchase_total, e.amount)
      AND abs(a.transaction_date - e.date) <= 3 AND e.created_at > a.first_seen_at)
  OR EXISTS (SELECT 1 FROM public.bank_sync_transactions b
    WHERE b.user_id = e.user_id AND b.bank = e.bank AND b.status = 'imported'
      AND b.status_reason IS NULL
      AND -b.amount = coalesce(e.group_purchase_total, e.amount)
      AND abs(b.transaction_date - e.date) <= 3 AND e.created_at > b.first_seen_at)
  OR ((e.description LIKE 'Amortering – %' OR e.description LIKE 'Ränta bolån – %')
      AND e.created_at > '2026-09-29')
);

UPDATE public.expenses SET import_source = 'csv'
WHERE import_source IS NULL AND bank IS NOT NULL;

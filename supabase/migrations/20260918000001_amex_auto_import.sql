-- Durable inbox and review-batch metadata for automatic Amex imports.

CREATE TABLE IF NOT EXISTS public.import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  opened_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT import_batches_source_check CHECK (source IN ('amex_auto'))
);

CREATE UNIQUE INDEX IF NOT EXISTS import_batches_one_active_amex_batch
  ON public.import_batches (user_id, source)
  WHERE source = 'amex_auto';

CREATE TABLE IF NOT EXISTS public.amex_sync_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_transaction_id TEXT,
  fingerprint TEXT NOT NULL,
  occurrence_index INTEGER NOT NULL DEFAULT 1,
  transaction_date DATE NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  cardholder TEXT,
  status TEXT NOT NULL DEFAULT 'unreviewed',
  staging_batch_id UUID REFERENCES public.import_batches(id) ON DELETE SET NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT amex_sync_transactions_status_check
    CHECK (status IN ('unreviewed', 'staged', 'imported', 'ignored')),
  CONSTRAINT amex_sync_transactions_occurrence_check CHECK (occurrence_index > 0),
  CONSTRAINT amex_sync_transactions_description_check CHECK (btrim(description) <> ''),
  CONSTRAINT amex_sync_transactions_source_id_check
    CHECK (source_transaction_id IS NULL OR btrim(source_transaction_id) <> ''),
  CONSTRAINT amex_sync_transactions_staged_batch_check
    CHECK (status <> 'staged' OR staging_batch_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS amex_sync_transactions_source_id_unique
  ON public.amex_sync_transactions (user_id, source_transaction_id)
  WHERE source_transaction_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS amex_sync_transactions_occurrence_unique
  ON public.amex_sync_transactions (user_id, fingerprint, occurrence_index);

CREATE INDEX IF NOT EXISTS amex_sync_transactions_status_idx
  ON public.amex_sync_transactions (user_id, status, transaction_date DESC);

ALTER TABLE public.import_staging
  ADD COLUMN IF NOT EXISTS amex_sync_transaction_id UUID
  REFERENCES public.amex_sync_transactions(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS import_staging_amex_sync_transaction_unique
  ON public.import_staging (amex_sync_transaction_id)
  WHERE amex_sync_transaction_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'expenses_amex_requires_ccm'
      AND conrelid = 'public.expenses'::regclass
  ) THEN
    ALTER TABLE public.expenses
      ADD CONSTRAINT expenses_amex_requires_ccm
      CHECK (bank IS DISTINCT FROM 'Amex' OR is_ccm = TRUE);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'import_staging_amex_requires_ccm'
      AND conrelid = 'public.import_staging'::regclass
  ) THEN
    ALTER TABLE public.import_staging
      ADD CONSTRAINT import_staging_amex_requires_ccm
      CHECK (bank IS DISTINCT FROM 'Amex' OR is_ccm = TRUE);
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.release_amex_batch_transactions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.amex_sync_transactions
  SET status = 'unreviewed', staging_batch_id = NULL
  WHERE user_id = OLD.user_id
    AND staging_batch_id = OLD.id
    AND status = 'staged';
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS release_amex_batch_transactions_before_delete
  ON public.import_batches;

CREATE TRIGGER release_amex_batch_transactions_before_delete
BEFORE DELETE ON public.import_batches
FOR EACH ROW EXECUTE FUNCTION public.release_amex_batch_transactions();

ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amex_sync_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own import batches"
  ON public.import_batches;
CREATE POLICY "Users can manage their own import batches"
  ON public.import_batches
  FOR ALL
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can manage their own Amex sync transactions"
  ON public.amex_sync_transactions;
CREATE POLICY "Users can manage their own Amex sync transactions"
  ON public.amex_sync_transactions
  FOR ALL
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_batches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.amex_sync_transactions TO authenticated;
GRANT ALL ON public.import_batches TO service_role;
GRANT ALL ON public.amex_sync_transactions TO service_role;


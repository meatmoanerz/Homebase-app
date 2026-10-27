-- Wallet-autoimport per kort: samma inkorg (amex_sync_transactions) för Amex och
-- Norwegian, skild åt med kolumnen bank. Varje kort får en egen granskningsbatch
-- (amex_auto / norwegian_auto). Kreditkortet sätts på utgiften av triggern
-- set_expense_credit_card utifrån expenses.bank.

ALTER TABLE public.amex_sync_transactions
  ADD COLUMN IF NOT EXISTS bank text NOT NULL DEFAULT 'Amex';
DO $$ BEGIN
  ALTER TABLE public.amex_sync_transactions
    ADD CONSTRAINT amex_sync_transactions_bank_check CHECK (bank IN ('Amex', 'Norwegian'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.import_batches DROP CONSTRAINT IF EXISTS import_batches_source_check;
ALTER TABLE public.import_batches ADD CONSTRAINT import_batches_source_check
  CHECK (source = ANY (ARRAY['amex_auto', 'norwegian_auto', 'bank_auto']));
CREATE UNIQUE INDEX IF NOT EXISTS import_batches_one_active_norwegian_batch
  ON public.import_batches (user_id, source) WHERE source = 'norwegian_auto';

CREATE OR REPLACE FUNCTION public.rebuild_wallet_review_batch(p_user_id uuid, p_bank text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  b public.import_batches%ROWTYPE;
  n integer;
  v_source text;
BEGIN
  v_source := CASE p_bank WHEN 'Amex' THEN 'amex_auto' WHEN 'Norwegian' THEN 'norwegian_auto' END;
  IF v_source IS NULL THEN RAISE EXCEPTION 'Okänt kort: %', p_bank; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(lower(p_bank) || ':' || p_user_id::text, 0));
  INSERT INTO public.import_batches(user_id, source)
    VALUES(p_user_id, v_source) ON CONFLICT DO NOTHING;
  SELECT * INTO STRICT b FROM public.import_batches
    WHERE user_id = p_user_id AND source = v_source FOR UPDATE;
  IF b.opened_at IS NOT NULL THEN
    RETURN jsonb_build_object('staged', 0, 'batchId', b.id, 'batchLocked', true);
  END IF;

  UPDATE public.amex_sync_transactions SET status = 'unreviewed', staging_batch_id = NULL
    WHERE user_id = p_user_id AND staging_batch_id = b.id AND status = 'staged';
  DELETE FROM public.import_staging WHERE user_id = p_user_id AND batch_id = b.id;

  -- Multiset matching: one existing expense consumes one occurrence, preserving
  -- two real identical purchases. Use card total for expenses entered as outlays.
  WITH ranked AS (
    SELECT r.id, r.transaction_date, r.description, r.amount,
      row_number() OVER (PARTITION BY r.transaction_date,
        upper(regexp_replace(btrim(r.description), '\s+', ' ', 'g')), r.amount
        ORDER BY (r.status = 'imported') DESC, r.first_seen_at, r.id) AS occurrence
    FROM public.amex_sync_transactions r
    WHERE r.user_id = p_user_id AND r.bank = p_bank AND r.status IN ('unreviewed', 'imported')
  )
  UPDATE public.amex_sync_transactions r SET status = 'imported'
    FROM ranked x WHERE r.id = x.id AND r.status = 'unreviewed'
    AND x.occurrence <= (
      SELECT count(*) FROM public.expenses e WHERE e.user_id = p_user_id
      AND e.bank = p_bank AND e.date = x.transaction_date
      AND upper(regexp_replace(btrim(e.description), '\s+', ' ', 'g')) =
          upper(regexp_replace(btrim(x.description), '\s+', ' ', 'g'))
      AND CASE WHEN e.is_group_purchase THEN coalesce(e.group_purchase_total, e.amount)
          ELSE e.amount END = x.amount
    );

  WITH eligible AS (
    SELECT r.*, row_number() OVER (PARTITION BY r.transaction_date,
      upper(regexp_replace(btrim(r.description), '\s+', ' ', 'g')), r.amount
      ORDER BY r.first_seen_at, r.id) AS occurrence
    FROM public.amex_sync_transactions r
    WHERE r.user_id = p_user_id AND r.bank = p_bank AND r.status = 'unreviewed'
  )
  INSERT INTO public.import_staging(batch_id,user_id,bank,date,description,amount,
    category_id,cost_assignment,is_ccm,match_source,selected,status,cardholder,
    amex_sync_transaction_id,pinned,expires_at)
  SELECT b.id,p_user_id,p_bank,r.transaction_date,r.description,r.amount,
    m.category_id,coalesce(m.cost_assignment,'shared'),true,
    CASE WHEN m.id IS NULL THEN 'blank' ELSE 'mappning' END,true,'pending',r.cardholder,
    r.id,true,now() + interval '48 hours'
  FROM eligible r
  LEFT JOIN LATERAL (
    SELECT cm.* FROM public.category_mappings cm WHERE cm.user_id = p_user_id
      AND (cm.bank IS NULL OR lower(cm.bank) = lower(p_bank))
      AND CASE cm.match_type
        WHEN 'exact' THEN lower(r.description) = lower(cm.pattern)
        WHEN 'starts_with' THEN starts_with(lower(r.description),lower(cm.pattern))
        ELSE strpos(lower(r.description),lower(cm.pattern)) > 0 END
    ORDER BY cm.priority DESC, cm.hit_count DESC, cm.id LIMIT 1
  ) m ON true
  WHERE r.occurrence > (
    SELECT count(*) FROM public.import_staging s WHERE s.user_id = p_user_id
      AND s.bank = p_bank AND s.status = 'pending' AND s.batch_id <> b.id
      AND (s.pinned OR s.expires_at > now()) AND s.date = r.transaction_date
      AND s.amount = r.amount
      AND upper(regexp_replace(btrim(s.description), '\s+', ' ', 'g')) =
          upper(regexp_replace(btrim(r.description), '\s+', ' ', 'g'))
  );
  GET DIAGNOSTICS n = ROW_COUNT;
  UPDATE public.amex_sync_transactions r SET status = 'staged', staging_batch_id = b.id
    FROM public.import_staging s WHERE s.batch_id = b.id AND s.amex_sync_transaction_id = r.id;
  IF n = 0 THEN
    DELETE FROM public.import_batches WHERE id = b.id;
    RETURN jsonb_build_object('staged',0,'batchId',NULL,'batchLocked',false);
  END IF;
  UPDATE public.import_batches SET updated_at = now() WHERE id = b.id;
  RETURN jsonb_build_object('staged',n,'batchId',b.id,'batchLocked',false);
END $function$;

REVOKE ALL ON FUNCTION public.rebuild_wallet_review_batch(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rebuild_wallet_review_batch(uuid, text) TO service_role;

-- Bakåtkompatibelt: befintliga anrop (Amex wallet-route, Browserbase-sync) fungerar som förut.
CREATE OR REPLACE FUNCTION public.rebuild_amex_review_batch(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ SELECT public.rebuild_wallet_review_batch(p_user_id, 'Amex') $function$;

-- Spara-funktionen: ta emot båda korten och skriv utgiften med radens egen bank.
DO $$
DECLARE def text;
BEGIN
  def := pg_get_functiondef('public.complete_amex_review_batch(uuid, jsonb)'::regprocedure);
  IF position('''Amex'',true,budget_amount < 0' IN def) > 0 THEN
    def := replace(def, 'AND source = ''amex_auto'' FOR UPDATE',
                        'AND source IN (''amex_auto'', ''norwegian_auto'') FOR UPDATE');
    def := replace(def, '''Amex'',true,budget_amount < 0',
                        'coalesce(r.bank, ''Amex''),true,budget_amount < 0');
    EXECUTE def;
  END IF;
END $$;

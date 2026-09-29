-- Automatic weekly bank import (SEB/Swedbank via Era). One rolling review
-- batch per user; rows are pinned and never expire. Durable inbox keyed on the
-- source transaction id so overlapping fetches never duplicate or resurrect rows.

ALTER TABLE public.import_batches DROP CONSTRAINT IF EXISTS import_batches_source_check;
ALTER TABLE public.import_batches ADD CONSTRAINT import_batches_source_check
  CHECK (source IN ('amex_auto', 'bank_auto'));

CREATE UNIQUE INDEX IF NOT EXISTS import_batches_one_active_bank_batch
  ON public.import_batches (user_id, source) WHERE source = 'bank_auto';

CREATE TABLE IF NOT EXISTS public.bank_sync_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_transaction_id TEXT NOT NULL,
  bank TEXT NOT NULL,
  transaction_date DATE NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,            -- signed as delivered by the bank (outflow < 0)
  status TEXT NOT NULL DEFAULT 'unreviewed',
  status_reason TEXT,
  staging_batch_id UUID REFERENCES public.import_batches(id) ON DELETE SET NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT bank_sync_status_check
    CHECK (status IN ('unreviewed','staged','imported','ignored','excluded')),
  CONSTRAINT bank_sync_bank_check CHECK (bank IN ('SEB','Swedbank')),
  CONSTRAINT bank_sync_source_id_unique UNIQUE (user_id, source_transaction_id)
);
CREATE INDEX IF NOT EXISTS bank_sync_transactions_status_idx
  ON public.bank_sync_transactions (user_id, status, transaction_date DESC);

-- Patterns that are never expenses (internal transfers, Swish to partner, ...)
CREATE TABLE IF NOT EXISTS public.bank_import_exclusions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pattern TEXT NOT NULL,
  match_type TEXT NOT NULL DEFAULT 'contains'
    CHECK (match_type IN ('contains','starts_with','exact')),
  bank TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT bank_import_exclusions_unique UNIQUE (user_id, pattern, match_type)
);

ALTER TABLE public.import_staging
  ADD COLUMN IF NOT EXISTS bank_sync_transaction_id UUID
  REFERENCES public.bank_sync_transactions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS import_staging_bank_sync_idx
  ON public.import_staging (bank_sync_transaction_id) WHERE bank_sync_transaction_id IS NOT NULL;

-- Pin automatic rows (Amex and bank) so the hourly cleanup never removes them.
CREATE OR REPLACE FUNCTION public.pin_amex_staging_row()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF NEW.amex_sync_transaction_id IS NOT NULL OR NEW.bank_sync_transaction_id IS NOT NULL THEN
    NEW.pinned := true;
  END IF;
  RETURN NEW;
END $$;

-- Deleting the bank batch releases its rows back to the inbox (same as Amex).
CREATE OR REPLACE FUNCTION public.release_bank_batch_transactions()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.bank_sync_transactions SET status = 'unreviewed', staging_batch_id = NULL
  WHERE user_id = OLD.user_id AND staging_batch_id = OLD.id AND status = 'staged';
  RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS release_bank_batch_transactions_before_delete ON public.import_batches;
CREATE TRIGGER release_bank_batch_transactions_before_delete
BEFORE DELETE ON public.import_batches
FOR EACH ROW EXECUTE FUNCTION public.release_bank_batch_transactions();

ALTER TABLE public.bank_sync_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_import_exclusions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own bank sync transactions" ON public.bank_sync_transactions;
CREATE POLICY "Users manage own bank sync transactions" ON public.bank_sync_transactions
  FOR ALL TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "Users manage own bank import exclusions" ON public.bank_import_exclusions;
CREATE POLICY "Users manage own bank import exclusions" ON public.bank_import_exclusions
  FOR ALL TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_sync_transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_import_exclusions TO authenticated;
GRANT ALL ON public.bank_sync_transactions TO service_role;
GRANT ALL ON public.bank_import_exclusions TO service_role;

-- Append new bank transactions to the rolling review batch.
-- p_rows: [{"id","bank","date","description","amount"}], amount signed (outflow < 0).
CREATE OR REPLACE FUNCTION public.stage_bank_transactions(p_user_id uuid, p_rows jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  b_id uuid;
  r public.bank_sync_transactions%ROWTYPE;
  m record;
  loan_name text;
  loan_amort numeric;
  claimed uuid[] := '{}';
  dup_id uuid;
  n_new int := 0; n_staged int := 0; n_excl int := 0; n_dup int := 0; n_seen int := 0;
  cat_interest uuid; cat_amort uuid;
  out_amount numeric;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('bank:' || p_user_id::text, 0));

  SELECT count(*) INTO n_seen FROM jsonb_array_elements(p_rows);
  WITH ins AS (
    INSERT INTO public.bank_sync_transactions(user_id, source_transaction_id, bank,
      transaction_date, description, amount)
    SELECT p_user_id, x->>'id', x->>'bank', (x->>'date')::date,
      btrim(x->>'description'), (x->>'amount')::numeric
    FROM jsonb_array_elements(p_rows) x
    ON CONFLICT (user_id, source_transaction_id)
      DO UPDATE SET last_seen_at = now()
    RETURNING (xmax = 0) AS inserted
  ) SELECT count(*) FILTER (WHERE inserted) INTO n_new FROM ins;

  SELECT id INTO cat_interest FROM public.categories WHERE user_id = p_user_id AND name = 'Ränta bolån' LIMIT 1;
  SELECT id INTO cat_amort FROM public.categories WHERE user_id = p_user_id AND name = 'Amortering' LIMIT 1;

  INSERT INTO public.import_batches(user_id, source) VALUES (p_user_id, 'bank_auto') ON CONFLICT DO NOTHING;
  SELECT id INTO STRICT b_id FROM public.import_batches
    WHERE user_id = p_user_id AND source = 'bank_auto' FOR UPDATE;

  FOR r IN SELECT * FROM public.bank_sync_transactions
    WHERE user_id = p_user_id AND status = 'unreviewed'
    ORDER BY transaction_date, first_seen_at, id FOR UPDATE LOOP

    -- 1. Explicit exclusions (internal transfers, Swish to partner, ...)
    IF EXISTS (SELECT 1 FROM public.bank_import_exclusions ex
      WHERE ex.user_id = p_user_id AND (ex.bank IS NULL OR ex.bank = r.bank)
      AND CASE ex.match_type
        WHEN 'exact' THEN lower(r.description) = lower(ex.pattern)
        WHEN 'starts_with' THEN starts_with(lower(r.description), lower(ex.pattern))
        ELSE strpos(lower(r.description), lower(ex.pattern)) > 0 END) THEN
      UPDATE public.bank_sync_transactions SET status = 'excluded', status_reason = 'exclusion rule' WHERE id = r.id;
      n_excl := n_excl + 1; CONTINUE;
    END IF;

    -- Category mapping (bank-specific or generic)
    SELECT cm.category_id, cm.cost_assignment, cm.id INTO m FROM public.category_mappings cm
      WHERE cm.user_id = p_user_id AND (cm.bank IS NULL OR lower(cm.bank) = lower(r.bank))
      AND CASE cm.match_type
        WHEN 'exact' THEN lower(r.description) = lower(cm.pattern)
        WHEN 'starts_with' THEN starts_with(lower(r.description), lower(cm.pattern))
        ELSE strpos(lower(r.description), lower(cm.pattern)) > 0 END
      ORDER BY cm.priority DESC, cm.hit_count DESC, cm.id LIMIT 1;

    -- 2. Incoming money: only merchant refunds (mapped) are kept, rest excluded
    IF r.amount >= 0 AND m.id IS NULL THEN
      UPDATE public.bank_sync_transactions SET status = 'excluded', status_reason = 'incoming' WHERE id = r.id;
      n_excl := n_excl + 1; CONTINUE;
    END IF;

    out_amount := -r.amount;  -- expenses positive, refunds negative

    -- 3. Already registered (CSV/manual): same bank + amount, date within 3 days
    SELECT e.id INTO dup_id FROM public.expenses e
      WHERE e.user_id = p_user_id AND e.bank = r.bank AND e.amount = out_amount
      AND abs(e.date - r.transaction_date) <= 3 AND NOT (e.id = ANY(claimed))
      ORDER BY abs(e.date - r.transaction_date), e.id LIMIT 1;
    IF dup_id IS NOT NULL THEN
      claimed := claimed || dup_id;
      UPDATE public.bank_sync_transactions SET status = 'imported', status_reason = 'duplicate of existing expense' WHERE id = r.id;
      n_dup := n_dup + 1; CONTINUE;
    END IF;

    -- 4. Mortgage OCR payment: reference ends with the loan number digits
    loan_name := NULL; loan_amort := 0;
    IF r.description ~ '^[0-9]{8,}$' AND r.amount < 0 THEN
      SELECT l.name, coalesce(l.monthly_amortization, 0) INTO loan_name, loan_amort FROM public.loans l
        WHERE l.user_id = p_user_id AND length(regexp_replace(l.name, '[^0-9]', '', 'g')) >= 4
        AND right(r.description, length(regexp_replace(l.name, '[^0-9]', '', 'g')))
            = regexp_replace(l.name, '[^0-9]', '', 'g')
        LIMIT 1;
    END IF;

    IF loan_name IS NOT NULL THEN
      IF loan_amort > 0 AND out_amount > loan_amort THEN
        INSERT INTO public.import_staging(batch_id,user_id,bank,date,description,amount,category_id,
          cost_assignment,is_ccm,match_source,selected,status,bank_sync_transaction_id,pinned,expires_at)
        VALUES (b_id,p_user_id,r.bank,r.transaction_date,'Amortering – ' || loan_name,loan_amort,cat_amort,
          'shared',false,'lån',true,'pending',r.id,true,now() + interval '10 years');
        INSERT INTO public.import_staging(batch_id,user_id,bank,date,description,amount,category_id,
          cost_assignment,is_ccm,match_source,selected,status,bank_sync_transaction_id,pinned,expires_at)
        VALUES (b_id,p_user_id,r.bank,r.transaction_date,'Ränta bolån – ' || loan_name,out_amount - loan_amort,cat_interest,
          'shared',false,'lån',true,'pending',r.id,true,now() + interval '10 years');
        n_staged := n_staged + 2;
      ELSE
        INSERT INTO public.import_staging(batch_id,user_id,bank,date,description,amount,category_id,
          cost_assignment,is_ccm,match_source,selected,status,bank_sync_transaction_id,pinned,expires_at)
        VALUES (b_id,p_user_id,r.bank,r.transaction_date,'Ränta bolån – ' || loan_name,out_amount,cat_interest,
          'shared',false,'lån',true,'pending',r.id,true,now() + interval '10 years');
        n_staged := n_staged + 1;
      END IF;
    ELSE
      INSERT INTO public.import_staging(batch_id,user_id,bank,date,description,amount,category_id,
        cost_assignment,is_ccm,match_source,selected,status,bank_sync_transaction_id,pinned,expires_at)
      VALUES (b_id,p_user_id,r.bank,r.transaction_date,r.description,out_amount,m.category_id,
        coalesce(m.cost_assignment,'shared'),
        -- Amex invoice payment is flagged ccm; everything else from bank is not
        (strpos(upper(r.description), 'AMERICAN EXPRESS') > 0),
        CASE WHEN m.id IS NULL THEN 'blank' ELSE 'mappning' END,true,'pending',r.id,true,now() + interval '10 years');
      n_staged := n_staged + 1;
    END IF;

    UPDATE public.bank_sync_transactions SET status = 'staged', staging_batch_id = b_id WHERE id = r.id;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM public.import_staging WHERE batch_id = b_id) THEN
    DELETE FROM public.import_batches WHERE id = b_id;
    b_id := NULL;
  ELSE
    UPDATE public.import_batches SET updated_at = now() WHERE id = b_id;
  END IF;

  RETURN jsonb_build_object('received', n_seen, 'new', n_new, 'staged_rows', n_staged,
    'excluded', n_excl, 'duplicates', n_dup, 'batchId', b_id,
    'pending_in_batch', (SELECT count(*) FROM public.import_staging WHERE batch_id = b_id AND status = 'pending'));
END $$;
REVOKE ALL ON FUNCTION public.stage_bank_transactions(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.stage_bank_transactions(uuid, jsonb) TO service_role;

-- Save reviewed rows. Only rows the client actually loaded (in p_edits) are
-- processed, so rows appended by a concurrent fetch stay for the next review.
CREATE OR REPLACE FUNCTION public.complete_bank_review_batch(p_batch_id uuid, p_edits jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  b public.import_batches%ROWTYPE;
  r public.import_staging%ROWTYPE;
  edit jsonb;
  n integer := 0;
  budget_amount numeric;
  expense_id uuid;
  ids bigint[];
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO b FROM public.import_batches
    WHERE id = p_batch_id AND user_id = auth.uid() AND source = 'bank_auto' FOR UPDATE;
  IF NOT FOUND THEN RETURN 0; END IF;

  SELECT array_agg((value->>'id')::bigint) INTO ids FROM jsonb_array_elements(p_edits);
  IF ids IS NULL THEN RETURN 0; END IF;

  FOR edit IN SELECT value FROM jsonb_array_elements(p_edits) LOOP
    UPDATE public.import_staging SET
      category_id = (edit->>'category_id')::uuid,
      cost_assignment = edit->>'cost_assignment',
      selected = (edit->>'selected')::boolean,
      is_group_purchase = coalesce((edit->>'is_group_purchase')::boolean,false),
      group_purchase_user_share = (edit->>'group_purchase_user_share')::numeric,
      group_purchase_partner_share = (edit->>'group_purchase_partner_share')::numeric,
      group_purchase_swish_recipient = edit->>'group_purchase_swish_recipient'
    WHERE id = (edit->>'id')::bigint AND batch_id = b.id AND user_id = auth.uid();
  END LOOP;

  FOR r IN SELECT * FROM public.import_staging
    WHERE batch_id = b.id AND user_id = auth.uid() AND status = 'pending' AND id = ANY(ids) FOR UPDATE LOOP
    IF r.selected AND r.amount <> 0 THEN
      IF r.category_id IS NULL THEN RAISE EXCEPTION 'Category required'; END IF;
      budget_amount := CASE WHEN r.is_group_purchase THEN
        round(coalesce(r.group_purchase_user_share,0) + coalesce(r.group_purchase_partner_share,0),2)
        ELSE r.amount END;
      INSERT INTO public.expenses(user_id,date,description,amount,category_id,cost_assignment,
        bank,is_ccm,is_refund,is_group_purchase,group_purchase_total,
        group_purchase_user_share,group_purchase_partner_share,
        group_purchase_swish_amount,group_purchase_swish_recipient)
      VALUES(auth.uid(),r.date,r.description,budget_amount,r.category_id,
        (CASE WHEN r.is_group_purchase THEN
          CASE WHEN coalesce(r.group_purchase_user_share,0) > 0 AND coalesce(r.group_purchase_partner_share,0) > 0 THEN 'shared'
            WHEN coalesce(r.group_purchase_partner_share,0) > 0 THEN 'partner' ELSE 'personal' END
          ELSE r.cost_assignment END)::public.cost_assignment,
        r.bank,r.is_ccm,budget_amount < 0,r.is_group_purchase,
        CASE WHEN r.is_group_purchase THEN r.amount END,
        r.group_purchase_user_share,r.group_purchase_partner_share,
        CASE WHEN r.is_group_purchase THEN round(r.amount - budget_amount,2) END,
        r.group_purchase_swish_recipient) RETURNING id INTO expense_id;
      INSERT INTO public.savings_goal_contributions(savings_goal_id,expense_id,user_id,amount,user1_amount,user2_amount)
        SELECT c.linked_savings_goal_id,e.id,e.user_id,e.amount,
          CASE e.cost_assignment WHEN 'shared' THEN e.amount/2 WHEN 'partner' THEN 0 ELSE e.amount END,
          CASE e.cost_assignment WHEN 'shared' THEN e.amount/2 WHEN 'partner' THEN e.amount ELSE 0 END
        FROM public.expenses e JOIN public.categories c ON c.id = e.category_id
        WHERE e.id = expense_id AND c.linked_savings_goal_id IS NOT NULL;
      n := n + 1;
    END IF;
  END LOOP;

  -- Inbox status: imported if any split row of the transaction was saved
  UPDATE public.bank_sync_transactions t SET
    status = CASE WHEN EXISTS (SELECT 1 FROM public.import_staging s
      WHERE s.bank_sync_transaction_id = t.id AND s.id = ANY(ids) AND s.selected AND s.amount <> 0)
      THEN 'imported' ELSE 'ignored' END,
    staging_batch_id = NULL
  WHERE t.user_id = auth.uid() AND t.id IN (SELECT bank_sync_transaction_id FROM public.import_staging
    WHERE id = ANY(ids) AND bank_sync_transaction_id IS NOT NULL);

  DELETE FROM public.import_staging WHERE batch_id = b.id AND user_id = auth.uid() AND id = ANY(ids);
  IF NOT EXISTS (SELECT 1 FROM public.import_staging WHERE batch_id = b.id) THEN
    DELETE FROM public.import_batches WHERE id = b.id AND user_id = auth.uid();
  END IF;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.complete_bank_review_batch(uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_bank_review_batch(uuid,jsonb) TO authenticated;

-- Rebuild under the same row lock used by opened_at updates. Readers see either
-- the previous batch or the complete replacement, never a partially cleared one.
CREATE OR REPLACE FUNCTION public.rebuild_amex_review_batch(p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  b public.import_batches%ROWTYPE;
  n integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('amex:' || p_user_id::text, 0));
  INSERT INTO public.import_batches(user_id, source)
    VALUES(p_user_id, 'amex_auto') ON CONFLICT DO NOTHING;
  SELECT * INTO STRICT b FROM public.import_batches
    WHERE user_id = p_user_id AND source = 'amex_auto' FOR UPDATE;
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
    WHERE r.user_id = p_user_id AND r.status IN ('unreviewed', 'imported')
  )
  UPDATE public.amex_sync_transactions r SET status = 'imported'
    FROM ranked x WHERE r.id = x.id AND r.status = 'unreviewed'
    AND x.occurrence <= (
      SELECT count(*) FROM public.expenses e WHERE e.user_id = p_user_id
      AND e.bank = 'Amex' AND e.date = x.transaction_date
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
    WHERE r.user_id = p_user_id AND r.status = 'unreviewed'
  )
  INSERT INTO public.import_staging(batch_id,user_id,bank,date,description,amount,
    category_id,cost_assignment,is_ccm,match_source,selected,status,cardholder,
    amex_sync_transaction_id,pinned,expires_at)
  SELECT b.id,p_user_id,'Amex',r.transaction_date,r.description,r.amount,
    m.category_id,coalesce(m.cost_assignment,'shared'),true,
    CASE WHEN m.id IS NULL THEN 'blank' ELSE 'mappning' END,true,'pending',r.cardholder,
    r.id,true,now() + interval '48 hours'
  FROM eligible r
  LEFT JOIN LATERAL (
    SELECT cm.* FROM public.category_mappings cm WHERE cm.user_id = p_user_id
      AND (cm.bank IS NULL OR lower(cm.bank) = 'amex')
      AND CASE cm.match_type
        WHEN 'exact' THEN lower(r.description) = lower(cm.pattern)
        WHEN 'starts_with' THEN starts_with(lower(r.description),lower(cm.pattern))
        ELSE strpos(lower(r.description),lower(cm.pattern)) > 0 END
    ORDER BY cm.priority DESC, cm.hit_count DESC, cm.id LIMIT 1
  ) m ON true
  WHERE r.occurrence > (
    SELECT count(*) FROM public.import_staging s WHERE s.user_id = p_user_id
      AND s.bank = 'Amex' AND s.status = 'pending' AND s.batch_id <> b.id
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
END $$;
REVOKE ALL ON FUNCTION public.rebuild_amex_review_batch(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rebuild_amex_review_batch(uuid) TO service_role;

-- Save expenses and terminal inbox statuses in the same transaction. A retry
-- after a lost response is harmless because completed metadata has been removed.
CREATE OR REPLACE FUNCTION public.complete_amex_review_batch(p_batch_id uuid, p_edits jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  b public.import_batches%ROWTYPE;
  r public.import_staging%ROWTYPE;
  edit jsonb;
  n integer := 0;
  budget_amount numeric;
  expense_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO b FROM public.import_batches
    WHERE id = p_batch_id AND user_id = auth.uid() AND source = 'amex_auto' FOR UPDATE;
  IF NOT FOUND THEN RETURN 0; END IF;
  IF b.opened_at IS NULL THEN RAISE EXCEPTION 'Open the batch before saving'; END IF;
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
    WHERE batch_id = b.id AND user_id = auth.uid() AND status = 'pending' FOR UPDATE LOOP
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
        'Amex',true,budget_amount < 0,r.is_group_purchase,
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
    UPDATE public.amex_sync_transactions SET
      status = CASE WHEN r.selected AND r.amount <> 0 THEN 'imported' ELSE 'ignored' END,
      staging_batch_id = NULL WHERE id = r.amex_sync_transaction_id AND user_id = auth.uid();
  END LOOP;
  DELETE FROM public.import_staging WHERE batch_id = b.id AND user_id = auth.uid();
  DELETE FROM public.import_batches WHERE id = b.id AND user_id = auth.uid();
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.complete_amex_review_batch(uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_amex_review_batch(uuid,jsonb) TO authenticated;

-- Automatic imports are durable; hourly cleanup must not remove a review.
CREATE OR REPLACE FUNCTION public.pin_amex_staging_row()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF NEW.amex_sync_transaction_id IS NOT NULL THEN NEW.pinned := true; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.pin_amex_staging_row() FROM PUBLIC;
DROP TRIGGER IF EXISTS pin_amex_staging_row ON public.import_staging;
CREATE TRIGGER pin_amex_staging_row BEFORE INSERT OR UPDATE ON public.import_staging
  FOR EACH ROW EXECUTE FUNCTION public.pin_amex_staging_row();

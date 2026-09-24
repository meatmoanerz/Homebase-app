-- Run after the migration in the SAME BEGIN/ROLLBACK transaction.
DO $$
DECLARE
  u uuid := 'b8a41ea4-66f5-4869-98f1-2fe06c4423f3';
  b uuid;
  result jsonb;
  n integer;
  category uuid;
BEGIN
  PERFORM set_config('request.jwt.claim.sub',u::text,true);
  SELECT id INTO STRICT category FROM public.categories WHERE user_id = u LIMIT 1;
  INSERT INTO public.expenses(user_id,date,description,amount,bank,is_ccm,category_id)
    VALUES(u,'2026-09-20','__amex_rollback_test__',42,'Amex',true,category);
  INSERT INTO public.amex_sync_transactions(user_id,fingerprint,occurrence_index,transaction_date,description,amount)
    VALUES(u,'__amex_rollback_test__',1,'2026-09-20','__amex_rollback_test__',42),
      (u,'__amex_rollback_test__',2,'2026-09-20','__amex_rollback_test__',42),
      (u,'__amex_refund_test__',1,'2026-09-21','__amex_refund_test__',-12);
  result := public.rebuild_amex_review_batch(u);
  b := (result->>'batchId')::uuid;
  IF (result->>'staged')::integer <> 2 THEN RAISE EXCEPTION 'Multiset dedupe failed: %',result; END IF;
  result := public.rebuild_amex_review_batch(u);
  IF (result->>'staged')::integer <> 2 THEN RAISE EXCEPTION 'Repeat rebuild failed'; END IF;
  UPDATE public.import_batches SET opened_at = now() WHERE id = b;
  INSERT INTO public.amex_sync_transactions(user_id,fingerprint,transaction_date,description,amount)
    VALUES(u,'__amex_later_test__','2026-09-22','__amex_later_test__',17);
  result := public.rebuild_amex_review_batch(u);
  IF NOT (result->>'batchLocked')::boolean THEN RAISE EXCEPTION 'Opened batch not locked'; END IF;
  IF (SELECT count(*) FROM public.import_staging WHERE batch_id=b) <> 2 THEN RAISE EXCEPTION 'Opened rows changed'; END IF;
  -- A rejected save must preserve both the batch and the expenses.
  BEGIN
    PERFORM public.complete_amex_review_batch(b,'[]');
    RAISE EXCEPTION 'Expected missing-category error';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Category required' THEN RAISE; END IF;
  END;
  UPDATE public.import_staging SET category_id=category WHERE batch_id=b;
  n := public.complete_amex_review_batch(b,'[]');
  IF n <> 2 THEN RAISE EXCEPTION 'Completion count %',n; END IF;
  IF public.complete_amex_review_batch(b,'[]') <> 0 THEN RAISE EXCEPTION 'Retry imported twice'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.expenses WHERE user_id=u AND description='__amex_refund_test__' AND amount=-12 AND is_refund AND is_ccm) THEN
    RAISE EXCEPTION 'Refund/CCM failed';
  END IF;
  result := public.rebuild_amex_review_batch(u);
  IF (result->>'staged')::integer <> 1 THEN RAISE EXCEPTION 'Later purchase missing'; END IF;
  IF has_function_privilege('authenticated','public.rebuild_amex_review_batch(uuid)','EXECUTE')
    OR has_function_privilege('anon','public.complete_amex_review_batch(uuid,jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'RPC permissions too broad';
  END IF;
END $$;

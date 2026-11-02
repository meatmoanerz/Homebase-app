-- Partnern får läsa varandras kvitton, och partnerns profil går att läsa.
--
-- 1. profiles_select: partnervillkoret jämförde pc.user2_id = pc.id
--    (kopplingens id) i stället för profilens id och matchade därför aldrig.
-- 2. receipts, receipt_items, products, product_aliases: ny SELECT-policy för
--    hushållet (ägaren + aktiv partner). Ändringar gäller fortfarande bara
--    egna rader via de befintliga policyerna.
--
-- Skriven utan DROP/REVOKE (ALTER POLICY + nya policyer).

ALTER POLICY profiles_select ON public.profiles
  USING (
    id = (SELECT auth.uid())
    OR id IN (SELECT public.my_household_user_ids())
  );

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['receipts', 'receipt_items', 'products', 'product_aliases']
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = t || '_household_select') THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT USING (user_id IN (SELECT public.my_household_user_ids()))',
        t || '_household_select', t);
    END IF;
  END LOOP;
END $$;

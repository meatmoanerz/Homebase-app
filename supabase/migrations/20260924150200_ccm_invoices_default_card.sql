-- Fakturarader utan kort (t.ex. från äldre klientkod) får hushållets standardkort.
CREATE OR REPLACE FUNCTION public.set_invoice_default_card()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.credit_card_id IS NULL THEN
    WITH household AS (
      SELECT NEW.user_id AS uid
      UNION
      SELECT CASE WHEN pc.user1_id = NEW.user_id THEN pc.user2_id ELSE pc.user1_id END
      FROM partner_connections pc
      WHERE pc.status = 'active' AND (pc.user1_id = NEW.user_id OR pc.user2_id = NEW.user_id)
    )
    SELECT c.id INTO NEW.credit_card_id
    FROM credit_cards c
    WHERE c.user_id IN (SELECT uid FROM household)
    ORDER BY c.is_default DESC, c.created_at
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_invoice_default_card ON public.ccm_invoices;
CREATE TRIGGER set_invoice_default_card
  BEFORE INSERT ON public.ccm_invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_invoice_default_card();

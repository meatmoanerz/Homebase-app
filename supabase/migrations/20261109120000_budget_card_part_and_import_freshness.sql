-- Budget: en rad kan betalas delvis med kort, delvis från konto.
-- Import: hur färska hushållets bankfiler är, för varningen på Ny budget.
--
-- * budget_items.ccm_amount: kortdelen av en rad som betalas både med kort och
--   från konto (t.ex. Prenumerationer: 450 kr på Amex, 189 kr från Swedbank).
--   NULL = ingen delning: raden följer is_ccm (true = allt kort, false = allt
--   konto). Satt bara när is_ccm = false och 0 < ccm_amount < amount; appen
--   sparar annars om raden som ren kort- eller kontorad. Gemensamt konto och
--   "Dras från kontot" räknar amount - ccm_amount.
-- * import_freshness(): per person och bank, senaste transaktionsdatum och
--   senaste uppladdning bland rader från en bankfil (import_source = 'csv').
--   SECURITY INVOKER: RLS på expenses avgör vad som syns (egna + partnerns).

ALTER TABLE public.budget_items ADD COLUMN IF NOT EXISTS ccm_amount numeric;

ALTER TABLE public.budget_items DROP CONSTRAINT IF EXISTS budget_items_ccm_amount_check;
ALTER TABLE public.budget_items ADD CONSTRAINT budget_items_ccm_amount_check
  CHECK (ccm_amount IS NULL OR (ccm_amount >= 0 AND ccm_amount <= COALESCE(amount, 0)));

COMMENT ON COLUMN public.budget_items.ccm_amount IS
  'Kortdelen när raden betalas både med kort och från konto. NULL = följer is_ccm.';

CREATE OR REPLACE FUNCTION public.import_freshness()
RETURNS TABLE (user_id uuid, bank text, latest_date date, last_upload timestamptz)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $function$
  SELECT e.user_id, e.bank, max(e.date), max(e.created_at)
  FROM public.expenses e
  WHERE e.import_source = 'csv' AND e.bank IS NOT NULL
  GROUP BY e.user_id, e.bank
$function$;

REVOKE ALL ON FUNCTION public.import_freshness() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_freshness() TO authenticated;

-- Flera kreditkort i Kreditkortshanteraren (CCM)
--
-- * credit_cards: ett kort per rad, delas inom hushållet (ägare + aktiv partner)
-- * expenses.credit_card_id: vilket kort ett CCM-köp gjordes på
-- * ccm_invoices.credit_card_id: fakturabelopp/betald-status per kort och period
-- * Trigger: CCM-köp utan kort hamnar på kortet vars utgivare matchar
--   expenses.bank (t.ex. 'Amex', 'Norwegian'), annars hushållets standardkort.

CREATE TABLE IF NOT EXISTS public.credit_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  issuer text,                                   -- 'Amex' | 'Norwegian' | NULL (annat)
  invoice_break_date integer NOT NULL DEFAULT 1 CHECK (invoice_break_date BETWEEN 1 AND 28),
  due_day integer NOT NULL DEFAULT 25 CHECK (due_day BETWEEN 1 AND 31),
  is_default boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS credit_cards_user_id_idx ON public.credit_cards(user_id);

ALTER TABLE public.credit_cards ENABLE ROW LEVEL SECURITY;

-- Hushållsdelat: ägaren och aktiv partner får läsa/ändra/ta bort
DROP POLICY IF EXISTS credit_cards_select ON public.credit_cards;
CREATE POLICY credit_cards_select ON public.credit_cards FOR SELECT USING (
  user_id = (SELECT auth.uid()) OR EXISTS (
    SELECT 1 FROM public.partner_connections pc
    WHERE pc.status = 'active'
      AND ((pc.user1_id = (SELECT auth.uid()) AND pc.user2_id = credit_cards.user_id)
        OR (pc.user2_id = (SELECT auth.uid()) AND pc.user1_id = credit_cards.user_id))
  )
);

DROP POLICY IF EXISTS credit_cards_insert ON public.credit_cards;
CREATE POLICY credit_cards_insert ON public.credit_cards FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS credit_cards_update ON public.credit_cards;
CREATE POLICY credit_cards_update ON public.credit_cards FOR UPDATE USING (
  user_id = (SELECT auth.uid()) OR EXISTS (
    SELECT 1 FROM public.partner_connections pc
    WHERE pc.status = 'active'
      AND ((pc.user1_id = (SELECT auth.uid()) AND pc.user2_id = credit_cards.user_id)
        OR (pc.user2_id = (SELECT auth.uid()) AND pc.user1_id = credit_cards.user_id))
  )
);

DROP POLICY IF EXISTS credit_cards_delete ON public.credit_cards;
CREATE POLICY credit_cards_delete ON public.credit_cards FOR DELETE USING (
  user_id = (SELECT auth.uid()) OR EXISTS (
    SELECT 1 FROM public.partner_connections pc
    WHERE pc.status = 'active'
      AND ((pc.user1_id = (SELECT auth.uid()) AND pc.user2_id = credit_cards.user_id)
        OR (pc.user2_id = (SELECT auth.uid()) AND pc.user1_id = credit_cards.user_id))
  )
);

DROP TRIGGER IF EXISTS update_credit_cards_updated_at ON public.credit_cards;
CREATE TRIGGER update_credit_cards_updated_at
  BEFORE UPDATE ON public.credit_cards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Kolumner
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS credit_card_id uuid REFERENCES public.credit_cards(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS expenses_credit_card_id_idx ON public.expenses(credit_card_id);

ALTER TABLE public.ccm_invoices
  ADD COLUMN IF NOT EXISTS credit_card_id uuid REFERENCES public.credit_cards(id) ON DELETE CASCADE;

-- Backfill: ett kort per användare som har CCM-data (befintligt = Amex)
INSERT INTO public.credit_cards (user_id, name, issuer, invoice_break_date, due_day, is_default)
SELECT u.user_id,
       CASE WHEN u.has_amex THEN 'Amex' ELSE 'Kreditkort' END,
       CASE WHEN u.has_amex THEN 'Amex' ELSE NULL END,
       LEAST(GREATEST(COALESCE(p.ccm_invoice_break_date, 1), 1), 28),
       CASE WHEN u.has_amex THEN 27 ELSE 25 END,
       true
FROM (
  SELECT user_id, bool_or(bank = 'Amex') AS has_amex
  FROM (
    SELECT user_id, bank FROM public.expenses WHERE is_ccm
    UNION ALL
    SELECT user_id, NULL FROM public.ccm_invoices
  ) x
  GROUP BY user_id
) u
LEFT JOIN public.profiles p ON p.id = u.user_id
WHERE NOT EXISTS (SELECT 1 FROM public.credit_cards c WHERE c.user_id = u.user_id);

UPDATE public.expenses e
SET credit_card_id = c.id
FROM public.credit_cards c
WHERE e.is_ccm AND e.credit_card_id IS NULL AND c.user_id = e.user_id AND c.is_default;

UPDATE public.ccm_invoices i
SET credit_card_id = c.id
FROM public.credit_cards c
WHERE i.credit_card_id IS NULL AND c.user_id = i.user_id AND c.is_default;

-- Fakturor är nu unika per kort och period
ALTER TABLE public.ccm_invoices ALTER COLUMN credit_card_id SET NOT NULL;
ALTER TABLE public.ccm_invoices DROP CONSTRAINT IF EXISTS ccm_invoices_user_id_period_key;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ccm_invoices_card_period_key') THEN
    ALTER TABLE public.ccm_invoices ADD CONSTRAINT ccm_invoices_card_period_key UNIQUE (credit_card_id, period);
  END IF;
END $$;

-- Partnern får uppdatera hushållets fakturor (belopp/betald)
DROP POLICY IF EXISTS ccm_invoices_update ON public.ccm_invoices;
CREATE POLICY ccm_invoices_update ON public.ccm_invoices FOR UPDATE USING (
  user_id = (SELECT auth.uid()) OR EXISTS (
    SELECT 1 FROM public.partner_connections pc
    WHERE pc.status = 'active'
      AND ((pc.user1_id = (SELECT auth.uid()) AND pc.user2_id = ccm_invoices.user_id)
        OR (pc.user2_id = (SELECT auth.uid()) AND pc.user1_id = ccm_invoices.user_id))
  )
);

-- Trigger: sätt kort på CCM-köp
CREATE OR REPLACE FUNCTION public.set_expense_credit_card()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_card uuid;
BEGIN
  IF NOT COALESCE(NEW.is_ccm, false) THEN
    NEW.credit_card_id := NULL;
    RETURN NEW;
  END IF;

  IF NEW.credit_card_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  WITH household AS (
    SELECT NEW.user_id AS uid
    UNION
    SELECT CASE WHEN pc.user1_id = NEW.user_id THEN pc.user2_id ELSE pc.user1_id END
    FROM partner_connections pc
    WHERE pc.status = 'active' AND (pc.user1_id = NEW.user_id OR pc.user2_id = NEW.user_id)
  )
  SELECT c.id INTO v_card
  FROM credit_cards c
  WHERE c.user_id IN (SELECT uid FROM household)
  ORDER BY
    COALESCE(lower(c.issuer) = lower(NEW.bank), false) DESC,
    c.is_default DESC,
    c.created_at
  LIMIT 1;

  NEW.credit_card_id := v_card;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_expense_credit_card ON public.expenses;
CREATE TRIGGER set_expense_credit_card
  BEFORE INSERT OR UPDATE OF is_ccm, credit_card_id, bank ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_expense_credit_card();

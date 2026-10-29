-- Household economy model ("Så delar ni ekonomin")
--
-- Extends the effective-dated, household-shared shared_account_defaults with:
--   model                 'budget' = each keeps their income, costs split as the
--                                    budget says
--                         'income' = each keeps their income, income_category_ids
--                                    split by income share
--                         'equal'  = income shared equally (the higher earner
--                                    transfers half the difference), costs as
--                                    the budget says
--   excluded_income_names incomes left out of the share/equalization
--                         (by monthly_incomes.name, e.g. 'Bonus'); new income
--                         types count by default
--   income_category_ids   subset of category_ids split by income share
--   updated_at            orders two saves for the same period (one per partner)
--
-- household_settlement_checks: the per-period "Att göra" checklist on
-- Gemensam ekonomi (swish + deposits), shared between the partners.
--
-- budget_items.is_manual_amount: rows filled from a source (loans, credit
-- cards) follow it until someone types their own amount.

ALTER TABLE public.shared_account_defaults
  ADD COLUMN IF NOT EXISTS model text NOT NULL DEFAULT 'budget',
  ADD COLUMN IF NOT EXISTS excluded_income_names text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS income_category_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.shared_account_defaults
  DROP CONSTRAINT IF EXISTS shared_account_defaults_model_check;
ALTER TABLE public.shared_account_defaults
  ADD CONSTRAINT shared_account_defaults_model_check
  CHECK (model IN ('budget', 'income', 'equal'));

UPDATE public.shared_account_defaults SET updated_at = coalesce(created_at, now());

DROP TRIGGER IF EXISTS update_shared_account_defaults_updated_at ON public.shared_account_defaults;
CREATE TRIGGER update_shared_account_defaults_updated_at
  BEFORE UPDATE ON public.shared_account_defaults
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE IF NOT EXISTS public.household_settlement_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  period text NOT NULL, -- budget period 'YYYY-MM'
  step text NOT NULL,   -- 'equalize' | 'deposit:<user_id>'
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, period, step)
);

CREATE INDEX IF NOT EXISTS household_settlement_checks_period_idx
  ON public.household_settlement_checks (period);

ALTER TABLE public.household_settlement_checks ENABLE ROW LEVEL SECURITY;

-- Own rows and the active partner's
DROP POLICY IF EXISTS "household_settlement_checks_select" ON public.household_settlement_checks;
CREATE POLICY "household_settlement_checks_select"
  ON public.household_settlement_checks FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.partner_connections pc
      WHERE pc.status = 'active'
        AND ((pc.user1_id = (SELECT auth.uid()) AND pc.user2_id = household_settlement_checks.user_id)
          OR (pc.user2_id = (SELECT auth.uid()) AND pc.user1_id = household_settlement_checks.user_id))
    )
  );

DROP POLICY IF EXISTS "household_settlement_checks_insert" ON public.household_settlement_checks;
CREATE POLICY "household_settlement_checks_insert"
  ON public.household_settlement_checks FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Either partner may untick a step, whoever ticked it
DROP POLICY IF EXISTS "household_settlement_checks_delete" ON public.household_settlement_checks;
CREATE POLICY "household_settlement_checks_delete"
  ON public.household_settlement_checks FOR DELETE TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.partner_connections pc
      WHERE pc.status = 'active'
        AND ((pc.user1_id = (SELECT auth.uid()) AND pc.user2_id = household_settlement_checks.user_id)
          OR (pc.user2_id = (SELECT auth.uid()) AND pc.user1_id = household_settlement_checks.user_id))
    )
  );

ALTER TABLE public.budget_items
  ADD COLUMN IF NOT EXISTS is_manual_amount boolean;

-- Existing budgets keep their amounts: treat them as typed in, so opening an
-- old budget only suggests the current source value instead of replacing it
UPDATE public.budget_items SET is_manual_amount = true WHERE is_manual_amount IS NULL;
ALTER TABLE public.budget_items ALTER COLUMN is_manual_amount SET DEFAULT false;
ALTER TABLE public.budget_items ALTER COLUMN is_manual_amount SET NOT NULL;

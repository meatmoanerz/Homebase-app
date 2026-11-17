-- Betala med sparande: a withdrawal from a savings goal can pay (part of) an expense.
--
-- The money was already counted once, as savings, in the months it was put
-- aside. Counting the purchase in full again would count it twice. So:
--   - savings_goal_contributions.funded_expense_id links a withdrawal (negative
--     amount, no expense_id) to the expense it pays.
--   - expenses.savings_funded = how much of the expense is paid from savings,
--     kept in sync by trigger. Consumption / budget outcome counts
--     amount - savings_funded; the transaction itself keeps its full amount
--     (card invoices and reconciliation are unchanged).
--   - The withdrawal's date is when the money moves to the paying account; cash
--     flow counts it as money in on that date.
-- Deleting the expense deletes its funding, which puts the money back in the goal.

ALTER TABLE public.savings_goal_contributions
  ADD COLUMN IF NOT EXISTS funded_expense_id uuid
  REFERENCES public.expenses(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS savings_goal_contributions_funded_expense_idx
  ON public.savings_goal_contributions(funded_expense_id)
  WHERE funded_expense_id IS NOT NULL;

ALTER TABLE public.savings_goal_contributions
  DROP CONSTRAINT IF EXISTS savings_goal_contributions_funding_check;
ALTER TABLE public.savings_goal_contributions
  ADD CONSTRAINT savings_goal_contributions_funding_check
  CHECK (funded_expense_id IS NULL OR (expense_id IS NULL AND amount < 0));

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS savings_funded numeric(12,2) NOT NULL DEFAULT 0;

-- The person adding the funding must be able to see the expense (RLS applies:
-- SECURITY INVOKER), and funding can never exceed what the expense counts.
CREATE OR REPLACE FUNCTION public.check_savings_funding()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_amount numeric;
  v_funded numeric;
BEGIN
  IF NEW.funded_expense_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT e.amount INTO v_amount FROM public.expenses e WHERE e.id = NEW.funded_expense_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Utgiften finns inte';
  END IF;
  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'Bara köp kan betalas med sparande';
  END IF;

  SELECT coalesce(-sum(c.amount), 0) INTO v_funded
    FROM public.savings_goal_contributions c
   WHERE c.funded_expense_id = NEW.funded_expense_id
     AND c.id IS DISTINCT FROM NEW.id;

  IF v_funded - NEW.amount > v_amount + 0.005 THEN
    RAISE EXCEPTION 'Mer än utgiftens belopp kan inte betalas med sparande';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_savings_funding_trigger ON public.savings_goal_contributions;
CREATE TRIGGER check_savings_funding_trigger
  BEFORE INSERT OR UPDATE OF funded_expense_id, amount ON public.savings_goal_contributions
  FOR EACH ROW EXECUTE FUNCTION public.check_savings_funding();

-- Keep expenses.savings_funded in sync. SECURITY DEFINER: a partner may fund
-- the owner's shared expense without having update rights on it.
CREATE OR REPLACE FUNCTION public.sync_expense_savings_funded()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ids uuid[];
BEGIN
  v_ids := array_remove(ARRAY[
    CASE WHEN TG_OP <> 'DELETE' THEN NEW.funded_expense_id END,
    CASE WHEN TG_OP <> 'INSERT' THEN OLD.funded_expense_id END
  ], NULL);
  IF array_length(v_ids, 1) IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.expenses e SET savings_funded = coalesce((
    SELECT -sum(c.amount) FROM public.savings_goal_contributions c
     WHERE c.funded_expense_id = e.id), 0)
   WHERE e.id = ANY(v_ids);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS sync_expense_savings_funded_trigger ON public.savings_goal_contributions;
CREATE TRIGGER sync_expense_savings_funded_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.savings_goal_contributions
  FOR EACH ROW EXECUTE FUNCTION public.sync_expense_savings_funded();

REVOKE EXECUTE ON FUNCTION public.sync_expense_savings_funded() FROM PUBLIC, anon, authenticated;

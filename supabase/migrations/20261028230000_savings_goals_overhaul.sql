-- Savings goals overhaul
--
-- 1. initial_balance ("Redan sparat") is stored on its own. starting_balance and
--    starting_balance_user1/2 become derived totals, recomputed by trigger:
--      starting_balance       = initial_balance + sum(contributions.amount)
--      starting_balance_userN = sum(contributions.userN_amount)
-- 2. Contributions follow their expense in the database: an expense in a goal's
--    category gets a contribution on insert, and it is moved/updated/removed when
--    the expense's category, amount, cost assignment or owner changes. Covers
--    every write path (app, imports, SQL from Claude). user1 = goal owner,
--    user2 = the owner's partner.
-- 3. Manual entries without an expense (withdrawals, "uttag"), and negative
--    amounts (refunds in a goal's category).
-- 4. Partner access to shared goals: see, edit and archive them, and see and
--    add their contributions.
-- 5. create_savings_goal(): category + goal + link in one transaction.
--
-- Backwards compatible with clients that still write starting_balance directly
-- or insert contributions themselves (see the guard trigger below).

-- ---------------------------------------------------------------------------
-- 1. initial_balance
-- ---------------------------------------------------------------------------
ALTER TABLE public.savings_goals
  ADD COLUMN IF NOT EXISTS initial_balance numeric(12,2) NOT NULL DEFAULT 0;

-- Backfill before the derive trigger exists: what is not explained by
-- contributions was entered as already saved.
UPDATE public.savings_goals sg SET initial_balance =
  coalesce(sg.starting_balance, 0) - coalesce((
    SELECT sum(c.amount) FROM public.savings_goal_contributions c
    WHERE c.savings_goal_id = sg.id), 0);

-- ---------------------------------------------------------------------------
-- 3. Contributions without an expense, negative amounts
-- ---------------------------------------------------------------------------
ALTER TABLE public.savings_goal_contributions ALTER COLUMN expense_id DROP NOT NULL;
ALTER TABLE public.savings_goal_contributions ADD COLUMN IF NOT EXISTS date date;
ALTER TABLE public.savings_goal_contributions ADD COLUMN IF NOT EXISTS note text;

ALTER TABLE public.savings_goal_contributions
  DROP CONSTRAINT IF EXISTS savings_goal_contributions_amount_check;
ALTER TABLE public.savings_goal_contributions
  ADD CONSTRAINT savings_goal_contributions_amount_check CHECK (amount <> 0);

-- A manual entry needs its own date; expense-linked ones use the expense's date
ALTER TABLE public.savings_goal_contributions
  DROP CONSTRAINT IF EXISTS savings_goal_contributions_manual_date_check;
ALTER TABLE public.savings_goal_contributions
  ADD CONSTRAINT savings_goal_contributions_manual_date_check
  CHECK (expense_id IS NOT NULL OR date IS NOT NULL);

-- ---------------------------------------------------------------------------
-- Derived balances on savings_goals
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.savings_goals_derive_balances()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_total numeric;
  v_user1 numeric;
  v_user2 numeric;
BEGIN
  SELECT coalesce(sum(c.amount), 0),
         coalesce(sum(c.user1_amount), 0),
         coalesce(sum(c.user2_amount), 0)
    INTO v_total, v_user1, v_user2
    FROM public.savings_goal_contributions c
   WHERE c.savings_goal_id = NEW.id;

  IF TG_OP = 'INSERT' THEN
    -- Older clients send the already-saved amount as starting_balance
    IF NEW.initial_balance = 0 AND coalesce(NEW.starting_balance, 0) <> 0 THEN
      NEW.initial_balance := NEW.starting_balance;
    END IF;
  ELSE
    -- Owner and category never change hands
    NEW.user_id := OLD.user_id;
    NEW.category_id := OLD.category_id;
    -- Older clients edit "Redan sparat" through starting_balance
    IF NEW.starting_balance IS DISTINCT FROM OLD.starting_balance
       AND NEW.initial_balance IS NOT DISTINCT FROM OLD.initial_balance THEN
      NEW.initial_balance := coalesce(NEW.starting_balance, 0) - v_total;
    END IF;
  END IF;

  NEW.starting_balance := NEW.initial_balance + v_total;
  NEW.starting_balance_user1 := v_user1;
  NEW.starting_balance_user2 := v_user2;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS savings_goals_derive_balances_trigger ON public.savings_goals;
CREATE TRIGGER savings_goals_derive_balances_trigger
  BEFORE INSERT OR UPDATE ON public.savings_goals
  FOR EACH ROW EXECUTE FUNCTION public.savings_goals_derive_balances();

-- Any change to contributions re-derives the affected goals' balances
CREATE OR REPLACE FUNCTION public.update_savings_goal_on_contribution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    UPDATE public.savings_goals SET updated_at = now() WHERE id = NEW.savings_goal_id;
  END IF;
  IF TG_OP = 'DELETE'
     OR (TG_OP = 'UPDATE' AND OLD.savings_goal_id <> NEW.savings_goal_id) THEN
    UPDATE public.savings_goals SET updated_at = now() WHERE id = OLD.savings_goal_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS update_savings_goal_on_contribution_trigger ON public.savings_goal_contributions;
CREATE TRIGGER update_savings_goal_on_contribution_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.savings_goal_contributions
  FOR EACH ROW EXECUTE FUNCTION public.update_savings_goal_on_contribution();

-- ---------------------------------------------------------------------------
-- 2. Contributions follow their expense
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_expense_savings_contribution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_goal_id uuid;
  v_owner_id uuid;
  v_creator_share numeric;
  v_user1 numeric;
  v_user2 numeric;
  v_existing public.savings_goal_contributions%ROWTYPE;
BEGIN
  SELECT c.linked_savings_goal_id, c.user_id INTO v_goal_id, v_owner_id
    FROM public.categories c WHERE c.id = NEW.category_id;

  IF v_goal_id IS NOT NULL AND NEW.amount <> 0 THEN
    v_creator_share := CASE NEW.cost_assignment
      WHEN 'shared' THEN round(NEW.amount / 2, 2)
      WHEN 'partner' THEN 0
      ELSE NEW.amount END;
    IF NEW.user_id = v_owner_id THEN
      v_user1 := v_creator_share;
      v_user2 := NEW.amount - v_creator_share;
    ELSE
      v_user1 := NEW.amount - v_creator_share;
      v_user2 := v_creator_share;
    END IF;
  ELSE
    v_goal_id := NULL;
  END IF;

  SELECT * INTO v_existing FROM public.savings_goal_contributions
   WHERE expense_id = NEW.id;

  IF v_existing.id IS NULL THEN
    IF v_goal_id IS NOT NULL THEN
      INSERT INTO public.savings_goal_contributions
        (savings_goal_id, expense_id, user_id, amount, user1_amount, user2_amount)
      VALUES (v_goal_id, NEW.id, NEW.user_id, NEW.amount, v_user1, v_user2);
    END IF;
  ELSIF v_goal_id IS NULL THEN
    DELETE FROM public.savings_goal_contributions WHERE id = v_existing.id;
  ELSIF v_existing.savings_goal_id <> v_goal_id
     OR v_existing.amount <> NEW.amount
     OR coalesce(v_existing.user1_amount, 0) <> v_user1
     OR coalesce(v_existing.user2_amount, 0) <> v_user2 THEN
    UPDATE public.savings_goal_contributions
       SET savings_goal_id = v_goal_id, amount = NEW.amount,
           user1_amount = v_user1, user2_amount = v_user2
     WHERE id = v_existing.id;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS sync_expense_savings_contribution_trigger ON public.expenses;
CREATE TRIGGER sync_expense_savings_contribution_trigger
  AFTER INSERT OR UPDATE OF category_id, amount, cost_assignment, user_id ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.sync_expense_savings_contribution();

-- The import RPCs (complete_amex_review_batch, complete_bank_review_batch) and
-- older app versions still insert a contribution right after the expense. The
-- expense trigger has made it already, so skip the duplicate instead of
-- failing on UNIQUE(expense_id) and rolling back the whole import.
CREATE OR REPLACE FUNCTION public.skip_duplicate_expense_contribution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.expense_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.savings_goal_contributions WHERE expense_id = NEW.expense_id
  ) THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS skip_duplicate_expense_contribution_trigger ON public.savings_goal_contributions;
CREATE TRIGGER skip_duplicate_expense_contribution_trigger
  BEFORE INSERT ON public.savings_goal_contributions
  FOR EACH ROW EXECUTE FUNCTION public.skip_duplicate_expense_contribution();

-- ---------------------------------------------------------------------------
-- 4. Partner access to shared goals
-- ---------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated;

-- True when the current user owns the goal, or it is shared and owned by their
-- active partner. Used by RLS policies.
CREATE OR REPLACE FUNCTION private.can_access_savings_goal(p_goal_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.savings_goals sg
    WHERE sg.id = p_goal_id
      AND (sg.user_id = (SELECT auth.uid())
        OR (sg.is_shared AND EXISTS (
          SELECT 1 FROM public.partner_connections pc
          WHERE pc.status = 'active'
            AND ((pc.user1_id = (SELECT auth.uid()) AND pc.user2_id = sg.user_id)
              OR (pc.user2_id = (SELECT auth.uid()) AND pc.user1_id = sg.user_id)))))
  );
$$;

REVOKE EXECUTE ON FUNCTION private.can_access_savings_goal(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.can_access_savings_goal(uuid) TO authenticated;

DROP POLICY IF EXISTS "savings_goals_update" ON public.savings_goals;
CREATE POLICY "savings_goals_update"
  ON public.savings_goals FOR UPDATE
  USING ((SELECT private.can_access_savings_goal(id)))
  WITH CHECK (user_id = (SELECT auth.uid()) OR is_shared);

DROP POLICY IF EXISTS "savings_goal_contributions_select" ON public.savings_goal_contributions;
CREATE POLICY "savings_goal_contributions_select"
  ON public.savings_goal_contributions FOR SELECT
  USING (user_id = (SELECT auth.uid())
    OR private.can_access_savings_goal(savings_goal_id));

DROP POLICY IF EXISTS "savings_goal_contributions_insert" ON public.savings_goal_contributions;
CREATE POLICY "savings_goal_contributions_insert"
  ON public.savings_goal_contributions FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid())
    AND private.can_access_savings_goal(savings_goal_id));

-- Expense-linked contributions are managed by the expense trigger; only manual
-- entries can be removed directly
DROP POLICY IF EXISTS "savings_goal_contributions_delete" ON public.savings_goal_contributions;
CREATE POLICY "savings_goal_contributions_delete"
  ON public.savings_goal_contributions FOR DELETE
  USING (expense_id IS NULL AND private.can_access_savings_goal(savings_goal_id));

-- ---------------------------------------------------------------------------
-- 5. Atomic goal creation
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_savings_goal(
  p_name text,
  p_description text DEFAULT NULL,
  p_target_amount numeric DEFAULT NULL,
  p_target_date date DEFAULT NULL,
  p_initial_balance numeric DEFAULT 0,
  p_goal_category public.goal_category DEFAULT 'other',
  p_custom_goal_type_id uuid DEFAULT NULL,
  p_is_shared boolean DEFAULT false
)
RETURNS public.savings_goals
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_category_id uuid;
  v_goal public.savings_goals;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.categories (user_id, name, cost_type, subcategory, is_default)
  VALUES (v_user_id, p_name, 'Savings', 'Savings', false)
  RETURNING id INTO v_category_id;

  INSERT INTO public.savings_goals (user_id, category_id, name, description,
    target_amount, target_date, initial_balance, goal_category,
    custom_goal_type_id, is_shared, status)
  VALUES (v_user_id, v_category_id, p_name, p_description,
    p_target_amount, p_target_date, coalesce(p_initial_balance, 0), p_goal_category,
    p_custom_goal_type_id, p_is_shared, 'active')
  RETURNING * INTO v_goal;

  UPDATE public.categories SET linked_savings_goal_id = v_goal.id
  WHERE id = v_category_id;

  RETURN v_goal;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_savings_goal(text, text, numeric, date, numeric, public.goal_category, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_savings_goal(text, text, numeric, date, numeric, public.goal_category, uuid, boolean) TO authenticated;

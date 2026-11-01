-- Lock down accounts and partner connections
--
-- Before this migration any signed-in user could insert an *active* row in
-- partner_connections pointing at any other user (the insert policy only
-- checked initiated_by), and so read that user's expenses, budgets and
-- incomes through the partner-sharing RLS policies. join_partner_connection
-- trusted a p_user_id from the client and could be called by anon. Every
-- signed-in user could read all pending invite codes.
--
-- After it:
--   * Only create_partner_invite() and join_partner_connection() can create
--     or activate a connection. Both use auth.uid(), never a client id.
--   * A user can have at most one active connection and one pending invite.
--   * Clients can only read their own rows, create a pending invite for
--     themselves and set an active connection to 'revoked'.
--   * The partner's profile is readable again (the policy compared against
--     partner_connections.id instead of profiles.id).
--   * SECURITY DEFINER functions are no longer callable by anon, and all
--     functions flagged by the linter get a fixed search_path.
--
-- Compatible with the previous client: it inserted exactly a pending self
-- invite, deleted its own pending invites, updated status to 'revoked' and
-- called join_partner_connection(p_invite_code, p_user_id) with its own id.

-- ---------------------------------------------------------------------------
-- 1. partner_connections: constraints
-- ---------------------------------------------------------------------------

-- Expired invites are dead weight and would block the one-pending rule
DELETE FROM public.partner_connections
WHERE status = 'pending' AND (expires_at IS NULL OR expires_at < now());

-- UNIQUE (user1_id, user2_id) made it impossible to reconnect the same pair
-- after a revoke. Replaced by the rules below.
ALTER TABLE public.partner_connections
  DROP CONSTRAINT IF EXISTS partner_connections_user1_id_user2_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS partner_connections_one_pending_per_user
  ON public.partner_connections (initiated_by)
  WHERE status = 'pending';

-- One active connection per user, per side. A user being user1 in one active
-- row and user2 in another is prevented by join_partner_connection(), the
-- only path to an active row (it serializes joins with an advisory lock).
CREATE UNIQUE INDEX IF NOT EXISTS partner_connections_one_active_user1
  ON public.partner_connections (user1_id)
  WHERE status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS partner_connections_one_active_user2
  ON public.partner_connections (user2_id)
  WHERE status = 'active';

-- ---------------------------------------------------------------------------
-- 2. partner_connections: privileges and RLS
-- ---------------------------------------------------------------------------

REVOKE ALL ON public.partner_connections FROM anon;
REVOKE INSERT, UPDATE, TRUNCATE, REFERENCES, TRIGGER ON public.partner_connections FROM authenticated;
GRANT INSERT (user1_id, user2_id, initiated_by, invite_code, status, expires_at)
  ON public.partner_connections TO authenticated;
-- The only column a client may change is status (and only to 'revoked')
GRANT UPDATE (status) ON public.partner_connections TO authenticated;

DROP POLICY IF EXISTS partner_connections_select ON public.partner_connections;
DROP POLICY IF EXISTS partner_connections_insert ON public.partner_connections;
DROP POLICY IF EXISTS partner_connections_update ON public.partner_connections;
DROP POLICY IF EXISTS partner_connections_delete ON public.partner_connections;

-- Own rows only. Invite codes are looked up inside join_partner_connection().
CREATE POLICY partner_connections_select ON public.partner_connections
  FOR SELECT TO authenticated
  USING (
    user1_id = (SELECT auth.uid())
    OR user2_id = (SELECT auth.uid())
    OR initiated_by = (SELECT auth.uid())
  );

-- A pending invite for yourself, nothing else
CREATE POLICY partner_connections_insert ON public.partner_connections
  FOR INSERT TO authenticated
  WITH CHECK (
    initiated_by = (SELECT auth.uid())
    AND user1_id = (SELECT auth.uid())
    AND user2_id = (SELECT auth.uid())
    AND status = 'pending'
    AND invite_code IS NOT NULL
    AND expires_at IS NOT NULL
    AND expires_at <= now() + interval '2 hours'
  );

-- Either side may end an active connection (or cancel its pending invite)
CREATE POLICY partner_connections_update ON public.partner_connections
  FOR UPDATE TO authenticated
  USING (
    status IN ('active', 'pending')
    AND (user1_id = (SELECT auth.uid()) OR user2_id = (SELECT auth.uid()))
  )
  WITH CHECK (status = 'revoked');

-- Only your own pending invite can be deleted; connections are revoked
CREATE POLICY partner_connections_delete ON public.partner_connections
  FOR DELETE TO authenticated
  USING (initiated_by = (SELECT auth.uid()) AND status = 'pending');

-- ---------------------------------------------------------------------------
-- 3. Invite and join functions
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_partner_invite()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  -- No I, L, O, 0 or 1: easy to read out loud and type
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_expires timestamptz := now() + interval '1 hour';
  v_bytes bytea;
  v_code text;
  v_attempt int := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.partner_connections
    WHERE status = 'active' AND (user1_id = v_uid OR user2_id = v_uid)
  ) THEN
    RETURN json_build_object('success', false, 'error', 'already_connected');
  END IF;

  DELETE FROM public.partner_connections
  WHERE initiated_by = v_uid AND status = 'pending';

  LOOP
    v_attempt := v_attempt + 1;
    v_bytes := extensions.gen_random_bytes(6);
    v_code := '';
    FOR i IN 0..5 LOOP
      v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % length(v_alphabet)) + 1, 1);
    END LOOP;

    BEGIN
      INSERT INTO public.partner_connections
        (user1_id, user2_id, initiated_by, invite_code, status, expires_at)
      VALUES (v_uid, v_uid, v_uid, v_code, 'pending', v_expires);
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      -- Code collision (or a concurrent call): try again a few times
      IF v_attempt >= 5 THEN
        RETURN json_build_object('success', false, 'error', 'could_not_create_code');
      END IF;
    END;
  END LOOP;

  RETURN json_build_object('success', true, 'invite_code', v_code, 'expires_at', v_expires);
END;
$$;

-- Same signature as before so the previous client keeps working; p_user_id
-- is only accepted when it is the caller's own id.
DROP FUNCTION IF EXISTS public.join_partner_connection(text, uuid);

CREATE FUNCTION public.join_partner_connection(p_invite_code text, p_user_id uuid DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_conn public.partner_connections%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  IF p_user_id IS NOT NULL AND p_user_id <> v_uid THEN
    RETURN json_build_object('success', false, 'error', 'not_allowed');
  END IF;

  -- Serialize joins so two people can't both connect to the same person
  PERFORM pg_advisory_xact_lock(hashtext('public.partner_connections.join'));

  SELECT * INTO v_conn
  FROM public.partner_connections
  WHERE invite_code = upper(btrim(p_invite_code))
    AND status = 'pending'
    AND expires_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'invalid_or_expired_code');
  END IF;

  IF v_conn.initiated_by = v_uid THEN
    RETURN json_build_object('success', false, 'error', 'cannot_join_own_invite');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.partner_connections
    WHERE status = 'active' AND (user1_id = v_uid OR user2_id = v_uid)
  ) THEN
    RETURN json_build_object('success', false, 'error', 'already_connected');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.partner_connections
    WHERE status = 'active'
      AND (user1_id = v_conn.initiated_by OR user2_id = v_conn.initiated_by)
  ) THEN
    RETURN json_build_object('success', false, 'error', 'inviter_already_connected');
  END IF;

  -- created_at marks when the connection started: partner-shared expenses
  -- are visible from this moment on
  UPDATE public.partner_connections
  SET user2_id = v_uid,
      status = 'active',
      invite_code = NULL,
      created_at = now()
  WHERE id = v_conn.id;

  -- The joiner's own invite, if any, is no longer needed
  DELETE FROM public.partner_connections
  WHERE initiated_by = v_uid AND status = 'pending';

  RETURN json_build_object(
    'success', true,
    'connection_id', v_conn.id,
    'partner_id', v_conn.initiated_by
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_partner_invite() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.join_partner_connection(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_partner_invite() TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_partner_connection(text, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. profiles: partner profile readable (fixes pc.id vs profiles.id)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS profiles_select ON public.profiles;

CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.partner_connections pc
      WHERE pc.status = 'active'
        AND (
          (pc.user1_id = (SELECT auth.uid()) AND pc.user2_id = profiles.id)
          OR (pc.user2_id = (SELECT auth.uid()) AND pc.user1_id = profiles.id)
        )
    )
  );

-- ---------------------------------------------------------------------------
-- 5. SECURITY DEFINER functions: no anon, fixed search_path
-- ---------------------------------------------------------------------------

-- Could create categories for any user id; only used internally
REVOKE EXECUTE ON FUNCTION public.create_user_default_categories(uuid) FROM PUBLIC, anon, authenticated;

-- Trigger functions: never called directly (triggers don't check EXECUTE)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_default_categories() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.release_amex_batch_transactions() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.release_bank_batch_transactions() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_expense_credit_card() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_invoice_default_card() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.savings_goals_derive_balances() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_expense_savings_contribution() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.skip_duplicate_expense_contribution() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_savings_goal_on_contribution() FROM PUBLIC, anon, authenticated;

-- RPCs the app calls while signed in: keep for authenticated, drop anon
REVOKE EXECUTE ON FUNCTION public.get_household_income() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_household_monthly_incomes(character varying) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_household_monthly_income_total(character varying) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_income_for_period(character varying) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.increment_mapping_hit(uuid) FROM PUBLIC, anon;

ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.create_default_categories() SET search_path = public;
ALTER FUNCTION public.create_user_default_categories(uuid) SET search_path = public;
ALTER FUNCTION public.get_household_income() SET search_path = public;
ALTER FUNCTION public.get_household_monthly_incomes(character varying) SET search_path = public;
ALTER FUNCTION public.get_household_monthly_income_total(character varying) SET search_path = public;
ALTER FUNCTION public.has_income_for_period(character varying) SET search_path = public;
ALTER FUNCTION public.increment_mapping_hit(uuid) SET search_path = public;
ALTER FUNCTION public.get_partner_id(uuid) SET search_path = public;
ALTER FUNCTION public.get_savings_goal_contributions(uuid) SET search_path = public;
ALTER FUNCTION public.update_updated_at() SET search_path = public;
ALTER FUNCTION public.update_ccm_invoices_updated_at() SET search_path = public;
ALTER FUNCTION public.update_monthly_incomes_updated_at() SET search_path = public;

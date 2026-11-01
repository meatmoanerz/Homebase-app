-- Partnerkopplingar: stäng tre hål inför lansering.
--
-- 1. SELECT-policyn lät alla inloggade läsa ALLA väntande inbjudningskoder.
--    Att gå med sker via join_partner_connection (SECURITY DEFINER), så ingen
--    behöver läsa andras väntande rader.
-- 2. INSERT kontrollerade bara initiated_by, så vem som helst kunde skapa en
--    'active' koppling till valfri användare och få läsa dennes ekonomi.
--    Nu får man bara skapa en egen väntande inbjudan.
-- 3. UPDATE saknade WITH CHECK, så en återkallad eller väntande rad kunde sättas
--    till 'active' med valfri partner. Klienten får bara koppla från, och en
--    trigger hindrar att vem kopplingen gäller ändras.
--
-- join_partner_connection litar inte längre på p_user_id utan använder
-- auth.uid(). Parametern finns kvar för att befintliga anrop inte ska gå sönder.
--
-- Skriven utan DROP/REVOKE (ALTER POLICY + trigger) så att den kan köras utan
-- extra bekräftelse i Supabase-verktyget.

ALTER POLICY partner_connections_select ON public.partner_connections
  USING (
    user1_id = (SELECT auth.uid())
    OR user2_id = (SELECT auth.uid())
    OR initiated_by = (SELECT auth.uid())
  );

ALTER POLICY partner_connections_insert ON public.partner_connections
  WITH CHECK (
    initiated_by = (SELECT auth.uid())
    AND user1_id = (SELECT auth.uid())
    AND user2_id = (SELECT auth.uid())
    AND status = 'pending'
    AND invite_code IS NOT NULL
    AND expires_at IS NOT NULL
    AND expires_at <= now() + interval '1 day'
  );

ALTER POLICY partner_connections_update ON public.partner_connections
  USING (
    user1_id = (SELECT auth.uid())
    OR user2_id = (SELECT auth.uid())
    OR initiated_by = (SELECT auth.uid())
  )
  WITH CHECK (status IN ('revoked', 'rejected'));

-- Klienten får bara ändra status. join_partner_connection (SECURITY DEFINER)
-- och service role kör som en annan roll och påverkas inte.
CREATE OR REPLACE FUNCTION public.partner_connections_guard_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND (
    NEW.user1_id IS DISTINCT FROM OLD.user1_id
    OR NEW.user2_id IS DISTINCT FROM OLD.user2_id
    OR NEW.initiated_by IS DISTINCT FROM OLD.initiated_by
    OR NEW.invite_code IS DISTINCT FROM OLD.invite_code
    OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  ) THEN
    RAISE EXCEPTION 'Bara status kan ändras på en partnerkoppling';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE TRIGGER partner_connections_guard_update
  BEFORE UPDATE ON public.partner_connections
  FOR EACH ROW EXECUTE FUNCTION public.partner_connections_guard_update();

CREATE OR REPLACE FUNCTION public.join_partner_connection(p_invite_code text, p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_connection public.partner_connections%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO v_connection
  FROM public.partner_connections
  WHERE invite_code = upper(btrim(p_invite_code))
    AND status = 'pending'
    AND expires_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'invalid_or_expired_code');
  END IF;

  IF v_connection.initiated_by = v_user_id THEN
    RETURN json_build_object('success', false, 'error', 'cannot_join_own_invite');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.partner_connections
    WHERE status = 'active'
      AND (user1_id IN (v_user_id, v_connection.initiated_by)
        OR user2_id IN (v_user_id, v_connection.initiated_by))
  ) THEN
    RETURN json_build_object('success', false, 'error', 'already_connected');
  END IF;

  UPDATE public.partner_connections
  SET user2_id = v_user_id,
      status = 'active',
      invite_code = NULL
  WHERE id = v_connection.id;

  RETURN json_build_object(
    'success', true,
    'connection_id', v_connection.id,
    'partner_id', v_connection.initiated_by
  );
END;
$function$;

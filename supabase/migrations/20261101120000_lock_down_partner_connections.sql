-- Partnerkopplingar: stäng tre hål inför lansering.
--
-- 1. SELECT-policyn lät alla inloggade läsa ALLA väntande inbjudningskoder.
--    Att gå med sker via join_partner_connection (SECURITY DEFINER), så ingen
--    behöver läsa andras väntande rader.
-- 2. INSERT kontrollerade bara initiated_by, så vem som helst kunde skapa en
--    'active' koppling till valfri användare och få läsa dennes ekonomi.
--    Nu får man bara skapa en egen väntande inbjudan.
-- 3. UPDATE saknade WITH CHECK, så en återkallad eller väntande rad kunde sättas
--    till 'active' med valfri partner. Klienten behöver bara kunna koppla från.
--
-- join_partner_connection litar inte längre på p_user_id utan använder
-- auth.uid(). Parametern finns kvar för att befintliga anrop inte ska gå sönder.

DROP POLICY IF EXISTS partner_connections_select ON public.partner_connections;
CREATE POLICY partner_connections_select ON public.partner_connections
  FOR SELECT TO authenticated
  USING (
    user1_id = (SELECT auth.uid())
    OR user2_id = (SELECT auth.uid())
    OR initiated_by = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS partner_connections_insert ON public.partner_connections;
CREATE POLICY partner_connections_insert ON public.partner_connections
  FOR INSERT TO authenticated
  WITH CHECK (
    initiated_by = (SELECT auth.uid())
    AND user1_id = (SELECT auth.uid())
    AND user2_id = (SELECT auth.uid())
    AND status = 'pending'
    AND invite_code IS NOT NULL
    AND expires_at IS NOT NULL
    AND expires_at <= now() + interval '1 day'
  );

DROP POLICY IF EXISTS partner_connections_update ON public.partner_connections;
CREATE POLICY partner_connections_update ON public.partner_connections
  FOR UPDATE TO authenticated
  USING (
    user1_id = (SELECT auth.uid())
    OR user2_id = (SELECT auth.uid())
    OR initiated_by = (SELECT auth.uid())
  )
  WITH CHECK (status IN ('revoked', 'rejected'));

-- Klienten får bara ändra status (koppla från), inte vem kopplingen gäller.
REVOKE UPDATE ON public.partner_connections FROM authenticated, anon;
GRANT UPDATE (status) ON public.partner_connections TO authenticated;

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

REVOKE ALL ON FUNCTION public.join_partner_connection(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_partner_connection(text, uuid) TO authenticated;

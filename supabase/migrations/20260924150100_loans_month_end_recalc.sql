-- Automatisk omräkning av lån sista dagen i varje månad.
--
-- Banken drar ränta + amortering ~27–28:e. Efter dragningen (sista dagen i
-- månaden) dras månadens amortering av från skulden, så att räntan som visas
-- i appen motsvarar NÄSTA dragning — samma belopp som bankens avisering.
--
-- Körs dagligen (kl 22:05 svensk sommartid). På månadens sista dag räknas
-- månaden om; andra dagar fångar jobbet upp en missad körning för föregående
-- månad. Skyddet last_amortization_date gör att varje månad bara räknas en gång.

CREATE OR REPLACE FUNCTION public.recalc_loans_month_end()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Europe/Stockholm')::date;
  v_last_of_month date := (date_trunc('month', v_today) + interval '1 month - 1 day')::date;
  v_target date;
  v_month_start date;
  v_count integer;
BEGIN
  IF v_today = v_last_of_month THEN
    v_target := v_today;
  ELSE
    v_target := (date_trunc('month', v_today) - interval '1 day')::date;
  END IF;
  v_month_start := date_trunc('month', v_target)::date;

  UPDATE loans
  SET current_balance = GREATEST(0, current_balance - monthly_amortization),
      last_amortization_date = v_target
  WHERE monthly_amortization > 0
    AND current_balance > 0
    AND (last_amortization_date IS NULL OR last_amortization_date < v_month_start)
    -- Nyupplagda lån: saldot anges från senaste avisering, räkna först efter nästa månadsskifte
    AND created_at::date < v_target;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.recalc_loans_month_end() FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'recalc_loans_month_end';
SELECT cron.schedule('recalc_loans_month_end', '5 20 * * *', 'SELECT public.recalc_loans_month_end();');

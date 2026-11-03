-- Veckomat fas 5: körningar som appen startar (Claude API). Se docs/08-veckomat.md.
--
-- En rad per körning. Skapas och uppdateras bara av servern (service role,
-- /api/meals/run); hushållet kan läsa sina rader för att följa status.

CREATE TABLE IF NOT EXISTS public.meal_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'done', 'failed')),
  year integer NOT NULL,
  iso_week integer NOT NULL CHECK (iso_week BETWEEN 1 AND 53),
  meal_plan_id uuid REFERENCES public.meal_plans(id) ON DELETE SET NULL,
  error text,
  sources jsonb NOT NULL DEFAULT '[]',   -- per butik: källa, antal erbjudanden, fel
  model text,
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE INDEX IF NOT EXISTS meal_runs_user_created_idx ON public.meal_runs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS meal_runs_meal_plan_id_idx ON public.meal_runs (meal_plan_id);

ALTER TABLE public.meal_runs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'meal_runs' AND policyname = 'meal_runs_household_select') THEN
    CREATE POLICY meal_runs_household_select ON public.meal_runs FOR SELECT
      USING (user_id IN (SELECT public.my_household_user_ids()));
  END IF;
END $$;

-- /api/meals/run kör import_meal_plan och meal_prompt_context som service role,
-- och de anropar funktioner i private. Service role är redan admin.
GRANT USAGE ON SCHEMA private TO service_role;

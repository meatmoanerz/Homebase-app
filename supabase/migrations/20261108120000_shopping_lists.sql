-- Inköpslista: egna listor, utkast på kontot och inlärda avdelningar.
-- Se docs/10-inkopslista.md.
--
-- * shopping_lists: listor som inte hör till en veckomatsplan. Delas inom
--   hushållet som Veckomat.
-- * shopping_list_items: en rad hör nu till ANTINGEN en veckomatsplan
--   (meal_plan_id) ELLER en egen lista (shopping_list_id), aldrig båda.
--   import_meal_plan sätter meal_plan_id som förut och behöver inte ändras.
-- * shopping_list_drafts: utkastet på sidan Inköpslista, ett per användare.
--   Bara ägaren ser och ändrar det.
-- * shopping_item_sections: avdelning som hushållet själv valt för en vara
--   ("havremjölk" -> "Mejeri"). Vinner över gissningen nästa gång.

-- ---------------------------------------------------------------------------
-- Egna listor
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.shopping_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

CREATE INDEX IF NOT EXISTS shopping_lists_user_id_idx ON public.shopping_lists (user_id);

-- ---------------------------------------------------------------------------
-- Rader: veckomatsplan eller egen lista
-- ---------------------------------------------------------------------------

ALTER TABLE public.shopping_list_items ALTER COLUMN meal_plan_id DROP NOT NULL;

ALTER TABLE public.shopping_list_items
  ADD COLUMN IF NOT EXISTS shopping_list_id uuid REFERENCES public.shopping_lists(id) ON DELETE CASCADE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shopping_list_items_one_list_check'
      AND conrelid = 'public.shopping_list_items'::regclass
  ) THEN
    ALTER TABLE public.shopping_list_items
      ADD CONSTRAINT shopping_list_items_one_list_check
      CHECK (num_nonnulls(meal_plan_id, shopping_list_id) = 1);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS shopping_list_items_list_idx ON public.shopping_list_items (shopping_list_id);

-- ---------------------------------------------------------------------------
-- Utkast (ett per användare)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.shopping_list_drafts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- [{ id, name, qty_text, section, manual }]
  items jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(items) = 'array'),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Inlärda avdelningar
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.shopping_item_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Varans namn i gemener utan mängd, t.ex. "havremjölk"
  name_key text NOT NULL CHECK (name_key = lower(btrim(name_key)) AND length(name_key) > 0),
  section text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name_key)
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['shopping_lists', 'shopping_item_sections']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = t || '_household') THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL
           USING (user_id IN (SELECT public.my_household_user_ids()))
           WITH CHECK (user_id IN (SELECT public.my_household_user_ids()))',
        t || '_household', t);
    END IF;
  END LOOP;
END $$;

ALTER TABLE public.shopping_list_drafts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'shopping_list_drafts' AND policyname = 'shopping_list_drafts_own') THEN
    CREATE POLICY shopping_list_drafts_own ON public.shopping_list_drafts FOR ALL
      USING (user_id = (SELECT auth.uid()))
      WITH CHECK (user_id = (SELECT auth.uid()));
  END IF;
END $$;

-- shopping_list_items har redan policyn shopping_list_items_household
-- (user_id inom hushållet) och ligger i supabase_realtime sedan veckomat.
-- En rad i en egen lista ska bara kunna peka på en lista i samma hushåll; det
-- följer av att listan bara syns för hushållet (FK-kontrollen går förbi RLS,
-- så kontrollen görs här).
CREATE OR REPLACE FUNCTION public.shopping_list_items_check_list()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
BEGIN
  IF NEW.shopping_list_id IS NOT NULL
     AND (SELECT auth.uid()) IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.shopping_lists l WHERE l.id = NEW.shopping_list_id) THEN
    RAISE EXCEPTION 'shopping_list_items: listan finns inte';
  END IF;
  IF NEW.meal_plan_id IS NOT NULL
     AND (SELECT auth.uid()) IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.meal_plans p WHERE p.id = NEW.meal_plan_id) THEN
    RAISE EXCEPTION 'shopping_list_items: matsedeln finns inte';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER shopping_list_items_check_list
  BEFORE INSERT OR UPDATE OF shopping_list_id, meal_plan_id ON public.shopping_list_items
  FOR EACH ROW EXECUTE FUNCTION public.shopping_list_items_check_list();

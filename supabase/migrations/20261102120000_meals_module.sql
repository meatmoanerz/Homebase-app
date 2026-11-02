-- Veckomat (modul 'meals'), fas 1. Se docs/08-veckomat.md.
--
-- * Tabeller: meal_settings, store_offers, recipes, recipe_ingredients,
--   meal_plans, meal_plan_dishes, shopping_list_items. Alla delas inom
--   hushållet (ägaren + aktiv partner) via my_household_user_ids().
-- * stores: external_id/offers_source/offers_url, partnern får läsa.
-- * profiles.feature_access + has_feature_access(): modulen är låst till
--   användare med 'meals' i feature_access eller e-post på @test.se, tills
--   körning via Claude API finns. Klienten kan inte ändra feature_access.
-- * import_meal_plan(payload, p_user_id): enda vägen in för en veckoplan.
--   Inloggad användare = auth.uid(). p_user_id används bara av admin (MCP).
-- * latest_receipt_price(): senaste kvittopris för en vara (prisordning steg 3).
--
-- Inga användare, butiker eller hushållsvärden är hårdkodade här.

-- ---------------------------------------------------------------------------
-- Hushåll och åtkomst
-- ---------------------------------------------------------------------------

-- Inloggad användare + aktiv partner. Används i RLS som
-- user_id IN (SELECT public.my_household_user_ids()) så att den körs en gång.
CREATE OR REPLACE FUNCTION public.my_household_user_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $$
  SELECT (SELECT auth.uid())
  UNION
  SELECT CASE WHEN pc.user1_id = (SELECT auth.uid()) THEN pc.user2_id ELSE pc.user1_id END
  FROM public.partner_connections pc
  WHERE pc.status = 'active'
    AND (SELECT auth.uid()) IN (pc.user1_id, pc.user2_id)
$$;

-- Samma hushåll för en given användare (admin-vägen, utan auth.uid()).
CREATE OR REPLACE FUNCTION private.household_user_ids(p_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT p_user_id
  UNION
  SELECT CASE WHEN pc.user1_id = p_user_id THEN pc.user2_id ELSE pc.user1_id END
  FROM public.partner_connections pc
  WHERE pc.status = 'active'
    AND p_user_id IN (pc.user1_id, pc.user2_id)
$$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS feature_access text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.profiles.feature_access IS
  'Funktioner i beta som användaren har tillgång till, t.ex. ''meals''. Sätts bara av admin.';

-- Klienten får inte ge sig själv åtkomst. Admin/service role påverkas inte.
CREATE OR REPLACE FUNCTION public.profiles_guard_feature_access()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.feature_access := '{}';
    ELSE
      NEW.feature_access := OLD.feature_access;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER profiles_guard_feature_access
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_guard_feature_access();

-- Ligger i private (exponeras inte via API:t) eftersom den tar valfritt user_id.
CREATE OR REPLACE FUNCTION private.user_has_feature(p_user_id uuid, p_feature text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = p_user_id AND p_feature = ANY (p.feature_access)
    )
    OR EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = p_user_id AND lower(u.email) LIKE '%@test.se'
    )
$$;

-- För appen: gäller alltid den inloggade användaren.
CREATE OR REPLACE FUNCTION public.has_feature_access(p_feature text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT COALESCE(private.user_has_feature((SELECT auth.uid()), p_feature), false)
$$;

-- ---------------------------------------------------------------------------
-- stores
-- ---------------------------------------------------------------------------

ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS external_id text;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS offers_source text;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS offers_url text;

COMMENT ON COLUMN public.stores.external_id IS 'Kedjans butiks-id, t.ex. Willys 2187, ICA 1003380, Coop 015810';
COMMENT ON COLUMN public.stores.offers_source IS 'willys_api | ica_web | coop_web | third_party | manual';

CREATE UNIQUE INDEX IF NOT EXISTS stores_user_chain_external_id_key
  ON public.stores (user_id, chain, external_id) WHERE external_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'stores' AND policyname = 'stores_household_select') THEN
    CREATE POLICY stores_household_select ON public.stores FOR SELECT
      USING (user_id IN (SELECT public.my_household_user_ids()));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Tabeller
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.meal_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  adults integer NOT NULL DEFAULT 2 CHECK (adults BETWEEN 0 AND 20),
  kids integer NOT NULL DEFAULT 0 CHECK (kids BETWEEN 0 AND 20),
  portions_per_dinner numeric(4,1) NOT NULL DEFAULT 2 CHECK (portions_per_dinner > 0),
  dinners_per_week integer NOT NULL DEFAULT 4 CHECK (dinners_per_week BETWEEN 0 AND 14),
  lunchboxes_per_week integer NOT NULL DEFAULT 0 CHECK (lunchboxes_per_week BETWEEN 0 AND 30),
  diet_notes text,
  avoid text[] NOT NULL DEFAULT '{}',
  kcal_target_min integer CHECK (kcal_target_min > 0),
  kcal_target_max integer CHECK (kcal_target_max > 0),
  memberships text[] NOT NULL DEFAULT '{}',      -- 'willys_plus' | 'ica_stammis' | 'coop_member'
  preferred_store_ids uuid[] NOT NULL DEFAULT '{}',
  online_fees jsonb NOT NULL DEFAULT '{}',        -- { "<store_id>": 59 }
  run_day smallint CHECK (run_day BETWEEN 1 AND 7),  -- ISO: 1 = måndag
  run_time time,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (kcal_target_min IS NULL OR kcal_target_max IS NULL OR kcal_target_min <= kcal_target_max)
);

CREATE TABLE IF NOT EXISTS public.store_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  year integer NOT NULL,
  iso_week integer NOT NULL CHECK (iso_week BETWEEN 1 AND 53),
  valid_from date,
  valid_to date,
  name text NOT NULL,
  brand text,
  size_text text,
  offer_price numeric(10,2),
  offer_label text,
  qualifying_count integer,
  ordinary_price numeric(10,2),
  compare_price_text text,
  max_purchase text,
  member_only boolean NOT NULL DEFAULT false,
  loyalty_program text,
  category_text text,
  image_url text,
  source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('willys_api', 'ica_web', 'coop_web', 'third_party', 'manual')),
  source_url text,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  raw jsonb
);

CREATE TABLE IF NOT EXISTS public.recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  base_portions numeric(4,1) NOT NULL CHECK (base_portions > 0),
  kcal_per_portion integer CHECK (kcal_per_portion > 0),
  time_text text,
  steps jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(steps) = 'array'),
  tips jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(tips) = 'array'),
  storage_note text,
  kids_note text,
  tags text[] NOT NULL DEFAULT '{}',
  rating smallint CHECK (rating BETWEEN 1 AND 5),
  times_cooked integer NOT NULL DEFAULT 0,
  last_cooked_at timestamptz,
  created_by text NOT NULL DEFAULT 'claude' CHECK (created_by IN ('claude', 'user')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.recipe_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipe_id uuid NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  sort integer NOT NULL DEFAULT 0,
  name text NOT NULL,
  amount numeric(10,2),
  unit text,
  amount_text text,
  is_pantry boolean NOT NULL DEFAULT false,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.meal_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  year integer NOT NULL,
  iso_week integer NOT NULL CHECK (iso_week BETWEEN 1 AND 53),
  store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'visible' CHECK (status IN ('visible', 'archived')),
  is_new boolean NOT NULL DEFAULT true,
  total_cost_est numeric(10,2),
  cost_per_portion_est numeric(10,2),
  portions_total numeric(5,1),
  kcal_min integer,
  kcal_max integer,
  notes text,
  pantry text[] NOT NULL DEFAULT '{}',
  source text NOT NULL DEFAULT 'chat' CHECK (source IN ('chat', 'schedule', 'app')),
  actual_cost numeric(10,2),
  receipt_id uuid REFERENCES public.receipts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  UNIQUE (user_id, year, name)
);

CREATE TABLE IF NOT EXISTS public.meal_plan_dishes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meal_plan_id uuid NOT NULL REFERENCES public.meal_plans(id) ON DELETE CASCADE,
  recipe_id uuid NOT NULL REFERENCES public.recipes(id) ON DELETE RESTRICT,
  sort integer NOT NULL DEFAULT 0,
  batch_multiplier smallint NOT NULL DEFAULT 1 CHECK (batch_multiplier BETWEEN 1 AND 4),
  dinner_portions numeric(4,1) NOT NULL DEFAULT 0 CHECK (dinner_portions >= 0),
  lunchbox_portions numeric(4,1) NOT NULL DEFAULT 0 CHECK (lunchbox_portions >= 0),
  cost_est numeric(10,2),
  planned_date date,
  cooked_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.shopping_list_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meal_plan_id uuid NOT NULL REFERENCES public.meal_plans(id) ON DELETE CASCADE,
  section text NOT NULL,
  sort integer NOT NULL DEFAULT 0,
  name text NOT NULL,
  quantity numeric(10,2),
  unit text,
  qty_text text,
  price_est numeric(10,2),
  price_source text NOT NULL DEFAULT 'estimate'
    CHECK (price_source IN ('offer', 'store_ordinary', 'receipt', 'estimate')),
  is_offer boolean NOT NULL DEFAULT false,
  offer_label text,
  store_offer_id uuid REFERENCES public.store_offers(id) ON DELETE SET NULL,
  store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  dish_ids uuid[] NOT NULL DEFAULT '{}',
  checked boolean NOT NULL DEFAULT false,
  checked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  checked_at timestamptz
);

-- Index för RLS och för de vanligaste uppslagen
CREATE INDEX IF NOT EXISTS store_offers_user_id_idx ON public.store_offers (user_id);
CREATE INDEX IF NOT EXISTS store_offers_store_week_idx ON public.store_offers (store_id, year, iso_week);
CREATE INDEX IF NOT EXISTS recipes_user_id_idx ON public.recipes (user_id);
CREATE INDEX IF NOT EXISTS recipe_ingredients_recipe_id_idx ON public.recipe_ingredients (recipe_id);
CREATE INDEX IF NOT EXISTS recipe_ingredients_user_id_idx ON public.recipe_ingredients (user_id);
CREATE INDEX IF NOT EXISTS recipe_ingredients_product_id_idx ON public.recipe_ingredients (product_id);
CREATE INDEX IF NOT EXISTS meal_plans_user_status_idx ON public.meal_plans (user_id, status);
CREATE INDEX IF NOT EXISTS meal_plans_store_id_idx ON public.meal_plans (store_id);
CREATE INDEX IF NOT EXISTS meal_plans_receipt_id_idx ON public.meal_plans (receipt_id);
CREATE INDEX IF NOT EXISTS meal_plan_dishes_plan_idx ON public.meal_plan_dishes (meal_plan_id);
CREATE INDEX IF NOT EXISTS meal_plan_dishes_recipe_idx ON public.meal_plan_dishes (recipe_id);
CREATE INDEX IF NOT EXISTS meal_plan_dishes_user_id_idx ON public.meal_plan_dishes (user_id);
CREATE INDEX IF NOT EXISTS shopping_list_items_plan_idx ON public.shopping_list_items (meal_plan_id);
CREATE INDEX IF NOT EXISTS shopping_list_items_user_id_idx ON public.shopping_list_items (user_id);
CREATE INDEX IF NOT EXISTS shopping_list_items_store_offer_idx ON public.shopping_list_items (store_offer_id);
CREATE INDEX IF NOT EXISTS shopping_list_items_store_idx ON public.shopping_list_items (store_id);

CREATE OR REPLACE TRIGGER meal_settings_updated_at
  BEFORE UPDATE ON public.meal_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE OR REPLACE TRIGGER recipes_updated_at
  BEFORE UPDATE ON public.recipes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: ägaren och aktiv partner får allt, insert bara inom hushållet
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['meal_settings', 'store_offers', 'recipes', 'recipe_ingredients',
                           'meal_plans', 'meal_plan_dishes', 'shopping_list_items']
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

-- Avbockning syns direkt för båda
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'shopping_list_items') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.shopping_list_items;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- latest_receipt_price: prisordning steg 3
-- ---------------------------------------------------------------------------

-- Senaste kvittopris för en vara i hushållets kvitton. Matchar via produkt
-- (products.name / product_aliases) om koppling finns, annars på kvittotexten.
CREATE OR REPLACE FUNCTION public.latest_receipt_price(p_name text, p_user_id uuid DEFAULT NULL)
RETURNS TABLE (unit_price numeric, raw_name text, purchase_date date, store_name text, store_chain text)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_users uuid[];
BEGIN
  IF (SELECT auth.uid()) IS NOT NULL THEN
    v_users := ARRAY(SELECT public.my_household_user_ids());
  ELSIF current_user NOT IN ('anon', 'authenticated') AND p_user_id IS NOT NULL THEN
    v_users := ARRAY(SELECT private.household_user_ids(p_user_id));
  ELSE
    RAISE EXCEPTION 'latest_receipt_price: ingen användare';
  END IF;

  RETURN QUERY
  SELECT ri.unit_price, ri.raw_name, r.purchase_date, s.name, s.chain
  FROM public.receipt_items ri
  JOIN public.receipts r ON r.id = ri.receipt_id
  LEFT JOIN public.stores s ON s.id = r.store_id
  LEFT JOIN public.products p ON p.id = ri.product_id
  WHERE ri.user_id = ANY (v_users)
    AND NOT ri.is_deposit
    AND ri.unit_price > 0
    AND (
      p.name ILIKE '%' || p_name || '%'
      OR ri.raw_name ILIKE '%' || p_name || '%'
    )
  ORDER BY r.purchase_date DESC NULLS LAST, ri.created_at DESC
  LIMIT 1;
END;
$$;

-- ---------------------------------------------------------------------------
-- import_meal_plan
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.import_meal_plan(payload jsonb, p_user_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_owner uuid;
  v_household uuid[];
  v_year integer := (payload->>'year')::integer;
  v_week integer := (payload->>'iso_week')::integer;
  v_store_id uuid;
  v_base text;
  v_name text;
  v_n integer := 1;
  v_plan_id uuid;
  v_dish record;
  v_item record;
  v_recipe_id uuid;
  v_dish_id uuid;
  v_key text;
  v_keys jsonb := '{}'::jsonb;
  v_dish_ids uuid[];
  v_missing text;
BEGIN
  -- Ägare: inloggad användare, annars p_user_id om anropet kommer från admin.
  IF (SELECT auth.uid()) IS NOT NULL THEN
    v_owner := (SELECT auth.uid());
    IF NOT public.has_feature_access('meals') THEN
      RAISE EXCEPTION 'import_meal_plan: användaren har inte tillgång till veckomat';
    END IF;
    v_household := ARRAY(SELECT public.my_household_user_ids());
  ELSIF current_user NOT IN ('anon', 'authenticated') AND p_user_id IS NOT NULL THEN
    v_owner := p_user_id;
    IF NOT private.user_has_feature(v_owner, 'meals') THEN
      RAISE EXCEPTION 'import_meal_plan: användaren % har inte tillgång till veckomat', v_owner;
    END IF;
    v_household := ARRAY(SELECT private.household_user_ids(v_owner));
  ELSE
    RAISE EXCEPTION 'import_meal_plan: ingen ägare (logga in, eller ange p_user_id som admin)';
  END IF;

  IF v_year IS NULL OR v_week IS NULL OR v_week NOT BETWEEN 1 AND 53 THEN
    RAISE EXCEPTION 'import_meal_plan: year och iso_week (1–53) krävs';
  END IF;
  IF jsonb_typeof(payload->'dishes') IS DISTINCT FROM 'array' OR jsonb_array_length(payload->'dishes') = 0 THEN
    RAISE EXCEPTION 'import_meal_plan: dishes måste vara en icke-tom lista';
  END IF;

  -- Butik: id, eller kedja + external_id, bland hushållets butiker.
  IF jsonb_typeof(payload->'store') = 'object' THEN
    SELECT s.id INTO v_store_id
    FROM public.stores s
    WHERE s.user_id = ANY (v_household)
      AND (
        s.id::text = payload->'store'->>'store_id'
        OR (s.external_id = payload->'store'->>'external_id'
            AND lower(s.chain) = lower(payload->'store'->>'chain'))
      )
    ORDER BY (s.user_id = v_owner) DESC
    LIMIT 1;
    IF v_store_id IS NULL THEN
      RAISE EXCEPTION 'import_meal_plan: butiken % finns inte bland hushållets butiker', payload->'store';
    END IF;
  END IF;

  -- Namn: "v45", "v45 (2)" om det redan finns samma år.
  v_base := COALESCE(NULLIF(btrim(payload->>'name'), ''), 'v' || v_week);
  v_name := v_base;
  WHILE EXISTS (SELECT 1 FROM public.meal_plans WHERE user_id = v_owner AND year = v_year AND name = v_name) LOOP
    v_n := v_n + 1;
    v_name := v_base || ' (' || v_n || ')';
  END LOOP;

  INSERT INTO public.meal_plans (
    user_id, name, year, iso_week, store_id, total_cost_est, cost_per_portion_est,
    portions_total, kcal_min, kcal_max, notes, pantry, source
  ) VALUES (
    v_owner, v_name, v_year, v_week, v_store_id,
    (payload->'summary'->>'total_cost_est')::numeric,
    (payload->'summary'->>'cost_per_portion_est')::numeric,
    (payload->'summary'->>'portions_total')::numeric,
    (payload->'summary'->>'kcal_min')::integer,
    (payload->'summary'->>'kcal_max')::integer,
    payload->'summary'->>'notes',
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(payload->'pantry')), '{}'),
    COALESCE(payload->>'source', 'chat')
  ) RETURNING id INTO v_plan_id;

  -- Erbjudanden
  IF jsonb_typeof(payload->'offers') = 'array' AND jsonb_array_length(payload->'offers') > 0 THEN
    IF v_store_id IS NULL THEN
      RAISE EXCEPTION 'import_meal_plan: erbjudanden kräver store';
    END IF;
    INSERT INTO public.store_offers (
      user_id, store_id, year, iso_week, valid_from, valid_to, name, brand, size_text,
      offer_price, offer_label, qualifying_count, ordinary_price, compare_price_text,
      max_purchase, member_only, loyalty_program, category_text, image_url, source,
      source_url, raw
    )
    SELECT v_owner, v_store_id, v_year, v_week, o.valid_from, o.valid_to, o.name, o.brand, o.size_text,
           o.offer_price, o.offer_label, o.qualifying_count, o.ordinary_price, o.compare_price_text,
           o.max_purchase, COALESCE(o.member_only, false), o.loyalty_program, o.category_text,
           o.image_url, COALESCE(o.source, 'manual'), o.source_url, o.raw
    FROM jsonb_to_recordset(payload->'offers') AS o(
      valid_from date, valid_to date, name text, brand text, size_text text,
      offer_price numeric, offer_label text, qualifying_count integer, ordinary_price numeric,
      compare_price_text text, max_purchase text, member_only boolean, loyalty_program text,
      category_text text, image_url text, source text, source_url text, raw jsonb
    );
  END IF;

  -- Rätter: återanvänd recept via recipe_id, annars skapa nytt.
  FOR v_dish IN
    SELECT d.value AS x, d.ordinality AS ord
    FROM jsonb_array_elements(payload->'dishes') WITH ORDINALITY AS d
  LOOP
    v_key := v_dish.x->>'key';
    IF v_key IS NULL OR v_key = '' THEN
      RAISE EXCEPTION 'import_meal_plan: rätt % saknar key', v_dish.ord;
    END IF;
    IF v_keys ? v_key THEN
      RAISE EXCEPTION 'import_meal_plan: key "%" finns två gånger', v_key;
    END IF;

    IF NULLIF(v_dish.x->>'recipe_id', '') IS NOT NULL THEN
      SELECT r.id INTO v_recipe_id
      FROM public.recipes r
      WHERE r.id = (v_dish.x->>'recipe_id')::uuid AND r.user_id = ANY (v_household);
      IF v_recipe_id IS NULL THEN
        RAISE EXCEPTION 'import_meal_plan: recept % finns inte', v_dish.x->>'recipe_id';
      END IF;
    ELSE
      IF NULLIF(btrim(v_dish.x->>'name'), '') IS NULL THEN
        RAISE EXCEPTION 'import_meal_plan: rätt "%" saknar name', v_key;
      END IF;
      INSERT INTO public.recipes (
        user_id, name, description, base_portions, kcal_per_portion, time_text,
        steps, tips, storage_note, kids_note, tags, created_by
      ) VALUES (
        v_owner,
        btrim(v_dish.x->>'name'),
        v_dish.x->>'description',
        COALESCE(
          NULLIF((v_dish.x->>'base_portions')::numeric, 0),
          NULLIF(COALESCE((v_dish.x->>'dinner_portions')::numeric, 0)
                 + COALESCE((v_dish.x->>'lunchbox_portions')::numeric, 0), 0),
          1
        ),
        (v_dish.x->>'kcal_per_portion')::integer,
        v_dish.x->>'time_text',
        COALESCE(v_dish.x->'steps', '[]'),
        COALESCE(v_dish.x->'tips', '[]'),
        v_dish.x->>'storage_note',
        v_dish.x->>'kids_note',
        COALESCE(ARRAY(SELECT jsonb_array_elements_text(v_dish.x->'tags')), '{}'),
        'claude'
      ) RETURNING id INTO v_recipe_id;

      INSERT INTO public.recipe_ingredients (user_id, recipe_id, sort, name, amount, unit, amount_text, is_pantry)
      SELECT v_owner, v_recipe_id, i.ordinality::integer,
             i.value->>'name', (i.value->>'amount')::numeric, i.value->>'unit',
             i.value->>'amount_text', COALESCE((i.value->>'is_pantry')::boolean, false)
      FROM jsonb_array_elements(COALESCE(v_dish.x->'ingredients', '[]')) WITH ORDINALITY AS i;
    END IF;

    INSERT INTO public.meal_plan_dishes (
      user_id, meal_plan_id, recipe_id, sort, batch_multiplier, dinner_portions,
      lunchbox_portions, cost_est, planned_date
    ) VALUES (
      v_owner, v_plan_id, v_recipe_id, v_dish.ord::integer,
      COALESCE((v_dish.x->>'batch_multiplier')::smallint, 1),
      COALESCE((v_dish.x->>'dinner_portions')::numeric, 0),
      COALESCE((v_dish.x->>'lunchbox_portions')::numeric, 0),
      (v_dish.x->>'cost_est')::numeric,
      (v_dish.x->>'planned_date')::date
    ) RETURNING id INTO v_dish_id;

    v_keys := v_keys || jsonb_build_object(v_key, v_dish_id);
  END LOOP;

  -- Inköpslista
  FOR v_item IN
    SELECT l.value AS x, l.ordinality AS ord
    FROM jsonb_array_elements(COALESCE(payload->'shopping_list', '[]')) WITH ORDINALITY AS l
  LOOP
    SELECT k INTO v_missing
    FROM jsonb_array_elements_text(COALESCE(v_item.x->'dish_keys', '[]')) AS k
    WHERE NOT v_keys ? k
    LIMIT 1;
    IF v_missing IS NOT NULL THEN
      RAISE EXCEPTION 'import_meal_plan: inköpsrad "%" pekar på okänd rätt "%"', v_item.x->>'name', v_missing;
    END IF;
    v_dish_ids := ARRAY(
      SELECT (v_keys->>k)::uuid
      FROM jsonb_array_elements_text(COALESCE(v_item.x->'dish_keys', '[]')) AS k
    );

    INSERT INTO public.shopping_list_items (
      user_id, meal_plan_id, section, sort, name, quantity, unit, qty_text, price_est,
      price_source, is_offer, offer_label, store_id, dish_ids
    ) VALUES (
      v_owner, v_plan_id,
      COALESCE(NULLIF(btrim(v_item.x->>'section'), ''), 'Övrigt'),
      v_item.ord::integer,
      v_item.x->>'name',
      (v_item.x->>'quantity')::numeric,
      v_item.x->>'unit',
      v_item.x->>'qty_text',
      (v_item.x->>'price_est')::numeric,
      COALESCE(v_item.x->>'price_source', 'estimate'),
      COALESCE((v_item.x->>'is_offer')::boolean, false),
      v_item.x->>'offer_label',
      v_store_id,
      v_dish_ids
    );
  END LOOP;

  RETURN v_plan_id;
END;
$$;

COMMENT ON FUNCTION public.import_meal_plan(jsonb, uuid) IS
  'Veckomat: skriver en hel veckoplan från MealPlan-JSON (docs/08-veckomat.md). Returnerar meal_plans.id.';

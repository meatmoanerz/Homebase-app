-- Veckomat: basvaror, "har hemma just nu" och rester. Se docs/08-veckomat.md
-- och docs/09-veckomat-korning.md.
--
-- * meal_settings.pantry_staples: basvaror som alltid finns hemma och aldrig
--   hamnar på inköpslistan (olja, kryddor, ris ...).
-- * meal_settings.on_hand + on_hand_updated_at: det som finns hemma just den
--   här veckan och ska användas först.
-- * meal_plans.leftovers: det planen räknar med blir över. Föreslås som
--   "har hemma" inför nästa vecka.
-- * import_meal_plan: läser payload.leftovers.
-- * meal_prompt_context(p_user_id): samma underlag som startprompten i appen,
--   för körningar utan appen (schemalagd körning).

ALTER TABLE public.meal_settings ADD COLUMN IF NOT EXISTS pantry_staples text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.meal_settings ADD COLUMN IF NOT EXISTS on_hand text;
ALTER TABLE public.meal_settings ADD COLUMN IF NOT EXISTS on_hand_updated_at timestamptz;
ALTER TABLE public.meal_plans ADD COLUMN IF NOT EXISTS leftovers text[] NOT NULL DEFAULT '{}';

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
    portions_total, kcal_min, kcal_max, notes, pantry, leftovers, source
  ) VALUES (
    v_owner, v_name, v_year, v_week, v_store_id,
    (payload->'summary'->>'total_cost_est')::numeric,
    (payload->'summary'->>'cost_per_portion_est')::numeric,
    (payload->'summary'->>'portions_total')::numeric,
    (payload->'summary'->>'kcal_min')::integer,
    (payload->'summary'->>'kcal_max')::integer,
    payload->'summary'->>'notes',
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(payload->'pantry')), '{}'),
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(payload->'leftovers')), '{}'),
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

-- Underlaget för en körning, samma nycklar som startprompten i appen
-- (src/lib/meals/prompt.ts). Inloggad: auth.uid(). Admin: p_user_id.
-- Inställningar: egna, annars partnerns.
CREATE OR REPLACE FUNCTION public.meal_prompt_context(p_user_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_owner uuid;
  v_household uuid[];
  v_settings public.meal_settings;
  v_day date := (now() AT TIME ZONE 'Europe/Stockholm')::date;
  v_week_date date;
BEGIN
  IF (SELECT auth.uid()) IS NOT NULL THEN
    v_owner := (SELECT auth.uid());
    v_household := ARRAY(SELECT public.my_household_user_ids());
  ELSIF current_user NOT IN ('anon', 'authenticated') AND p_user_id IS NOT NULL THEN
    v_owner := p_user_id;
    v_household := ARRAY(SELECT private.household_user_ids(p_user_id));
  ELSE
    RAISE EXCEPTION 'meal_prompt_context: ingen användare';
  END IF;

  SELECT * INTO v_settings FROM public.meal_settings
  WHERE user_id = ANY (v_household)
  ORDER BY (user_id = v_owner) DESC
  LIMIT 1;
  IF v_settings.user_id IS NULL THEN
    RAISE EXCEPTION 'meal_prompt_context: inga inställningar för veckomat';
  END IF;

  -- Planeringsvecka: denna vecka mån–fre, nästa vecka lör–sön.
  v_week_date := CASE WHEN extract(isodow FROM v_day) >= 6 THEN v_day + 7 ELSE v_day END;

  RETURN jsonb_build_object(
    'user_id', v_owner,
    'year', extract(isoyear FROM v_week_date)::int,
    'iso_week', extract(week FROM v_week_date)::int,
    'household', jsonb_build_object(
      'adults', v_settings.adults,
      'kids', v_settings.kids,
      'portions_per_dinner', v_settings.portions_per_dinner,
      'dinners_per_week', v_settings.dinners_per_week,
      'lunchboxes_per_week', v_settings.lunchboxes_per_week),
    'diet_notes', v_settings.diet_notes,
    'avoid', to_jsonb(v_settings.avoid),
    'kcal_per_adult_portion', CASE
      WHEN v_settings.kcal_target_min IS NULL AND v_settings.kcal_target_max IS NULL THEN NULL
      ELSE jsonb_build_object('min', v_settings.kcal_target_min, 'max', v_settings.kcal_target_max) END,
    'memberships', (
      SELECT COALESCE(jsonb_agg(CASE m WHEN 'willys_plus' THEN 'Willys Plus' WHEN 'ica_stammis' THEN 'ICA Stammis'
                                       WHEN 'coop_member' THEN 'Coop medlem' ELSE m END), '[]')
      FROM unnest(v_settings.memberships) AS m),
    'pantry_staples', to_jsonb(v_settings.pantry_staples),
    'on_hand', CASE WHEN NULLIF(btrim(v_settings.on_hand), '') IS NULL THEN NULL
      ELSE jsonb_build_object('text', v_settings.on_hand, 'updated_at', v_settings.on_hand_updated_at) END,
    'stores', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'store_id', s.id, 'name', s.name, 'chain', s.chain, 'external_id', s.external_id,
        'offers_source', s.offers_source, 'offers_url', s.offers_url,
        'online_fee', v_settings.online_fees->(s.id::text)) ORDER BY p.ord), '[]')
      FROM unnest(v_settings.preferred_store_ids) WITH ORDINALITY AS p(id, ord)
      JOIN public.stores s ON s.id = p.id AND s.user_id = ANY (v_household)),
    'recent_dishes', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('recipe_id', x.recipe_id, 'name', x.name,
                                                   'week', 'v' || x.iso_week || ' ' || x.year)), '[]')
      FROM (
        SELECT DISTINCT ON (r.id) r.id AS recipe_id, r.name, mp.year, mp.iso_week, mp.created_at
        FROM (SELECT * FROM public.meal_plans WHERE user_id = ANY (v_household)
              ORDER BY year DESC, iso_week DESC, created_at DESC LIMIT 4) mp
        JOIN public.meal_plan_dishes d ON d.meal_plan_id = mp.id
        JOIN public.recipes r ON r.id = d.recipe_id
        ORDER BY r.id, mp.year DESC, mp.iso_week DESC
      ) x),
    'leftovers_from_last_plan', (
      SELECT to_jsonb(mp.leftovers) FROM public.meal_plans mp
      WHERE mp.user_id = ANY (v_household)
      ORDER BY mp.year DESC, mp.iso_week DESC, mp.created_at DESC LIMIT 1)
  );
END;
$$;

COMMENT ON FUNCTION public.meal_prompt_context(uuid) IS
  'Veckomat: underlaget för en körning (samma nycklar som startprompten i appen). docs/09-veckomat-korning.md.';

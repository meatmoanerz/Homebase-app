-- Modulval och introduktioner inför lansering.
--
-- enabled_modules: vilka tillvalsmoduler användaren har slagit på
--   ('savings', 'loans', 'ccm', 'receipts', 'shared'). Grunden (översikt,
--   utgifter, budget, import) är alltid på. NULL = profil från före modulvalet,
--   då räknas alla moduler som påslagna så att inget försvinner för befintliga
--   användare. Nya profiler får '{}' och väljer i onboardingen.
--
-- seen_intros: vilka introduktioner användaren har sett eller stängt.
--   '*' = hoppa över alla (befintliga användare som redan kan appen).

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS enabled_modules text[];
ALTER TABLE public.profiles ALTER COLUMN enabled_modules SET DEFAULT '{}';
UPDATE public.profiles SET enabled_modules = '{}'
  WHERE enabled_modules IS NULL AND onboarding_completed IS NOT TRUE;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS seen_intros text[] NOT NULL DEFAULT '{}';
UPDATE public.profiles SET seen_intros = '{*}'
  WHERE onboarding_completed IS TRUE AND seen_intros = '{}';

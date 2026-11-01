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
--   "Visa introduktionen igen" i Hjälp nollställer listan.
--
-- Befintliga rader får sina värden från kolumnens default när den läggs till,
-- sedan byts default för nya profiler. Ingen UPDATE behövs.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS enabled_modules text[];
ALTER TABLE public.profiles ALTER COLUMN enabled_modules SET DEFAULT '{}';

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS seen_intros text[] NOT NULL DEFAULT '{*}';
ALTER TABLE public.profiles ALTER COLUMN seen_intros SET DEFAULT '{}';

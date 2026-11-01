-- Nya användare fick ingen profil vid registrering.
--
-- handle_new_user (på auth.users) körs av Supabase Auth med en sökväg utan
-- public. Profilinsättningen triggar create_default_categories, som skriver
-- till "categories" utan schema och därför misslyckas. handle_new_user fångar
-- felet och loggar bara, så profilen saknades tills onboardingen var klar.
-- Under tiden gick det t.ex. inte att skapa en partnerinbjudan (FK mot profiles).
--
-- Rättning: fast sökväg på båda funktionerna. Ingen ändring av logiken.

ALTER FUNCTION public.create_default_categories() SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;

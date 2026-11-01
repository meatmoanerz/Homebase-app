# 07 — Lansering: kvar att göra

Senast uppdaterad: 2026-11-01

Checklista inför att Homebase släpps till nya användare. Bocka av och ta bort
rader när de är klara. Gjort hittills: säkrare partnerkoppling och
`/api/setup-user`, ny onboarding med modulval, rundturer och "Kom igång",
självbetjänade nycklar för iPhone-genvägarna (grenen `lansering-onboarding`).

## Innan lansering

- [ ] Testa onboarding, partnerkod, rundturer, "Kom igång" och modulreglage
      med två nya testkonton på förhandsversionen. Slå sedan ihop
      `lansering-onboarding` med `main`.
- [ ] E-postverifiering i Supabase: registreringen skickar direkt till
      `/onboarding`. Krävs verifiering hamnar användaren på inloggningen.
      Välj beteende och anpassa texten på registreringssidan.
- [ ] Supabase Auth: lägg till appens riktiga domän (och ev. förhandsdomäner)
      under Redirect URLs så att Google-inloggning och e-postlänkar fungerar.
- [ ] Egen SMTP i Supabase (standardutskicket har mycket låg gräns) och
      svenska mallar för bekräftelse och lösenordsåterställning.
- [ ] iPhone-guiden (Mer › iPhone-genvägar): kontrollera stegen mot appen
      Genvägar. Dela Tims fungerande genvägar som iCloud-länkar och sätt
      `NEXT_PUBLIC_WALLET_SHORTCUT_URL` / `NEXT_PUBLIC_RECEIPT_SHORTCUT_URL`.
- [ ] Kvittoläsningen anropar en AI-tjänst per kvitto utan gräns per användare.
      Sätt en kvot eller lägg den bakom premium.
- [ ] Namn och varumärke: registreringssidan visar en "S"-logga och hjälpsidan
      anger `support@stacka.app`. Bestäm namn och supportadress.
- [ ] GDPR: läs igenom `/privacy`, lägg till användarvillkor, radering av konto
      och export av data.
- [ ] Felövervakning (t.ex. Sentry), mätning av var användare hoppar av i
      onboardingen och en feedback-knapp.
- [ ] Supabase-plan med backup (gratisplanen pausas, se `keepalive`-cronen).
- [ ] Amex-synken via Browserbase (`AMEX_SYNC_USER_ID`) gäller bara Tim.
      Se till att den inte syns eller körs för andra.

## Senare

- [ ] Kortgenvägen för vanliga betalkort (i dag bara Amex och Norwegian, och
      köpen sparas som kreditkortsköp). Kräver ändringar i
      `amex_sync_transactions` och `rebuild_wallet_review_batch`.
- [ ] Premium: behörighetstabell, Stripe och mätning av AI-användning.
- [ ] AI-import av CSV i appen för premium. Personuppgiftsbiträdesavtal med
      AI-leverantören innan kunddata skickas dit.
- [ ] Engelsk översättning (`next-intl` används inte än).

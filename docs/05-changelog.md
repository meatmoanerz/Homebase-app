# 05 — Changelog

Logg över ändringar i Homebase och i den här dokumentationen.
Nyast överst. Format: `## ÅÅÅÅ-MM-DD — rubrik` + en till tre rader om vad och varför.

Ändringar i dokumentationen skrivs bara in efter att Tim godkänt dem.

---

## 2026-10-28 — Ingen scrollbar på mobil

Skärmar med touch (`pointer: coarse`) visar ingen scrollbar/scrollindikator,
som en app. Dator med mus behåller sin.

## 2026-10-28 — Ångra vid borttagning i kreditkort, kodflödesnot om snabb start

- Kreditkortshanteraren: papperskorgen döljer raden direkt och visar
  "Ångra" i 5 sekunder; själva borttagningen körs först när notisen stängs.
- `04-kodflode.md`: ny frontend-fälla "Snabb start: app-sidorna är statiska"
  (inga serveranrop i `(app)/layout`, datum i klienten, hooks före return).
  Godkänd av Tim.

## 2026-10-28 — Snabbare start, rubriker i headern, mindre luft

- Start: `(app)/layout.tsx` gör inga serveranrop längre — middleware sköter
  inloggningskollen (nu `getClaims`, lokal JWT-verifiering), onboarding-kollen
  körs i klienten (`OnboardingGate`). Alla app-sidor byggs statiskt och
  serveras direkt från Vercels CDN i stället för att vänta på en kall
  serverfunktion + två auth-anrop. `useUser` läser sessionen lokalt.
  `/api/partner` filtrerar i databasen och loggar inte profiler.
- Statiska sidor byggs i förväg: UI som beror på dagens datum renderas i
  klienten (`useIsClient`), annars blir det hydreringsfel. Gemensamt konto
  väntar nu på löndag/budgetar (öppnade förut på fel period).
- Undersidor (Inställningar, Sparmål, Kvitton, Hjälp, Inkomst): tillbakapil
  och titel i appens header, sidans egen rubrik bara på dator. Mindre luft
  under innehållet (navbaren + säkerhetsmarginal i stället för 160 px + 96 px).
- Mer: profilen är en kompakt rad som öppnar Profil. Budgetdetalj: Arkivera
  och Ta bort i ⋯-meny. Lån/temporär budget: plusknappen överlappar inte navbaren.
- Kategoriregler kraschade om sidan öppnades innan reglerna laddats (hooks
  efter tidig return) — rättat.
- Reducerad rörelse följs (MotionConfig), theme-color matchar bakgrunden,
  ingen grå tap-blink på iOS.
- Skills i `.claude/skills/`: web-design-guidelines, vercel-react-best-practices,
  supabase-postgres-best-practices.

## 2026-10-28 — Kreditkort, import, budgethuvud, årsväljare i Analys, Mer-ikon

- Kreditkortshanteraren: plus och kugghjul borta ur headern ("Lägg till
  kreditkort" längst ner finns kvar), "N kort" står diskret ovanför korten.
  `/settings/ccm/settings` borttagen — CCM slås på/av under Mer → Funktioner
  (även direkt från kortsidan när den är avstängd). CCM-blocket i Profil
  borttaget; dess fakturabrytdag lästes bara av oanvänd kod (brytdag är per kort).
- Import: en tillbakaknapp i headern som backar ett steg i flödet
  (granska → batchar → val av läge → Mer) i stället för två.
- Budgetdetalj: månaden på en rad, året litet under (bredvid "Aktuell period").
- Analys: "I år" har ‹ år › som månadsvyn; tidigare år visas helt (jan–dec)
  och jämförs med året innan. Första året börjar vid första registrerade månad.
- Navbar/sidomeny: "Mer" visas med tre prickar i stället för kugghjul.

## 2026-10-27 — Jämförpris, produkter med flera artiklar, artikelbyten

- `receipt_items.package_size/package_unit`: priser jämförs per kg/l/st.
  Backfill: vägda rader `1 kg`, 9 färdigpackade vägda varor (Wagyu, Brie,
  Paprika …) fick vikten uträknad, storlekar lästa ur namnen ("380G",
  "6-pack"). Pant avkopplad från produkter; 5 felkopplingar rättade
  (Smörgåsrån≠Smör m.fl.), Smör Osaltat och två äggartiklar kopplade.
- Vara i appen: snittpris över alla varianter → varianter (artiklar) med egen
  historik, storlek, "inte samma vara" och "lägg till variant". Artikelbyten
  (liknande namn, gamla artikeln inte köpt sedan) visas i grafen och översikten.
- `06-kvitton.md`: storlek/vikt-regler, steg för att koppla nya artiklar till
  befintliga produkter (`product_name`), mallen lär sig alias och ärver
  storlek från tidigare rader av samma artikel.

## 2026-10-27 — Kvitton via Claude-appen (utan API)

Nytt `06-kvitton.md`: dela kvittot till Claude-appen i projektet, Claude läser
av och sparar med en testad SQL-sats (butik, dubblettkoll, produktkoppling,
koppling till köpet). Ruttabellen i `00` har fått en rad — klistra in den i
projektinstruktionen.

## 2026-10-27 — Kvittoläsning, varugrupper, snabbare start, prognoströskel

- Kvitton läses av med Claude (Opus 5.5, strukturerad JSON): uppladdning i
  appen (`/api/receipts/upload`) och dela-genväg från Kivra/ICA
  (`/api/receipts/ingest`, samma enhetstoken som Wallet). Kräver
  `ANTHROPIC_API_KEY` i Vercel. Dubbletter (dag + belopp + butik) hoppas
  över, rader kopplas till produkter via artikelnummer/alias, kvittot
  matchas mot kort-/bankköpet (±1 kr, ±2 dagar).
- `products.product_group`: varugrupp vald i appen vinner över gissningen
  från namnet. Okopplade rader får en produkt + alias när gruppen väljs.
- Prognosen utesluter månader med <50 % av typiskt antal transaktioner
  eller köpdagar. Laddskärm, iOS-startbilder och funktioner i Dublin.

## 2026-10-27 — Analys, prognos, notiser och ny Översikt

- `expenses.import_source` (`'csv'`/`'auto'`/NULL) med backfill. Importsidan
  visar senaste datum per bank bara från bankfiler, så att Era/Wallet inte
  döljer luckor inför månadsbrytet.
- Ny sida **Analys** (`/analys`) ersätter "Visa min månad" och Utgifter-listan:
  Månad/I år/12 mån/Allt, Alla/Tim/Amanda, kategorifilter, fritextsök,
  drilldown med redigering och "lär regel" för okategoriserade rader.
- **Framåt**: prognos 3 eller 12 månader framåt. Fasta = median 3 mån,
  ränta/amortering från lånen (om de stämmer med historiken), rörliga = snitt
  6 mån med spann, trender per kategori när det finns minst 6 hela månader.
- Notisklocka (transaktioner att granska, saknad inkomst/budget).
- Översikten: att göra, kategorier att hålla koll på, prognos för perioden.
  Per person-budget följer `budget_item_assignments`; person-spend räknas
  från radens ägare.
- Budget: förbrukning inom ±5 % visas som Klar (grön).
- Menyn: Analys ersätter Utgifter; "Mer" är samlingssida för Importera,
  Sparmål, Lån, Kvitton, Gemensamt konto och Kreditkort.

## 2026-09-16 — Dokumentationen samlad i repot under `docs/`

Projektinstruktionen bantad till obrytbara regler + ruttabell (under 8 000
tecken) så att den ryms i ChatGPT:s instruktionsfält. Detaljerna flyttade till
`docs/01`–`docs/04`, så att uppsättningen kan användas med olika AI-verktyg,
versionshanteras med koden och uppdateras utan att projektinstruktionen rörs.
Den trasiga `../CLAUDE.md`-referensen i repo-roten riktad om till
`docs/README.md`.

---

## Nuläge per 2026-09-16

**Live och i daglig användning** av Tim och Amanda: budgetar, utgifter, CCM
(kreditkortshantering), lån, sparmål, kvitton, gemensamt konto, push-notiser.

**Nyligen genomfört:**
- `is_refund`-kolumnen tillagd på `expenses`, med check-constraint som bara
  tillåter negativa belopp när den är satt
- "Gruppköp" omdöpt till **"Utlägg"**
- `import_staging` utökad med `is_group_purchase`, `group_purchase_user_share`,
  `group_purchase_partner_share`, `group_purchase_swish_recipient`
- CCM-periodtotaler använder nu utläggs-CASE istället för rakt `amount`

**Öppna punkter:**
- Hinken Juli 2026 saknar 3 818,00 mot fakturan — två utläggsrader står på 0 kr.
  Se `03-ccm-avstamning.md`.
- **Homebase MCP-server** är utskissad men inte byggd. Tanken är att koda in
  domänlogiken (fakturaberäkning, import staging-regler, refund-validering,
  hårdkodat projekt-ID som skydd) i verktyg, för robustare AI-assisterad drift.
  Nästa steg innan bygge: välja implementationsväg (remote route handler på
  Vercel vs. lokal stdio) och enas om konkret verktygslista och auth-design.
- Löpande: nya merchant-regler till `category_mappings` efter varje
  importsession. Kandidatlista i `01-databas.md`.

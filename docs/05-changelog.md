# 05 — Changelog

Logg över ändringar i Homebase och i den här dokumentationen.
Nyast överst. Format: `## ÅÅÅÅ-MM-DD — rubrik` + en till tre rader om vad och varför.

Ändringar i dokumentationen skrivs bara in efter att Tim godkänt dem.

---

## 2026-11-09 — Kort och konto per budgetrad, utfall och importpåminnelse

- Budget: kortknappen på en rad öppnar Konto / Kort / Båda. Vid Båda anges
  kortdelen (`budget_items.ccm_amount`), resten dras från kontot. Gemensamt
  konto, "Dras från kontot" och per person räknar bara kontodelen.
- Ny budget: "Förra perioden" visar utfall per rad (hittills om perioden
  pågår) med förra budgeten bredvid, och Använd per rad. Kopiera tar budgeten.
- Ny budget: påminnelse om banker vars filer inte når till igår, för er båda
  (`import_freshness()`). Går att dölja per period.

## 2026-11-08 — Rörelse och 3D-kort från designlabbet

- Kreditkort: sammanfattningen är ett kort som lutar efter fingret
  (`components/ccm/credit-card-3d.tsx`, CSS 3D) med obetalt, närmaste
  förfallodag, antal utgifter och totalt. Flera kort listas under.
- `AnimatedAmount`: siffran räknar fram första gången per session
  (översiktens hero) och rör sig vid byte (Analys). Reducerad rörelse
  respekteras.
- Översikten: pillret "Kvar · per dag" visas överst när heron scrollats
  förbi. Inglidningar vid sidladdning borttagna.
- Analys: indikatorn för tidsspann glider (layoutId) och heron laddas inte
  om vid byte.

## 2026-11-08 — Platt mono i hela appen

- Kort är platta (`--card` = ytfärgen, ingen kant, små skuggor av via
  `--shadow-sm` m.fl.), stora hörn 24 px. Overlays (dialog, meny) har kvar
  sina skuggor.
- Siffror i mono: `.font-serif-kpi/-hero` är nu JetBrains Mono med
  tabular-nums, stora belopp via `<Amount>` (litet "kr"). Serif borttagen
  (Fraunces laddas inte längre), `label-caps` i vanlig skiftläge,
  sektionsrubriker 13 px.
- Mörk platta (`className="dark slab"`) för huvudsiffran på Analys,
  Prognos, Kvitton, budgetdetalj och Kreditkort.
- Primärknappen är cognac. `--secondary`/`--muted` ett steg mörkare så
  spår och chips syns på de nya korten.

## 2026-11-08 — Översikten i ny stil (Platt mono)

- Vald i designlabbet: 24 px hörn, cognac, siffror i monospace, platta ytor,
  kompakt. Heron är en mörk platta med "≈ X kr om dagen" och en takstapel där
  ett streck visar idag; kassaflöde, spara och kortfaktura som platta rutor
  under. Övriga block på översikten är platta (`bg-surface`, inga skuggor).
- Nya tokens i `globals.css`: `--surface`, `--surface-hover`, `--surface-line`,
  `--hero-slab` (hex, inte opacitet på variabler, för Capacitor). Belopp via
  `components/shared/amount.tsx`. Gamla `dashboard-skeleton.tsx` borttagen;
  översikten laddar med `DashboardPageSkeleton` som har samma form.

## 2026-11-08 — Designlabb i `/sandbox`

- Gamla sandlådan (jämförelse av utgiftsformulär) ersatt med ett designlabb:
  riktlinjegranskning, fyra layoutriktningar för översikten (`?riktning=`),
  rörelsemönster, 3D-lutande kreditkort, rangordnad kritik och en
  token-lekplats. Bara mockdata, inget sparas. Länk under Mer.
## 2026-11-08 — Genomgång av hela appen med testkonton

- Testkonton `claude-test-1@test.se` och `claude-test-2@test.se` (kopplade som
  partner) finns kvar för framtida tester. Allt deras data är testdata.
- Rättat: nya användare kunde inte lägga till sitt första lån (skapandet av
  standardgrupperna loopade och blockerade sparandet).
- Rättat: bankfiler kontrolleras mot dubbletter (datum, belopp, text) — rader
  som redan finns markeras och hoppas över.
- Rättat: sparmål räknade en månad för lite kvar (klockslag), "Total progress"
  på svenska, kreditkortssidan visade 0 kr obetalt utan kort, kreditkortsvalet
  i Ny utgift var av första gången, tydligt fel för projekt utan koppling i
  snabbformuläret, missvisande text om projekt utan koppling.
- Kategoriregler lärs in automatiskt vid import: vald eller ändrad kategori
  blir en regel (eller uppdaterar regeln med samma mönster). Swish, Bankgiro och
  liknande betalsätt undantas. Knappen "Spara som regel" är borttagen. Se
  `02-csv-import.md`.
- Migrationen `20240101000023_expenses_nullable_category.sql` är borttagen: den
  kördes aldrig i live, och varje utgift ska ha en kategori.
- Reglage: avstängt är neutralt grått i stället för salviagrönt.

## 2026-11-08 — Inköpslista

- Ny sida `/shopping`: skriv in varor en i taget, avdelningen gissas och går
  att ändra, spara till en Veckomat-lista, en egen lista eller en ny lista.
  Utkastet sparas på kontot. Nya tabeller `shopping_lists`,
  `shopping_list_drafts`, `shopping_item_sections`; `shopping_list_items` kan
  nu höra till en egen lista. Detaljer i `10-inkopslista.md`.
- Nya avdelningar: Dryck, Hem & hygien, Barn. Veckomats lista visar
  avdelningarna i butiksordning.

## 2026-11-03 — Veckomat fas 5: körning från appen

- Knappen "Skapa matsedel" på Veckomat startar en körning via Claude API
  (`/api/meals/run`): erbjudanden från Willys och Tjek, kvittopriser, ett
  Claude-anrop med strukturerat svar och `import_meal_plan`. Status i ny tabell
  `meal_runs`. Startprompten till chatten finns kvar under "Kör i
  Claude-chatten istället". Detaljer i `08-veckomat.md` 5.9.
- Spärren för modulen är kvar tills Tim bestämt om den ska öppnas.

## 2026-11-03 — Veckomat fas 4: källor för erbjudanden

- Testat från Vercel: Willys-API fungerar, ica.se blockerar (403), Coops
  erbjudande-API ger tomt. Tjeks öppna API har reklamblad per butik för alla
  stora kedjor. Resultat och dealer-id i `08-veckomat.md` 3.2.1.
- Maxi ICA Stormarknad Solna och Stora Coop Sundby Park läses nu via Tjek
  (`offers_source = 'tjek'`). Körinstruktionen och nya butiker i appen följer det.

## 2026-11-03 — Veckomat fas 3: körinstruktion, basvaror och har hemma

- Ny fil `09-veckomat-korning.md`: hur en körning görs steg för steg, och hur en
  schemalagd körning sätts upp. Rad i ruttabellen i `00-projektinstruktion.md`.
- Migration `meals_pantry_on_hand`: `meal_settings.pantry_staples`, `on_hand`,
  `on_hand_updated_at`, `meal_plans.leftovers`, `import_meal_plan` läser
  `leftovers`, ny `meal_prompt_context()` för körning utan appen.
- Appen: basvaror i inställningarna, "Har hemma just nu" under startprompten
  med förra planens rester som förslag, "Blir över" på listan.

## 2026-11-02 — Veckomat fas 2: appen, och partner läser kvitton

- Ny modul Veckomat (`meals`) under `/meals`: listor med "Ny"-etikett,
  arkiveringsfråga för passerade veckor, arkiv, receptvy, inköpslista som bockas
  av i realtid, inställningar (hushåll, mat, medlemskap, butiker) och en
  startprompt att kopiera till Claude-chatten. Syns bara med åtkomst
  (`has_feature_access('meals')`).
- Migration `partner_reads_receipts_and_profile`: partnern kan läsa kvitton,
  artiklar, produkter och alias. `profiles_select` rättad — partnervillkoret
  jämförde med kopplingens id och matchade aldrig. Tillagt på Tims begäran.

## 2026-11-02 — Veckomat fas 1: databas

- Migration `meals_module`: sju nya tabeller med hushålls-RLS, `stores` med
  `external_id` och läsrätt för partner, `profiles.feature_access` med skydd mot
  ändring från klienten, `import_meal_plan` och `latest_receipt_price`.
  Testad i transaktion som rullades tillbaka (Tim, Amanda, användare utan
  åtkomst, anon) innan den kördes.
- Data: `meals` i `feature_access` för Tim och Amanda, Willys Rissne och Stora
  Coop Sundby Park som butiker, Tims `meal_settings`, v45 importerad.

## 2026-11-02 — Docs: underlag för veckomat

- Ny fil `08-veckomat.md`: plan för modulen `meals` (matsedel, inköpslista,
  erbjudanden) med datakällor, tabeller, JSON-kontrakt, prisordning, byggordning
  och beslut. Inget byggt än. Tillagt på Tims begäran.
- Beslutat: inget hårdkodat per användare, och modulen är låst till
  `feature_access` och `@test.se`-konton tills körning via Claude API finns.

## 2026-11-01 — Lansering: onboarding, rundturer, genvägsnycklar och säkerhet

- Partnerkopplingar låsta (egna rader, bara väntande inbjudan, bara koppla från)
  och `/api/setup-user` läser användaren från sessionen.
- Ny onboarding med modulval, rundturer första gången en sida öppnas, "Kom igång"
  på översikten och egna nycklar under Mer › iPhone-genvägar.
- Nya kolumner `profiles.enabled_modules` och `profiles.seen_intros`. Ny fil
  `07-lansering.md` med det som är kvar. Tillagt på Tims begäran.

## 2026-10-30 — Prognos: frivilligt sparande gissas inte fram

- Frivilligt sparande (Savings utom Amortering) prognostiseras aldrig från historiken.
  Innevarande månad: gjort eller resten av budgetens plan; månader framåt: inget.
  Amortering räknas som kostnad. Utfall mot budget visar sparandet som förut.
- Dashboarden: "Utrymme att spara" (inkomst − prognos för kostnader och
  amortering) mot planerat sparande ersätter "Kassaflöde vid lön".

## 2026-10-30 — Förbrukning och kassaflöde, kortfakturan i prognosen

- Kortköp räknas en gång: förbrukning (huvud-KPI) = varje köp på köpdagen,
  Kreditkort-raden räknas inte (varken utfall eller budget som jämförs). Den är
  kassaflöde. Gemensam ekonomi oförändrad, men CCM-rader hoppas över i insättningen.
- Prognos: kortfakturan räknas per kort från köpen som redan ligger på den +
  kortets takt för okända dagar (se `03-ccm-avstamning.md`). Dashboarden visar
  kassaflöde vid lön och nästa kortfaktura; analysen delar upp förbrukning/sparande.
- KPI-regeln i avsnitt 1 av `00-projektinstruktion.md` uppdaterad (spend →
  förbrukning, Kreditkort-raden är kassaflöde), på Tims uttryckliga begäran.
  Dokumentationen godkänd av Tim.

## 2026-10-29 — Gemensam ekonomi, sparmål via trigger, budgetens källrader

- Sparmål: bidrag skapas/flyttas/tas bort av en DB-trigger på `expenses`
  (även vid redigering och SQL-insert). `initial_balance` = "Redan sparat",
  `starting_balance` härleds. Uttag, partnern ser delade mål, månadssparande borttaget.
- Gemensam ekonomi (f.d. Gemensamt konto): modellval Enligt budget / Efter inkomst /
  Delad inkomst, sidan Gemensamma kostnader, checklista för månadens överföringar, delning som bild.
- Budget: inkomsthinkar och procentrader enligt modellen; Ränta, Amortering och
  Kreditkort följer sin källa tills de skrivs över. Cachebugg (0 kr efter sparande) rättad.
  Dokumentationen godkänd av Tim.

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

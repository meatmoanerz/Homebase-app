# 05 — Changelog

Logg över ändringar i Homebase och i den här dokumentationen.
Nyast överst. Format: `## ÅÅÅÅ-MM-DD — rubrik` + en till tre rader om vad och varför.

Ändringar i dokumentationen skrivs bara in efter att Tim godkänt dem.

---

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

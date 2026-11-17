# 11 — Testkonton och test i webbläsaren

Senast uppdaterad: 2026-11-17

Så loggar du in som ett testkonto och klickar igenom appen själv, i stället för
att be Tim testa. Repot är **publikt**: inga lösenord, nycklar eller tokens får
skrivas hit, i kod, commit eller changelog.

## Konton

| E-post | Namn | Roll |
|---|---|---|
| `claude-test-1@test.se` | Testa | Huvudkonto, har testdata |
| `claude-test-2@test.se` | Partner | Kopplad som partner till Testa |

**Lösenord:** miljövariabeln `TEST_PASSWORD` i molnmiljön "Homebase-app". Samma
lösenord på båda kontona. Läs den i skriptet (`process.env.TEST_PASSWORD`), skriv
aldrig ut den.

- Finns inte variabeln: be Tim lägga in den (miljömenyn i sessionens titelrad →
  Edit → miljövariabler → `TEST_PASSWORD`). Be aldrig om lösenordet i chatten.
  Ny session plockar upp den.
- Kontona ligger i **live-databasen** (`ziplastiwvjcfrtjihwj`), samma som
  riktiga appen. RLS håller isär datan, men skriv bara på testkontona och
  verifiera med SQL efteråt.
- Övriga `@test.se`-konton i databasen (`test1`–`test5`, `demo1`–`demo2`)
  tillhör andra tester. Använd dem inte utan att fråga.
- Att ta bort kontona kräver bekräftelse i Supabase-rutan. Testdata får ligga
  kvar mellan sessioner.

### Testdata (kontrollerat 2026-11-09)

- Testa: ett tiotal utgifter i november (SEB-import, ett Amex-köp, manuella),
  gemensamma kategorier El, Prenumerationer och Mat (`shared_account_defaults`
  från 2026-11, modell `budget`) och en budget för 2026-12.
- Båda kontona: inkomsten "Lön" 30 000 kr för 2026-12 (`monthly_incomes`).
- Inga kreditkort inlagda. Lägg till via SQL om ett test kräver det.

## Starta appen lokalt

1. `.env.local` (gitignorad):
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://ziplastiwvjcfrtjihwj.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<hämta med Supabase-verktyget get_publishable_keys>
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` är en publik nyckel, men skrivs ändå inte in
   här. Serverns hemliga nyckel (`SUPABASE_SERVICE_ROLE_KEY`) finns inte i miljön.
2. `pnpm install`, sedan `rm -rf .next && pnpm dev` (port 3000).
3. Miljön "Homebase-app" släpper bara ut till `ziplastiwvjcfrtjihwj.supabase.co`
   (och pakethanterare).

## Inloggning med Playwright

Chromium och Playwright finns förinstallerade (`require('playwright')`).
Spara som `session.js` i scratchpad, utanför repot:

```js
const { chromium } = require('playwright')
const pw = process.env.TEST_PASSWORD
async function session(n = 1) {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    isMobile: true, hasTouch: true, locale: 'sv-SE', timezoneId: 'Europe/Stockholm',
  })
  const page = await ctx.newPage()
  await page.goto('http://localhost:3000/login', { timeout: 120000 })
  await page.fill('input[type=email]', `claude-test-${n}@test.se`)
  await page.fill('input[type=password]', pw)
  await page.click('button[type=submit]')
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 90000 })
  page.go = async (path) => {
    await page.goto('http://localhost:3000' + path, { waitUntil: 'domcontentloaded', timeout: 120000 })
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})
    await page.waitForTimeout(1000)
    // Dialogen "Påminn mig senare" ligger ivägen
    const later = page.getByRole('button', { name: /Påminn mig senare/ })
    if (await later.count()) await later.first().click().catch(() => {})
  }
  return { browser, page }
}
module.exports = { session }
```

Använd `session(1)` för Testa och `session(2)` för Partner. Första sidladdningen
kompilerar och kan ta flera sekunder. Ta skärmbilder med `page.screenshot` och
titta på dem.

## Kända begränsningar lokalt

- **Servervägarna som behöver den hemliga nyckeln ger 500**:
  `/api/partner`, `/api/household-incomes` med flera. Partnerns namn, partnerns
  inkomster och uppdelningen mellan er går därför **inte** att testa lokalt, bara
  läsas i koden. Next-overlayen visar "1 Issue" ("Error fetching household
  incomes"); det är väntat.
- **Ny budget: "Skapa budget" kan förbli låst** (kräver inkomst större än 0), trots
  att `monthly_incomes` finns för perioden, när `/api/household-incomes` svarar
  direkt med fel. Att fördröja anropet 4 s fungerade:
  `page.route('**/api/household-incomes', async (r) => { await new Promise((x) => setTimeout(x, 4000)); await r.continue() })`.
  Orsaken är inte utredd. Lägg in inkomster för perioden med SQL (kolumner:
  `user_id`, `period`, `name`, `amount`).
- **`page.clock.setFixedTime`** för att låtsas att det är en annan dag gav
  429 från Supabase (tokenförnyelse). Fungerade för en kort kontroll av UI som
  beror på dagens datum, inget mer.
- Appen kompilerar varje sida första gången: räkna med timeouts på 60–120 s
  första varvet.

## Efter ett test

Kontrollera med SQL att det som sparades blev rätt (till exempel
`budget_items` för budgetar). Logga bara det som gäller appens beteende i
`05-changelog.md`, aldrig inloggningsuppgifter.

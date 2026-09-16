# 04 — Kodflöde, bygge och frontend-fällor

Senast uppdaterad: 2026-09-16

## Arbetsflöde för kodändringar

1. Shallow-klona repot: `git clone --depth 1`
2. Gör ändringen i appens befintliga stil — matcha omgivande kod
3. Kör **innan push**:
   - `node_modules/.bin/tsc --noEmit`
   - `node_modules/.bin/eslint [ändrade filer]`
4. Pusha till `main`
5. Rapportera deploy + länk

**Kan du inte köra steg 3 i din miljö: pusha inte.** Säg det rakt ut och föreslå
att Tim kör verifieringen, eller att ändringen görs i en miljö som kan det.
Okompilerad kod på `main` tar ner live-appen direkt.

### Praktiska knep

- **Python inline-string-replacement** är mer pålitligt än `sed` för ändringar
  på flera ställen i stora filer.
- **Lint-baseline:** använd `git stash` / `git stash pop` för att jämföra
  felen mot rena `main` innan du antar att de kommer från dina ändringar.
- GitHub-PAT har repo-scope. Lagra den aldrig permanent.

### Repon

| Repo | App | Deploy |
|---|---|---|
| `meatmoanerz/Homebase-app` | Homebase | Vercel, auto på push till `main` |
| `meatmoanerz/zplitta-app` | Zplitta | Vercel, auto på push till `main` |

---

## Byggnoter

- **Typsnitt:** använd alltid `@fontsource-variable`-paket, aldrig Google Fonts.
  Google Fonts är blockerat i sandboxen vid `next build`. Stubba
  `next/font/google`-importer vid lokal build.
- **Tailwind v4 CSS-inspektion:**
  `npx @tailwindcss/cli@4 -i src/app/globals.css -o /tmp/out.css`
  — snabbare än en full Next.js-build.
- **Raderade routes:** rensa `.next` innan ombyggnad, annars får du stale
  TypeScript-fel för filer som inte längre finns.
- **`vercel.json`** måste innehålla `{"framework": "nextjs"}`, annars blir det
  "No Output Directory"-fel vid deploy.

---

## Frontend-fällor (dyrköpta)

### Tailwind v4 dark mode

`globals.css` måste innehålla:

```css
@custom-variant dark (&:where(.dark, .dark *));
```

Utan den följer `dark:`-utilities `prefers-color-scheme` istället för
`next-themes` `.dark`-klass. Resultatet är temaläckage på enheter med systemmörkt
läge påslaget — appen ser rätt ut hos dig och trasig hos någon annan.

### Safari / WKWebView

`showPicker()` stöds inte — och misslyckas **tyst**. Inget felmeddelande, inget
händer.

Lösning: absolutpositionerad transparent `<input type="date">` som overlay.

### Capacitor

CSS custom property-opacity renderas inkonsekvent. Föredra hårdkodade värden
(t.ex. `text-white`) där kontrast måste vara garanterad.

### VAPID / Web Push

Prenumerationer registrerade mot en gammal public key skickar tyst till **0
enheter** efter nyckelrotation. Inget fel kastas.

Vid nyckelrotation: radera stale subscriptions i `push_subscriptions` och
tvinga omregistrering.

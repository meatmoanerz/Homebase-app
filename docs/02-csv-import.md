# 02 — CSV-import

Senast uppdaterad: 2026-09-16

## Flödet

Tim laddar upp CSV → du parsar och kategoriserar mot `category_mappings` →
skriver raderna till `import_staging` → Tim granskar via valet **"AI-import"**
under Importera CSV. Han bockar, justerar och sparar. Resten självdör efter ~48h.

---

## Filformat per bank

| Bank | Avgränsare | Datumformat | Tecken |
|---|---|---|---|
| SEB | semikolon | — | utgifter negativa → invertera till positiva |
| Swedbank | komma, hoppa metadatarad 1 | — | utgifter negativa → invertera till positiva |
| Amex | komma | MM/DD/YYYY | **detekteras per fil** |

### Amex-tecken

Hårdkoda aldrig en flip. Upptäck konventionen dynamiskt i varje fil.

Nuvarande exporter har köp positiva och returer negativa — vilket redan är
målkonventionen, alltså ingen inversion. Men kontrollera alltid innan import.
Formatet har ändrats förr.

---

## Importsekvens

1. Hämta `category_mappings` (`ORDER BY priority DESC, hit_count DESC`)
2. Slå upp kategori-UUID:n i `categories`
3. Kontrollera dubbletter mot **både** `expenses` och `import_staging`,
   på datumintervall + bank
4. INSERT i `import_staging` med gemensamt `batch_id` via CTE (se `01-databas.md`)

---

## Vad som ska med — Amex-faktura

ALLA transaktioner på fakturan ska in som utgifter. Både köp OCH
krediteringar/returer (negativa belopp från handlare).

**Enda undantaget:** själva betalningen av fakturan/skulden — t.ex. raden
"Betalning Mottagen" under "Nya inbetalningar". Det är den enda post som
exkluderas på en Amex-faktura.

---

## Vad som ska med — övrigt

**Exkludera:**
- Swish till Amanda (`46705204919`)
- Bankinterna poster: kortfakturabetalningar, lön, överföringar mellan egna konton

**Inkludera:**
- Alla andra Swish
- Alla handlarreturer (dessa är INTE bankinterna)

---

## Fältregler

| Fält | Regel |
|---|---|
| `amount` | utgifter positiva |
| returer | `is_refund = true` + negativt `amount` — krävs av check-constraint |
| `cost_assignment` | default `'shared'`. Gissa aldrig utifrån kortinnehavare. |
| kategori | lämna blank vid osäkerhet |
| `is_ccm` | `true` för Amex, `false` för SEB/Swedbank |

### Undantag för `is_ccm`

Amex-betalningsraden som dyker upp i **Swedbank** får `is_ccm = true` och
kategori Kreditkort. Det är den enda SEB/Swedbank-raden som ska ha `is_ccm = true`.

### Returer och `cost_assignment`

Är raden en retur av ett tidigare köp med känd `cost_assignment` — återanvänd
samma värde. Annars blir returen bokförd på fel person och saldot driftar.

### Utlägg

Kan förifyllas redan vid CSV-bearbetning. `amount` = korttotal, budgetandelen
härleds vid import. Rent utlägg = båda shares 0.

---

## Periodgränser

Periodgränser är **inte** exakta kalenderdatum. En faktura kan innehålla en
transaktion daterad dagen innan angivet "från"-datum, på grund av skillnaden
mellan Amex auktoriserings- och bokföringsdatum.

Filtrera därför aldrig strikt på fakturans angivna datumintervall vid
avstämning. Jämför transaktion för transaktion. Se `03-ccm-avstamning.md`.

---

## Nya merchant-regler

Efter varje importsession dyker okända merchants upp. Lägg dem som nya regler i
`category_mappings` i `ziplastiwvjcfrtjihwj`. Aktuell kandidatlista finns i
`01-databas.md`.

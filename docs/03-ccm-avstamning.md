# 03 — CCM / Amex-avstämning

Senast uppdaterad: 2026-09-16

## Kritiskt: `is_ccm`

`expenses.is_ccm` MÅSTE vara `true` för alla rader med `bank = 'Amex'`.

Annars hamnar de utanför Kreditkort-vyn helt och räknas felaktigt som direkt
kassaflöde.

Missades 2026-08-30 → 72 rader fick `is_ccm = false`, vilket gjorde julifakturan
omöjlig att stämma av. Rättat i efterhand.

---

## Hur appen grupperar fakturor

`getInvoicePeriod()` i `src/hooks/use-expenses.ts`:

> om `dag >= brytdatum` → transaktionen hamnar i NÄSTA månads fakturahink

Tims `ccm_invoice_break_date` = **2**. Det ger hinken "Juli 2026" =
transaktioner 2 juni–1 juli.

### Hinkens namn

**Hinkens namn är månaden fakturan BETALAS, inte perioden den täcker.**

| Hink | Faktura daterad | Period | Förfaller |
|---|---|---|---|
| Juli 2026 | 02.07 | — | 27.07 |
| Augusti 2026 | 02.08 | 03.07–02.08 | 27.08 |

### Varför brytdatum 2 fungerar

Amex-perioden är 03.xx–02.xx, så brytdatum **3** matchar Amex exakt.

Brytdatum **2** fungerar ändå i praktiken, eftersom årsavgiften den 2:a varje
månad är samma belopp (150 kr) och nettar ut mellan hinkarna.

---

## Transaktionsdatum vs bokföringsdatum

Amex kan ta med köp daterade FÖRE fakturaperiodens start, om bokföringsdatum
(processdatum) ligger inom perioden.

**Exempel:** HM.COM 2 658,60 daterad 30.06 men bokförd 06.07 → ligger på
fakturan 03.07–02.08.

Sådana rader måste dateras inom periodens hink för att avstämningen ska gå ihop.

**Konsekvens för queries:** utöka alltid intervallet minst en dag före angiven
periodstart. Filtrera på `bank = 'Amex' AND is_ccm = true`, inte bara datum.

---

## Periodtotaler

Använd utläggs-CASE, inte rakt `amount`:

```sql
SUM(
  CASE WHEN is_group_purchase
  THEN COALESCE(group_purchase_total, amount)
  ELSE amount END
)
```

Med rakt `amount` blir totalen fel så fort ett utlägg finns i perioden.

---

## Avstämd faktura 03.07.26–02.08.26

- Fakturasaldo **34 827,28** (Tim 12 468,17 / Amanda 22 359,11), 57 transaktioner
- Efter rättning: hinken Augusti 2026 = 34 827,28 exakt
- `ccm_invoices`: 2026-07 = 38 214,27, 2026-08 = 34 827,28

---

## Öppen punkt

Hinken Juli 2026 = 34 396,27 vs fakturan 38 214,27 → **saknas 3 818,00**.

Motsvarar de två utläggsraderna "Elgiganten" (638 kr) och "Flygbiljetter kaoz"
(~3 180 kr), som står på 0 kr i `expenses`.

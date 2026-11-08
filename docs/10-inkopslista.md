# 10 — Inköpslista

Senast uppdaterad: 2026-11-08

Sidan `/shopping`, där varor skrivs in en i taget och sparas i en lista. Den
hör till kärnan, inte till en tillvalsmodul, och syns i sidomenyn och under
Mer. Migration: `20261108120000_shopping_lists.sql`. Kod:
`src/hooks/use-shopping.ts`, `src/components/shopping/`,
`src/lib/shopping/sections.ts`, `src/app/(app)/shopping/`.

Läs `01-databas.md` innan du rör schemat.

---

## 1. Flödet

1. Skriv en vara och tryck Enter. Mängd i början eller slutet läses ut till
   `qty_text` ("Mjölk 2 l", "2 mjölk", "3x avokado").
2. Avdelningen fylls i automatiskt (avsnitt 3) och går att ändra, både i
   inmatningsraden och på varje rad i utkastet.
3. **Spara till lista** öppnar en dialog: veckans Veckomat-listor
   (`meal_plans.status = 'visible'`), egna listor som inte är arkiverade, eller
   **Ny lista**. Varor som redan finns oavbockade i den valda listan visas, och
   hoppas över som standard.
4. Sparade (och överhoppade) rader tas bort ur utkastet.

Egna listor öppnas på `/shopping/[id]`: avbockning i realtid för båda,
ta bort rader, arkivera och ta bort listan. Veckomat-listor öppnas som förut på
`/meals/[id]`, där rader som lagts till för hand visas utan pris.

## 2. Tabeller

| Tabell | Innehåll | Åtkomst |
|---|---|---|
| `shopping_lists` | Egna listor: `name`, `created_at`, `archived_at` | Hushållet (`my_household_user_ids()`) |
| `shopping_list_items` | Samma tabell som Veckomat. En rad har **antingen** `meal_plan_id` **eller** `shopping_list_id` (check `shopping_list_items_one_list_check`) | Hushållet |
| `shopping_list_drafts` | Utkastet: en rad per användare, `items` jsonb `[{id, name, qty_text, section, manual}]` | Bara ägaren |
| `shopping_item_sections` | Avdelning hushållet valt själv: `name_key` (gemener) → `section`, unik per användare | Hushållet |

- `import_meal_plan` sätter `meal_plan_id` som förut och påverkas inte.
- Triggern `shopping_list_items_check_list` hindrar en inloggad användare från
  att lägga rader i en lista eller matsedel utanför hushållet (FK-kontrollen
  går förbi RLS). Service role (`/api/meals/run`) passerar.
- Raderas en egen lista försvinner dess rader (`ON DELETE CASCADE`).

## 3. Avdelning: så gissas den

Avdelningar (`SHOPPING_SECTIONS`): Frukt & grönt, Kött & chark, Fisk, Mejeri,
Bröd, Skafferi & fryst, Dryck, Hem & hygien, Barn, Övrigt. De sju första är
samma som Veckomat skriver. Listor visas i den ordningen.

Första träff vinner, på varans namn i gemener:

1. Eget val i `shopping_item_sections` (ens eget före partnerns, nyast först).
   Sparas när en vara med handvald avdelning sparas till en lista.
2. Den avdelning namnet oftast haft i tidigare listor, Veckomat inräknat.
3. `products.product_group` från kvittona, översatt till avdelning.
4. Gissning från namnet med kvittomodulens regler (`productGroup()`), där pasta,
   ris och mjöl flyttas från bröd till Skafferi & fryst och "fryst …" alltid
   blir Skafferi & fryst.

Namnen från 2 och 3 används också som förslag i inmatningsfältet.

## 4. Utkastet

Sparas på kontot (`shopping_list_drafts`) ca 0,7 s efter senaste ändringen, när
sidan lämnas och när appen går till bakgrunden. Enheten har dessutom en kopia i
`localStorage` (`shopping-draft:<user_id>`), så att en rad som skrivs precis
innan sidan stängs inte går förlorad. Vid start vinner den kopia som har nyast
`updated_at`; är enhetens nyare skickas den upp.

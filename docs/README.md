# Homebase — dokumentation

Detta är källan till sanning för hur Homebase ska hanteras. Den är skriven för
att läsas av en AI-assistent (Claude, ChatGPT, Codex) lika mycket som av en
människa.

## Så här hänger det ihop

| Fil | Innehåll | Läs när |
|---|---|---|
| [`00-projektinstruktion.md`](00-projektinstruktion.md) | Obrytbara regler + ruttabell | Klistras in i AI-verktygets projektinstruktion |
| [`01-databas.md`](01-databas.md) | Schema, constraints, SQL-arbetsflöde | Innan du skriver SQL eller rör schema |
| [`02-csv-import.md`](02-csv-import.md) | Filformat per bank, importregler | Innan du behandlar en bank-CSV |
| [`03-ccm-avstamning.md`](03-ccm-avstamning.md) | Brytdatum, hinklogik, avstämning | Innan du stämmer av en Amex-faktura |
| [`04-kodflode.md`](04-kodflode.md) | Byggflöde, byggnoter, frontend-fällor | Innan du ändrar kod eller felsöker UI |
| [`05-changelog.md`](05-changelog.md) | Vad som ändrats och när | För att förstå nuläget |

`00-projektinstruktion.md` är den enda filen som **inte** läses från repot i
normalfallet — dess innehåll klistras in manuellt i projektinstruktionen hos den
AI du använder, så att reglerna alltid ligger i kontexten. Kopian här finns för
att den ska versionshanteras och gå att diffa.

Kodnära konventioner (query keys, komponentmönster, mappstruktur) ligger i
[`../CLAUDE.md`](../CLAUDE.md) i repo-roten. Den här mappen handlar om domänen
och arbetsflödena, inte om kodstilen.

## Regler för dokumentationen

1. **Ändra bara innehåll som är fel eller saknas.** Skriv aldrig om en fil för
   språkets eller strukturens skull.
2. **Föreslå ändringar som diff** — visa exakt vad som tas bort och läggs till.
   Tim godkänner innan något committas.
3. **Logga varje godkänd ändring** i `05-changelog.md` med datum och en rad om
   vad och varför.
4. **Reglerna i avsnitt 1 av `00-projektinstruktion.md` ändras aldrig av en AI.**
   De föreslås till Tim, som uppdaterar projektinstruktionen manuellt.
5. En fil = ett ansvarsområde. Håll diffarna små nog att faktiskt läsas.

## Uppdatera från telefonen

Utan dator går det att ändra dessa filer på tre sätt:

- Promptа Claude — den klonar, ändrar och pushar
- GitHub-appen (iOS/Android) — pennikonen på filen
- github.com i mobilwebbläsaren

Ändringar i `docs/` triggar en Vercel-ombyggnad. Det är ofarligt, bara lite brus
i deploy-loggen.

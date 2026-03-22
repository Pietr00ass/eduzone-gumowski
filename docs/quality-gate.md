# Minimalny próg jakości dla adaptacyjnej nauki

## Wymagania blokujące
1. Testy automatyczne dla helperów quizu, historii i sesji przechodzą lokalnie.
2. Pokrycie logiki obejmuje co najmniej:
   - walidację pytań,
   - dobór pytań do sesji adaptacyjnej,
   - `exam readiness`,
   - trend 5 vs 5,
   - review filters,
   - brak regresji dla `exam`, retry i backupu.
3. Manualna checklista QA jest wykonana bez blockerów i bez krytycznych błędów w quiz flow.
4. Import/export backupu zachowuje zgodność z obecnym formatem danych.

## Minimalna definicja Done
- 0 otwartych blockerów.
- 0 krytycznych błędów w sesji `study`, `exam` i `Trenuj słabe miejsca`.
- Review po sesji działa z filtrami i poprawnym liczeniem badge.
- Dashboard poprawnie pokazuje readiness i trend także dla pustej lub małej historii.

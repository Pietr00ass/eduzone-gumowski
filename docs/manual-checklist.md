# Manualna checklista QA

## Układy i nawigacja
- [ ] Mobile layout działa poprawnie w szerokościach 320px, 375px i 768px.
- [ ] Dashboard, gra, bank pytań, rekordy i profil przełączają się bez utraty stanu UI.
- [ ] Przycisk `Trenuj słabe miejsca` ma poprawny stan aktywny lub nieaktywny zależnie od historii.

## Zachowanie quizu
- [ ] Zmiana trybu ustawia polecane wartości limitu, czasu, kategorii i timeru zamiast zostawiać poprzednią mieszankę ustawień.
- [ ] `exam` zawsze wymusza timer i nie pokazuje wyjaśnień w trakcie rundy.
- [ ] `study` pozwala wyłączyć timer i po rundzie pokazuje retry błędnych pytań.
- [ ] Adaptacyjna sesja startuje w `study`, z wyłączonym timerem i bez shuffle.
- [ ] `Code Runner 2D` pozwala sterować po torach strzałkami i zalicza odpowiedź po dojechaniu kafelków do strefy.
- [ ] Po kliknięciu odpowiedzi nie można nabić punktów wielokrotnie.
- [ ] Timeout jest poprawnie oznaczany w review i filtrze `Timeout`.

## Review i insighty
- [ ] Review po rundzie pokazuje filtry `Wszystkie`, `Błędne`, `Timeout`, `Poprawne`.
- [ ] Po zwykłej sesji podsumowanie pozwala wystartować `Trenuj słabe miejsca`, jeśli historia jest wystarczająca.
- [ ] Badge edukacyjne pojawiają się tylko wtedy, gdy spełnione są warunki sesji.
- [ ] `Exam readiness` pokazuje sensowny stan dla kategorii z danymi i stan `za mało danych`, gdy historii brakuje.
- [ ] Trend 5 vs 5 nie pokazuje mylących wartości przy zbyt małej liczbie sesji.

## Dane lokalne
- [ ] Zmiany w bazie pytań zapisują się w `localStorage` i są dostępne po odświeżeniu strony.
- [ ] Pełny backup przywraca pytania, konfigurację, historię i profil.
- [ ] Import starszego backupu nie psuje aktualnego działania review i leaderboardu.
- [ ] Usunięte pytania z historii nie wywracają sesji `Trenuj słabe miejsca`.

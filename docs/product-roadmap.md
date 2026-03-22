# Produkt: quiz local-first z adaptacyjną nauką

## Obecny stan produktu

Aktualna wersja ma już:

- tryby `study`, `exam`, `blitz`, `survival`, `arcade` i `mentor`,
- review odpowiedzi po rundzie,
- retry błędnych pytań,
- dashboard z insightami lokalnymi,
- bank pytań z walidacją i szybkim formularzem,
- eksport/import pytań oraz pełny backup JSON.

## Najbliższy etap

### 1. Adaptacyjna nauka
- sesja `Trenuj słabe miejsca` oparta o ostatnie błędy i najtrudniejszą kategorię,
- domyślnie uruchamiana jako `study` bez timera i bez shuffle,
- follow-up `Jeszcze jedna poprawka` po adaptacyjnej sesji, jeśli nadal są błędy.

### 2. Readiness do exam
- karta `Exam readiness` liczona z lokalnej historii,
- próg wejścia: minimum 10 odpowiedzi w kategorii,
- statusy: `za mało danych`, `jeszcze nie`, `prawie gotowe`, `gotowe na exam`.

### 3. Trend postępu
- porównanie średniej skuteczności z ostatnich 5 sesji do poprzednich 5,
- rekomendacja następnej sesji oparta o readiness i słabe miejsca.

## Kolejne kroki po tym etapie

### Etap 2 — mocniejszy authoring pytań
- edycja istniejących pytań z poziomu UI,
- duplikowanie pytania jako draft,
- szybsze czyszczenie i walidacja importów.

### Etap 3 — lokalne ścieżki nauki
- preset sesji per fokus użytkownika,
- osobne bloki nauki dla kategorii o niskiej skuteczności,
- zapis ulubionych zestawów bez backendu.

### Etap 4 — delikatna gamifikacja edukacyjna
- odznaki za regularność i bezbłędne rundy,
- tygodniowe wyzwania local-only,
- mikrofeedback podnoszący motywację bez zmiany modelu local-first.

## Założenia stałe

- produkt pozostaje local-only,
- nie dodajemy backendu ani zewnętrznych kont,
- format pytania ma pozostać prosty i łatwy do backupu,
- adaptacja ma opierać się na historii wyników, a nie na ciężkim modelu danych.

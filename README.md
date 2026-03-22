# projekt-gumowski

Local-only quiz bez backendu. Cała aplikacja działa w przeglądarce, a pytania, konfiguracja, profil użytkownika, historia sesji i backup są trzymane lokalnie.

## Co jest w środku

- tryb `study` z opcjonalnym timerem i retry tylko dla błędnych pytań,
- tryb `exam` z obowiązkowym timerem, bez podpowiedzi w trakcie i z wynikiem procentowym,
- adaptacyjną sesję `Trenuj słabe miejsca`, która wykorzystuje lokalną historię błędów,
- dodatkowe tryby `blitz`, `survival`, `arcade`, `runner` i `mentor`,
- przegląd odpowiedzi po każdej rundzie: poprawność, czas, punkty, poprawna odpowiedź i filtry review,
- dashboard z realniejszymi insightami: średnia skuteczność, najtrudniejsza kategoria, readiness do exam, trend 5 vs 5, rekomendowana następna sesja i najczęściej mylone pytania,
- bank pytań z edycją JSON, szybkim formularzem dodawania pytania i podglądem przed zapisem,
- ostrzejsza walidacja pytań: unikalne ID i brak zduplikowanych odpowiedzi,
- eksport/import samych pytań oraz pełny backup aplikacji jako JSON.

## Uruchomienie

Repo zawiera prosty frontend w katalogu `frontend/`.

1. Zainstaluj Node.js.
2. Uruchom lokalny serwer:

```bash
npm start
```

3. Otwórz aplikację pod adresem:

```text
http://127.0.0.1:4173
```

## Główne przepływy

### 1. Konfiguracja sesji

W zakładce `Graj` ustawiasz:

- tryb,
- kategorię,
- limit pytań,
- czas na pytanie,
- włączenie lub wyłączenie timera,
- losowanie kolejności,
- retry błędnych pytań w `study`.

`exam` wymusza aktywny timer i nie pozwala go wyłączyć.
Zmiana trybu automatycznie ustawia teraz polecany preset, a przycisk `Polecane ustawienia` pozwala wrócić do sensownego punktu startowego jednym kliknięciem.
Sesja `Trenuj słabe miejsca` sama przełącza konfigurację na `study`, wyłącza timer, zostawia retry błędów i wyłącza shuffle.

### 2. Rozgrywka

Podczas sesji aplikacja pokazuje:

- postęp,
- aktywny tryb,
- licznik czasu albo informację, że timer jest wyłączony,
- odpowiedzi do wyboru.

W `Code Runner 2D` pytanie zostaje u góry ekranu, a Ty sterujesz informatykiem po torach strzałkami. Odpowiedzi jadą z prawej strony i trzeba ustawić się na właściwym torze, zanim dojadą do strefy kolizji.

Po zakończeniu rundy dostajesz pełne podsumowanie:

- wynik `poprawne/wszystkie`,
- punkty,
- średni czas odpowiedzi,
- procent w `exam`,
- listę wszystkich odpowiedzi z review,
- badge edukacyjne, np. `bez timeoutów`, `szybka runda` i `gotowy na exam`.

Jeśli grasz w `study` i masz włączone retry błędów, po rundzie możesz od razu uruchomić poprawkę tylko dla nietrafionych pytań.
Po zakończeniu zwykłej sesji możesz też wejść bezpośrednio w `Trenuj słabe miejsca` z poziomu podsumowania, jeśli lokalna historia ma już dość danych.
Jeśli kończysz sesję `Trenuj słabe miejsca`, pojawia się przycisk `Jeszcze jedna poprawka`, który ponownie odpala krótką korektę tylko z błędnych pytań.

### 2a. Adaptacyjna nauka i readiness

Dashboard liczy teraz dwa dodatkowe sygnały:

- `Exam readiness` dla rekomendowanej kategorii,
- trend skuteczności z ostatnich 5 sesji vs poprzednie 5.

`Exam readiness` działa bez zmiany formatu pytań i korzysta tylko z historii odpowiedzi:

- mniej niż 10 odpowiedzi w kategorii: `za mało danych`,
- mniej niż 70%: `jeszcze nie`,
- 70-84%: `prawie gotowe`,
- 85% lub więcej: `gotowe na exam`.

Przycisk `Trenuj słabe miejsca` buduje sesję adaptacyjnie:

- najpierw z najczęściej mylonych pytań z ostatnich 10 sesji,
- potem z pytań z najtrudniejszej kategorii,
- na końcu z reszty bazy, aż do aktualnego limitu pytań.

Jeśli historia jest zbyt mała, przycisk pozostaje nieaktywny i pokazuje komunikat o zbieraniu danych.

### 3. Bank pytań

W zakładce `Bank pytań` masz dwa sposoby pracy:

- edycję całej bazy przez JSON,
- szybkie dodawanie pojedynczego pytania bez JSON-a.

Szybki formularz pozwala wpisać:

- ID pytania,
- kategorię,
- treść,
- odpowiedzi, po jednej w linii,
- poprawną odpowiedź,
- wyjaśnienie.

Zanim zapiszesz pytanie, zobaczysz jego podgląd.

Walidacja blokuje zapis, jeśli:

- lista pytań jest pusta,
- pytanie nie ma treści,
- pytanie ma mniej niż 2 odpowiedzi,
- poprawna odpowiedź nie występuje na liście,
- ID nie jest unikalne,
- odpowiedzi są zdublowane.

### 4. Backup

Masz dwa eksporty:

- `Eksport JSON` zapisuje samą bazę pytań,
- `Eksport backupu` zapisuje pełny stan aplikacji.

Pełny backup zawiera:

- pytania,
- konfigurację sesji,
- historię wyników,
- profil użytkownika.

`Import backupu` przywraca cały ten stan lokalnie.

## Co zapisuje się lokalnie

W `localStorage` aplikacja trzyma:

- bazę pytań,
- konfigurację quizu,
- historię sesji,
- profil użytkownika.

Nie ma backendu, logowania do zewnętrznego systemu ani synchronizacji z serwerem.

## Testy

Jeśli masz lokalnie dostępne narzędzia, możesz uruchomić:

```bash
npm test
npm run typecheck
python3 -m unittest discover -s tests -v
```

W repo są też testy pomocnicze dla:

- logiki quizu,
- pytaniowego state machine,
- walidacji banku pytań, adaptacyjnego doboru pytań, readiness, trendu i filtrów review,
- trybu `exam` po stronie modułów Pythona.

## Struktura

- `frontend/` – aplikacja działająca w przeglądarce
- `frontend/src/` – logika UI, sesji, historii i banku pytań
- `src/` – dodatkowe moduły JS/TS/Python używane przez testy i warstwę domenową
- `test/`, `tests/` – testy JavaScript i Python

## Założenia projektu

- local-first,
- bez backendu,
- bez zewnętrznego API,
- całość ma działać lokalnie i dawać się łatwo zbackupować do JSON-a.

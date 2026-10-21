# Gitlab MR Checker

Rozszerzenie dla Firefoksa oraz Chrome i innych przeglądarek opartych na Chromium (np. Brave),
które prosi o potwierdzenie utworzenia, zapisania edycji
lub ręcznego merge merge requesta (MR) w GitLabie, gdy zaznaczono usunięcie brancha
źródłowego lub squash. Działa lokalnie na wskazanym przez użytkownika serwerze GitLab,
bez tokenów i wywołań API GitLaba.

**Automatic merge nie jest sprawdzany.** Dodatek pomija zarówno włączenie auto-merge,
jak i późniejsze wykonanie merge przez serwer. Ręczny „Merge immediately” jest sprawdzany.

Wersja Firefox używa Manifest V2, a wersja dla Chromium Manifest V3 ([szczegóły](browsers/chrome/README.md)).
Obie korzystają z tego samego kodu w `src/`.

## Szybki start

Wymagane: **Node.js 18 lub nowszy** oraz **Firefox 142 lub nowszy** albo przeglądarka
oparta na **Chromium 108 lub nowszym** (Chrome, Brave i inne). Nie trzeba instalować zależności npm.

Pobierz repozytorium, otwórz terminal w jego katalogu głównym i zbuduj rozszerzenie:

```sh
node scripts/build.cjs firefox   # wynik w dist/firefox/
node scripts/build.cjs chrome    # wynik w dist/chrome/
```

### Firefox

1. Otwórz `about:debugging#/runtime/this-firefox`.
2. Kliknij „Wczytaj tymczasowy dodatek” (Load Temporary Add-on) i wskaż
   `dist/firefox/manifest.json`.
3. W otwartej stronie ustawień wpisz adres serwera, np. `https://gitlab.example.com`,
   i kliknij „Zapisz i włącz”.
4. Zaakceptuj dostęp do wskazanej domeny i odśwież wszystkie otwarte karty GitLaba.

Ustawienia można ponownie otworzyć ikoną dodatku na pasku narzędzi lub przez opcje
w `about:addons`. Tymczasowa instalacja znika po ponownym uruchomieniu Firefoksa.
Stałą instalację opisuje sekcja [Pakowanie i podpisywanie](#pakowanie-i-podpisywanie).

### Chrome, Brave i inne przeglądarki Chromium

Wszystkie przeglądarki oparte na Chromium używają tej samej paczki `dist/chrome/`.

1. Otwórz stronę rozszerzeń: `chrome://extensions` w Chrome, `brave://extensions` w Brave.
2. Włącz „Tryb dewelopera” (Developer mode).
3. Kliknij „Załaduj rozpakowane” (Load unpacked) i wskaż katalog `dist/chrome/`.
4. W otwartej stronie ustawień wpisz adres serwera i kliknij „Zapisz i włącz”.
5. Zaakceptuj dostęp do wskazanej domeny i odśwież wszystkie otwarte karty GitLaba.

Ustawienia można ponownie otworzyć ikoną dodatku lub przez „Szczegóły” → „Opcje rozszerzenia”.
Rozpakowane rozszerzenie zostaje po ponownym uruchomieniu przeglądarki.
Po przebudowaniu kliknij „Odśwież” przy dodatku na stronie rozszerzeń i odśwież karty GitLaba.

## Działanie

Okno potwierdzenia wymienia zaznaczone opcje: usunięcie brancha źródłowego po merge
oraz scalenie commitów (squash). Dodatek odczytuje stan checkboxów i nie zmienia ich wartości.

| Akcja | Zachowanie |
| --- | --- |
| Utworzenie lub zapis edycji MR | Pytanie, jeśli zaznaczono co najmniej jedną z kontrolowanych opcji. |
| Ręczny Merge, „Merge immediately” lub wariant „Merge now” dla merge train | Kontrola aktualnych checkboxów w panelu merge, także zaznaczonych i zablokowanych ustawieniami projektu. |
| Rozpoznany przycisk ręcznego merge, ale brak odczytu opcji | Pytanie z ostrzeżeniem, aby sprawdzić opcje w panelu GitLaba. |
| Brak zaznaczonych opcji przy poprawnym odczycie | Akcja przechodzi bez pytania. |
| Włączenie lub wykonanie automatic merge | Bez kontroli i bez pytania. |

„Zapisz MR” lub „Kontynuuj merge” wznawia pierwotną akcję.
„Wróć do MR”, Esc lub kliknięcie tła zamyka okno bez wykonania akcji.
Początkowy fokus jest na przycisku anulowania. Zmiana opcji podczas wyświetlania
pytania powoduje ponowną kontrolę przed wznowieniem akcji.

## Konfiguracja i prywatność

- Podaj sam adres HTTPS serwera, bez ścieżki projektu, danych logowania, parametrów
  i fragmentu URL. HTTP i niestandardowe porty nie są obsługiwane.
- Obsługiwany jest jeden skonfigurowany serwer naraz. Dodatek nie zawiera firmowego adresu.
- Manifest deklaruje `https://*/*` jako uprawnienie opcjonalne, aby umożliwić wybór
  serwera. Dostęp jest przyznawany tylko do wskazanej domeny.
- Bez konfiguracji lub zgody na dostęp ochrona pozostaje wyłączona.
- Adres jest zapisywany w `storage.local`, bez synchronizacji przez konto.
  Przy uruchomieniu dodatek odtwarza ochronę na podstawie ustawienia i uprawnienia.
- Po poprawnej zmianie adresu poprzednie uprawnienie jest usuwane.
  **Odśwież wszystkie otwarte karty GitLaba po konfiguracji lub zmianie serwera**:
  wyrejestrowanie skryptu nie usuwa obsługi zdarzeń z już otwartej strony.
- Dodatek nie zbiera ani nie przesyła danych, nie korzysta z tokenów ani cookies
  i nie przechwytuje ruchu sieciowego. Lokalnie przechowuje wyłącznie adres serwera.

Odinstalowanie usuwa lokalne dane dodatku. Instalacja tymczasowa nie gwarantuje
zachowania ustawień między sesjami.

## Polecenia

Wszystkie polecenia uruchamiaj z katalogu głównego repozytorium.

| Polecenie | Opis |
| --- | --- |
| `node --test tests/*.test.cjs` | Testy automatyczne bez instalacji zależności. |
| `node scripts/build.cjs firefox` | Budowanie plików rozszerzenia w `dist/firefox/`, bez testów i archiwum. |
| `node scripts/build.cjs chrome` | Budowanie plików rozszerzenia w `dist/chrome/`, bez testów i archiwum. |
| `mvn test` | Testy Node.js uruchamiane przez Maven. |
| `mvn clean verify` | Usunięcie poprzednich wyników, testy, budowanie i utworzenie ZIP-ów. |
| `mvn package` | Testy, budowanie i utworzenie ZIP-ów. |
| `mvn package -DskipTests` | Budowanie i ZIP-y bez testów. |
| `mvn clean` | Usunięcie wygenerowanych katalogów `target/` i `dist/`. |

Budowanie odtwarza `dist/<przeglądarka>/`. Zmiany wprowadzaj w `src/` lub konfiguracji
przeglądarki i buduj ponownie; własne zmiany w `dist/` zostaną nadpisane.

### Maven i IntelliJ IDEA

Maven jest opcjonalny. Wymaga Maven 3.6.3 lub nowszego, JDK 8 lub nowszego
oraz Node.js 18 lub nowszego dostępnego jako `node` w `PATH`.
Przy pierwszym uruchomieniu pobiera wtyczki budowania.
Projekt pozostaje rozszerzeniem JavaScript: Maven zarządza testami i pakowaniem,
bez kompilacji Javy i tworzenia JAR-a.

W IntelliJ wybierz **File → Open** i otwórz `pom.xml` jako projekt.
Jeśli katalog jest już otwarty, kliknij `pom.xml` prawym przyciskiem i wybierz
**Add as Maven Project**.

Jeśli Maven uruchomiony z IntelliJ nie znajduje Node.js, wskaż plik wykonywalny:

```sh
mvn verify -Dnode.executable=/pełna/ścieżka/do/node
```

## Pakowanie i podpisywanie

`mvn clean verify` tworzy `dist/firefox/` i `dist/chrome/` oraz archiwa
`target/gitlab-mr-checker-1.5.0-firefox.zip` i `target/gitlab-mr-checker-1.5.0-chrome.zip`.
Numer w nazwie pochodzi z `pom.xml`. Każdy ZIP zawiera `manifest.json` bezpośrednio
w katalogu głównym, bez testów i dokumentacji.

Przy budowaniu samym Node.js spakuj **zawartość** `dist/firefox/` lub `dist/chrome/`, a nie cały katalog,
aby uzyskać taki sam układ archiwum. Skrypt `build.cjs` nie tworzy ZIP-a ani XPI.

Żadna z tych metod nie podpisuje dodatku. Do stałej instalacji w standardowym
Firefoxie wymagany jest podpis Mozilli. Paczkę można zgłosić jako niepubliczną
(unlisted) przez [panel deweloperski Mozilla Add-ons](https://addons.mozilla.org/developers/).
Zmiana rozszerzenia archiwum ZIP na `.xpi` nie zastępuje podpisu.

W przeglądarkach Chromium instalacja bez trybu dewelopera wymaga publikacji w Chrome Web Store
(także jako niepubliczna); do sklepu przesyła się archiwum `-chrome.zip`, które sklep sam podpisuje.
Brave i inne przeglądarki Chromium instalują dodatek stamtąd bez osobnej publikacji.

### Automatyczne wydania

Workflow GitHub Actions w `.github/workflows/release.yml` uruchamia się po zmianie
`main`, np. po merge PR. Najpierw uruchamia testy, które sprawdzają też zgodność numerów
wersji w `pom.xml` i manifestach. O tym, czy wersja jest nowa, decyduje AMO: workflow
pyta API AMO z uwierzytelnieniem, bo tylko właściciel widzi wersje niepubliczne.

Dla wersji nieobecnej w AMO workflow buduje paczkę Firefox i podpisuje ją w AMO jako
wersję niepubliczną (kanał `unlisted`), więc dodatek nie pojawia się na publicznej liście.
Takie wersje przechodzą tylko automatyczną weryfikację, dlatego workflow czeka na podpis
(maksymalnie 60 minut) i pobiera podpisany plik. Następnie tworzy GitHub Release oraz tag
`vX.Y.Z` wskazujący dokładnie commit uruchomienia i dołącza do wydania
`gitlab-mr-checker-X.Y.Z-firefox.zip` oraz podpisany `gitlab-mr-checker-X.Y.Z-firefox.xpi`.
Wersji już obecnej w AMO workflow nie przesyła ponownie. Jeśli jej GitHub Release
nie istnieje albo nie ma ZIP-a i XPI, workflow kończy się sukcesem z ostrzeżeniem
o niedokończonym wydaniu; dokończ je według poniższych kroków.

W ustawieniach repozytorium GitHub dodaj sekrety Actions `AMO_JWT_ISSUER`
i `AMO_JWT_SECRET` z [poświadczeń API AMO](https://addons.mozilla.org/developers/addon/api/key/).
Sekrety nie powinny trafiać do plików repozytorium. Są potrzebne także do sprawdzenia
wersji w AMO, więc bez nich workflow kończy się błędem po testach.

Przed wydaniem ustaw ten sam nowy numer `X.Y.Z` w `pom.xml`,
`browsers/firefox/manifest.json` i `browsers/chrome/manifest.json` (testy wymagają
zgodności wszystkich trzech wersji), zatwierdź i zmerguj zmiany do `main`.
Nie trzeba ręcznie tworzyć ani wypychać taga. Ustaw ochronę `main`, jeśli zmiany mają
trafiać do niej wyłącznie przez PR: workflow reaguje na każdy push do `main`.

Odzyskiwanie po błędzie:

- Zawiodło tworzenie GitHub Release: wybierz w GitHub Actions **Re-run failed jobs**.
  Zadanie użyje ZIP-a i XPI zapisanych jako artefakt workflow.
- Zawiodło podpisanie po przesłaniu wersji (np. limit 60 minut, gdy AMO skieruje wersję
  do ręcznej weryfikacji): nie ponawiaj, bo AMO odrzuci ten sam numer. ZIP jest zapisany
  jako artefakt `firefox-package` tego uruchomienia jeszcze przed wysłaniem do AMO.
  Po podpisaniu pobierz XPI z panelu AMO i utwórz wydanie ręcznie, np.:

```sh
gh release create v1.6.0 gitlab-mr-checker-1.6.0-firefox.zip gitlab-mr-checker-1.6.0-firefox.xpi --target <commit>
```

Każda wersja musi mieć numer wyższy niż poprzednia wersja w AMO. Publikacja paczki
Chrome i przesyłanie do Chrome Web Store nie są częścią tego workflow.

## Architektura

```text
src/                  kod rozszerzenia, strona ustawień i ikony
browsers/firefox/     manifest Firefoksa (Manifest V2)
browsers/chrome/      manifest Chromium (Manifest V3) i service worker
scripts/              budowanie, konfiguracja ZIP-a i generowanie ikon
tests/                testy Node.js
dist/                 wygenerowane pliki rozszerzenia (pomijane w Git)
target/               wyniki Mavena, w tym ZIP (pomijane w Git)
```

- `settings.js` waliduje adres serwera i udostępnia `extensionApi` (`browser` w Firefoksie,
  `chrome` w Chromium), a `options.js` obsługuje zapis konfiguracji i uzyskanie uprawnienia do domeny.
- `background.js` odtwarza konfigurację i rejestruje skrypty tylko dla wybranego
  serwera: w Firefoksie przez `contentScripts.register`, w Chromium przez
  `scripting.registerContentScripts`. Chromium sam pamięta rejestrację, więc identyczna
  nie jest wymieniana przy każdym uruchomieniu service workera.
- `browsers/chrome/service-worker.js` ładuje `settings.js` i `background.js`,
  bo Chromium przyjmuje jeden plik tła.
- `guard.js` kontroluje zapis formularzy MR, a `merge-guard.js` ręczne akcje merge.
  Delegacja zdarzeń pozwala obsługiwać elementy dodawane przy nawigacji GitLaba
  bez pełnego przeładowania strony.
- `dialog.js` udostępnia wspólne okno potwierdzenia oparte na `<dialog>` i Shadow DOM,
  aby odizolować jego style od strony GitLaba.
- `scripts/build.cjs` kopiuje wspólny kod z `src/` i pliki z `browsers/<przeglądarka>/`
  (bez `README.md`). Przyjmuje cele `firefox` i `chrome`.

## Weryfikacja

```sh
node --test tests/*.test.cjs
```

Testy obejmują konfigurację, uprawnienia, rejestrację skryptów, zapis formularzy,
ręczny merge i wyjątek dla auto-merge oraz zawartość budowanego rozszerzenia.
Logika formularzy i merge jest testowana z atrapami DOM i zdarzeń.
Testy nie zastępują instalacji w przeglądarce i próby na docelowej wersji GitLaba.

Przed użyciem sprawdź na testowym MR:

1. Utworzenie i edycję MR bez opcji, z każdą osobno i z obiema.
   Pytanie powinno wymieniać tylko zaznaczone opcje.
2. Anulowanie: MR nie powstaje lub zmiany nie zapisują się, a formularz i checkboxy pozostają.
3. Potwierdzenie: pojedyncze pytanie i pojedynczy zapis.
4. Zapis klawiaturą oraz po nawigacji bez pełnego odświeżenia strony.
   Komentarze i inne formularze nie powinny wywoływać pytania.
5. Ręczny Merge z każdą opcją, obiema oraz żadną, także gdy zaznaczone pole jest zablokowane.
   Anulowanie powinno pozostawić MR otwarty. Sprawdź też aktywację klawiaturą.
6. Brak pytania przy włączaniu auto-merge oraz pytanie dla „Merge immediately”,
   gdy zaznaczono kontrolowaną opcję.

Potwierdzaj merge wyłącznie na MR przeznaczonym do scalenia.

## Ograniczenia

Dodatek jest pomocą przy pracy w interfejsie, a nie regułą wymuszaną przez serwer.
Nie obejmuje API/CLI, automatic merge ani zapisów omijających obsługiwane zdarzenia,
np. bezpośredniego `form.submit()`.

Rozpoznawanie formularzy opiera się na adresie akcji zakończonym `/merge_requests`
lub `/merge_requests/<numer>` i nazwach pól `merge_request[force_remove_source_branch]`,
`merge_request[remove_source_branch]` oraz `merge_request[squash]`.
Ręczny merge jest rozpoznawany po selektorach przycisków i panelu w `src/merge-guard.js`,
a auto-merge po etykiecie lub zaznaczonym polu `auto_merge` / `merge_when_pipeline_succeeds`.
Zmiany DOM, nazw pól, tłumaczeń lub mechanizmu zapisu GitLaba mogą wymagać aktualizacji
rozszerzenia. Zgodność trzeba potwierdzić na docelowej instancji GitLaba.

## Wprowadzanie zmian

- Edytuj źródła w `src/` i pliki przeglądarek w `browsers/`; nie edytuj wyników budowania.
  Różnice API przeglądarek trzymaj w `background.js` i `extensionApi`, bez kopiowania logiki MR.
- Przy zmianie zachowania zaktualizuj odpowiednie testy w `tests/` i opis w README.
- Uruchom testy i zbuduj rozszerzenie, a zmiany obsługi GitLaba sprawdź też na testowym MR.
- Przy wydaniu utrzymuj zgodność wersji w `pom.xml` i obu manifestach (sprawdza to test budowania).
- Ikona źródłowa znajduje się w `src/icons/icon.svg`. PNG w rozmiarach 16, 32, 48, 96 i 128 px
  odtwarza `python3 scripts/render-icons.py` (wymagany Pillow). Gotowe PNG są w repozytorium,
  więc zwykłe budowanie nie wymaga Pythona ani Pillow.

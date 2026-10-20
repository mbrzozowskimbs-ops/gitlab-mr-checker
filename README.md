# Gitlab MR Checker

Rozszerzenie pyta przed utworzeniem, zapisaniem edycji oraz ręcznym merge MR, jeśli zaznaczono
usuwanie brancha źródłowego lub squash. Wyświetla tylko zaznaczone opcje.
„Zapisz MR” / „Kontynuuj merge” pozwala kontynuować akcję.
„Wróć do MR”, Esc lub kliknięcie tła zamyka okno bez wykonania akcji.
Bez zaznaczonych opcji zapis odbywa się bez pytania. Dodatek nie zmienia checkboxów.

**Automatic merge nie jest sprawdzany.** Włączenie auto-merge jest pomijane bez pytania,
podobnie jak późniejsze wykonanie merge przez serwer. Ręczny „Merge immediately” nadal jest sprawdzany.

Ochrona obejmuje ręczny przycisk Merge, „Merge immediately”
i warianty „Merge now” dla merge train. Czyta aktualne checkboxy w panelu merge,
także zaznaczone i zablokowane przez ustawienia projektu. Anuluj zatrzymuje kliknięcie
przed obsługą przez GitLaba; OK pozwala na normalną obsługę.
Jeśli przycisk jest rozpoznany, ale opcje nie są odczytane, pojawi się pytanie ostrzegające
o braku odczytu. Ponowne kliknięcie Merge wywołuje ponowną kontrolę.
Nie przechwytuje wykonania auto-merge przez serwer w późniejszym terminie.


Projekt ma wspólny kod rozszerzenia i osobne konfiguracje przeglądarek.
Obecnie działa wersja Firefox; obsługa Chrome jest planowana.

## Struktura projektu

```text
src/                  wspólny kod, strona ustawień i ikony
browsers/firefox/     manifest Firefoksa
browsers/chrome/      miejsce na przyszłą obsługę Chrome
scripts/              budowanie rozszerzenia i generowanie ikon
tests/                testy automatyczne
docs/                 dokumentacja i podglądy
dist/                 wynik budowania, pomijany w Git
```

## Maven i IntelliJ IDEA

W IntelliJ wybierz **File → Open**, wskaż `pom.xml` i otwórz go jako projekt.
Jeśli katalog jest już otwarty, kliknij `pom.xml` prawym przyciskiem i wybierz
**Add as Maven Project**.

Wymagane są Maven 3.6.3 lub nowszy, JDK 8 lub nowszy do uruchamiania Mavena
oraz Node.js 18 lub nowszy dostępny jako `node` w `PATH`.
Maven przy pierwszym uruchomieniu pobierze wtyczki budowania.
Projekt pozostaje rozszerzeniem JavaScript; Maven zarządza testami i pakowaniem,
bez kompilacji Javy i bez tworzenia JAR-a.

```sh
mvn clean verify
```

Polecenie uruchamia testy Node.js, buduje `dist/firefox/` i tworzy
`target/gitlab-mr-checker-1.4.0-firefox.zip`. Archiwum zawiera `manifest.json`
w katalogu głównym i nadaje się do przekazania do podpisania przez Mozillę.
Nie jest podpisane automatycznie.

Pozostałe polecenia:

```sh
mvn test                    # Tylko testy
mvn package                 # Testy, budowanie i ZIP
mvn package -DskipTests      # Budowanie i ZIP bez testów
mvn clean                   # Usuwa wygenerowane target/ i dist/
```

Jeśli IntelliJ nie znajduje Node.js, ustaw ścieżkę jawnie:
`mvn verify -Dnode.executable=/pełna/ścieżka/do/node`.
Wersja w `pom.xml` i `browsers/firefox/manifest.json` powinna być zgodna
przy przygotowywaniu kolejnego wydania.

## Budowanie bez Mavena

Wymagany Node.js 18 lub nowszy. Instalacja zależności nie jest potrzebna.
Z katalogu głównego projektu uruchom:

```sh
node scripts/build.cjs firefox
```

Gotowe pliki znajdują się w `dist/firefox/`. Skrypt kopiuje kod z `src/`
i manifest z `browsers/firefox/`, bez testów i dokumentacji.
Ponowne budowanie odtwarza ten katalog; nie przechowuj w nim własnych zmian.
Nie edytuj plików w `dist/` — zmiany wprowadzaj w źródłach i buduj ponownie.
Aby przygotować archiwum do podpisania, spakuj zawartość `dist/firefox/`
tak, aby `manifest.json` był bezpośrednio w katalogu głównym archiwum.
Skrypt nie podpisuje dodatku i nie tworzy archiwum XPI ani ZIP.

## Instalacja do testów (Firefox)

Najpierw wykonaj budowanie opisane powyżej.

1. Otwórz w Firefoxie `about:debugging#/runtime/this-firefox`.
2. Kliknij „Wczytaj tymczasowy dodatek” (Load Temporary Add-on).
3. Wskaż `dist/firefox/manifest.json`.
4. W otwartej stronie ustawień wpisz adres serwera GitLab i kliknij „Zapisz i włącz”.
5. Zaakceptuj dostęp do wskazanej domeny i odśwież otwarte karty GitLaba.

Wersja 1.2.0 nie zawiera firmowego adresu. Przy pierwszej instalacji otwiera ustawienia.
Można je również otworzyć ikoną dodatku lub przez opcje w `about:addons`.
Podaj sam adres HTTPS, np. `https://gitlab.example.com`, bez ścieżki projektu i parametrów.
Niestandardowe porty i HTTP nie są obsługiwane. Ustawienie jest zapisywane w `storage.local`,
bez synchronizacji przez konto. Po restarcie ochrona jest odtwarzana z tego ustawienia.
Odinstalowanie dodatku usuwa jego lokalne dane; instalacja tymczasowa nie gwarantuje ich zachowania.

Manifest deklaruje `https://*/*` wyłącznie jako uprawnienie opcjonalne, aby użytkownik mógł
wybrać dowolny serwer. Dodatek prosi o dostęp tylko do konkretnej wskazanej domeny.
Bez konfiguracji lub bez zgody na dostęp ochrona pozostaje wyłączona.
Zmiana adresu usuwa poprzednie uprawnienie. Po zmianie odśwież wszystkie otwarte karty:
wyrejestrowanie skryptu nie usuwa jego obsługi zdarzeń z już otwartej strony.

Tymczasowa instalacja znika po ponownym uruchomieniu Firefoksa.
Do stałej instalacji w standardowym Firefoxie paczka wymaga podpisu Mozilli.
Można zgłosić ją jako niepubliczną (unlisted) na https://addons.mozilla.org/developers/.
Do podpisania prześlij nową paczkę `gitlab-mr-checker-1.4.0.xpi` lub `.zip`.
Wersja 1.4.0 zmienia nazwę na „Gitlab MR Checker” i pomija włączanie automatic merge.
Informacja o tym wyjątku jest widoczna bez rozwijania szczegółów, tuż pod konfiguracją,
oraz w krótkim opisie manifestu. Identyfikator dodatku pozostaje ten sam, aby zachować aktualizację i ustawienia.
Wersja 1.3.1 upraszcza ustawienia: konfiguracja na górze, pole i przycisk w jednym rzędzie,
krótka informacja o prywatności oraz szczegóły w zwijanej sekcji. Układ domyślny,
także z komunikatem zapisu, mieści się bez przewijania przy 1366×768, 1280×720 i 390×640
w przeglądarce testowej. Podgląd: `docs/options-preview.png`.
Wersja 1.3.0 zastępuje systemowy `confirm` własnym oknem: ikona dodatku, lista wybranych
opcji i przyciski opisujące akcję. Okno używa modalnego `<dialog>` i izolowanych stylów
w Shadow DOM. Początkowy fokus jest na anulowaniu; Esc zamyka okno.
Po potwierdzeniu pierwotna akcja jest ponawiana jeden raz. Zmiana opcji w trakcie pytania
wymaga ponownej kontroli. Przejście na inną stronę lub usunięcie przycisku zatrzymuje wznowienie.
Podgląd: `docs/dialog-preview.png` (formularz testowy, nie rzeczywisty GitLab).
Wersja 1.2.6 dodaje własną ikonę: białe gałęzie Git i zielony znak potwierdzenia
na ciemnym tle. Ikona jest w manifeście, przycisku paska narzędzi i ustawieniach.
Nie wykorzystuje logo GitLaba. Pliki PNG mają rozmiary 16, 32, 48, 96 i 128 px.
Źródłowy rysunek jest w `src/icons/icon.svg`; `scripts/render-icons.py` odtwarza PNG przy użyciu Pillow
(`python3 scripts/render-icons.py` z katalogu dodatku). Skrypt nie trafia do paczki instalacyjnej.
Wersja 1.2.5 dodaje autora również do krótkiego opisu w manifeście. Firefox decyduje,
czy wyświetli opis w oknie instalacji; rozszerzenie nie może dopisać tam własnej treści.
Wersja 1.2.4 dodaje opis działania i autora (Marek Brzozowski) na ekranie pierwszej
konfiguracji oraz pole `author` w manifeście. Ekran potwierdzenia instalacji jest kontrolowany
przez Firefoksa; szczegółowy opis wyświetla strona ustawień otwierana po instalacji.
Wersja 1.2.3 naprawia zapis konfiguracji ze strony ustawień otwartej w karcie:
sprawdza identyfikator dodatku i dokładny URL strony ustawień zamiast odrzucać nadawców z karty.
Wersja 1.2.1 deklaruje brak zbierania i przesyłania danych przez
`browser_specific_settings.gecko.data_collection_permissions.required: ["none"]`.
Wersja 1.2.2 wymaga Firefoksa 142 lub nowszego, aby uniknąć także ostrzeżenia
walidatora o zgodności deklaracji z Androidem. Nie deklaruje obsługi Androida.
Zawiera manifest, skrypt ochrony, skrypty konfiguracji i stronę ustawień, bez testów i dokumentacji.
Starsze paczki 1.0.0 nadal zawierają firmową domenę — nie przesyłaj ich, jeśli chcesz jej nie ujawniać.
Paczka wydania 1.4.0 nosi nazwę `gitlab-mr-checker-1.4.0.xpi` (nie jest przechowywana w źródłach) — to archiwum ZIP
z rozszerzeniem `.xpi`, również niepodpisane. Można wskazać je przy wczytywaniu
tymczasowego dodatku w `about:debugging`. Sama zmiana rozszerzenia pliku nie zastępuje
podpisu Mozilli wymaganego przy stałej instalacji w standardowym Firefoxie.

## Weryfikacja

Testy automatyczne bez instalacji zależności (Node.js 18+), z katalogu repozytorium:

```sh
node --test tests/*.test.cjs
```

Testy uruchamiają skrypt w izolowanym środowisku z atrapą formularza i zdarzeń.
Nie zastępują testu integracji z Waszą wersją GitLaba.

Sprawdzono też skrypt na rzeczywistym DOM w przeglądarce testowej: anulowanie kliknięcia,
akceptacja bez podwójnego pytania, anulowanie `requestSubmit()` oraz zapis bez zaznaczenia.
To sprawdzenie skryptu, nie instalacji rozszerzenia w Firefoxie ani rzeczywistego GitLaba.
Obsługę merge sprawdzono również na testowym DOM: anulowanie, akceptacja, zaznaczone pole
disabled, ignorowanie rebase, niezaznaczone pola i opcja Merge immediately poza panelem (portal).

Przed poleganiem na dodatku wykonaj próbę na testowym MR:

1. Bez opcji: utworzenie MR nie powinno wywołać pytania.
2. Każda opcja osobno i obie: komunikat powinien wymieniać zaznaczone opcje.
3. Anuluj: MR nie powstaje / zmiany nie zapisują się; formularz i checkboxy pozostają.
4. OK: pojedynczy komunikat i pojedynczy zapis.
5. Powtórz na edycji MR, także z opcją zaznaczoną już przy otwarciu strony.
6. Powtórz zapis klawiaturą i po przejściu do formularza bez pełnego odświeżenia strony.
7. Sprawdź, że komentarze oraz inne formularze nie wywołują pytania.
8. Na testowym MR sprawdź Merge z każdą opcją osobno, obiema oraz żadną.
9. Przy zaznaczonych opcjach wybierz Anuluj: MR powinien nadal być otwarty.
10. Sprawdź aktywację ręcznego Merge klawiaturą. Włączenie auto-merge nie powinno wyświetlać pytania.
11. OK wykonaj wyłącznie na MR, który rzeczywiście ma zostać zmergowany.

## Zakres i ograniczenia

Skrypt działa lokalnie. Nie wysyła danych, nie używa API GitLaba, tokenów ani cookies.
Magazyn `storage.local` zawiera wyłącznie skonfigurowany adres serwera.
Nie wymaga bibliotek, procesu budowania ani uprawnień do przechwytywania sieci.
Używa własnego okna potwierdzenia w języku polskim, z listą opcji i ikoną dodatku.
Wersję 1.3.0 sprawdzono na formularzu testowym w przeglądarce: anulowanie i akceptacja zapisu,
zapis przez `requestSubmit()`, anulowanie i akceptacja merge oraz zamknięcie przez Esc.
Nowy mechanizm wymaga ponownego sprawdzenia na Waszej wersji GitLaba (wznowienie kliknięcia).

Rozpoznaje formularz po adresie akcji zakończonym `/merge_requests` lub `/merge_requests/<numer>`
i checkboxy po nazwach `merge_request[force_remove_source_branch]`,
`merge_request[remove_source_branch]` oraz `merge_request[squash]`.
To założenia wymagające potwierdzenia na rzeczywistym GitLabie — dostępny był screenshot,
bez HTML formularza. Zmiana nazw pól lub mechanizmu zapisu w GitLabie może wymagać aktualizacji.

Obejmuje kliknięcia przycisków submit i zdarzenia submit (również klawiaturę).
Nie przechwytuje operacji przez API/CLI ani zapisów omijających obsługiwane zdarzenia,
np. bezpośredniego `form.submit()`.
Delegacja obsługi zdarzeń obejmuje formularze dodane dynamicznie.
To pomoc przy pracy w UI, a nie zabezpieczenie wymuszane po stronie serwera.

Selektory panelu merge oparto na publicznym kodzie GitLaba:
[merge_widget.vue](https://github.com/gitlabhq/gitlabhq/blob/master/app/assets/javascripts/vue_merge_request_widget/components/merge_widget.vue)
i [squash_before_merge.vue](https://github.com/gitlabhq/gitlabhq/blob/master/app/assets/javascripts/vue_merge_request_widget/components/states/squash_before_merge.vue).
Starsze wersje obsługuje także klasa `.accept-merge-request`. Nie przetestowano tego jeszcze
na Waszej instancji. Inne selektory przycisku lub niestandardowe sposoby merge mogą ominąć ochronę.

Auto-merge rozpoznajemy po etykiecie przycisku (np. „Set to auto-merge”, „Merge when pipeline succeeds”,
„Scal automatycznie”) lub zaznaczonym polu `auto_merge` / `merge_when_pipeline_succeeds` w panelu.
Inne tłumaczenia lub zmienione nazwy kontrolek mogą wymagać uzupełnienia rozpoznawania.
W przeglądarce testowej sprawdzono brak pytania dla auto-merge i zachowanie pytania dla Merge immediately.

Dokumentacja: [content scripts](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Content_scripts),
[podpisywanie](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/).

# Chrome — planowana obsługa

Ten katalog rezerwuje miejsce na konfigurację Chrome. Nie zawiera jeszcze
manifestu ani działającej wersji rozszerzenia dla tej przeglądarki.

Wspólny kod pozostaje w `src/`. Przy dodawaniu obsługi Chrome należy przygotować:

- manifest dla Chrome;
- obsługę tła i rejestracji skryptów zamiast obecnego `browser.contentScripts.register`;
- zgodność wywołań `browser.*`, obsługi uprawnień i otwierania ustawień;
- rozszerzenie `scripts/build.cjs` o cel `chrome`;
- testy konfiguracji, odtwarzania ochrony i działania na testowym MR w Chrome.

Nie należy kopiować całej logiki dodatku do osobnej wersji. Różnice API powinny
być odseparowane od wspólnej logiki sprawdzania MR.

# Chrome i przeglądarki Chromium

Konfiguracja dla Chrome, Brave i innych przeglądarek opartych na Chromium (wersja 108+).
Instalację opisuje główny `README.md`. Ten plik nie trafia do paczki.

- `manifest.json` — Manifest V3: `scripting` do rejestracji ochrony, `optional_host_permissions`
  zamiast opcjonalnych uprawnień do domen, `action` zamiast `browser_action`.
- `service-worker.js` — Chrome przyjmuje jeden plik tła, więc ładuje wspólne
  `settings.js` i `background.js` w tej samej kolejności co Firefox.

Wspólny kod pozostaje w `src/`. Różnice API są w `src/background.js` (rejestracja
przez `scripting.registerContentScripts` zamiast `contentScripts.register`) oraz w `extensionApi`
z `src/settings.js` (`chrome` zamiast `browser`). Logika sprawdzania MR i okno potwierdzenia
są wspólne — nie kopiuj ich do osobnej wersji.

# KFGyR Monitoring

MTConnect-alapú gépmonitoring Grafanával, Ladder99 Relay adatgyűjtéssel és TimescaleDB adattárolással.

A monitoring admin a Grafanából kezeli az agenteket és eszközöket, Coolify-hozzáférés nélkül.

## Állapot

A repository tartalmazza a Grafana app plugin forrását, a relay indítóprogramját, a telepítési Compose-t és a GitHub Actions kiadási workflow-kat. A plugin ZIP-ként, a runner GHCR image-ként adható ki.

## Működés

- Grafana app plugin: agentek és eszközök listázása, felvétele és módosítása.
- Szerveroldali jogosultságellenőrzés: a konfigurációt a megfelelő Grafana organization Admin módosíthatja.
- Tartós konfiguráció: verziózott `setup.yaml` külön kötetben, a Compose-ba ágyazott tartalom helyett.
- Hitelesített runner API: a Grafana backendje API-n kapcsolódik, megosztott konfigurációs volume nélkül.
- Hálózati keresés: a runner felismeri saját LAN-ját, és megszakítható feladatként keres MTConnect agenteket.
- Relay indítóprogram: a jóváhagyott konfiguráció alkalmazása a relay folyamatának újraindításával.
- Megtekintés: Grafana Viewer szerep, igény szerint névtelen Viewer hozzáférés.
- Plugin telepítése: a hivatalos Grafana image induláskor egy rögzített GitHub Release ZIP-ből telepít a `GF_PLUGINS_PREINSTALL_SYNC` beállítással. A Grafana és a plugin külön verziózható.

A konfiguráció alkalmazásával járó relay-újraindítás átmeneti adatgyűjtési kiesést okozhat. A teljes eseménytörténet pótlását külön kell megoldani, ha az üzemi követelmény.

## Dokumentáció

- [A Grafana app plugin felépítése és telepítése](docs/grafana-app.md)
- [Agentek és gépek kezelése a Grafana felületén](docs/agent-management-ui.md)
- [Windowsos pluginfejlesztés és a hivatalos projektváz eredete](docs/windows-development.md)
- [A repository tervezett szerkezete és a komponensek kiadása](docs/repository-layout.md)
- [Runner API és hálózati felderítés](docs/runner-api.md)
- [Telepítés és frissítés](deploy/README.md)
- [Nyilvános MTConnect példa konfiguráció](examples/setup.example.yaml)

## Helyi és üzemi adatok

A repository csak forráskódot, dokumentációt és példakonfigurációt tartalmazzon. Az üzemi jelszavak, tokenek, gépcímek, adatbázismentések és futás közben módosuló konfigurációk helyi vagy telepítési beállítások. A `.gitignore` ezek tipikus helyeit kizárja; a commitba kerülő fájlokat publikálás előtt át kell nézni.

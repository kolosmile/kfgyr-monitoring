# KFGyR Monitoring

MTConnect-alapú gépmonitoring Grafanával, Ladder99 Relay adatgyűjtéssel és TimescaleDB adattárolással.

A monitoring admin a Grafanából kezeli az agenteket és eszközöket, Coolify-hozzáférés nélkül.

## Állapot

A repository tartalmazza a Grafana app plugint (a két beágyazott panel pluginnal együtt), a kezelt dashboardokat és generáló szkriptjeiket, a relay indítóprogramját (`relay-runner`), a kétprojektes telepítési Compose-fájlokat és a GitHub Actions kiadási workflow-kat. A plugin ZIP-ként, a runner GHCR image-ként adható ki.

## Működés

- **Grafana app és panel pluginok:** a `kfgyr-monitoring-app` csomag adja az alkalmazásoldalakat (**Agentek és gépek**, **Dashboard szerkesztő**, **Jelkatalógus**, **Adatexport**, **Használati útmutató**, **Jogosultságkezelés**) és két beágyazott panel plugint: a szerepkör-tudatos **KFGyR navigáció** (`kfgyr-navigation-panel`) és a **KFGyR gépáttekintő** (`kfgyr-fleet-panel`) panelt.
- **Háromszintű jogosultságmodell:**
  - *Viewer / névtelen látogató:* elérheti a **Kezdőlap**, **Géppark** és **KFGyR · Monitoring** dashboardokat, valamint az **Adatexport** oldalt.
  - *KFGyR kezelők:* a konfigurált Grafana csapat (alapértelmezetten `KFGyR kezelők`) aktív `Viewer` tagjai. Grafana szerepük `Viewer` marad (nem szerkeszthetnek natív Grafana dashboardokat), ugyanakkor kezelhetik az agenteket, a jelkatalógust, a sémákat és a gépek monitoring dashboardjait. A Go backend a csapattagságot olvasási módban ellenőrzi a Grafana SQLite adatbázisából.
  - *Grafana Admin:* teljes jogosultság, beleértve a **Jogosultságkezelés** oldalt és a plugin kapcsolatbeállításait.
- **Tartós konfiguráció és adatbázis-sémák:** verziózott `setup.yaml` külön kötetben, a Compose-ba ágyazott tartalom helyett. A közös magyar jelkatalógust, a gép-/gépcsalád-sémákat, a megjelenítési egységeket és a gépenkénti több dashboardot a PostgreSQL `kfgyr.*` táblái tárolják.
- **Hitelesített runner API:** a Grafana Go backendje Bearer tokennel védett HTTP API-n kapcsolódik, megosztott konfigurációs kötet nélkül.
- **Hálózati keresés:** a runner felismeri saját LAN-ját (`/proc/1/net/route`), és megszakítható aszinkron feladatként keres MTConnect agenteket.
- **Relay indítóprogram:** a jóváhagyott agentkonfiguráció alkalmazása a relay gyermekfolyamatának szabályos újraindításával történik. A jelkatalógus, a sémák és a dashboardok szerkesztése nem indítja újra a relayt.
- **Plugin és dashboardok telepítése:** a Grafana Compose `monitoring-assets` init konténere (`install-monitoring-assets.py`) tölti le a GitHub Release ZIP-et, ellenőrzi annak SHA-256 összegét (alapértelmezetten a legfrissebb kiadást, `KFGYR_PLUGIN_RELEASE` változóval tagre rögzíthetően), és kicsomagolja a plugin könyvtárba. A Grafana és a plugin külön verziózható.

A konfiguráció alkalmazásával járó relay-újraindítás átmeneti adatgyűjtési kiesést okozhat. A teljes eseménytörténet pótlását külön kell megoldani, ha az üzemi követelmény.

A kiadott telepítés két önálló Compose projektből áll. A relay projekt (`compose.relay.yaml`) futtatja az adatgyűjtőt és a TimescaleDB-t. A Grafana projekt (`compose.grafana.yaml`) betölti a plugint, a csak olvasó `timescaledb` adatforrást és a kezelt dashboardokat (**Kezdőlap**, **Géppark**, **KFGyR · Monitoring**).

## Dokumentáció

- [Jelkatalógus, sémák, megjelenítési egységek és kezelt dashboardok](docs/signal-catalog-and-dashboards.md)
- [Gépadatok CSV-exportja a Grafana appból](docs/data-export.md)
- [A dashboardok, profilok és telepítés architekturális döntései](docs/monitoring-decisions.md)
- [A Grafana app plugin felépítése és telepítése](docs/grafana-app.md)
- [Agentek és gépek kezelése a Grafana felületén](docs/agent-management-ui.md)
- [Windowsos pluginfejlesztés és a hivatalos projektváz eredete](docs/windows-development.md)
- [A repository szerkezete és a komponensek kiadása](docs/repository-layout.md)
- [Runner API és hálózati felderítés](docs/runner-api.md)
- [Telepítés és frissítés](deploy/README.md)
- [Nyilvános MTConnect példa konfiguráció](examples/setup.example.yaml)

## Helyi és üzemi adatok

A repository csak forráskódot, dokumentációt és példakonfigurációt tartalmazzon. Az üzemi jelszavak, tokenek, gépcímek, adatbázismentések és futás közben módosuló konfigurációk helyi vagy telepítési beállítások. A `.gitignore` ezek tipikus helyeit kizárja; a commitba kerülő fájlokat publikálás előtt át kell nézni.

# Grafana app plugin: felépítés és megvalósítás

Az első megvalósítás a `plugins/kfgyr-monitoring-app/` és `services/relay-runner/` könyvtárakban található. A telepítés lépéseit a [telepítési leírás](../deploy/README.md) tartalmazza.

## Mi az app plugin?

A Grafana app plugin saját oldalakat és navigációs menüpontokat ad a Grafanához. A böngészőben a Grafana felületén belül futó React/TypeScript alkalmazás jelenik meg. A szerveroldali kiegészítés jellemzően Go program; azt a Grafana külön folyamatként indítja és a plugin SDK-n keresztül éri el.

A felület például a `/a/<plugin-id>/agents` útvonalon jelenhet meg. A felhasználó a Grafanába jelentkezik be. A felület a Grafana plugin resource végpontjain keresztül kér szerveroldali műveleteket.

## A generálható alap

A hivatalos `npx @grafana/create-plugin@latest` eszközben az `app` típust és a backend opciót választva generálható kiindulási projekt.

| Elem | Szerep | Saját feladat |
| --- | --- | --- |
| `src/plugin.json` | Azonosító, típus, függőségek, menüpontok, backend végrehajtható fájlja | Saját adatok és oldalak megadása |
| `src/module.ts` | A Grafana plugin belépési pontja | Az alkalmazás bekötése |
| `src/components/`, `src/pages/` | React felület és útvonalak | Agentlista, űrlapok, állapotjelzés |
| `pkg/` | Go backend, SDK és HTTP resource kezelők | Jogosultságellenőrzés, hitelesített runner API proxy |
| Build konfiguráció és Mage feladatok | TypeScript csomag és Go bináris előállítása | Célplatform, verziózás és kiadás beállítása |
| Fejlesztői Compose és példakód | Helyi Grafana és demonstrációs oldalak | Projektigényekhez igazítás |

A generátor működő keretet készít. Az MTConnect-kezelést és a relay-konfiguráció biztonságos alkalmazását nekünk kell megírni.

## Saját működés

1. A Go backend minden kérésnél ellenőrzi a Grafanától kapott szervezetet (`KFGYR_ADMIN_ORG_ID`) és a jogosultságot. A konfigurációs végpontokat az `Admin` szerep mellett a konfigurált kezelői csapat (`KFGYR_OPERATOR_TEAM_NAME`, alapértelmezetten `KFGyR kezelők`) aktív `Viewer` tagjai is hívhatják; a csapattagságot a backend olvasási módban ellenőrzi a Grafana SQLite adatbázisából (`access.go`). A gépek élő elérhetőségét (`availability/{machine}`) a szervezet `Viewer` (és névtelen) szerepköre is lekérdezheti, az **Adatexport** oldal pedig a Grafana olvasási adatforrásán fut. A **Jogosultságkezelés** kizárólag `Admin` joggal érhető el.
2. A frontend a Grafana resource API-t hívja, a Go backend pedig a runner hitelesített HTTP API-ját.
3. A runner validálja és verziózza az agentkonfigurációt, lekérdezi az MTConnect eszközleírásokat, felügyeli a relay folyamatát, és kezeli a PostgreSQL `kfgyr.*` konfigurációs tábláit (jelkatalógus, sémák, megjelenítési egységek, gépenkénti dashboardok).
4. A runner saját LAN-ján aszinkron, megszakítható keresés indítható, a találatokból agent szerkeszthető.
5. A felület megkülönbözteti a kért, alkalmazott és hibás konfigurációt. A mentés optimista verzióellenőrzést (`409`) és felhasználói auditot használ.

Csak a runner csatolja a tartós konfigurációs kötetet. A Grafana külön gépen is lehet; a kapcsolat címe és titkos tokenje a plugin beállítása. A token `secureJsonData` mezőben marad, nem kerül a frontendbe. A részletes API és hálózati korlátok a [runner leírásában](runner-api.md) találhatók.

A relay változatlan upstream alkalmazás. Az agentkonfiguráció alkalmazása folyamatrestarttal történik, ami átmeneti adatgyűjtési kiesést okozhat. Agentenkénti futás közbeni újrakonfigurálás további upstream fejlesztést igényel. A jelkatalógus, a sémák, a megjelenítési egységek és a dashboardok mentése nem indítja újra a relayt.

## Mi épül be Grafanába?

A build kimenete a lefordított frontend, a `plugin.json`, a két beágyazott panel plugin (`navigation/` → `kfgyr-navigation-panel` és `fleet/` → `kfgyr-fleet-panel`), az egyéb statikus fájlok és a célarchitektúrára fordított Go bináris. Grafana induláskor megkeresi a plugin könyvtárát, ellenőrzi a csomagot, regisztrálja az alkalmazást és a beágyazott paneleket, majd elindítja a Go backendet. Az appot ezután engedélyezni vagy provisionálni kell az érintett szervezetben; a `GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS` listának mindhárom pluginazonosítót tartalmaznia kell.

Az alkalmazásoldalak a Grafana navigációjában, illetve a kezdőlapról érhetők el. A dashboardok, a felhasználók és a megjelenítés alapját továbbra is Grafana adja.

## Telepítési módok

| Módszer | Használat |
| --- | --- |
| Grafana plugin katalógus, webes Install | A katalógusban publikált plugin telepíthető, megfelelő szerveradmin joggal és engedélyezett plugin adminisztrációval |
| Release ZIP kicsomagolása a plugin könyvtárba | Saját, katalóguson kívüli csomag telepítése; általában Grafana-újraindítással |
| Init konténeres telepítés (`monitoring-assets`) | Automatikus, SHA-256 ellenőrzött ZIP-telepítés és dashboard-letöltés Docker Compose környezetben a Grafana indulása előtt |
| Saját Grafana Docker image | A lefordított plugin a kész image része; verziózott, megismételhető telepítés |
| Build kimenetének könyvtárcsatolása | Elsősorban helyi fejlesztéshez |

A webes plugin felület nem általános forráskód- vagy saját ZIP-feltöltő. Egy nyilvános GitHub repository önmagában nem jelenik meg a Grafana katalógusában. A katalógusbeli megjelenés külön publikálás és ellenőrzés.

A fejlesztési változat betölthető a konkrét pluginazonosítókra engedélyezett unsigned betöltéssel. Üzemi telepítéshez aláírt csomagot érdemes tervezni; a szervezeten belüli aláírás és a katalógusba publikált csomag eltérő kiadási út. A pontos aláírási lehetőségeket a kiadáskor ellenőrizni kell.

Az elfogadott telepítési mód a hivatalos Grafana image megtartása. A plugin önálló, verziózott GitHub Release ZIP-ként készül, amelyet a `monitoring-assets` init konténer (`deploy/install-monitoring-assets.py`) tölt le és ellenőriz SHA-256 alapján a Grafana indulása előtt (alapértelmezetten a legfrissebb kiadást, `KFGYR_PLUGIN_RELEASE` változóval konkrét `plugin-vX.Y.Z` tagre rögzíthetően). Saját Grafana image ehhez nem szükséges. A runner API-kapcsolata és az app szervezeti engedélyezése/provisioningje külön beállítás.

A Grafana image-verziója és a plugin ZIP-verziója külön módosítható; kompatibilitásukat a frissítés előtt ellenőrizni kell. Pluginfrissítéskor a Grafana stack újralétrehozásával (vagy a `KFGYR_PLUGIN_RELEASE` átállításával) az init konténer letölti az új csomagot. A monitoring kezelő a Grafanában kezeli az agenteket, jelkatalógust és dashboardokat; ezekhez a műveletekhez nem kell pluginbuild vagy Compose-módosítás.

A plugin a nagyobb repository `plugins/kfgyr-monitoring-app/` alkönyvtárába kerül, saját függőségekkel, builddel és verzióval. A [repository felépítése](repository-layout.md) a többi monitoring komponens helyét is meghatározza.

## Hivatalos források

- [App plugin készítése](https://grafana.com/developers/plugin-tools/tutorials/build-an-app-plugin)
- [Go backend hozzáadása](https://grafana.com/developers/plugin-tools/how-to-guides/app-plugins/add-backend-component)
- [Hitelesítés és felhasználói kontextus](https://grafana.com/developers/plugin-tools/how-to-guides/app-plugins/add-authentication-for-app-plugins)
- [Plugin telepítés](https://grafana.com/docs/grafana/latest/administration/plugin-management/plugin-install/)
- [Grafana Docker környezet](https://grafana.com/docs/grafana/latest/setup-grafana/configure-docker/)
- [Plugin aláírás](https://grafana.com/developers/plugin-tools/publish-a-plugin/sign-a-plugin)
- [Relay indulási kód](https://github.com/Ladder99/ladder99/blob/main/services/relay/src/index.js)

## Felületek

A plugin hat alkalmazásoldalt ad:

- **Agentek és gépek** (`/a/kfgyr-monitoring-app/agents`): MTConnect agentek, eszközaliasok, gépsémák és hálózati felderítés kezelése ([részletek](agent-management-ui.md)).
- **Dashboard szerkesztő** (`/a/kfgyr-monitoring-app/profiles`): gépenkénti több monitoring dashboard, panelkategóriák, állapotidősorok és másolás kezelése.
- **Jelkatalógus** (`/a/kfgyr-monitoring-app/schemas`): közös magyar jelkatalógus, séma-hozzárendelések és megjelenítési mértékegységek karbantartása.
- **Adatexport** (`/a/kfgyr-monitoring-app/export`): közvetlen CSV-letöltés a `timescaledb` adatforrásról ([részletek](data-export.md)).
- **Használati útmutató** (`/a/kfgyr-monitoring-app/guide`): beépített dokumentációs oldal a kezelőknek.
- **Jogosultságkezelés** (`/a/kfgyr-monitoring-app/access-management`): a `KFGyR kezelők` csapat tagjainak kezelése, kizárólag Grafana **Admin** szerepkörrel.

A három gyári dashboard (**Kezdőlap**, **Géppark**, **KFGyR · Monitoring**) a repó `dashboards/managed/` mappájából kerül provisionálásra, a beágyazott `kfgyr-navigation-panel` és `kfgyr-fleet-panel` panelekkel. A jelkatalógus, a sémák, a megjelenítési egységek és a kezelt dashboardok felépítését a [jelkatalógus és dashboardok dokumentuma](signal-catalog-and-dashboards.md), az architekturális indokokat a [döntési dokumentum](monitoring-decisions.md) írja le.

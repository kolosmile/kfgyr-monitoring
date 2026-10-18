# Grafana app plugin: felépítés és tervezett megvalósítás

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
| `pkg/` | Go backend, SDK és HTTP resource kezelők | Jogosultság, MTConnect probe, konfigurációkezelés |
| Build konfiguráció és Mage feladatok | TypeScript csomag és Go bináris előállítása | Célplatform, verziózás és kiadás beállítása |
| Fejlesztői Compose és példakód | Helyi Grafana és demonstrációs oldalak | Projektigényekhez igazítás |

A generátor működő keretet készít. Az MTConnect-kezelést és a relay-konfiguráció biztonságos alkalmazását nekünk kell megírni.

## A tervezett saját működés

1. A backend ellenőrzi a felhasználó hiteles, Grafanától kapott szervezeti azonosítóját és Admin szerepét minden adminisztrációs kérésnél. A menüpont elrejtése önmagában nem jogosultságvédelem.
2. Az admin megad egy agent URL-t. A backend ellenőrzött hálózati célokra, időkorláttal lekéri és feldolgozza az MTConnect `/probe` választ.
3. A felület felsorolja az eszközöket, és kezeli a kiválasztást, az aliasokat és a megőrzési időt.
4. A backend sémával ellenőrzi a konfigurációt, majd verziózva, atomi fájlcserével menti. A meglévő azonosítók/aliasok módosítása külön kezelendő, mert adatbázisbeli azonosításra is hathat.
5. Egy relay indítóprogram érzékeli az alkalmazandó verziót, és újraindítja a relay gyermekfolyamatát. A módosító felületnek nincs szüksége Docker socketre vagy Coolify admin tokenre.
6. A rendszer külön jelzi a mentett, alkalmazott és hibás konfigurációkat; rögzíti a módosító felhasználót. Sikertelen alkalmazásnál visszaállítható az előző verzió.

A tartós konfiguráció teljes könyvtárát kell csatolni, hogy a fájlok atomi cseréje is látható maradjon. A Go backend írási, a relay indítóprogramja olvasási hozzáférést kap a konfigurációhoz. A visszajelzés és állapotcsere pontos módja implementációs döntés.

A vizsgált nyilvános relay-forrás induláskor olvassa a konfigurációt. A ténylegesen használt image viselkedését a megvalósítás részeként ellenőrizni kell. Az első változat folyamatrestarttal számol: ez az összes agent gyűjtését megszakíthatja, és a kieső minták teljes pótlása nem garantált. Agentenkénti, futás közbeni újrakonfigurálás a relay további fejlesztését igényli.

Külön Python/FastAPI konfigurációkezelő is használható. Ebben az esetben a Grafana plugin backendje belső API-n delegál; a szolgáltatások közötti hitelesítést, a hozzáférési korlátokat és az állapotkezelést is meg kell írni. A közvetlen Go backend kevesebb külön telepítendő komponenst igényel.

## Mi épül be Grafanába?

A build kimenete a lefordított frontend, a `plugin.json`, az egyéb statikus fájlok és a megfelelő rendszerre/architektúrára fordított Go bináris. Grafana induláskor megkeresi a plugin könyvtárát, ellenőrzi a csomagot, regisztrálja az alkalmazást és elindítja a backendjét. Az appot ezután engedélyezni/provisionálni kell az érintett szervezetben.

Az agenteket kezelő adminoldal a Grafana navigációjában jelenik meg. A dashboardok, a felhasználók és a megjelenítés alapját továbbra is Grafana adja.

## Telepítési módok

| Módszer | Használat |
| --- | --- |
| Grafana plugin katalógus, webes Install | A katalógusban publikált plugin telepíthető, megfelelő szerveradmin joggal és engedélyezett plugin adminisztrációval |
| Release ZIP kicsomagolása a plugin könyvtárba | Saját, katalóguson kívüli csomag telepítése; általában Grafana-újraindítással |
| `GF_PLUGINS_PREINSTALL` / támogatott szinkron megfelelője, rögzített ZIP URL-lel | Automatikus telepítés a Docker alapú környezetben, a használt Grafana verzió támogatásának ellenőrzésével |
| Saját Grafana Docker image | A lefordított plugin a kész image része; verziózott, megismételhető telepítés |
| Build kimenetének könyvtárcsatolása | Elsősorban helyi fejlesztéshez |

A webes plugin felület nem általános forráskód- vagy saját ZIP-feltöltő. Egy nyilvános GitHub repository önmagában nem jelenik meg a Grafana katalógusában. A katalógusbeli megjelenés külön publikálás és ellenőrzés.

A fejlesztési változat betölthető a konkrét pluginazonosítóra engedélyezett unsigned betöltéssel. Üzemi telepítéshez aláírt csomagot kell tervezni; a szervezeten belüli aláírás és a katalógusba publikált csomag eltérő kiadási út. A pontos aláírási lehetőségeket a kiadáskor ellenőrizni kell.

Az elfogadott telepítési mód a hivatalos Grafana image megtartása. A plugin önálló, verziózott GitHub Release ZIP-ként készül, és a `GF_PLUGINS_PREINSTALL_SYNC` beállítás a csomag rögzített URL-jére mutat. A Grafana induláskor megvárja a plugin telepítését. Saját Grafana image és külön plugintelepítő konténer ehhez nem szükséges. A konfigurációs kötet és az app szervezeti engedélyezése/provisioningje külön beállítás.

A Grafana image-verziója és a plugin ZIP-verziója külön módosítható; kompatibilitásukat a frissítés előtt ellenőrizni kell. Pluginfrissítéskor a csomagverziót/URL-t módosítjuk, majd újratelepítjük a Grafana konténert. A monitoring admin a Grafanában kezeli az agenteket, ezekhez a műveletekhez nem kell pluginbuild vagy Compose-módosítás.

A plugin a nagyobb repository `plugins/kfgyr-monitoring-app/` alkönyvtárába kerül, saját függőségekkel, builddel és verzióval. A [repository felépítése](repository-layout.md) a többi monitoring komponens helyét is meghatározza.

## Hivatalos források

- [App plugin készítése](https://grafana.com/developers/plugin-tools/tutorials/build-an-app-plugin)
- [Go backend hozzáadása](https://grafana.com/developers/plugin-tools/how-to-guides/app-plugins/add-backend-component)
- [Hitelesítés és felhasználói kontextus](https://grafana.com/developers/plugin-tools/how-to-guides/app-plugins/add-authentication-for-app-plugins)
- [Plugin telepítés](https://grafana.com/docs/grafana/latest/administration/plugin-management/plugin-install/)
- [Grafana Docker környezet](https://grafana.com/docs/grafana/latest/setup-grafana/configure-docker/)
- [Plugin aláírás](https://grafana.com/developers/plugin-tools/publish-a-plugin/sign-a-plugin)
- [Relay indulási kód](https://github.com/Ladder99/ladder99/blob/main/services/relay/src/index.js)

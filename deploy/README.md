# Telepítés és frissítés

A Grafana a hivatalos image marad. A `GF_PLUGINS_PREINSTALL_SYNC` a kiadott plugin ZIP-et telepíti. A saját plugin jelenleg unsigned; kizárólag a `kfgyr-monitoring-app` azonosító betöltése engedélyezett. A plugin organization Admin ellenőrzést végez, és a provisioning a beállított szervezetben engedélyezi/pineli az appot.

## Kiadás

- A `plugin-v0.1.0` típusú Git-tag elindítja a plugin buildjét, típusellenőrzését, Go tesztjeit, a linux/amd64 és linux/arm64 backend fordítását és a ZIP Release kiadását.
- A `relay-runner-v0.1.0` típusú tag elindítja a runner tesztjeit és a `ghcr.io/kolosmile/kfgyr-relay-runner:0.1.0` image buildjét/publikálását. Az image linux/amd64 célplatformra készül az upstream alap image alapján.
- A GHCR package-nek publikusnak kell lennie, vagy a telepítéshez registry-hitelesítést kell biztosítani. A publikus Git-repo nem jelenti automatikusan a package publikus láthatóságát.

## Első telepítés

1. Töltsd ki a `.env.example` alapján a Coolify környezeti változóit. A jelszavak Coolifyban maradjanak.
2. Készítsd el a `KFGYR_CONFIG_VOLUME` nevű külső Docker volume-ot. A konfiguráció könyvtárának tulajdonosa/csoportja és módja biztosítsa a runner 1000-es UID-jának írását; a hivatalos image 0-s csoportját használva a kötet könyvtára lehet `root:0`, `0770`, a fájlok `0660`.
3. A meglévő relay `setup.yaml` fájlját mentsd ki, és a `seed-config.py` segítségével készítsd el a kötetben az első verziót. A script már létező konfigurációt nem ír felül.
4. A Coolify Compose Service-ben alkalmazd a `compose.yaml` tartalmát. Meglévő telepítésnél őrizd meg a Grafana és TimescaleDB volume kulcsait, hogy a Coolify ugyanazokat a köteteket használja.
5. Ellenőrizd a runner healthcheckjét, a plugin telepítését és az adatgyűjtést. Az adminoldal útvonala `/a/kfgyr-monitoring-app/agents`.

Csak a runner csatolja a `KFGYR_CONFIG_VOLUME` külső kötetet. A konfiguráció útvonala `/var/lib/kfgyr-monitoring`; fájlműveleteket és verziózást kizárólag a runner végez. A Grafana a `KFGYR_RUNNER_URL` belső API-címen éri el. A `KFGYR_RUNNER_API_TOKEN` legalább 32 karakteres, véletlen titok legyen; a Compose a runner környezetébe és a Grafana plugin `secureJsonData` provisioningjébe adja. Ne tedd Gitbe. A Compose által provisionált plugin-kapcsolat a Grafana felületén olvasható és tesztelhető.

A host `/proc/1/net/route` fájlja csak olvashatóan kerül a runnerbe, így a valódi LAN automatikusan felismerhető. A `KFGYR_DISCOVERY_NETWORKS` további keresési tartományokat engedélyez. A `KFGYR_AGENT_ALLOWED_HOSTS` és `KFGYR_AGENT_ALLOWED_NETWORKS` a kézi MTConnect célokat korlátozza. Részletek: [Runner API](../docs/runner-api.md).

## Viewer és adatbázis-hozzáférés

A Compose névtelen Viewer hozzáférést engedélyez a `KFGYR_VIEWER_ORG_NAME` szervezetben. A Grafana szervezeti beállításaiban válassz alapértelmezett dashboardot. A látogató az adott szervezet minden, számára olvasható dashboardját és adatforrását elérheti; mappajogosultságokkal szűkíthető a hozzáférés. Az agentkezelő plugin API-ja továbbra is csak Adminnak enged műveletet.

A Grafana PostgreSQL adatforrása külön `grafana_reader` felhasználót használjon. A [grafana-reader.psql](grafana-reader.psql) script csak CONNECT, schema USAGE és SELECT jogot ad a `raw` séma tábláira, a jövőbeli táblák alapértelmezett jogosultságaival együtt. Futtatás előtt adj meg külön véletlen jelszót psql változóként; utána a meglévő Grafana adatforrás felhasználóját/jelszavát módosítsd a UID megőrzésével. A relay meglevő írói hozzáférése marad. Az adatforrás jelszava a Grafana adatbázisában titkosítva tárolódik, nem ez a Compose provisionálja.

## Migráció 0.2.0-ról

Mentsd a Coolify Compose-t, környezeti változókat, Grafana adatbázist és konfigurációs kötetet. Adj meg új runner API-tokent, alkalmazd az új Compose-t, indítsd újra a relayt a 0.3.0 image-dzsel, majd a Grafanát a 0.3.0 ZIP-pel. A meglévő konfigurációs manifest és verziók változtatás nélkül használhatók. A Grafana konfigurációs kötetcsatolása eltűnik; a kötet a runner számára megmarad. Az adatbáziskötetek kulcsait őrizd meg.

## Frissítés és visszaállítás

Pluginfrissítés: új pluginverzió és tag, sikeres ZIP Release, majd a `KFGYR_PLUGIN_INSTALL` módosítása és a Grafana újratelepítése. Runnerfrissítés: új image-verzió, `KFGYR_RELAY_RUNNER_IMAGE` módosítása és újratelepítés. A kiadási URL-ek és image-ek rögzített verzióra mutassanak.

A plugin aktuális kiadása `0.3.0`. A telepítési érték formátuma `pluginazonosító@verzió@ZIP-URL`; a verziót és a ZIP címét együtt frissítsd. A Coolifyban mentett Compose és környezeti változó módosítása után a `POST /api/v1/services/{uuid}/applications/{app_uuid}/start?force=true` végponttal a Grafana külön újratelepíthető. Ez a megoldás a frissített környezetet alkalmazza a Grafanára, a Compose többi szolgáltatásának újraindítása nélkül.

A runtime konfigurációk `revisions/` alatt maradnak; a `desired.json` jelöli a kért verziót. A runner korai kilépéskor visszaállhat a korábbi verzióra, amit a felület külön jelez. Az admin a felületről visszaállíthatja a mentett konfigurációt a futó verzióra. A mentés és a futó állapot nem egyenlő a sikeres adatbeérkezéssel.

Deploy előtt a Coolify Compose és a runtime kötet mentése szükséges. Az adatbázisköteteket rollbackkor sem kell törölni. A komponensfrissítés nem módosítja automatikusan az agentlistát vagy a dashboardokat.

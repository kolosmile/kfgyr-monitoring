# Telepítés és frissítés

A Grafana a hivatalos image marad. A `GF_PLUGINS_PREINSTALL_SYNC` a kiadott plugin ZIP-et telepíti. A saját plugin jelenleg unsigned; kizárólag a `kfgyr-monitoring-app` azonosító betöltése engedélyezett. A plugin organization Admin ellenőrzést végez, és a provisioning a beállított szervezetben engedélyezi/pineli az appot.

## Kiadás

- A `plugin-v0.1.0` típusú Git-tag elindítja a plugin buildjét, típusellenőrzését, Go tesztjeit, a linux/amd64 és linux/arm64 backend fordítását és a ZIP Release kiadását.
- A `relay-runner-v0.1.0` típusú tag elindítja a runner tesztjeit és a `ghcr.io/kolosmile/kfgyr-relay-runner:0.1.0` image buildjét/publikálását. Az image linux/amd64 célplatformra készül az upstream alap image alapján.
- A GHCR package-nek publikusnak kell lennie, vagy a telepítéshez registry-hitelesítést kell biztosítani. A publikus Git-repo nem jelenti automatikusan a package publikus láthatóságát.

## Első telepítés

1. Töltsd ki a `.env.example` alapján a Coolify környezeti változóit. A jelszavak Coolifyban maradjanak.
2. Adj meg külön véletlen `POSTGRES_PASSWORD`, `GRAFANA_DB_PASSWORD`, `GF_SECURITY_ADMIN_PASSWORD` jelszavakat és legalább 32 karakteres `KFGYR_RUNNER_API_TOKEN` titkot.
3. Alkalmazd a `compose.yaml` fájlt a Coolify Compose Service-ben. A három named volume-ot a Compose/Coolify létrehozza és kezeli. Meglévő telepítéskor a Grafana és TimescaleDB volume kulcsait őrizd meg.
4. Üres adatbáziskötet esetén a PostgreSQL inicializálás létrehozza a `grafana_reader` szerepet és az olvasási jogokat. A Grafana provisioning létrehozza/frissíti a `timescaledb` UID-jú adatforrást ugyanazzal a `GRAFANA_DB_PASSWORD` jelszóval.
5. Jelentkezz be Grafanába, nyisd meg az `/a/kfgyr-monitoring-app/agents` oldalt és konfiguráld az agenteket. Üres relay-config volume esetén nincs adatgyűjtés, amíg az első konfigurációt el nem mented. A jelenlegi runner ilyenkor nem teljesíti az adatgyűjtő healthcheckjét; az API és a beállító felület elérhető.

Csak a runner csatolja a Compose által kezelt `relay-config` kötetet. A konfiguráció útvonala `/var/lib/kfgyr-monitoring`; fájlműveleteket és verziózást kizárólag a runner végez. Meglevő konfiguráció importálásához opcionálisan a `seed-config.py` használható.

A Grafana a `KFGYR_RUNNER_URL` belső API-címen éri el a runnert. A Compose a `KFGYR_RUNNER_API_TOKEN` értékét a runner környezetébe és a Grafana plugin `secureJsonData` provisioningjébe adja. A token nem kerül a frontendbe. A kapcsolatot a telepítés kezeli; a plugin felületén ellenőrizhető.

A host `/proc/1/net/route` fájlja csak olvashatóan kerül a runnerbe, így a valódi LAN automatikusan felismerhető. A `KFGYR_DISCOVERY_NETWORKS` további keresési tartományokat engedélyez. A `KFGYR_AGENT_ALLOWED_HOSTS` és `KFGYR_AGENT_ALLOWED_NETWORKS` a kézi MTConnect célokat korlátozza. Részletek: [Runner API](../docs/runner-api.md).

## Viewer és adatbázis-hozzáférés

A Compose névtelen Viewer hozzáférést engedélyez a `KFGYR_VIEWER_ORG_NAME` szervezetben. A Grafana szervezeti beállításaiban válassz alapértelmezett dashboardot. A látogató az adott szervezet minden, számára olvasható dashboardját és adatforrását elérheti; mappajogosultságokkal szűkíthető a hozzáférés. Az agentkezelő plugin API-ja továbbra is csak Adminnak enged műveletet.

A PostgreSQL első inicializálásakor a Compose `grafana_db_init` konfigurációja fut le. A [grafana-reader.psql](grafana-reader.psql) ennek szerkeszthető forrása; a Compose-ba ágyazott SQL-lel együtt kell módosítani. A szerep CONNECT, a `raw` sémára USAGE és a táblákra SELECT jogot kap, a jövőbeli táblák alapértelmezett jogosultságaival együtt. A kezdeti relay-migráció a `public` sémában készíti, majd a `raw` sémába mozgatja a táblákat, ezért mindkét létrehozási sémára megadjuk az alapértelmezett SELECT jogot. A `raw` sémát előre létrehozzuk; a relay a saját tábláit és migrációit továbbra is maga kezeli.

**Az init script csak üres adatbáziskötetnél fut.** Meglevő adatbázis esetén a script egyszeri kézi futtatása szükséges, ha a felhasználó még nem létezik. Későbbi jelszóváltoztatáskor az adatbázisban is át kell állítani a szerep jelszavát; egy környezeti változó átírása nem változtatja meg a meglévő PostgreSQL-szerepet. A Grafana adatforrása provisioning által kezelt; azonos UID-val megőrzi a dashboardhivatkozásokat.

## Migráció 0.2.0-ról

Mentsd a Coolify Compose-t, környezeti változókat, Grafana adatbázist és konfigurációs kötetet. Adj meg új runner API-tokent, alkalmazd az új Compose-t, indítsd újra a relayt a 0.3.0 image-dzsel, majd a Grafanát a 0.3.0 ZIP-pel. A meglévő konfigurációs manifest és verziók változtatás nélkül használhatók. A Grafana konfigurációs kötetcsatolása eltűnik; a kötet a runner számára megmarad. Az adatbáziskötetek kulcsait őrizd meg.

## Frissítés és visszaállítás

Pluginfrissítés: új pluginverzió és tag, sikeres ZIP Release, majd a `KFGYR_PLUGIN_INSTALL` módosítása és a Grafana újratelepítése. Runnerfrissítés: új image-verzió, `KFGYR_RELAY_RUNNER_IMAGE` módosítása és újratelepítés. A kiadási URL-ek és image-ek rögzített verzióra mutassanak.

A plugin aktuális kiadása `0.3.0`. A telepítési érték formátuma `pluginazonosító@verzió@ZIP-URL`; a verziót és a ZIP címét együtt frissítsd. A Coolifyban mentett Compose és környezeti változó módosítása után a `POST /api/v1/services/{uuid}/applications/{app_uuid}/start?force=true` végponttal a Grafana külön újratelepíthető. Ez a megoldás a frissített környezetet alkalmazza a Grafanára, a Compose többi szolgáltatásának újraindítása nélkül.

A runtime konfigurációk `revisions/` alatt maradnak; a `desired.json` jelöli a kért verziót. A runner korai kilépéskor visszaállhat a korábbi verzióra, amit a felület külön jelez. Az admin a felületről visszaállíthatja a mentett konfigurációt a futó verzióra. A mentés és a futó állapot nem egyenlő a sikeres adatbeérkezéssel.

Deploy előtt a Coolify Compose és a runtime kötet mentése szükséges. Az adatbázisköteteket rollbackkor sem kell törölni. A komponensfrissítés nem módosítja automatikusan az agentlistát vagy a dashboardokat.

## Átállás external konfigurációs volume-ról

A `relay-config: {}` deklaráció új, a stackhez tartozó volume-ot használ. Megőrzéshez másold át a régi külső kötet tartalmát; újrakonfigurálás teszteléséhez hagyd üresen. A régi external volume nem törlődik automatikusan. A friss adatgyűjtéshez őrizd meg az agent aliasát és az MTConnect device/dataitem ID-kat, mert az upstream adatbázis-azonosító `agentAlias/MTConnectID`. A dashboardútvonalakhoz az eszközaliasok is egyezzenek. A kieső időszak teljes mintasorának pótlása nem garantált.

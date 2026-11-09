# Telepítés GitHubról

A relay és a Grafana két önálló Docker Compose projekt. Az alábbi parancsokat a `deploy` mappában futtasd az adott kiadáshoz tartozó repóból. A projekt a kiadott runner image-et és plugin ZIP-et használja. A dashboardfájlokat a checkoutból csatolja.

1. Másold a `.env.example` fájlt `.env` néven, és állíts be egyedi adatbázis-, olvasó- és Grafana-jelszót, valamint legalább 32 karakteres runner API-tokent. Indítsd el az adatgyűjtési stacket: `docker compose -f compose.relay.yaml up -d`.
2. Indítsd el a Grafanát: `docker compose -f compose.grafana.yaml up -d`. A két projekt közös belső Docker-hálózatot használ. A Grafana alapból `http://relay:8091` címen éri el a runnert és `db:5432` címen a TimescaleDB-t.

A Grafana elérhető a megadott porton. A Kezdőlap közvetlen belépést ad a gépmonitoringhoz és az adatexporthoz, az új gép bekötését pedig két adminlépésben mutatja. Az **Agentek és gépek** oldalon kapcsold be az adatgyűjtést, majd az eszköz első beolvasása után a **Gépprofilok** oldalon rendeld hozzá a profilt és a jeleket. A profilmentés nem jár relay újraindítással. A **Gépmonitoring** és az **Adatexport** a tárolt adatokat olvassa. Üres konfigurációs kötetnél a runner API elérhető, az adatgyűjtés az első konfiguráció alkalmazása után indul.

Külön gépeken a Grafana hoston hozd létre a Grafana Compose által külsőként hivatkozott helyi Docker-hálózatot. Állítsd a `KFGYR_RUNNER_URL` és a `KFGYR_DB_ADDRESS` értékét a Grafanából elérhető privát címekre, és biztosítsd a hálózati elérést. A mellékelt relay Compose belső hálózaton tartja a DB-t és az API-t. Külön hosthoz a telepítés saját privát hálózati csatlakozása vagy címhez kötött porttovábbítása szükséges. Több Grafana használhatja ugyanazt az adatgyűjtési stacket külön Grafana-kötetekkel és porttal.

## Provisioning és kiadás

- A Grafana a hivatalos image. A `GF_PLUGINS_PREINSTALL_SYNC` telepíti a rögzített verziójú plugin ZIP-et. A jelenlegi kiadás az adott pluginazonosítóhoz engedélyezi az aláírás nélküli betöltést. Pluginverzió változtatásakor a Grafana konténerét újra kell létrehozni.
- Az app, a `timescaledb` UID-jú olvasási adatforrás és a kezelt **KFGyR** mappa a Grafana Compose-ból jön. A dashboardok forrása a `dashboards/managed` mappa. Újragenerálás a repó gyökeréből: `python dashboards/build-managed-dashboards.py`. A gyári dashboardok mentése a UI-ban tiltott. Saját nézethez használj külön dashboardot.
- A Kezdőlap a Grafana szerver alapértelmezett Home dashboardja. Meglévő szervezeti, csapat- vagy személyes Home választás elsőbbséget élvezhet.
- A runner létrehozza a `kfgyr.machine_monitoring` konfigurációs táblát induláskor. A Grafana olvasási jogosultságát a runner migrációja adja meg a meglévő `grafana_reader` szerepnek. Az alap olvasó szerepet a PostgreSQL első inicializálásakor a `grafana-reader.psql` hozza létre.
- A plugin és a runner kiadását a `plugin-vX.Y.Z` és `relay-runner-vX.Y.Z` Git tagek indítják. A telepítési példákban és a Compose-ban rögzített verziót csak a megfelelő artefaktumok elkészülte után használd.

## Átállás a korábbi egyprojektes telepítésről

1. Mentsd a TimescaleDB, a runner konfiguráció és a Grafana tartós adatait. Jegyezd fel a három meglévő kötet tényleges Docker-nevét és a korábbi Compose-beállításokat.
2. Állítsd be a `KFGYR_DB_VOLUME`, `KFGYR_RELAY_VOLUME` és `KFGYR_GRAFANA_VOLUME` változókat a meglévő kötetek nevére. A három kötetet ellenőrizd `docker volume inspect` paranccsal még indítás előtt. Meglévő DB-köteten az init script nem fut újra. Ha az olvasó szerep hiányzik, futtasd a `grafana-reader.psql` fájlt `ladder99` jogosultsággal és az aktuális olvasói jelszóval.
3. Állítsd le a régi konténereket a kötetek törlése nélkül. Az új adatgyűjtési projekt indítása előtt ellenőrizd, hogy nincs másik PostgreSQL vagy runner folyamat ugyanazon köteteken. Ezután indítsd el sorrendben az új relay és Grafana projektet. A korábbi `compose.yaml` az átállás előtti telepítést dokumentálja.
4. Ellenőrizd a runner aktív revízióját, a mérések folytonosságát, az adatforrást, a Kezdőlapot és a plugin menüpontokat. Visszaállításhoz állítsd le a két új projektet, és az elmentett régi konfigurációval indítsd el a korábbi szolgáltatást ugyanazokon a köteteken.

A külön projektek leállításához használd a `stop` parancsot. A megosztott hálózatot az adatgyűjtési projekt hozza létre, és a Grafana is csatlakozik hozzá.


### Helyi plugin csomag, ha a release URL nem érhető el a szerverről

A GitHub release ZIP a GitHub asset API-ján keresztül is letölthető. Ellenőrizd a kiadott SHA-256 értéket, bontsd ki a csomagot, és tedd futtathatóvá a `gpx_*` backend binárisokat. A Grafana Compose-hoz adj helyi override fájlt. A példában a kibontott könyvtár a `deploy` mappa melletti `plugin-dist` alatt van.

```yaml
services:
  grafana:
    environment:
      GF_PLUGINS_PREINSTALL_SYNC: ''
    volumes:
      - ../plugin-dist/kfgyr-monitoring-app:/var/lib/grafana/plugins/kfgyr-monitoring-app:ro
```

Mindig add meg ugyanazokat az override fájlokat a Compose indításakor és újralétrehozásakor. Meglévő kötet átvételéhez az override-ban a megfelelő kötetekhez megadható az `external: true` beállítás. A régi Compose projektet csak visszaállításkor indítsd újra, miután a két új projekt leállt.

# Telepítés GitHubról

A relay és a Grafana két önálló Docker Compose projekt. Az alábbi parancsokat a `deploy` mappában futtasd az adott kiadáshoz tartozó repóból. A projekt a kiadott runner image-et és plugin ZIP-et használja. A dashboardfájlokat a checkoutból csatolja.

1. Másold a `.env.example` fájlt `.env` néven, és állíts be egyedi adatbázis-, olvasó- és Grafana-jelszót, valamint legalább 32 karakteres runner API-tokent. Indítsd el az adatgyűjtési stacket: `docker compose -f compose.relay.yaml up -d`.
2. Indítsd el a Grafanát: `docker compose -f compose.grafana.yaml up -d`. A két projekt közös belső Docker-hálózatot használ. A Grafana alapból `http://relay:8091` címen éri el a runnert és `db:5432` címen a TimescaleDB-t.

A Grafana elérhető a megadott porton. A Kezdőlap közvetlen belépést ad a gépmonitoringhoz és az adatexporthoz. Az **Agentek és gépek** oldalon kapcsold be az adatgyűjtést, majd az első beolvasás után a **Monitoring beállítása** oldalon válassz gépet, hozz létre dashboardot, és add hozzá a paneleket. Egy géphez több dashboard tartozhat. A dashboard mentése nem jár relay újraindítással. A **Gépmonitoring** és az **Adatexport** a tárolt adatokat olvassa. Üres konfigurációs kötetnél a runner API elérhető, az adatgyűjtés az első konfiguráció alkalmazása után indul.

Külön gépeken a Grafana hoston hozd létre a Grafana Compose által külsőként hivatkozott helyi Docker-hálózatot. Állítsd a `KFGYR_RUNNER_URL` és a `KFGYR_DB_ADDRESS` értékét a Grafanából elérhető privát címekre, és biztosítsd a hálózati elérést. A mellékelt relay Compose belső hálózaton tartja a DB-t és az API-t. Külön hosthoz a telepítés saját privát hálózati csatlakozása vagy címhez kötött porttovábbítása szükséges. Több Grafana használhatja ugyanazt az adatgyűjtési stacket külön Grafana-kötetekkel és porttal.

## Provisioning és kiadás

### KFGyR kezelők

A Grafana regisztráció nyitott. Az új fiókok Viewer szerepet kapnak, így elérik a Monitoringot és az Adatexportot. A normál Grafana Admin fiók a KFGyR **Jogosultságkezelés** oldalán vehet fel és távolíthat el kezelőket. A kezelők Grafana szerepe Viewer marad; a KFGyR saját beállításait használhatják, a Grafana dashboardjait nem szerkeszthetik.

Az első Grafana indítás után futtasd a management telepítőt a repó gyökeréből:

```sh
python deploy/install-management.py --url http://127.0.0.1:3000
```

A telepítő a meglévő Grafana adminjelszót interaktívan kéri be. Az indítási környezetben a `KFGYR_OPERATOR_TEAM_NAME` és a `KFGYR_ADMIN_ORG_ID` értéke egyezzen a Grafana Compose beállításával. Az alapértelmezett csapat neve **KFGyR kezelők**. A plugin az ugyanabban a konténerben lévő Grafana SQLite adatbázisból, olvasási módban ellenőrzi a csapattagságot. Más SQLite fájl használatakor a `KFGYR_GRAFANA_DB_PATH` adja meg az útvonalat.

Az éles szerveren megmaradt régi **KFGyR Demo** mappát a telepítő `--remove-demo` kapcsolója mentés után távolítja el. A mentés az `artifacts` mappába kerül, hacsak a `--backup-dir` nem ad meg más helyet.

### Grafana és relay kiadások

- A `monitoring-assets` konténer az `install-monitoring-assets.py` szkripttel kiválasztja a GitHub legfrissebb pluginkiadását, ellenőrzi a ZIP SHA-256 összegét, és stabil útvonalra telepíti a csomagot. Új verzióhoz telepítsd újra a Grafana stacket. Helyben futtasd a `docker compose -f compose.grafana.yaml up -d --force-recreate` parancsot, így a telepítő újra lefut, és a Grafana az új csomagot tölti be. Visszaállításhoz a `KFGYR_PLUGIN_RELEASE` változóban adj meg egy konkrét `plugin-vX.Y.Z` taget.
- Az app, a `timescaledb` UID-jú olvasási adatforrás és a kezelt **KFGyR** mappa a Grafana Compose-ból jön. A dashboardok forrása a `dashboards/managed` mappa. Újragenerálás a repó gyökeréből: `python dashboards/build-managed-dashboards.py`. A gyári dashboardok mentése a UI-ban tiltott. Saját nézethez használj külön dashboardot.
- A Kezdőlap a Grafana szerver alapértelmezett Home dashboardja. Meglévő szervezeti, csapat- vagy személyes Home választás elsőbbséget élvezhet.
- A runner induláskor létrehozza a `kfgyr.machine_dashboards` konfigurációs táblát, és a korábbi gépbeállításokat egyszer migrálja. A Grafana olvasási jogosultságát a runner migrációja adja meg a meglévő `grafana_reader` szerepnek. Az alap olvasó szerepet a PostgreSQL első inicializálásakor a `grafana-reader.psql` hozza létre.
- A plugin és a runner kiadását a `plugin-vX.Y.Z` és `relay-runner-vX.Y.Z` Git tagek indítják. A runner Compose-ban rögzített verzióját a konténerkép közzététele után állítsd át.

## Átállás a korábbi egyprojektes telepítésről

1. Mentsd a TimescaleDB, a runner konfiguráció és a Grafana tartós adatait. Jegyezd fel a három meglévő kötet tényleges Docker-nevét és a korábbi Compose-beállításokat.
2. Állítsd be a `KFGYR_DB_VOLUME`, `KFGYR_RELAY_VOLUME` és `KFGYR_GRAFANA_VOLUME` változókat a meglévő kötetek nevére. A három kötetet ellenőrizd `docker volume inspect` paranccsal még indítás előtt. Meglévő DB-köteten az init script nem fut újra. Ha az olvasó szerep hiányzik, futtasd a `grafana-reader.psql` fájlt `ladder99` jogosultsággal és az aktuális olvasói jelszóval.
3. Állítsd le a régi konténereket a kötetek törlése nélkül. Az új adatgyűjtési projekt indítása előtt ellenőrizd, hogy nincs másik PostgreSQL vagy runner folyamat ugyanazon köteteken. Ezután indítsd el sorrendben az új relay és Grafana projektet. A korábbi `compose.yaml` az átállás előtti telepítést dokumentálja.
4. Ellenőrizd a runner aktív revízióját, a mérések folytonosságát, az adatforrást, a Kezdőlapot és a plugin menüpontokat. Visszaállításhoz állítsd le a két új projektet, és az elmentett régi konfigurációval indítsd el a korábbi szolgáltatást ugyanazokon a köteteken.

A külön projektek leállításához használd a `stop` parancsot. A megosztott hálózatot az adatgyűjtési projekt hozza létre, és a Grafana is csatlakozik hozzá.


### Helyi plugin csomag, ha a release URL nem érhető el a szerverről

A GitHub release ZIP a GitHub asset API-ján keresztül is letölthető. Ellenőrizd a kiadott SHA-256 értéket, bontsd ki a csomagot a `deploy/runtime/grafana-plugin` mappába, és tedd futtathatóvá a `gpx_*` backend binárisokat. Az alábbi Compose override kihagyja a hálózati letöltést, így a Grafana a kézzel bemásolt plugint olvassa a megszokott helyről.

```yaml
services:
  monitoring-assets:
    command: ["true"]
```

Mindig add meg ugyanazokat az override fájlokat a Compose indításakor és újralétrehozásakor. Meglévő kötet átvételéhez az override-ban a megfelelő kötetekhez megadható az `external: true` beállítás. A régi Compose projektet csak visszaállításkor indítsd újra, miután a két új projekt leállt.

### Az utolsó minta lekérdezésének gyorsítása

A Gépmonitoring állapotkártyái és műszerei a kiválasztott gép és adatpont utolsó ismert mintáját keresik. Egy ritkán változó állapot mintája a dashboard időablakán kívül is lehet. A `raw.history` külön gép-, adatpont- és időindexei mellé ezért egy összetett B-tree index kerül. A `(node_id, dataitem_id, time DESC)` sorrend a két azonosítóra szűrés után a legújabb minta keresését segíti.

A `raw.history` létrejötte után futtasd a repó gyökeréből, az aktív backend TimescaleDB-jén, a tábla tulajdonosaként. A `db` az aktív relay Compose projekt adatbázis-szolgáltatása.

```sh
docker compose -f deploy/compose.relay.yaml exec -T db psql -X -U ladder99 -d ladder99 < deploy/history-lookup-index.psql
```

A TimescaleDB időszegmensenként építi az indexet. Az érintett szegmens írásai közben várhatnak, ezért kisebb terhelésnél futtasd. A fájl öt másodperces zárolási időkorlátot állít be, és ellenőrzi az index érvényességét. Futtasd önállóan, tranzakciós csomagolás nélkül. A Grafana és a relay újraindítása nem szükséges. [TimescaleDB indexelés időszegmensenként](https://www.tigerdata.com/docs/reference/timescaledb/hypertables/create_index)

Az ellenőrzéshez hasonlítsd össze ugyanannak az Elérhetőség panelnek az adatforrás-lekérdezését előtte és utána. Ha az indexépítés félbeszakad, az index érvénytelen maradhat, és a megismételt parancs az azonos név miatt átugorhatja. Ilyenkor, illetve visszaállításhoz, a tulajdonosi kapcsolaton futtasd a következőt. Újraépítéshez utána futtasd ismét a fenti fájlt.

```sql
DROP INDEX IF EXISTS raw.history_node_dataitem_time_idx;
```

Az éles Coolify telepítésben az index 2026. november 13-án az aktív backend `db` konténerében épült fel, egyszeri psql futtatással. Az adatbázis érvényesnek jelölte az indexet. A Mazak Elérhetőség lekérdezése a Grafana API-n egy-egy mérésben 2,37 s-ról 0,05 s-ra csökkent, és mindkét alkalommal `AVAILABLE` értéket adott.

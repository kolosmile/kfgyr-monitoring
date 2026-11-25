# Relay-runner API

## Felépítés és hozzáférés

Böngésző → Grafana plugin resource API → Go backend → runner FastAPI → relay gyermekfolyamat.

A Go backend minden kérésnél a Grafanától kapott szervezetet (`KFGYR_ADMIN_ORG_ID`) és a jogosultságot ellenőrzi. A konfigurációs végpontok az `Admin` szerep mellett a konfigurált kezelői csapat (`KFGYR_OPERATOR_TEAM_NAME`, alapértelmezetten `KFGyR kezelők`) aktív `Viewer` tagjai számára is engedélyezettek (a backend olvasási módban ellenőrzi a csapattagságot a Grafana SQLite adatbázisából). Az élő elérhetőségi lekérdezést (`availability/{machine}`) a szervezet `Viewer` és névtelen szerepköre is elérheti; a kezelői csapattagság lekérdezését és módosítását szolgáló jogosultságkezelés kizárólag `Admin` szerephez kötött. A runner külön Bearer tokent kér, állandó idejű összehasonlítással. A token a Grafana `secureJsonData` mezőjében tárolódik; a böngésző és a Viewer nem kapja meg. Az auditáló felhasználónevet a backend `X-KFGYR-Actor` fejlécben továbbítja. A runner token birtokosa adminisztrációs jogot kap.

A Grafana és a runner külön gépen is lehet. Ilyenkor a `KFGYR_RUNNER_URL` módosul, és a runner portját a megfelelő hálózaton elérhetővé kell tenni. Távoli kapcsolathoz HTTPS vagy tailnet használható, a portot a Grafana gépére korlátozva. Alapértelmezésben a port nincs publikálva a hoston.

| Végpont | Művelet |
| --- | --- |
| `GET /healthz` | Token nélküli folyamat-életjel és verzió |
| `GET /v1/config` | Mentett konfiguráció, verzió, YAML |
| `PUT /v1/config` | `{base_revision, config}` mentése, új verzió és relay-újraindítás |
| `POST /v1/rollback` | `{base_revision, revision}` korábbi verzió új mentésként |
| `GET /v1/status` | Kért, futó, hibás verzió és relay állapot |
| `POST /v1/probe` | `{url}` ellenőrzött MTConnect `/probe` lekérése |
| `GET /v1/networks` | A runner gépén felismert és engedélyezett LAN-ok |
| `POST /v1/discovery` | `{network, ports}` aszinkron keresés, 202 és feladatazonosító |
| `GET /v1/discovery` | Utolsó keresés vagy null |
| `GET /v1/discovery/{id}` | Előrehaladás, állapot és találatok |
| `DELETE /v1/discovery/{id}` | Megszakítás; a folyamatban levő rövid kérések még befejeződhetnek |

A `/docs` és `/openapi.json` is tokent kér. Kéréskorlát 1 MiB, XML-válaszkorlát 4 MiB. Párhuzamos szerkesztésnél az elavult `base_revision` 409-et ad, felülírás nélkül. A konfiguráció az ismeretlen mezőket megőrzi; a meglévő adatbázis-azonosító aliasok nem változtathatók.

## LAN és keresés

A Linux host `/proc/1/net/route` fájlja csak olvasható bind mountként kerül a runnerbe. Így a LAN felismerése a host kapcsolt hálózatait látja a Docker bridge-hálózat helyett. Nincs host network, privileged mód vagy Docker socket. A loopback, Docker, bridge, veth, VPN és alapértelmezett útvonalak kimaradnak. Szükség esetén a telepítő `KFGYR_DISCOVERY_NETWORKS` változóval ad meg tartományt.

Egyszerre egy keresés futhat, legfeljebb 256 címen, 1–8 porton, 24 párhuzamos kéréssel. A keresés HTTP `/probe` választ ellenőriz (443-on HTTPS). Az eltérő port kézzel megadható; eltérő alapútvonalú agent kézzel vehető fel. A 15 percnél régebbi feladatok új keresés indításakor törlődnek, egyszerre legfeljebb nyolcat őriz a memória. Runner-újraindításkor a keresési előzmények elvesznek.

A kézi probe és konfiguráció kizárólag engedélyezett hostneveket/CIDR-eket és a felismert LAN-t fogadja el. Nincs redirect, loopback/link-local cél; DNS után a kapcsolat az ellenőrzött IP-hez rögzített. HTTPS esetén a tanúsítványellenőrzés aktív. Csak érvényes MTConnect eszközleírást adó agent jelenik meg találatként.

## Tárolás és visszaállás

Csak a runner csatolja a konfiguráció volume-ját. A `revisions/*.yaml` és auditfájlok változatok, a `desired.json` a kért verzió, a `runner-state.json` az utolsó stabil és az elutasított verzió. A `status.json` technikai állapot. A manifest és a YAML SHA-256 ellenőrzése megelőzi a használatot. A relay a saját privát aktív YAML-ját olvassa.

A sikeres mentés nem azonos a sikeres adatgyűjtéssel. A runner az indulási időszak túlélését ellenőrzi; az agentkapcsolat és a beérkező adatok a dashboardon ellenőrzendők. Hibás induláskor a korábbi stabil verzió fut, miközben a felület jelzi a kért verzió hibáját.

Adatbázis-támogatással a normál konfigurációmentés az eltávolított agentek aliasait a kért verzióhoz és az auditfájlhoz rögzíti. A runner az új relay folyamat sikeres indulása után, a még aktuális verzióhoz hajtja végre a törlést. Alias alapján egyetlen PostgreSQL-tranzakcióban törli a kapcsolódó mintákat (`raw.history`), összesítéseket (`raw.bins`), csomópontkapcsolatokat (`raw.edges`), eszközöket és adatpontokat (`raw.nodes`), valamint a géphez kötött KFGyR-beállításokat és dashboardokat. Adatbázishibánál a tranzakció visszagördül, a runner újrapróbálkozik. A sikertelen konfigurációindítás és a konfiguráció-visszaállítás önmagában nem indít adattörlést.


## Gépmonitoring konfiguráció

- `GET /v1/machines` felsorolja az adatbázisban ismert gépeket és a hozzájuk rendelt sémákat.
- `GET /v1/signals` lekéri a magyar jelnevek és egységek katalógusát.
- `POST /v1/signals`, `PUT /v1/signals`, `DELETE /v1/signals/{id}` jelet hoz létre, módosítja a nevét/egységét, illetve törli (ha nem hivatkozza séma vagy dashboard).
- `GET /v1/display-units`, `PUT /v1/display-units` az MTConnect `UnitEnum` mértékegységkódok megjelenítési címkéit (`kfgyr.display_units`) olvassa és menti.
- `GET /v1/schemas`, `POST /v1/schemas`, `PUT /v1/schemas/{id}`, `DELETE /v1/schemas/{id}` a gépsémákat kezeli. A `POST /v1/schemas` opcionális `source_schema_id` paraméterrel meglévő séma és hozzárendelései klónozását is támogatja.
- `GET/PUT /v1/schemas/{id}/mappings` egy séma jel-végpont hozzárendeléseit olvassa vagy menti.
- `DELETE /v1/schemas/{id}/mappings/{signal_id}` egy hozzárendelést töröl.
- `GET /v1/machines/{machine}/dataitems` visszaadja a gép relatív adatpontútvonalait, egységeit és az agent által közölt `name` mezőt. A `name` hiányzó gépi névnél üres karakterlánc. A sémához a relatív `path` értéket kell menteni.
- `GET /v1/availability/{machine}` a géphez tartozó agent `/probe` válaszával ellenőrzi a gép élő elérhetőségét (`online`, `offline` vagy `unknown`).
- `GET /v1/machines/{machine}/dashboards` felsorolja a gép dashboardjait és az azonos sémájú másolható forrásdashboardokat.
- `POST /v1/dashboards/copy-preview` a `machine` és `source_dashboard_id` alapján visszaadja az átvihető panelek számát (`copied_panels`) és a kimaradó panelek `name` és `view` mezőit (`skipped_panels`). Ugyanazt a feloldási logikát futtatja, mint a másolás.
- `POST /v1/dashboards` új, üres vagy meglévő azonos sémájú dashboardból (`source_dashboard_id`) másolt dashboardot hoz létre.
- `GET /v1/dashboards/{id}` visszaadja a dashboard nevét, paneljeit, revízióját és a gép kiválasztható adatpontjait.
- `PUT /v1/dashboards` az `id`, `name`, `panels` és `revision` alapján ment (beleértve az opcionális grafikon-vonalszínt és állapotidősor-kapcsolót). A runner csak az adott géphez tartozó adatpontot fogad el.
- `PUT /v1/dashboards/default` a `machine` és `id` alapján kiválasztja a gép alapértelmezett dashboardját. A runner ellenőrzi, hogy a dashboard a géphez tartozik, és egy tranzakcióban állítja át a jelölést. A válasz a kiválasztott `id`.
- `POST /v1/dashboards/delete` az `id` és `revision` alapján töröl. Párhuzamos módosításnál a régi revízió 409 választ kap.
- A korábbi `GET /v1/machine-monitoring/{machine}` és `PUT /v1/machine-monitoring` végpont az alapértelmezett dashboardot kezeli.

A jelkatalógus (`kfgyr.signal_catalog`), a megjelenítési egységek (`kfgyr.display_units`), a sémák (`kfgyr.machine_schemas`), a hozzárendelések (`kfgyr.schema_mappings`) és az egyszeri migrációs napló (`kfgyr.schema_migrations`) a PostgreSQL `kfgyr` sémájában élnek. A táblák induláskori migrációját, valamint a séma-hozzárendelések validálását és szinkronizálását a `KFGYR_MONITORING_DB_ENABLED=1` környezeti változó engedélyezi. Egy séma egy katalógusjelhez legfeljebb egy gépen belüli útvonalat rendelhet; ugyanaz az útvonal egy sémában nem tartozhat két jelhez. A géphez rendelt sémaazonosító a verziózott agent-konfigurációban marad, és a relaynek átadott YAML-ból a runner eltávolítja. A runner az értéket a `kfgyr.machine_schema_assignments` táblába is tükrözi a Grafana olvasási lekérdezéseihez.

Az új dashboardpanelek katalógusjelet használnak. A runner csak akkor kínálja fel, ha a gép sémájában van útvonala, és az útvonal az adott gép adatpontjai között ténylegesen megtalálható. A régi, közvetlen DataItem-azonosítóra mutató panelek továbbra is olvashatók és szerkeszthetők. A katalógus egysége nem íródik át, ha egy gép adatpontja eltérő egységet közöl.

A runner induláskor tranzakcióban migrálja a meglévő gépbeállításokat a `kfgyr.machine_dashboards` táblába, gépenként egy „Áttekintés” dashboardként (`machine_dashboards_v1` migráció). A migráció egyszer fut le, és megőrzi a korábbi panelkonfigurációkat. Az első dashboard automatikusan alapértelmezett, később a választás módosítható. Az alapértelmezett dashboard törlésekor a legrégebbi fennmaradó dashboard veszi át ezt a szerepet.

Ezek a műveletek a runner hitelesített API-ján futnak. A mentés a normál PostgreSQL konfigurációs táblát módosítja. A relay adatgyűjtési konfigurációját és alkalmazott revízióját külön kezeli.

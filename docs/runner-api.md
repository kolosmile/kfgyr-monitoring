# Relay-runner API

## Felépítés és hozzáférés

Böngésző → Grafana plugin resource API → Go backend → runner FastAPI → relay gyermekfolyamat.

A Go backend minden kérésnél a Grafanától kapott szervezetet és Admin szerepet ellenőrzi. A runner külön Bearer tokent kér, állandó idejű összehasonlítással. A token a Grafana `secureJsonData` mezőjében tárolódik; a böngésző és a Viewer nem kapja meg. Az auditáló felhasználónevet a backend `X-KFGYR-Actor` fejlécben továbbítja. A runner token birtokosa adminisztrációs jogot kap.

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

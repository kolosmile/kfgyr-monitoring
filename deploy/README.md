# Telepítés és frissítés

A Grafana a hivatalos image marad. A `GF_PLUGINS_PREINSTALL_SYNC` a kiadott plugin ZIP-et telepíti. A saját plugin jelenleg unsigned; kizárólag a `kfgyr-monitoring-app` azonosító betöltése engedélyezett. A plugin organization Admin ellenőrzést végez, és a provisioning a beállított szervezetben engedélyezi/pineli az appot.

## Kiadás

- A `plugin-v0.1.0` típusú Git-tag elindítja a plugin buildjét, típusellenőrzését, Go tesztjeit, a linux/amd64 és linux/arm64 backend fordítását és a ZIP Release kiadását.
- A `relay-runner-v0.1.0` típusú tag elindítja a runner tesztjeit és a `ghcr.io/kolosmile/kfgyr-relay-runner:0.1.0` image buildjét/publikálását. Az image linux/amd64 célplatformra készül az upstream alap image alapján.
- A GHCR package-nek publikusnak kell lennie, vagy a telepítéshez registry-hitelesítést kell biztosítani. A publikus Git-repo nem jelenti automatikusan a package publikus láthatóságát.

## Első telepítés

1. Töltsd ki a `.env.example` alapján a Coolify környezeti változóit. A jelszavak Coolifyban maradjanak.
2. Készítsd el a `KFGYR_CONFIG_VOLUME` nevű külső Docker volume-ot. A konfiguráció könyvtárának tulajdonosa/csoportja és módja biztosítsa a Grafana 472-es UID-jának írását; a hivatalos image 0-s csoportját használva a kötet könyvtára lehet `root:0`, `0770`, a fájlok `0660`.
3. A meglévő relay `setup.yaml` fájlját mentsd ki, és a `seed-config.py` segítségével készítsd el a kötetben az első verziót. A script már létező konfigurációt nem ír felül.
4. A Coolify Compose Service-ben alkalmazd a `compose.yaml` tartalmát. Meglévő telepítésnél őrizd meg a Grafana és TimescaleDB volume kulcsait, hogy a Coolify ugyanazokat a köteteket használja.
5. Ellenőrizd a runner healthcheckjét, a plugin telepítését és az adatgyűjtést. Az adminoldal útvonala `/a/kfgyr-monitoring-app/agents`.

A Grafana és a runner ugyanazt a `KFGYR_CONFIG_VOLUME` külső kötetet használja; a konténeren belüli útvonalat a `KFGYR_CONFIG_DIR` határozza meg. Ezek mindkét szolgáltatásnál közös beállítások. A runner `status.json` és `runner-state.json` fájlokat is ír a kötetbe.

A `KFGYR_AGENT_ALLOWED_HOSTS` és `KFGYR_AGENT_ALLOWED_NETWORKS` korlátozza az admin API-ból konfigurálható/lekérdezhető MTConnect címeket. A hostnevek pontos egyezéssel engedélyezettek; a privát címek csak engedélyezett CIDR-ből érhetők el. Loopback, link-local és redirect nem engedélyezett. Új hálózat felvétele fejlesztői telepítési beállítás; az engedélyezett hálózaton belüli agentek kezelése monitoring admin feladat.

## Frissítés és visszaállítás

Pluginfrissítés: új pluginverzió és tag, sikeres ZIP Release, majd a `KFGYR_PLUGIN_INSTALL` módosítása és a Grafana újratelepítése. Runnerfrissítés: új image-verzió, `KFGYR_RELAY_RUNNER_IMAGE` módosítása és újratelepítés. A kiadási URL-ek és image-ek rögzített verzióra mutassanak.

A runtime konfigurációk `revisions/` alatt maradnak; a `desired.json` jelöli a kért verziót. A runner korai kilépéskor visszaállhat a korábbi verzióra, amit a felület külön jelez. Az admin a felületről visszaállíthatja a mentett konfigurációt a futó verzióra. A mentés és a futó állapot nem egyenlő a sikeres adatbeérkezéssel.

Deploy előtt a Coolify Compose és a runtime kötet mentése szükséges. Az adatbázisköteteket rollbackkor sem kell törölni. A komponensfrissítés nem módosítja automatikusan az agentlistát vagy a dashboardokat.

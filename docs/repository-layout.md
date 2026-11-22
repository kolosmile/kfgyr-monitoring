# A repository szerkezete

A monitoring rendszer egy Git-repositoryban található. Az önállóan buildelhető és kiadható komponensek külön alkönyvtárat kaptak.

```text
kfgyr-monitoring/
  plugins/
    kfgyr-monitoring-app/
      README.md
      CHANGELOG.md
      src/                    # React/TypeScript frontend, plugin.json, pages/, components/, navigation/, fleet/
      pkg/                    # Go backend (jogosultság-ellenőrzés és runner API proxy)
      Magefile.go             # Grafana plugin SDK Go build célok
      package.json
      package-lock.json
      go.mod
      go.sum
      tsconfig.json
      docker-compose.yaml     # Helyi pluginfejlesztői Compose
  services/
    relay-runner/             # Python/FastAPI relay-felügyelet, PostgreSQL séma/dashboard API és Dockerfile
  deploy/
    compose.relay.yaml        # Adatgyűjtési stack (TimescaleDB + relay-runner)
    compose.grafana.yaml      # Megjelenítési stack (monitoring-assets init + Grafana + provisioning)
    compose.yaml              # Korábbi, egyprojektes telepítési sablon
    .env.example              # Környezeti változók sablonja
    install-monitoring-assets.py  # Plugin ZIP letöltése/SHA-256 ellenőrzése és dashboard-telepítés
    install-management.py     # KFGyR kezelők csapat létrehozása és opcionális régi Demo-takarítás
    seed-config.py            # Példakonfiguráció betöltése és ellenőrzése
    grafana-reader.psql       # Csak olvasó grafana_reader PostgreSQL-szerep inicializálása
    history-lookup-index.psql # Összetett raw.history index az utolsó minta lekérdezéséhez
    README.md
  dashboards/
    build-managed-dashboards.py   # A kezelt dashboardok JSON-generátora
    managed/                  # Provisionált Grafana dashboardok (home.json, fleet.json, machine-monitoring.json)
    build-export-dashboard.py # Korábbi natív export dashboard generátora
    export-dashboard.json
  examples/                   # Publikálható MTConnect és demó dashboard példák
  docs/                       # Műszaki dokumentáció
  .github/
    workflows/                # Komponensenkénti CI build és tag-alapú kiadás (plugin.yml, relay-runner.yml)
  README.md
```

## Plugin mint külön fejlesztési egység

A pluginprojekt teljes egészében a `plugins/kfgyr-monitoring-app/` könyvtárban található. A pluginon belül marad a frontend, a két beágyazott panel plugin (`src/navigation/` és `src/fleet/`), a Go backend, a függőségek és a build konfigurációja. A fejlesztői parancsokat ebben a könyvtárban futtatjuk. A kimeneti `dist/` buildtermék, nem Gitben tárolt forrás.

A fő app plugin (`kfgyr-monitoring-app`), a két beágyazott panel plugin (`kfgyr-navigation-panel`, `kfgyr-fleet-panel`) és a Go backend együtt alkot egy kiadási csomagot, ezért közös verzióval és egy ZIP-ben kerülnek kiadásra. A ZIP tartalmazza a pluginleírókat, a frontend fájlokat és a támogatott célplatformok (`linux/amd64`, `linux/arm64`) backend binárisait.

A GitHub Actions workflow-k a repo gyökerének `.github/workflows/` könyvtárába kerülnek (`plugin.yml`, `relay-runner.yml`), a pluginbuild munkakönyvtára viszont a plugin alkönyvtára. Az ellenőrzések útvonalszűréssel indulnak a komponensek vagy a workflow-k változásakor; a kiadás külön verziótagra fut le (`plugin-v*` és `relay-runner-v*`).

## Önálló verziók és kiadások

Tagformátumok:

- `plugin-vX.Y.Z`: a Grafana app plugin és beágyazott panel pluginok kiadása (például `kfgyr-monitoring-app-0.4.37.zip` és `SHA256SUMS`);
- `relay-runner-vX.Y.Z`: a relay indítóprogram Docker image kiadása (`ghcr.io/kolosmile/kfgyr-relay-runner:X.Y.Z`).

A `deploy/compose.grafana.yaml` rögzített Grafana image-verziót használ, és a `monitoring-assets` init konténerrel (`deploy/install-monitoring-assets.py`) tölti le a plugin ZIP-et a GitHub Releases API-ról SHA-256 ellenőrzéssel (alapértelmezetten a legfrissebb kiadást, `KFGYR_PLUGIN_RELEASE` változóval konkrét tagre rögzíthetően). Az unsigned pluginok betöltési listája (`GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS`) és az app provisioningje a Grafana Compose része.

Pluginfrissítéshez a plugin buildje és kiadása, majd a Grafana stack újralétrehozása (vagy `KFGYR_PLUGIN_RELEASE` átállítása) szükséges. Grafana-frissítéshez a hivatalos image verzióját módosítjuk, és ellenőrizzük a plugin kompatibilitását. A gyári dashboardok módosítása a `dashboards/build-managed-dashboards.py` futtatásával kerül a `dashboards/managed/` mappába.

## Telepítés és futás közbeni beállítások

A telepítés két önálló Compose fájlra oszlik (`deploy/compose.relay.yaml` és `deploy/compose.grafana.yaml`), így a Grafana frissítése közben is zavartalanul fut az adatgyűjtés. A plugin saját helyi fejlesztői Compose-környezete a `plugins/kfgyr-monitoring-app/docker-compose.yaml` fájlban található.

A gépek/agentek üzemi konfigurációja a tartós konfigurációs kötetben (`relay-config`), a jelkatalógus, sémák, megjelenítési egységek és gépenkénti dashboardok pedig a PostgreSQL `kfgyr.*` tábláiban élnek. A kezelők és adminok ezeket a Grafana plugin felületén módosítják; a változás nem igényel forráskódkiadást. A repository csak publikálható példát tartalmaz.

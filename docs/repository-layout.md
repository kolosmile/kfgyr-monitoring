# A repository tervezett szerkezete

A monitoring rendszer egy Git-repositoryban marad. Az önállóan buildelhető és kiadható komponensek külön alkönyvtárat kapnak. A következő fa terv; jelenleg csak az alapdokumentáció és a példakonfiguráció létezik.

```text
kfgyr-monitoring/
  plugins/
    kfgyr-monitoring-app/
      README.md
      src/                 # React/TypeScript frontend és plugin.json
      pkg/                 # Go backend
      package.json
      package-lock.json
      go.mod
      go.sum
      Magefile.go
      docker-compose.yaml  # A plugin helyi fejlesztői Grafanája
  services/
    relay-runner/          # Relay indítóprogram és saját relay image buildje
  deploy/
    compose.yaml          # A teljes monitoring rendszer telepítése
    .env.example
    grafana/
      provisioning/       # Automatizált Grafana beállítások
  dashboards/             # Verziózott dashboard JSON-források
  examples/               # Publikálható MTConnect konfigurációs példák
  docs/
  .github/
    workflows/            # Komponensenkénti build és kiadás
  README.md
```

## Plugin mint külön fejlesztési egység

A generált pluginprojekt teljes egészében a `plugins/kfgyr-monitoring-app/` könyvtárba kerül. A pluginon belül marad a frontend, a backend, a függőségek és a build konfigurációja. A fejlesztői parancsokat ebben a könyvtárban futtatjuk. A kimeneti `dist/` buildtermék, nem Gitben tárolt forrás.

A frontend és a Go backend együtt alkot egy plugint, ezért közös verzióval és egy ZIP-csomagban kerülnek kiadásra. A ZIP tartalmazza a pluginleírót, a frontend fájlokat és a támogatott célplatformok backend binárisait. A csomag pontos gyökérkönyvtárát a Grafana plugin csomagolási szabályai szerint kell kialakítani.

A GitHub Actions workflow-k a repo gyökerének `.github/workflows/` könyvtárába kerülnek, a pluginbuild munkakönyvtára viszont a plugin alkönyvtára. A későbbi ellenőrzések útvonalszűréssel indulhatnak a plugin vagy annak workflow-ja változásakor. A kiadási workflow külön tag alapján fut; a tag indítást és az útvonalszűrést nem kell összekeverni.

## Önálló verziók és kiadások

Példák a tervezett tagnevekre:

- `plugin-v0.1.0`: csak a Grafana plugin kiadása;
- `relay-runner-v0.1.0`: csak a relay indítóprogram kiadása.

A plugin release ZIP-je például `kfgyr-monitoring-app-0.1.0.zip` néven jelenik meg. A plugin belső verziója `0.1.0`; a `plugin-` előtag a Git-tagben különbözteti meg a komponenseket.

A `deploy/compose.yaml` rögzített Grafana image-verziót és rögzített plugin release URL-t használ. A `GF_PLUGINS_PREINSTALL_SYNC` a ZIP-ből telepíti a plugint a hivatalos Grafana konténer indulásakor. A szükséges aláírási beállítások és az app provisioningje a telepítés része.

Pluginfrissítéshez a plugin buildje és kiadása, majd a telepítésben a pluginverzió módosítása szükséges. Grafana-frissítéshez a hivatalos image verzióját módosítjuk, és ellenőrizzük a plugin kompatibilitását. Dashboard-módosítás önmagában nem igényel pluginbuildet, ha a dashboard a külön provisioningből származik.

## Telepítés és futás közbeni beállítások

A plugin saját fejlesztői Compose-a a helyi pluginfejlesztésre szolgál. A `deploy/compose.yaml` fogja össze az egész monitoring rendszert és a komponensek kapcsolatait.

A gépek/agentek üzemi konfigurációja a tartós konfigurációs kötetben él. A monitoring admin ezt a Grafana plugin felületén módosítja; az agentlista változása nem forráskódkiadás. A repository csak publikálható példát tartalmaz.

A kezdeti megvalósításkor nincs szükség külön Git-repositoryra, Git submodule-ra vagy közös JavaScript workspace-re. A plugin kinyerhető külön repositoryba, ha később saját csapatot, hozzáférési határt vagy több projekt által használt önálló életciklust kap.

# Grafana plugin fejlesztése Windows alatt

## Munkamenet

A hivatalos Grafana generátor egyszer WSL-ben futott. A kimenete már ekkor a Windows fájlrendszerében, `/mnt/c` alatt volt. A szükséges projektvázat átvettük a repository `plugins/kfgyr-monitoring-app` könyvtárába, megtartva a meglévő alkalmazáskódot és a plugin azonosítóját.

A további szerkesztés, függőségtelepítés és frontend build Windows alatt végezhető. Ehhez a generátort nem kell újra futtatni. A helyi `node_modules` Windowsos telepítésből származik; ne oszd meg ugyanazt a könyvtárat WSL-lel. Környezetváltáskor az adott rendszer saját Node.js-ével futtasd újra az `npm ci` parancsot.

Ellenőrzött helyi verziók: Windows Node.js 24.18.0, npm 11.16.0, Go 1.26.5.

```powershell
cd .\plugins\kfgyr-monitoring-app
npm.cmd ci --no-audit --no-fund
npm.cmd run typecheck
npm.cmd run build
```

Fejlesztés közbeni automatikus frontend fordítás:

```powershell
npm.cmd run dev
```

A frontend a `dist/` könyvtárba kerül. A Go backend fordításához a `go` legyen az aktuális shell PATH-jában:

```powershell
go run github.com/magefile/mage -v build:linux build:linuxARM64
```

Ez Windowsról Linux amd64 és arm64 binárisokat készít a Grafana plugin SDK hivatalos Mage céljaival. A Windowsos frontend build nem indít Grafanát: a plugin kipróbálásához Grafana szerver is kell. A mellékelt fejlesztői Compose az `npm.cmd run server` paranccsal indítható, ha fut a Docker engine. A fejlesztői konfiguráció a gitből kizárt `.dev-config/` könyvtárba kerül. Ezt a Compose-t ebben a migrációban nem indítottuk el.

## Mi generált, és mi saját kód?

| Terület | Eredet / szerep |
| --- | --- |
| `.config/` | Változatlan hivatalos build-, teszt- és fejlesztői eszközök. Közvetlenül nem szerkesztjük. |
| `Magefile.go`, Jest-, ESLint-, Playwright- és Prettier-bekötések | A generátor projektváza. |
| `package.json`, `tsconfig.json` | Generátor alapján; a csomagnév, verziók és a Grafana 13.0.2-höz illesztett függőségek projektbeállítások. |
| `src/module.ts`, `src/pages/App.tsx`, `src/plugin.json`, `src/img/` | A korábban megírt saját plugin, megtartva. |
| `pkg/` | Saját Go backend, jogosultságkezelés és konfigurációkezelés. |
| `docker-compose.yaml` | Saját helyi Grafana-beállítás a generált Compose-alapra építve. |
| A repository gyökerében lévő Actions workflow | Saját monorepo CI; Linuxos kiadás és külön Windows frontend ellenőrzés. |

A generátor verzióját, parancsát, npm integritását és az átvett generált fájlok ellenőrzőösszegét a [scaffold-origin.json](scaffold-origin.json) rögzíti. Az ellenőrzőösszegek CRLF → LF normalizálással készültek. Ez a projektváz átvételének nyilvántartása, nem annak állítása, hogy a saját alkalmazáskódot a generátor készítette.

## Az egyszeri generálás

A WSL Ubuntu 22.04-ben, egy külön munkakönyvtárban futtatott parancs:

```bash
npx --yes --package=node@24.18.0 --package=@grafana/create-plugin@7.13.0 create-plugin --plugin-type=app --plugin-name=monitoring --org-name=kfgyr --backend
```

A generálás elkészítette a fájlokat. A generátor utólagos Prettier lépése hibát jelzett; ez a projektváz létrehozását nem akadályozta. A generált `.config` fájlokat változatlanul tartottuk meg. A WSL-ből származó `node_modules` nem került át a projektbe: a függőségeket Windowsos `npm ci` telepítette.

A Grafana [hibaelhárítási dokumentációja](https://grafana.com/developers/plugin-tools/troubleshooting) WSL-t ír elő a generátor Windowsos használatához. A kész projekt natív Windowsos típusellenőrzését és production frontend buildjét külön ellenőriztük; ezt a CI `windows-frontend` feladata is ellenőrzi. Ez nem jelenti minden generált fejlesztői eszköz Windows-kompatibilitásának igazolását.

## Kiadás

A végleges plugin ZIP továbbra is Ubuntu GitHub Actions környezetben készül, a Linux backend binárisokkal együtt. A Windowsos ellenőrzés külön CI feladat. A projektváz átvétele nem igényel új Grafana image-et, és önmagában nem módosítja az üzemi telepítést.

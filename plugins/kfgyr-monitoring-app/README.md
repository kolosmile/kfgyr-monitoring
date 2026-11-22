# KFGyR Monitoring Grafana app

React/TypeScript felület és Go backend MTConnect agentek, jelkatalógus, gépsémák, gépenkénti dashboardok és adatexport kezeléséhez. A csomag hat alkalmazásoldalt (**Agentek és gépek**, **Dashboard szerkesztő**, **Jelkatalógus**, **Adatexport**, **Használati útmutató**, **Jogosultságkezelés**) és két beágyazott panel plugint (`kfgyr-navigation-panel`, `kfgyr-fleet-panel`) foglal magába közös verzióval.

A Go backend minden kérésnél ellenőrzi a Grafana szervezetet (`KFGYR_ADMIN_ORG_ID`) és a jogosultságot: a konfigurációs végpontokat az `Admin` szerep mellett a konfigurált kezelői csapat (`KFGYR_OPERATOR_TEAM_NAME`, alapértelmezetten `KFGyR kezelők`) aktív `Viewer` tagjai is használhatják. A tagságot a backend olvasási módban ellenőrzi a Grafana SQLite adatbázisából (`KFGYR_GRAFANA_DB_PATH` vagy `$GF_PATHS_DATA/grafana.db`). Az **Adatexport** oldal, a szerepkör-tudatos **Használati útmutató** és a gépek élő elérhetőségének lekérdezése a `Viewer` és névtelen szerepkör számára is elérhető; a **Jogosultságkezelés** kizárólag `Admin` joggal használható.

Projektváz: a hivatalos `@grafana/create-plugin@7.13.0` generátorral, egyszer WSL-ből előállítva. A `.config/` a generátortól változatlanul átvett buildeszközöket tartalmazza; az alkalmazás saját kódja a `src/` és `pkg/` könyvtárakban található.

Windows PowerShellből, Node.js 24 és Go 1.26.5 mellett:

```powershell
npm.cmd ci --no-audit --no-fund
npm.cmd run typecheck
npm.cmd run build
go run github.com/magefile/mage -v build:linux build:linuxARM64
```

A `npm.cmd run dev` figyeli és újrafordítja a frontend módosításait. A fejlesztői Grafana indításához Docker engine szükséges; ehhez az `npm.cmd run server` használható. A Linux backend build célplatformjai Windowsról is előállíthatók; maga a plugin backend a Grafana Linux konténerében fut. A kiadási ZIP-et továbbra is a Linuxos GitHub Actions készíti.

Részletes munkamenet és a generált/saját fájlok eredete: [Windowsos fejlesztés](../../docs/windows-development.md).

## Runner kapcsolat

A plugin Go backendje a runner HTTP API-ját hívja. A Grafana nem csatolja a relay konfigurációs kötetét. A cím `jsonData.runnerUrl`, a token `secureJsonData.runnerToken`, az engedélyezett szervezet `jsonData.adminOrgId` (alapérték 1). A token nem kerül a böngészőbe. A `KFGYR_ADMIN_ORG_ID` szerveroldali felülbírálásként használható.

A plugin **Relay kapcsolat** beállítási lapján külön is megadható a kapcsolat. A termelési Compose provisionálja; `managedByDeployment: true` esetén a lap olvasható és kapcsolattesztet kínál. Fejlesztéshez adj meg egy külön runner címet és tokent a figyelmen kívül hagyott helyi `.env` fájlban. Az `npm.cmd run server` ezt használja. A runner külön fut, Linuxon vagy konténerben.

A relay minden agent összes eszközét gyűjti. Az eszközlista aliasokat kezel, nem eszközszűrő. Az agentkonfiguráció mentése relay-újraindítást okoz; a jelkatalógus, a sémák, a megjelenítési egységek és a dashboardok mentése nem indítja újra a relayt. A processz futása nem bizonyítja az adatgyűjtés sikerét.

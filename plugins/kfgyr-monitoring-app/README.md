# KFGyR Monitoring Grafana app

React/TypeScript adminoldal és Go backend MTConnect agentekhez. A plugin a megfelelő Grafana organization Admin szerepéhez kötött; a backend minden végponton ellenőrzi a szerepet és a szervezetet.

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

Környezeti változók a Grafana konténerében:

- `KFGYR_CONFIG_DIR`: közös konfigurációs kötet helye, alapérték `/var/lib/kfgyr-monitoring`.
- `KFGYR_ADMIN_ORG_ID`: engedélyezett Grafana szervezet, alapérték `1`.
- `KFGYR_AGENT_ALLOWED_HOSTS`: engedélyezett hostnevek vesszővel, alapérték `demo.mtconnect.org`.
- `KFGYR_AGENT_ALLOWED_NETWORKS`: engedélyezett IP-hálózatok CIDR formában, vesszővel. Csak a tényleges MTConnect hálózatokat add meg.

A relay minden agent összes eszközét gyűjti. Az eszközlista aliasokat kezel, nem eszközszűrő. A mentés relay-újraindítást okoz. A processz futása nem bizonyítja az adatgyűjtés sikerét.

# KFGyR Monitoring Grafana app

React/TypeScript adminoldal és Go backend MTConnect agentekhez. A plugin a megfelelő Grafana organization Admin szerepéhez kötött; a backend minden végponton ellenőrzi a szerepet és a szervezetet.

Build: `npm ci`, `npm run typecheck`, `npm run build`, majd `go build -o dist/gpx_kfgyr_monitoring_linux_amd64 ./pkg` Linux/amd64 célplatformra (`GOOS=linux`, `GOARCH=amd64`, `CGO_ENABLED=0`). A kiadási workflow további célplatformot is készít és ZIP-be csomagol.

Környezeti változók a Grafana konténerében:

- `KFGYR_CONFIG_DIR`: közös konfigurációs kötet helye, alapérték `/var/lib/kfgyr-monitoring`.
- `KFGYR_ADMIN_ORG_ID`: engedélyezett Grafana szervezet, alapérték `1`.
- `KFGYR_AGENT_ALLOWED_HOSTS`: engedélyezett hostnevek vesszővel, alapérték `demo.mtconnect.org`.
- `KFGYR_AGENT_ALLOWED_NETWORKS`: engedélyezett IP-hálózatok CIDR formában, vesszővel. Csak a tényleges MTConnect hálózatokat add meg.

A relay minden agent összes eszközét gyűjti. Az eszközlista aliasokat kezel, nem eszközszűrő. A mentés relay-újraindítást okoz. A processz futása nem bizonyítja az adatgyűjtés sikerét.

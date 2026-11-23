# Jelkatalógus, sémák, megjelenítési egységek és kezelt dashboardok

Ez a dokumentum a gépadatpontok szabványos magyar elnevezéshez kötését, a gépenkénti dashboardok összeállítását és a Grafana által provisionált gyári dashboardok működését írja le.

## Jelkatalógus és sémák (`/a/kfgyr-monitoring-app/schemas`)

Azonos típusú vagy eltérő vezérlésű gépek MTConnect-adatpontjainak útvonalai különbözhetnek. A rendszer ezért különválasztja a közös magyar jelkatalógust és a gép- vagy gépcsalád-specifikus útvonal-hozzárendeléseket:

- **Jelkatalógus (`kfgyr.signal_catalog`):** egyedi `id`, magyar elnevezés (`name`) és nyers MTConnect-mértékegység (`units`). A létrehozáskor megadott azonosító utólag nem módosítható; egy jel csak akkor törölhető, ha egyetlen sémában vagy dashboardon sem szerepel (`409` válasz).
- **Sémák (`kfgyr.machine_schemas`, `kfgyr.schema_mappings`):** elnevezett hozzárendelési készletek, amelyek egy-egy katalógusjelhez gépen belüli, `/` jellel kezdődő relatív MTConnect-útvonalat rendelnek (például `/Axes/Linear[X]/Position`). Egy sémában egy katalógusjelhez legfeljebb egy útvonal tartozhat, és egy útvonal nem rendelhető két különböző jelhez.
- **Sémamásolás és géphozzárendelés:** új séma üresen vagy meglévő séma és hozzárendelései klónozásával (`source_schema_id`) is létrehozható. Géphez az **Agentek és gépek** oldalon kell sémát választani; a választást a runner a `kfgyr.machine_schema_assignments` táblába tükrözi. A törlés letiltott, amíg a sémához legalább egy gép tartozik.

A **Jelkatalógus** oldal egyetlen táblázatban mutatja a katalógusjeleket és a kiválasztott séma hozzárendelt útvonalait, külön keresőmezővel a jelekre és az adatpont-útvonalakra. A sorok a szabványos MTConnect-komponenságak (`adapters`, `auxiliaries`, `axes`, `controllers`, `interfaces`, `resources`, `structures`, `systems`) szerint kapnak eltérő színjelölést.

Új jel vagy hozzárendelés felvehető kézzel, illetve egy már beolvasott gép még fel nem használt adatpontjából választva. Ha a kiválasztott gépadatpont nyers egysége eltér a katalógusjel mentett egységétől, a felület figyelmeztet, de nem írja felül a katalógusjel egységét.

## Megjelenítési mértékegységek (`kfgyr.display_units`)

Az MTConnect-eszközök az egységeket szabványos kódokkal (például `MILLIMETER`, `REVOLUTION/MINUTE`, `CELSIUS`) közlik. A **Jelkatalógus** oldalsávjában elérhető **Megjelenítési mértékegységek** párbeszédablakban az MTConnect 2.5 `UnitEnum` kódjaihoz rövid magyar vagy műszaki megjelenítési címke adható meg (például `mm`, `rpm`, `°C`). Üresen hagyott címke esetén az eredeti MTConnect-kód jelenik meg. A beállított címkéket a Jelkatalógus, a **Géppark** és a **KFGyR · Monitoring** dashboardok közösen használják.

## Dashboard szerkesztő (`/a/kfgyr-monitoring-app/profiles`)

A **Dashboard szerkesztő** oldalon a beolvasott gépekhez több önálló dashboard hozható létre, szerkeszthető, átnevezhető és törölhető. Új dashboard létrehozásakor kiindulásként választható egy azonos sémához tartozó másik gép (vagy ugyanazon gép) meglévő dashboardja is; a célgépen fel nem oldható panelek kimaradnak, amiről a felület figyelmeztetést ad.

A gép első dashboardja automatikusan alapértelmezett. A **Dashboardok** listában a kitöltött sárga csillag jelöli ezt a nézetet. Egy másik kártya körvonalas csillagával azonnal menthető az új választás. A műveletet a relay `PUT /v1/dashboards/default` végpontja végzi, és gépenként egyetlen `is_default` jelölést tart meg. Ha az alapértelmezett dashboardot törlik, a legrégebben létrehozott megmaradt dashboard lesz az új alapértelmezett.

Egy dashboard panelei négy nézettípusba rendeződnek:

| Nézet (`view`) | Megjelenítés | Külön beállítások |
| --- | --- | --- |
| `state` | Állapotkártya (szöveges állapot) | Opcionális színes állapotidősor (`show_timeline`) a kiválasztott időablakra |
| `value` | Aktuális érték (numerikus) | Automatikus vagy felülírt megjelenítési név |
| `gauge` | Műszer (félköríves skála) | Kötelező `minimum` és `maximum` határértékek |
| `chart` | Idősor grafikon | Választható vonalszín (`blue`, `green`, `orange`, `red`, `purple`, `yellow`) |

A panelek alapértelmezetten a gép sémájában feloldott katalógusjelekre (`signal_id`) hivatkoznak; a korábbi, közvetlen `DataItem` azonosítóra (`point`) mutató panelek továbbra is olvashatók és szerkeszthetők. A mentés a `kfgyr.machine_dashboards` táblában optimista revízióellenőrzést (`409`) használ, és nem indítja újra a relayt.

## Kezelt dashboardok (`dashboards/managed/`)

A gyári dashboardok forrását a `dashboards/build-managed-dashboards.py` generálja a `dashboards/managed/` könyvtárba, és a Grafana Compose csak olvasható (`editable: false`) formában provisionálja őket a **KFGyR** mappába:

1. **KFGyR · Kezdőlap (`home.json`, `kfgyr-home`):** a beágyazott `kfgyr-navigation-panel` segítségével szerepkör-tudatos indítólapot ad. A **Viewer** és névtelen felhasználók az *Eszközök* kártyáit (**Monitoring**, **Géppark**, **Adatexport**) és a *Dokumentáció* (**Használati útmutató**) kártyát látják; a **KFGyR kezelők** és az **Admin** elérik a *Beállítások* (**Agentek és gépek**, **Dashboard szerkesztő**, **Jelkatalógus**) oldalakat is; a **Jogosultságkezelés** kártya kizárólag **Admin** számára jelenik meg.
2. **Géppark (`fleet.json`, `kfgyr-fleet`):** `dashboard.grafana.app/v2` alapú áttekintő dashboard a beágyazott `kfgyr-fleet-panel` használatával. Gépenként az alapértelmezett dashboard első hat állapotpanelének és első három műszerpanelének utolsó ismert értékét mutatja, a mentett panelsorrend szerint. A gépkártya ugyanazt a dashboardot nyitja meg a Monitoringban.
3. **KFGyR · Monitoring (`machine-monitoring.json`, `kfgyr-machine-monitoring`):** `dashboard.grafana.app/v2` séma szerinti részletes gépnézet `Europe/Budapest` időzónával, alapértelmezett `now-5m` időablakkal és `5s` automatikus frissítéssel.
   - A felső sávban a `kfgyr-navigation-panel` (`mode: "monitoring"`) kínál agent-, gép- és dashboardválasztót (keskeny képernyőn kompakt modális választóval), mutatja az agent élő MTConnect-elérhetőségét (`/v1/availability/{machine}`), és jogosult felhasználóknak közvetlen linket ad az aktuális dashboard szerkesztőjébe. Gépváltáskor az alapértelmezett dashboard nyílik meg, a dashboardválasztóval másik nézet is megnyitható.
   - A panelek típus szerint rendezve és ismételve jelennek meg (soronként legfeljebb 6 állapot-/értékpanel, 5 műszer és 4 idősor grafikon), az állapotpanelek alatt az engedélyezett jelek `state-timeline` idősorával.
   - Az oldal alján lévő **Gyors adatpontnézegető** táblázat a kiválasztott időszakon belüli utolsó mintákat sorolja fel a gép valamennyi adatpontjához. A gyors utolsó-minta lekérdezést a `raw.history (node_id, dataitem_id, time DESC)` összetett B-tree index támogatja.

# Döntések a KFGyR monitoring felépítéséről

| Kiinduló igény | Döntés és indok |
|---|---|
| Új gép bekötése után gyorsan legyen használható a megjelenítés. | A géphez rendelt séma feloldja a jelkatalógust annak MTConnect útvonalaival. A panelbeállítások csak a katalógusjeleket és nézeteket tárolják; a tényleges gépadatpontot a séma adja. |
| Azonos típusú gépek adatpontjai eltérhetnek. | A gépenként kiválasztott séma saját, gépen belüli végpontútvonalakat rendel a közös magyar jelkatalógushoz. A közvetlen DataItem-azonosítóra épülő korábbi panelek kompatibilisek maradnak. |
| Több Grafana példány ugyanazt a konfigurációt lássa. | A runner API a konfiguráció írási határa. A plugin ellenőrzi a szervezetet és jogosultságot, a runner validál és ment. A grafanás adatforrás olvasási hozzáféréssel kapja a konfigurációt és a méréseket. |
| Egy grafanás frissítés alatt is fusson az adatgyűjtés. | A relay és a TimescaleDB egy Compose projekt. A Grafana, a plugin és a dashboardok külön projektben vannak. Közöttük a runner API és az olvasási DB-kapcsolat az interfész. |
| GitHubról megismételhető, ellenőrzött legyen a telepítés. | Rögzíthető runner image és `monitoring-assets` init konténer (`install-monitoring-assets.py`), amely SHA-256 ellenőrzéssel telepíti a GitHub Release plugin ZIP-et (alapértelmezetten a legfrissebbet, `KFGYR_PLUGIN_RELEASE` változóval tagre rögzítve). A gyári dashboardok fájlból provisionáltak. |
| A CSV-letöltés legyen közvetlenül elérhető. | Külön pluginoldal saját gép-, jel-, időszak- és formátumválasztóval. A meglévő, olvasási adatforrást használja. A részleges exportot a felület és a fájl is jelzi. |
| Kezelői jogosultság adható legyen Grafana Admin kiadása nélkül. | A `KFGyR kezelők` Grafana csapat tagjainak Grafana szerepe `Viewer` marad (így nem módosíthatják a gyári vagy más Grafana dashboardokat), a Go backend pedig olvasási módban ellenőrzi a csapattagságot a Grafana SQLite adatbázisából, tartós admin hitelesítő adat tárolása nélkül. |
| Egységes, magyar vagy rövidített mértékegységek jelenjenek meg. | A `kfgyr.display_units` tábla központilag tárolja az MTConnect `UnitEnum` kódok megjelenítési címkéit, amelyeket a Jelkatalógus, a Géppark és a Monitoring dashboardok együtt használnak. |
| Szerepkör-tudatos navigáció és géppark-áttekintés dashboardokon belül. | A beágyazott `kfgyr-navigation-panel` és `kfgyr-fleet-panel` az app plugin csomagjában, azonos verzióval érkezik; így a **Kezdőlap**, a **Géppark** és a **KFGyR · Monitoring** dinamikusan igazodik a felhasználó jogosultságához és a gépek állapotához. |
| Ritkán változó jeleknél is gyors legyen az utolsó minta lekérdezése. | A `raw.history` hypertable-ön létrehozott összetett `(node_id, dataitem_id, time DESC)` B-tree index (`history-lookup-index.psql`) megszünteti a nagy időtartamú visszakeresés lassulását. |

## Konfiguráció és életciklus

Az agent és a gép konfigurációja a verziózott konfigurációs köteten marad. Új gép szerkesztésekor kötelező sémát választani az **Agentek és gépek** oldalon; új gépekhez nincs automatikus alapértelmezés. A sémaazonosítót a runner nem adja tovább a relaynek, hanem a `kfgyr.machine_schema_assignments` táblába tükrözi. A magyar jelkatalógus, a megjelenítési egységek, a sémák, az útvonal-hozzárendelések és a gépenkénti több dashboard definíciói külön SQL-táblákban élnek (`kfgyr.*`). A dashboardpanel katalógusjelet, opcionális névfelülírást, nézetet és megjelenítési beállításokat (például műszerhatárok, grafikon-vonalszín, opcionális állapotidősor) tárol. A gépnézet a jelhez rendelt, ténylegesen létező adatpontot oldja fel. A dashboard, a jelkatalógus, a sémák és a megjelenítési egységek mentése nem indítja újra a relayt; a dashboard mentése optimista revízióellenőrzést használ.

## Későbbi fejlesztés

Új Grafana példány egyetlen runner kapcsolattal történő bekötése. Az egyik út a csak olvasó PostgreSQL adatforrás beállítása a runner által átadott kapcsolati adatokból. A másik egy saját Grafana adatforrás, amely az adatokat is a runner API-járól kéri. A jelenlegi telepítésben a runner API és az olvasási adatforrás címe külön megadható.

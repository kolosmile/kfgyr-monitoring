# Döntések a KFGyR monitoring felépítéséről

| Kiinduló igény | Döntés és indok |
|---|---|
| Új gép bekötése után gyorsan legyen használható a megjelenítés. | A géphez rendelt séma feloldja a jelkatalógust annak MTConnect útvonalaival. A panelsablon csomag csak a katalógusjeleket sorolja fel; a tényleges gépadatpontot a séma adja. |
| Azonos típusú gépek adatpontjai eltérhetnek. | A gépenként kiválasztott séma saját, gépen belüli végpontútvonalakat rendel a közös magyar jelkatalógushoz. A közvetlen DataItem-azonosítóra épülő korábbi panelek kompatibilisek maradnak. |
| Több Grafana példány ugyanazt a konfigurációt lássa. | A runner API a konfiguráció írási határa. A plugin ellenőrzi az admin szerepet, a runner validál és ment. A grafanás adatforrás olvasási hozzáféréssel kapja a konfigurációt és a méréseket. |
| Egy grafanás frissítés alatt is fusson az adatgyűjtés. | A relay és a TimescaleDB egy Compose projekt. A Grafana, a plugin és a dashboardok külön projektben vannak. Közöttük a runner API és az olvasási DB-kapcsolat az interfész. |
| GitHubról megismételhető legyen a telepítés. | Rögzített runner image és plugin ZIP verzió, hivatalos Grafana image és fájlból provisionált gyári dashboardok. A dashboardok módosítása a repóba kerül. A saját Grafana dashboardok külön kezelhetők. |
| A CSV-letöltés legyen közvetlenül elérhető. | Külön pluginoldal saját gép-, jel-, időszak- és formátumválasztóval. A meglévő, olvasási adatforrást használja. A részleges exportot a felület és a fájl is jelzi. |

## Konfiguráció és életciklus

Az agent és a gép konfigurációja a verziózott konfigurációs köteten marad. Géphez sémát kell választani az Agentek és gépek szerkesztőben; az új gépekhez nincs automatikus alapértelmezés. A sémaazonosítót a runner nem adja tovább a relaynek, hanem a `kfgyr.machine_schema_assignments` táblába tükrözi. A magyar jelkatalógus, sémák és útvonal-hozzárendelések külön SQL-táblákban élnek. A dashboardpanel katalógusjelet, opcionális névfelülírást, nézetet és megjelenítési beállításokat tárol. A gépnézet a jelhez rendelt, ténylegesen létező adatpontot oldja fel. A dashboard mentése ellenőrzi a revíziót, és nem indítja újra a relayt.

## Későbbi fejlesztés

Új Grafana példány egyetlen runner kapcsolattal történő bekötése. Az egyik út a csak olvasó PostgreSQL adatforrás beállítása a runner által átadott kapcsolati adatokból. A másik egy saját Grafana adatforrás, amely az adatokat is a runner API-járól kéri. A jelenlegi telepítésben a runner API és az olvasási adatforrás címe külön megadható.

# Döntések a KFGyR monitoring felépítéséről

| Kiinduló igény | Döntés és indok |
|---|---|
| Új gép bekötése után gyorsan legyen használható a megjelenítés. | A CNC eszterga és megmunkálóközpont sablonja szerkeszthető paneljavaslatokat ad. Bármely gép üres listáról is beállítható. |
| Azonos típusú gépek adatpontjai eltérhetnek. | A géphez mentett lista soronként nevet, adatpontot és nézetet tárol. A Grafana nézetenként ismétli a megfelelő sablonpanelt, a mentett sorrendet a nézeten belül követve. |
| Több Grafana példány ugyanazt a konfigurációt lássa. | A runner API a konfiguráció írási határa. A plugin ellenőrzi az admin szerepet, a runner validál és ment. A grafanás adatforrás olvasási hozzáféréssel kapja a konfigurációt és a méréseket. |
| Egy grafanás frissítés alatt is fusson az adatgyűjtés. | A relay és a TimescaleDB egy Compose projekt. A Grafana, a plugin és a dashboardok külön projektben vannak. Közöttük a runner API és az olvasási DB-kapcsolat az interfész. |
| GitHubról megismételhető legyen a telepítés. | Rögzített runner image és plugin ZIP verzió, hivatalos Grafana image és fájlból provisionált gyári dashboardok. A dashboardok módosítása a repóba kerül. A saját Grafana dashboardok külön kezelhetők. |
| A CSV-letöltés legyen közvetlenül elérhető. | Külön pluginoldal saját gép-, jel-, időszak- és formátumválasztóval. A meglévő, olvasási adatforrást használja. A részleges exportot a felület és a fájl is jelzi. |

## Konfiguráció és életciklus

A runner az adatgyűjtési beállításokat a verziózott konfigurációs köteten, a monitoring panellistát pedig a `kfgyr.machine_monitoring` táblában tárolja, agent alias és eszközazonosító szerint. A régi jel-hozzárendeléseket beolvassa, és a következő mentés már a panellistát tárolja. A sablon alkalmazása csak sorokat másol a szerkesztőbe. A mentés ellenőrzi a revíziót, és nem indítja újra a relayt.

## Későbbi fejlesztés

Új Grafana példány egyetlen runner kapcsolattal történő bekötése. Az egyik út a csak olvasó PostgreSQL adatforrás beállítása a runner által átadott kapcsolati adatokból. A másik egy saját Grafana adatforrás, amely az adatokat is a runner API-járól kéri. A jelenlegi telepítésben a runner API és az olvasási adatforrás címe külön megadható.

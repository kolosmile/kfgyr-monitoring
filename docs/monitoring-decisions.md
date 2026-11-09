# Döntések a KFGyR monitoring felépítéséről

| Kiinduló igény | Döntés és indok |
|---|---|
| Új gép bekötése után gyorsan legyen használható a megjelenítés. | Egy gépválasztós dashboard és előre definiált profilok. A géphez rendelt jelek alapján a Grafana ismételt grafikonokat hoz létre. Egy új gép meglévő profilt és kártyákat használhat. |
| Azonos típusú gépek adatpontjai eltérhetnek. | A profilkatalógus a runner forrásában van verziózva. A gép konkrét hozzárendelése normál PostgreSQL táblában él. A dashboardgenerátor ugyanazt a katalógust olvassa, így a stabil profil- és jelazonosítók együtt változnak a kóddal. |
| Több Grafana példány ugyanazt a konfigurációt lássa. | A runner API a konfiguráció írási határa. A plugin ellenőrzi az admin szerepet, a runner validál és ment. A grafanás adatforrás olvasási hozzáféréssel kapja a konfigurációt és a méréseket. |
| Egy grafanás frissítés alatt is fusson az adatgyűjtés. | A relay és a TimescaleDB egy Compose projekt. A Grafana, a plugin és a dashboardok külön projektben vannak. Közöttük a runner API és az olvasási DB-kapcsolat az interfész. |
| GitHubról megismételhető legyen a telepítés. | Rögzített runner image és plugin ZIP verzió, hivatalos Grafana image és fájlból provisionált gyári dashboardok. A dashboardok módosítása a repóba kerül. A saját Grafana dashboardok külön kezelhetők. |
| A CSV-letöltés legyen közvetlenül elérhető. | Külön pluginoldal saját gép-, jel-, időszak- és formátumválasztóval. A meglévő, olvasási adatforrást használja. A részleges exportot a felület és a fájl is jelzi. |

## Konfiguráció és életciklus

A runner adatgyűjtési beállítása továbbra is a verziózott konfigurációs köteten van. A `kfgyr.machine_monitoring` a gép profilját és a jelekhez kiválasztott adatpontokat tárolja `agent_alias` és `device_id` szerint. A jelazonosítók a relay metaadataira mutatnak. Agent alias vagy eszközazonosító változtatásakor a hozzárendelést az új identitásnál újra meg kell adni. A profil felviteléhez a gép metaadatainak előbb meg kell jelenniük a DB-ben. A mentés ellenőrzi a revíziót, és nem indítja újra a relayt.

## Későbbi fejlesztés

Új Grafana példány egyetlen runner kapcsolattal történő bekötése. Az egyik út a csak olvasó PostgreSQL adatforrás beállítása a runner által átadott kapcsolati adatokból. A másik egy saját Grafana adatforrás, amely az adatokat is a runner API-járól kéri. A jelenlegi telepítésben a runner API és az olvasási adatforrás címe külön megadható.

# KFGyR Monitoring

MTConnect-alapú gépmonitoring Grafanával, Ladder99 Relay adatgyűjtéssel és TimescaleDB adattárolással.

A tervezett bővítés célja, hogy a monitoring admin a Grafanából kezelhesse az agenteket és eszközöket, Coolify-hozzáférés nélkül.

## Állapot

A repository a fejlesztés dokumentációs alapja. A Grafana plugin, a konfigurációkezelés és a relay indítóprogramja még nincs implementálva. A korábban telepített monitoring stack ettől a repositorytól függetlenül működik.

## Tervezett működés

- Grafana app plugin: agentek és eszközök listázása, felvétele és módosítása.
- Szerveroldali jogosultságellenőrzés: a konfigurációt a megfelelő Grafana organization Admin módosíthatja.
- Tartós konfiguráció: verziózott `setup.yaml` külön kötetben, a Compose-ba ágyazott tartalom helyett.
- Relay indítóprogram: a jóváhagyott konfiguráció alkalmazása a relay folyamatának újraindításával.
- Megtekintés: Grafana Viewer szerep, igény szerint névtelen Viewer hozzáférés.

A konfiguráció alkalmazásával járó relay-újraindítás átmeneti adatgyűjtési kiesést okozhat. A teljes eseménytörténet pótlását külön kell megoldani, ha az üzemi követelmény.

## Dokumentáció

- [A Grafana app plugin felépítése és telepítése](docs/grafana-app.md)
- [Nyilvános MTConnect példa konfiguráció](examples/setup.example.yaml)

## Helyi és üzemi adatok

A repository csak forráskódot, dokumentációt és példakonfigurációt tartalmazzon. Az üzemi jelszavak, tokenek, gépcímek, adatbázismentések és futás közben módosuló konfigurációk helyi vagy telepítési beállítások. A `.gitignore` ezek tipikus helyeit kizárja; a commitba kerülő fájlokat publikálás előtt át kell nézni.

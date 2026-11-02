# Szakdolgozat rövid vázlat

**Téma:** Gyártórendszer monitoring szoftver fejlesztése és implementálása a BME Kiber-Fizikai Gyártórendszer berendezéseire

## 1. Bevezetés és célkitűzések

A téma jelentősége és a BME Kiber-Fizikai Gyártórendszer monitoringfeladata. A megoldandó probléma, a célkitűzések, a feladat lehatárolása és az alkalmazott munkamódszer.

## 2. Gyártórendszerek felügyelete és az alkalmazható megoldások

- A felügyeleti szoftverek jellemző funkciói és elemzési szolgáltatásai: gépállapotok, idősorok, állásidők, kihasználtság, riasztások és riportok.
- Ipari monitoringrendszerek összehasonlítása; szabványos adatkapcsolatok és az MTConnect szerepe.
- Az MTConnect felépítése és adatmodellje, valamint az alkalmazható szoftveres megoldások áttekintése.

## 3. A KFGyR felmérése és a monitoringrendszer tervezése

- A kijelölt berendezések, adatkapcsolatok és a korábbi Python/Dash monitoringrendszer bemutatása; a továbbfejlesztési igények azonosítása.
- Funkcionális és üzemeltetési követelmények meghatározása.
- A megoldásváltozatok értékelése, a Ladder99–TimescaleDB–Grafana rendszer választásának indoklása és a célarchitektúra bemutatása.

## 4. A monitoringrendszer megvalósítása

- Berendezések MTConnect-kapcsolatainak kialakítása, adatgyűjtés, metaadatok és történeti adatok tárolása.
- Saját Grafana-bővítmény és relay-runner: agentkezelés, hálózati felderítés, konfigurációverziók, jogosultságok és hibakezelés.
- Gépállapotok, idősorok és események megjelenítése; adatpontválasztás, ritkán változó jelek és adathiány kezelése.
- Konténeres telepítés, tartós adattárolás és távoli hozzáférés.

## 5. Ellenőrzés, elemzés és távoli bemutató

- Vizsgálati környezet, tesztmódszer és elfogadási feltételek.
- Az eszközkapcsolatok, adatgyűjtés, konfigurációkezelés és hozzáférési jogosultságok ellenőrzése; újraindítás és kapcsolatvesztés vizsgálata.
- Adatminőség és folytonosság értékelése, egy konkrét elemzési példa, valamint a távoli bemutató menete.
- A mért eredmények és a megoldás korlátainak értékelése, a laboradatok és a demonstrációs tesztadatok elkülönítésével.

## 6. Összefoglalás és következtetések

A saját mérnöki munka és az elért eredmények összefoglalása. A feladatkiírás négy pontjának teljesülése, a fennmaradó korlátok és a továbbfejlesztési lehetőségek.

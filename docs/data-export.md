# Adatexport a Grafana appból

A **KFGyR · Kezdőlap → Adatexport** kártya a plugin `/a/kfgyr-monitoring-app/export` oldalára visz. Az export a Grafana `timescaledb` adatforrásával működik, ugyanazokkal az adatolvasási jogosultságokkal, mint a dashboardok.

1. Válassz legalább egy gépet és adatpontot. A géplista a tárolt gépeket tartalmazza. Az adatpontlista a kiválasztott gépekhez igazodik.
2. Add meg a kezdő- és végidőt a böngésző helyi időzónájában. A kezdőidő beleértendő, a végidő kizáró határ.
3. Válassz sorkorlátot és formátumot, majd kattints a **CSV letöltése** gombra. Az Excelhez formázott CSV pontosvesszős, UTF-8 BOM-mal.
4. Részleges export esetén a fájl az időben első N sort tartalmazza, a felület és a fájl is jelzi a korlátozást. Nagy időszakot bonts kisebb intervallumokra.

Egy sor egy tárolt megfigyelés. A CSV tartalmazza az UTC-időpontot, a gépet, az adatpontot, az MTConnect azonosítót, a kategóriát, típust, mértékegységet, értéket és a teljesség jelzését. A lekérdezés növekvő időrendben adja az eredményt. A teljes lekérdezés az adatbázisban elérhető adatokra vonatkozik. Az export a böngészőben állítja össze a fájlt, és legfeljebb 100 000 sort ad egy letöltésben.

A korábbi natív dashboard a meglévő telepítéseken megmaradhat történeti nézetként. A gyári kezdőlap a plugin export oldalára mutat.

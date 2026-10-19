# Agentek és gépek kezelése

A Grafana app agentlistája név, URL, eszköznév és MTConnect eszközazonosító alapján kereshető. A szűrő az engedélyezett és szüneteltetett agenteket külön is megjeleníti. Az „Engedélyezve” az agent konfigurációja; az adatbeérkezés ellenőrzésére a dashboard szolgál. A felső állapotjelzés a relay folyamatának és a mentett konfiguráció alkalmazásának állapotát mutatja.

## Szerkesztés és mentés

1. Az „Agent hozzáadása” vagy „Szerkesztés” külön űrlapot nyit.
2. Add meg az agent nevét és HTTP/HTTPS címét. IP-cím és port is használható. A névnek egyedinek kell lennie.
3. A „Kapcsolat és eszközkeresés” a szerverről kérdezi le az agentet. A megtalált eszközökhöz megjelenítési név adható; az URL módosítása érvényteleníti az előző keresés eredményét.
4. A „Hozzáadás a listához” vagy „Módosítás a listában” helyi, még nem alkalmazott változtatást készít. Az agentkártya jelzi az új vagy módosított állapotot.
5. Az alsó mentési sáv „Mentés és alkalmazás” gombja változásösszesítőt nyit. Megerősítés után a runner API menti a konfigurációt, és a runner újraindítja a relayt.

Az „Elvetés” a legutóbb mentett konfigurációt tölti be. Az űrlap módosítása után a „Mégse” és a bezárás külön rákérdez az elvetésre. Az oldal újratöltése vagy bezárása előtt a böngésző figyelmeztet a nem mentett változtatásokra. A Grafanán belüli másik oldalra navigálás előtt mindig ments vagy vess el minden módosítást.

A már mentett agentnevek és eszközaliasok az adatbázis azonosításának részei, ezért rögzítettek. A relay az agent összes eszközét olvassa; a névlista szerkesztése nem eszközönkénti adatgyűjtési szűrő. Az agent teljes adatgyűjtése az engedélyezés kapcsolójával szüneteltethető.

A monitoring neve és időzónája a „Monitoring beállításai” ablakban módosítható, ugyanazzal a mentési folyamattal. A technikai állapot és az utolsó mentett YAML külön lenyitható részben található.

## Ellenőrzés a 0.2.0 kiadáshoz

Windowsos TypeScript-ellenőrzés, célzott ESLint és production build mellett külön Grafana 13.0.2 tesztpéldányban, a konfiguráció elkülönített másolatán ellenőriztük:

- agent hozzáadása, eszközfelderítés, név felvétele, mentés és eltávolítás;
- kötelező mezők, ismétlődő agentnév és hibás időzóna visszajelzése;
- félbehagyott űrlap elvetése és a szerkesztés folytatása;
- keresés és találat nélküli állapot;
- asztali és 390 pixel széles mobilos elrendezés, látható űrlapgombok és görgetés.

A tesztpéldányban nem futott külön relay-adatgyűjtés. A konfiguráció mentését és a felületet itt ellenőriztük; az éles relay működését a telepítés után külön ellenőrizzük.

## Hálózati keresés (0.3.0)

A felső **Hálózati keresés** gomb a runner által felismert LAN-t kínálja fel. Válassz legfeljebb /24 méretű tartományt és 1–8 portot. A keresés előrehaladása látható, megszakítható, bezárás után az utolsó eredmény visszatölthető. A találat **Agent beállítása** gombja megnyitja a szokásos szerkesztőt; a keresés önmagában nem módosítja a konfigurációt. A keresés mindig a relay-runner hálózatán történik, akkor is, ha a Grafana más gépen fut.

A kapcsolat a plugin **Relay kapcsolat** beállítási lapján ellenőrizhető. A Coolify által provisionált cím és token ott nem szerkeszthető. Viewer és névtelen látogató a dashboardot olvashatja; az agentkezelő API minden művelete Admin jogot igényel.

## API integráció ellenőrzése a 0.3.0 kiadáshoz

A Python API tesztjei és a Go proxy tesztjei mellett elkülönített Grafana 13.0.2 + runner konténerekkel ellenőriztük a token titkos tárolását, a névtelen kérés elutasítását, a host LAN felismerését, egy valódi HTTP tesztagent hálózati megtalálását, a konfiguráció API-n keresztüli mentését és alkalmazását, az elavult verzió 409 válaszát és a korábbi konfiguráció visszaállítását. A relay-életciklus külön Docker tesztje a korai hibát, az újraindítás utáni helyreállást és a szabályos leállást is ellenőrzi. A tesztagent és a tesztkonfiguráció elkülönül az üzemi adatgyűjtéstől.

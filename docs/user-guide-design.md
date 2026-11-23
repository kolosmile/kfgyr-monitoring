# A beépített Használati útmutató tervezési elvei és forrásai

A Grafana app `/a/kfgyr-monitoring-app/guide` oldala kifejezetten a végfelhasználók (gépkezelők, műszaki munkatársak, kezelők és adminisztrátorok) számára készült, technológiai és implementációs részletek nélkül. Az útmutató felépítése az alábbi nemzetközi szabványokra és iparági dokumentációs elvekre épül:

## Módszertani alapok

1. **ISO/IEC/IEEE 26514:2022 (*Systems and software engineering — Design and development of information for users*):**
   - A felhasználói dokumentáció felépítése a felhasználói szerepkörökhöz és tényleges munkafolyamatokhoz igazodik, nem a szoftver belső modulhatáraihoz.
   - Követelmény az egységes, a felülettel szó szerint egyező terminológia, a világos feladatfelosztás, a figyelmeztetések kiemelése és a szoftververzióval szinkronban tartott felülvizsgálat.
2. **Diátaxis dokumentációs keretrendszer (Daniele Procida):**
   - A tartalom szigorúan elkülöníti a műfajokat a felhasználói szándék szerint: gyors áttekintés (*Első lépések*), lépésről lépésre szóló feladatleírások (*Hogyan csináljam* és oldalszintű munkafolyamatok), valamint pontos felületi jelmagyarázat (*Referencia*).
3. **Feladat-orientált szerkesztés és áttekinthető felületi jelölések:**
   - Sorszámozott lépéssorok, lépésenként egy művelet, a felülettel megegyező gomb- és menüjelölések (ikonos inline címkék, valamint valódi állapotjelzők a Géppark és Monitoring nézeteknél).
   - Egységes, letisztult tájékoztató és figyelmeztető kiemelések (**Tipp**, **Megjegyzés**, **Figyelmeztetés**).
   - Kétoszlopos wiki-elrendezés keretezett oldalsó tartalomjegyzékkel és keret nélküli, kényelmesen olvasható tartalommal a Grafana aktív világos vagy sötét témájához igazodva.
4. **Szerepkör-alapú láthatóság:**
   - A wiki bal oldali tartalomjegyzéke, keresője, fejezetlépkedése és oldalreferenciái csendben, automatikusan igazodnak a felhasználó jogosultságához (`Viewer` / `KFGyR kezelők` / `Admin`), így mindenki csak az általa elérhető funkciók leírását látja.

## Hivatkozott források

- **ISO/IEC/IEEE (2022):** *ISO/IEC/IEEE 26514:2022 — Systems and software engineering — Design and development of information for users*. Genf: International Organization for Standardization / IEEE. Elérhető: https://www.iso.org/standard/77451.html (Hozzáférés: 2026-11-22).
- **Procida, D. (2024):** *Diátaxis — A systematic approach to technical documentation authoring*. Elérhető: https://diataxis.fr/ (Hozzáférés: 2026-11-22).
- **Microsoft (2024):** *Microsoft Writing Style Guide — Procedures and instructions / Screenshots and callouts*. Elérhető: https://learn.microsoft.com/en-us/style-guide/procedures-instructions/writing-step-by-step-instructions (Hozzáférés: 2026-11-22).

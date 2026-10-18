# Relay runner

A gyári `ladder99/relay:0.11.7` image alkalmazását használó Python felügyelő. A relay forrását nem módosítja és nem másolja a repositoryba. A Docker build az upstream image `/usr/app` könyvtárát függőségeivel együtt Debian 12 / Node.js 22 futtatókörnyezetbe emeli át, mert a gyári Debian 11 csomagarchívumainak egy része már nem elérhető.

A `KFGYR_CONFIG_DIR` közös köteten olvassa a `desired.json` manifestet és a `revisions/<revision>.yaml` konfigurációt, ellenőrzi a SHA-256 értéket és a gyári YAML parserrel a szintaxist. A relay privát futásidejű mappából olvas; a megosztott kötetben nincs részlegesen írt aktív YAML.

Változáskor a relay folyamatcsoportját SIGTERM jelzéssel leállítja, 15 másodperc után szükség esetén SIGKILL következik. A validált új konfigurációval indít. A korai kilépés sikertelen alkalmazást jelent, ekkor visszaállhat az utolsó stabilan futó verzióra. A `status.json` az alkalmazott és kért verziót külön jelzi. Hibás verziót nem próbál újra minden másodpercben; új konfigurációverzió szükséges.

A futó állapot csak élő folyamatot igazol. Agent-elérhetőséget és sikeres adatbázisírást nem garantál. A relay induláskori current/sample viselkedése miatt az újraindítás alatti teljes történet pótlása nem garantált.

Beállítások: `KFGYR_CONFIG_DIR`, `KFGYR_RELAY_RUNTIME_DIR`, `KFGYR_RELAY_STARTUP_SECONDS`. A PostgreSQL és FETCH környezeti változókat változtatás nélkül továbbadja a gyermekfolyamatnak. Nincs HTTP port, Docker socket vagy Coolify token.

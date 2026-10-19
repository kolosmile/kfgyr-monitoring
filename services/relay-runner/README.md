# Relay runner 0.3.0

A gyári `ladder99/relay:0.11.7` image alkalmazását használó Python felügyelő. A relay forrását nem módosítja és nem másolja a repositoryba. A Docker build az upstream image `/usr/app` könyvtárát függőségeivel együtt Debian 12 / Node.js 22 futtatókörnyezetbe emeli át, mert a gyári Debian 11 csomagarchívumainak egy része már nem elérhető.

A `KFGYR_CONFIG_DIR` saját tartós kötetén olvassa a `desired.json` manifestet és a `revisions/<revision>.yaml` konfigurációt, ellenőrzi a SHA-256 értéket és a gyári YAML parserrel a szintaxist. A relay privát futásidejű mappából olvas; a tartós kötetben nincs részlegesen írt aktív YAML.

Változáskor a relay folyamatcsoportját SIGTERM jelzéssel leállítja, 15 másodperc után szükség esetén SIGKILL következik. A validált új konfigurációval indít. A korai kilépés sikertelen alkalmazást jelent, ekkor visszaállhat az utolsó stabilan futó verzióra. A `status.json` az alkalmazott és kért verziót külön jelzi. Hibás verziót nem próbál újra minden másodpercben; új konfigurációverzió szükséges.

A futó állapot csak élő folyamatot igazol. Agent-elérhetőséget és sikeres adatbázisírást nem garantál. A relay induláskori current/sample viselkedése miatt az újraindítás alatti teljes történet pótlása nem garantált.

## API és működés

A Python FastAPI API és a relay folyamatfelügyelete egy konténerben fut. A Grafana HTTP-n kapcsolódik; nem kell közös konfigurációs kötet. A konténer `1000:0` felhasználóként fut, Docker socket és Coolify token nélkül. A token nem kerül a relay gyermekfolyamatának környezetébe.

- `KFGYR_CONFIG_DIR`: tartós konfiguráció, alapérték `/var/lib/kfgyr-monitoring`.
- `KFGYR_RELAY_RUNTIME_DIR`: privát aktív YAML, alapérték `/run/kfgyr-relay`.
- `KFGYR_RELAY_STARTUP_SECONDS`: indulási ellenőrzés, alapérték 10.
- `KFGYR_RUNNER_API_TOKEN`: legalább 32 karakter, a Grafana secureJsonData tokenjével egyező titok.
- `KFGYR_RUNNER_API_BIND`, `KFGYR_RUNNER_API_PORT`: alapérték `0.0.0.0`, `8091`.
- `KFGYR_HOST_ROUTES_FILE`: a host útvonaltáblájának csak olvasható csatolása.
- `KFGYR_AGENT_ALLOWED_HOSTS`, `KFGYR_AGENT_ALLOWED_NETWORKS`: kézi agentcímek engedélyezése.
- `KFGYR_DISCOVERY_NETWORKS`: a felismert LAN mellett külön engedélyezett IPv4 keresési hálózatok.

A PostgreSQL és FETCH változókat továbbadja a relaynek. A Compose nem publikálja az API-portot a hoston.

Fejlesztéshez Python 3.11+, `pip install -r requirements-dev.txt`, majd `python -m unittest -v`. Az API Windows alatt is fejleszthető; a teljes folyamatfelügyelet Linuxot és az upstream Node alkalmazást igényli. Docker integráció: `sudo python3 smoke_test.py <image>`.

Részletes protokoll: [Runner API](../../docs/runner-api.md).

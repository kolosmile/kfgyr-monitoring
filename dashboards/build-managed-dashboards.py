"""Generate the Grafana dashboards provisioned by the Grafana Compose project."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PROFILES = json.loads((ROOT.parent / "services/relay-runner/profiles.json").read_text(encoding="utf-8"))
OUTPUT = ROOT / "managed"
DS = {"type": "grafana-postgresql-datasource", "uid": "timescaledb"}
APP = "/a/kfgyr-monitoring-app"


def panel(id, title, kind, x, y, w, h, content=None, sql=None, fmt="table"):
    result = {"id": id, "type": kind, "title": title,
              "gridPos": {"x": x, "y": y, "w": w, "h": h}, "options": {}}
    if content:
        result["options"] = {"mode": "markdown", "content": content}
    if sql:
        result["datasource"] = DS
        result["targets"] = [{"refId": "A", "format": fmt, "rawQuery": True,
                              "rawSql": sql, "editorMode": "code", "datasource": DS}]
    return result


def dashboard(uid, title, panels, variables=()):
    return {"uid": uid, "title": title, "schemaVersion": 41, "editable": False,
            "tags": ["KFGyR"], "timezone": "Europe/Budapest", "refresh": "",
            "time": {"from": "now-15m", "to": "now"}, "panels": panels,
            "templating": {"list": list(variables)}}


def variable(name, label, sql, multi=False, hide=0):
    return {"name": name, "label": label, "type": "query", "datasource": DS,
            "query": sql, "definition": sql, "refresh": 1, "sort": 1,
            "multi": multi, "includeAll": multi, "hide": hide, "skipUrlSync": bool(hide),
            "current": {"text": ["All"], "value": ["$__all"]} if multi else {}, "options": []}


def quote(value):
    return "'" + value.replace("'", "''") + "'"


MACHINE = """
SELECT d.node_id, d.props, m.profile, m.signals
FROM raw.nodes d LEFT JOIN kfgyr.machine_monitoring m
  ON m.agent_alias=d.props->>'agentAlias' AND m.device_id=d.props->>'deviceId'
WHERE d.props->>'node_type'='Device' AND d.node_id::text=${machine:sqlstring}
"""
CATALOG = ", ".join(
    f"({quote(profile)}, {quote(slot)}, {quote(label)})"
    for profile, info in PROFILES.items() for slot, label in info["signals"].items()
)
PROFILE_LABELS = "CASE m.profile " + " ".join(
    f"WHEN {quote(key)} THEN {quote(info['label'])}" for key, info in PROFILES.items()
) + " ELSE coalesce(m.profile, 'Általános') END"
MAPPED = f"""
WITH machine AS ({MACHINE}), catalog(profile, slot, label) AS (VALUES {CATALOG})
SELECT m.node_id AS device, n.node_id AS signal, c.slot, c.label, n.props->>'units' AS units
FROM machine m JOIN catalog c ON c.profile=coalesce(m.profile,'generic')
JOIN raw.nodes n ON n.node_id::text=m.signals->>c.slot AND n.props->>'node_type'='DataItem'
 AND n.props->>'agentAlias'=m.props->>'agentAlias' AND n.props->>'deviceId'=m.props->>'deviceId'
"""
home = dashboard("kfgyr-home", "KFGyR · Kezdőlap", [
    panel(1, "KFGyR · MONITORING", "text", 0, 0, 24, 3,
          "## Gépmonitoring\nGépek élő állapota, mérési adatai és adatexportja egy helyen."),
    panel(2, "GÉPMONITORING", "text", 0, 3, 16, 6,
          "### Gépek megtekintése\nVálassz gépet a legfrissebb állapot, a hozzárendelt jelek és azok idősorainak megtekintéséhez.\n\n"
          "[**Gépmonitoring megnyitása →**](/d/kfgyr-machine-monitoring)"),
    panel(3, "ADATEXPORT", "text", 16, 3, 8, 6,
          f"### Mérési adatok letöltése\nÁllítsd össze az exportot gép, adatpont és időszak alapján.\n\n"
          f"[**Export összeállítása →**]({APP}/export)"),
    panel(4, "01 · GÉP BEKÖTÉSE", "text", 0, 9, 12, 4,
          f"### Agent és gép csatlakoztatása\nAdd meg az MTConnect-agent elérését, majd kapcsold be a gép adatgyűjtését.\n\n"
          f"[Agentek és gépek megnyitása →]({APP}/agents)"),
    panel(5, "02 · PROFIL ÉS JELEK", "text", 12, 9, 12, 4,
          f"### Gépprofil beállítása\nAz első adatbeolvasás után válaszd ki a profilt és a megjelenítendő jeleket.\n\n"
          f"[Gépprofilok megnyitása →]({APP}/profiles)"),
])
summary = panel(2, "Kiválasztott gép", "table", 0, 3, 24, 4, sql=f"""
WITH machine AS ({MACHINE})
SELECT m.props->>'path' AS "Gép", {PROFILE_LABELS} AS "Profil",
 (SELECT h.time FROM raw.history h WHERE h.node_id=m.node_id ORDER BY h.time DESC LIMIT 1)
 AS "Utolsó minta"
FROM machine m
""")
latest = panel(3, "Hozzárendelt jelek", "table", 0, 7, 24, 7, sql=f"""
WITH mapped AS ({MAPPED})
SELECT m.label AS "Jel", h.value #>> '{{}}' AS "Érték", m.units AS "Mértékegység",
 h.time AS "Időpont"
FROM mapped m LEFT JOIN LATERAL (
 SELECT time, value FROM raw.history WHERE node_id=m.device AND dataitem_id=m.signal
 ORDER BY time DESC LIMIT 1
) h ON true ORDER BY 1
""")
chart = panel(4, "${slot:text}", "timeseries", 0, 14, 12, 8, sql=f"""
WITH mapped AS ({MAPPED})
SELECT h.time, CASE WHEN (h.value #>> '{{}}') ~ '^[+-]?[0-9]+([.][0-9]+)?([eE][+-]?[0-9]+)?$'
 THEN (h.value #>> '{{}}')::double precision END AS value
FROM mapped m JOIN raw.history h ON h.node_id=m.device AND h.dataitem_id=m.signal
WHERE m.slot IN (${{slot:sqlstring}}) AND $__timeFilter(h.time) ORDER BY 1
""", fmt="time_series")
chart.update(repeat="slot", repeatDirection="h", maxPerRow=2)
monitoring = dashboard("kfgyr-machine-monitoring", "KFGyR · Gépmonitoring", [
    panel(1, "", "text", 0, 0, 24, 3,
          f"[Kezdőlap](/d/kfgyr-home) · [Adatexport]({APP}/export) · [Gépprofilok]({APP}/profiles)\n\n"
          "A grafikonok a géphez hozzárendelt számértékű jelekhez jelennek meg. A szöveges jelek a táblában olvashatók."),
    summary, latest, chart,
], [
    variable("machine", "Gép", "SELECT props->>'path' AS __text, node_id::text AS __value FROM raw.nodes WHERE props->>'node_type'='Device' ORDER BY 1"),
    variable("slot", "Jel", f"WITH mapped AS ({MAPPED}) SELECT label AS __text, slot AS __value FROM mapped WHERE slot NOT IN ('execution') ORDER BY 1", multi=True, hide=2),
])

if __name__ == "__main__":
    OUTPUT.mkdir(exist_ok=True)
    for filename, model in [("home.json", home), ("machine-monitoring.json", monitoring)]:
        (OUTPUT / filename).write_text(json.dumps(model, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

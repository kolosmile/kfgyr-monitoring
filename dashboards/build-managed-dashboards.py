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
MAPPED = f"""
WITH machine AS ({MACHINE}), catalog(profile, slot, label) AS (VALUES {CATALOG})
SELECT m.node_id AS device, n.node_id AS signal, p.position, p.name,
 p.view, p.minimum, p.maximum, n.props->>'units' AS units
FROM machine m
CROSS JOIN LATERAL (
 SELECT item->>'name' AS name, item->>'point' AS point, item->>'view' AS view,
        (item->>'minimum')::double precision AS minimum,
        (item->>'maximum')::double precision AS maximum, ord AS position
 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(m.signals)='array' THEN m.signals ELSE '[]'::jsonb END)
      WITH ORDINALITY AS items(item, ord)
 UNION ALL
 SELECT c.label, m.signals->>c.slot, CASE WHEN c.slot='execution' THEN 'state' ELSE 'chart' END,
        NULL, NULL, row_number() OVER (ORDER BY c.slot)
 FROM catalog c WHERE c.profile=m.profile AND jsonb_typeof(m.signals)='object'
) p
JOIN raw.nodes n ON n.node_id::text=p.point AND n.props->>'node_type'='DataItem'
 AND n.props->>'agentAlias'=m.props->>'agentAlias' AND n.props->>'deviceId'=m.props->>'deviceId'
"""
home = dashboard("kfgyr-home", "KFGyR · Kezdőlap", [
    panel(1, "", "text", 0, 0, 12, 4,
          "# [📈 Gépmonitoring](/d/kfgyr-machine-monitoring)"),
    panel(2, "", "text", 12, 0, 12, 4,
          f"# [📥 Adatexport]({APP}/export)"),
    panel(3, "", "text", 0, 4, 12, 4,
          f"# [🔌 Agentek és gépek]({APP}/agents)"),
    panel(4, "", "text", 12, 4, 12, 4,
          f"# [⚙️ Monitoring beállítása]({APP}/profiles)"),
])
home["timepicker"] = {"hidden": True}
NUMBER = """
CASE WHEN (h.value #>> '{}') ~ '^[+-]?[0-9]+([.][0-9]+)?([eE][+-]?[0-9]+)?$'
     THEN (h.value #>> '{}')::double precision END
"""
LATEST = """
LEFT JOIN LATERAL (
 SELECT time, value FROM raw.history WHERE node_id=m.device AND dataitem_id=m.signal
 ORDER BY time DESC LIMIT 1
) h ON true
"""


def signal_panel(id, view, kind, y, height):
    scope = f"m.view={quote(view)} AND m.position::text IN (${{{view}:sqlstring}})"
    if view == "chart":
        query = f"""
WITH mapped AS ({MAPPED})
SELECT h.time, {NUMBER} AS "Érték"
FROM mapped m JOIN raw.history h ON h.node_id=m.device AND h.dataitem_id=m.signal
WHERE {scope} AND $__timeFilter(h.time) ORDER BY 1
"""
    else:
        value = {"value": NUMBER, "gauge": NUMBER, "state": "h.value #>> '{}'"}[view]
        query = f'WITH mapped AS ({MAPPED}) SELECT {value} AS "Érték" FROM mapped m {LATEST} WHERE {scope}'
    result = panel(id, f"${{{view}:text}}", kind, 0, y, 12, height, sql=query,
                   fmt="time_series" if view == "chart" else "table")
    result.update(repeat=view, repeatDirection="h", maxPerRow=2)
    if kind in ("stat", "gauge"):
        result["options"]["reduceOptions"] = {"calcs": ["lastNotNull"], "fields": "/^Érték$/", "values": False}
    if view == "state":
        result["options"].update(textMode="value", graphMode="none", colorMode="none")
    else:
        config_sql = f"""
WITH mapped AS ({MAPPED})
SELECT CASE WHEN nullif(m.units, '') IS NOT NULL THEN 'suffix:' || m.units END AS unit
       {', m.minimum, m.maximum' if view == 'gauge' else ''}
FROM mapped m WHERE {scope}
"""
        result["targets"].append({**result["targets"][0], "refId": "B", "format": "table", "rawSql": config_sql})
        mappings = [{"fieldName": "unit", "handlerKey": "unit"}]
        if view == "gauge":
            mappings.extend([{"fieldName": "minimum", "handlerKey": "min"}, {"fieldName": "maximum", "handlerKey": "max"}])
        result["transformations"] = [{"id": "configFromData", "options": {
            "configRefId": "B", "applyTo": {"id": "byType", "options": "number"}, "mappings": mappings,
        }}]
    return result


views = [
    ("state", "stat", 3, 4), ("value", "stat", 7, 4),
    ("gauge", "gauge", 11, 6), ("chart", "timeseries", 17, 8),
]
monitoring = dashboard("kfgyr-machine-monitoring", "KFGyR · Gépmonitoring", [
    panel(1, "", "text", 0, 0, 24, 3,
          f"[Kezdőlap](/d/kfgyr-home) · [Adatexport]({APP}/export) · [Monitoring beállítása]({APP}/profiles)"),
    *[signal_panel(id, *view) for id, view in enumerate(views, 2)],
], [
    variable("machine", "Gép", "SELECT props->>'path' AS __text, node_id::text AS __value FROM raw.nodes WHERE props->>'node_type'='Device' ORDER BY 1"),
    *[variable(view, view,
               f"WITH mapped AS ({MAPPED}) SELECT name || CASE WHEN count(*) OVER (PARTITION BY name) > 1 THEN ' · ' || position ELSE '' END AS __text, position::text AS __value "
               f"FROM mapped WHERE view={quote(view)} ORDER BY position", multi=True, hide=2) | {"sort": 0}
      for view, *_ in views],
])

if __name__ == "__main__":
    OUTPUT.mkdir(exist_ok=True)
    for filename, model in [("home.json", home), ("machine-monitoring.json", monitoring)]:
        (OUTPUT / filename).write_text(json.dumps(model, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

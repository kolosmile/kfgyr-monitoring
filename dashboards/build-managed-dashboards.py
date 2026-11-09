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


def signal_panel(id, view, kind):
    scope = f"m.view={quote(view)} AND (m.device::text || ':' || m.position::text) IN (${{{view}:sqlstring}})"
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
    result = panel(id, f"${{{view}:text}}", kind, 0, 0, 12, 4, sql=query,
                   fmt="time_series" if view == "chart" else "table")
    if kind in ("stat", "gauge"):
        result["options"]["reduceOptions"] = {"calcs": ["lastNotNull"], "fields": "/^Érték$/", "values": False}
    if view == "state":
        result["options"].update(textMode="value", graphMode="none", colorMode="none")
    elif view in ("value", "gauge"):
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


def resource(kind, **spec):
    return {"kind": kind, "spec": spec}


def data_query(**spec):
    return {**resource("DataQuery", **spec), "group": DS["type"], "version": "v0",
            "datasource": {"name": DS["uid"]}}


def panel_resource(source, defaults=None):
    queries = [
        resource("PanelQuery", refId=target["refId"], hidden=False,
                 query=data_query(**{key: target[key] for key in ("rawSql", "format", "rawQuery", "editorMode")}))
        for target in source["targets"]
    ]
    transforms = [
        {**resource("Transformation", options=item["options"]), "group": item["id"]}
        for item in source.get("transformations", [])
    ]
    return resource("Panel", id=source["id"], title=source["title"], description="", links=[],
                    data=resource("QueryGroup", queries=queries, transformations=transforms, queryOptions={}),
                    vizConfig={**resource("VizConfig", options=source["options"],
                                         fieldConfig={"defaults": defaults or {}, "overrides": []}),
                               "group": source["type"], "version": ""})


def query_variable(name, sql, *, repeat=False, visible=False):
    return resource("QueryVariable", name=name, label="Gép" if visible else name,
                    query=data_query(__legacyStringValue=sql), definition=sql,
                    current={"text": ["All"], "value": ["$__all"]} if repeat else {"text": "", "value": ""},
                    options=[], regex="", sort="disabled", refresh="onDashboardLoad",
                    hide="dontHide" if visible else "hideVariable", skipUrlSync=not visible,
                    multi=repeat, includeAll=repeat, allowCustomValue=False)


def view_variable(view):
    unit_label = """
      CASE units
        WHEN 'MILLIMETER' THEN 'mm'
        WHEN 'MILLIMETER/SECOND' THEN 'mm/s'
        WHEN 'REVOLUTION/MINUTE' THEN 'rpm'
        WHEN 'DEGREE' THEN '°'
        WHEN 'DEGREE/SECOND' THEN '°/s'
        WHEN 'PERCENT' THEN '%'
        ELSE nullif(units, '')
      END
    """
    unit_suffix = f" || coalesce(' (' || ({unit_label}) || ')', '')" if view == "chart" else ""
    # An explicit option replaces the old selection even when the new machine has no panels of this type.
    return query_variable(view, f"""
WITH mapped AS ({MAPPED}), selected AS (SELECT * FROM mapped WHERE view={quote(view)})
SELECT label AS __text, panel_key AS __value FROM (
 SELECT name || CASE WHEN count(*) OVER (PARTITION BY name) > 1 THEN ' · ' || position ELSE '' END{unit_suffix} AS label,
        device::text || ':' || position::text AS panel_key, position
 FROM selected
 UNION ALL
 SELECT '', '__none__', 0 WHERE NOT EXISTS (SELECT 1 FROM selected)
) options ORDER BY position
""", repeat=True)


def view_row(id, view, title, height):
    return resource("RowsLayoutRow", title=title, collapse=False, hideHeader=False,
                    conditionalRendering=resource("ConditionalRenderingGroup", visibility="show", condition="and", items=[
                        resource("ConditionalRenderingVariable", variable="configured_views", operator="matches",
                                 value=f"(^|,){view}(,|$)")
                    ]),
                    layout=resource("AutoGridLayout", maxColumnCount=2, columnWidthMode="standard",
                                    rowHeightMode="custom", rowHeight=height, fillScreen=False, items=[
                        resource("AutoGridLayoutItem", element={"kind": "ElementReference", "name": f"panel-{id}"},
                                 repeat={"mode": "variable", "value": view})
                    ]))


views = [
    ("state", "stat", "Állapot", 120), ("value", "stat", "Aktuális érték", 120),
    ("gauge", "gauge", "Műszerek", 185), ("chart", "timeseries", "Grafikonok", 260),
]
quick_points = panel(6, "Gyors adatpontnézegető", "table", 0, 0, 24, 10, sql=f"""
WITH machine AS ({MACHINE})
SELECT n.props->>'path' AS "Adatpont", latest.value #>> '{{}}' AS "Érték",
       n.props->>'units' AS "Egység", latest.time AS "Utolsó minta"
FROM machine m
JOIN raw.nodes n ON n.props->>'node_type'='DataItem'
 AND n.props->>'agentAlias'=m.props->>'agentAlias'
 AND n.props->>'deviceId'=m.props->>'deviceId'
LEFT JOIN LATERAL (
 SELECT h.value, h.time FROM raw.history h
 WHERE h.node_id=m.node_id AND h.dataitem_id=n.node_id AND $__timeFilter(h.time)
 ORDER BY h.time DESC LIMIT 1
) latest ON true
ORDER BY 1
""")
quick_points["options"] = {"showHeader": True, "enablePagination": True}

monitoring = {
    "apiVersion": "dashboard.grafana.app/v2",
    "kind": "Dashboard",
    "metadata": {"name": "kfgyr-machine-monitoring"},
    "spec": {
        "title": "KFGyR · Gépmonitoring", "editable": False, "tags": ["KFGyR"],
        "annotations": [], "cursorSync": "Off",
        "timeSettings": {"timezone": "Europe/Budapest", "from": "now-15m", "to": "now",
                         "autoRefresh": "", "autoRefreshIntervals": ["5s", "10s", "30s", "1m", "5m"],
                         "hideTimepicker": False, "fiscalYearStartMonth": 0},
        "links": [
            {"title": title, "url": url, "type": "link", "icon": icon, "tooltip": "",
             "tags": [], "asDropdown": False, "targetBlank": False, "includeVars": False, "keepTime": False}
            for title, url, icon in [
                ("Kezdőlap", "/d/kfgyr-home", "home-alt"),
                ("Adatexport", f"{APP}/export", "download-alt"),
                ("Monitoring beállítása", f"{APP}/profiles", "cog"),
            ]
        ],
        "elements": {
            **{f"panel-{id}": panel_resource(signal_panel(id, view, kind))
               for id, (view, kind, _, _) in enumerate(views, 2)},
            "panel-6": panel_resource(quick_points, {"custom": {"filterable": True}}),
        },
        "layout": resource("RowsLayout", rows=[
            *[view_row(id, view, title, height) for id, (view, _, title, height) in enumerate(views, 2)],
            resource("RowsLayoutRow", hideHeader=True, layout=resource("GridLayout", items=[
                resource("GridLayoutItem", x=0, y=0, width=24, height=10,
                         element={"kind": "ElementReference", "name": "panel-6"})
            ])),
        ]),
        "variables": [
            query_variable("machine", "SELECT props->>'path' AS __text, node_id::text AS __value "
                           "FROM raw.nodes WHERE props->>'node_type'='Device' ORDER BY 1", visible=True),
            query_variable("configured_views", f"WITH mapped AS ({MAPPED}) "
                           "SELECT coalesce(string_agg(DISTINCT view, ','), '__none__') FROM mapped"),
            *[view_variable(view) for view, *_ in views],
        ],
    },
}

if __name__ == "__main__":
    OUTPUT.mkdir(exist_ok=True)
    for filename, model in [("home.json", home), ("machine-monitoring.json", monitoring)]:
        (OUTPUT / filename).write_text(json.dumps(model, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

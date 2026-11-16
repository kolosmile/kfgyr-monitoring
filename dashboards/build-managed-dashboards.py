"""Generate the Grafana dashboards provisioned by the Grafana Compose project."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
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
SELECT d.node_id, d.props, m.profile, m.signals, a.schema_id
FROM raw.nodes d LEFT JOIN kfgyr.machine_dashboards m
  ON m.agent_alias=d.props->>'agentAlias' AND m.device_id=d.props->>'deviceId'
  AND m.id::text=${dashboard:sqlstring}
LEFT JOIN kfgyr.machine_schema_assignments a
  ON a.agent_alias=d.props->>'agentAlias' AND a.device_id=d.props->>'deviceId'
WHERE d.props->>'node_type'='Device' AND d.node_id::text=${machine:sqlstring}
"""
LEGACY_CATALOG = """VALUES
 ('generic', 'execution', 'Végrehajtási állapot'), ('generic', 'feedrate', 'Előtolás'),
 ('mill', 'spindle', 'Orsófordulat'), ('mill', 'feedrate', 'Előtolás'),
 ('mill', 'x', 'X pozíció'), ('mill', 'y', 'Y pozíció'), ('mill', 'z', 'Z pozíció'),
 ('lathe', 'spindle', 'Orsófordulat'), ('lathe', 'x', 'X pozíció'),
 ('lathe', 'z', 'Z pozíció'), ('lathe', 'turret', 'Revolverpozíció')
"""
def unit_label(units):
    return f"""
      CASE {units}
        WHEN 'MILLIMETER' THEN 'mm'
        WHEN 'MILLIMETER/SECOND' THEN 'mm/s'
        WHEN 'REVOLUTION/MINUTE' THEN 'rpm'
        WHEN 'DEGREE' THEN '°'
        WHEN 'DEGREE/SECOND' THEN '°/s'
        WHEN 'CELSIUS' THEN '°C'
        WHEN 'PERCENT' THEN '%'
        ELSE nullif({units}, '')
      END
    """


MAPPED = f"""
WITH machine AS ({MACHINE}), catalog(profile, slot, label) AS ({LEGACY_CATALOG})
SELECT m.node_id AS device, n.node_id AS signal, p.position,
 coalesce(nullif(p.name, ''), s.name, n.props->>'path') AS name,
 coalesce(p.view, 'chart') AS view, p.minimum, p.maximum, p.color,
 {unit_label("coalesce(nullif(n.props->>'units', ''), s.units)")} AS units
FROM machine m
CROSS JOIN LATERAL (
 SELECT item->>'name' AS name, item->>'signal_id' AS signal_id,
        item->>'point' AS point, item->>'view' AS view,
        (item->>'minimum')::double precision AS minimum,
        (item->>'maximum')::double precision AS maximum,
        item->>'color' AS color, ord AS position
 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(m.signals)='array' THEN m.signals ELSE '[]'::jsonb END)
      WITH ORDINALITY AS items(item, ord)
 UNION ALL
 SELECT c.label, NULL, m.signals->>c.slot, CASE WHEN c.slot='execution' THEN 'state' ELSE 'chart' END,
        NULL, NULL, NULL, row_number() OVER (ORDER BY c.slot)
 FROM catalog c WHERE c.profile=m.profile AND jsonb_typeof(m.signals)='object'
) p
LEFT JOIN kfgyr.signal_catalog s ON s.id=p.signal_id
LEFT JOIN kfgyr.schema_mappings sm ON sm.schema_id=m.schema_id AND sm.signal_id=p.signal_id
JOIN raw.nodes n ON n.props->>'node_type'='DataItem'
 AND n.props->>'agentAlias'=m.props->>'agentAlias' AND n.props->>'deviceId'=m.props->>'deviceId'
 AND ((p.point IS NOT NULL AND n.node_id::text=p.point) OR
      (p.signal_id IS NOT NULL AND sm.endpoint IS NOT NULL AND
       n.props->>'path'=(rtrim(m.props->>'path', '/') || sm.endpoint)))
"""
home = dashboard("kfgyr-home", "KFGyR · Kezdőlap", [
    {**panel(1, "", "kfgyr-navigation-panel", 0, 0, 24, 16), "transparent": True},
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
SELECT h.time, {NUMBER} AS value, coalesce('Érték · ' || m.color, 'Érték') AS metric
FROM mapped m JOIN raw.history h ON h.node_id=m.device AND h.dataitem_id=m.signal
WHERE {scope} AND $__timeFilter(h.time) ORDER BY 1
"""
    else:
        value = {"value": NUMBER, "gauge": NUMBER, "state": "h.value #>> '{}'"}[view]
        query = f'WITH mapped AS ({MAPPED}) SELECT {value} AS "Érték" FROM mapped m {LATEST} WHERE {scope}'
    result = panel(id, f"${{{view}:text}}", kind, 0, 0, 12, 4, sql=query,
                   fmt="time_series" if view == "chart" else "table")
    if view == "chart":
        result["overrides"] = [
            {"matcher": {"id": "byName", "options": f"Érték · {color}"},
             "properties": [
                 {"id": "color", "value": {"mode": "fixed", "fixedColor": color}},
                 {"id": "displayName", "value": "Érték"},
             ]}
            for color in ("blue", "green", "orange", "red", "purple", "yellow")
        ]
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
    panel_spec = {
        "id": source["id"], "title": source["title"], "description": "", "links": [],
        "data": resource("QueryGroup", queries=queries, transformations=transforms, queryOptions={}),
        "vizConfig": {**resource("VizConfig", options=source["options"],
                                  fieldConfig={"defaults": defaults or {}, "overrides": source.get("overrides", [])}),
                      "group": source["type"], "version": ""},
    }
    if source.get("transparent"):
        panel_spec["transparent"] = True
    return resource("Panel", **panel_spec)


def query_variable(name, sql, *, repeat=False, visible=False, label=None, sync=False):
    return resource("QueryVariable", name=name, label=label or name,
                    query=data_query(__legacyStringValue=sql), definition=sql,
                    current={"text": ["All"], "value": ["$__all"]} if repeat else {"text": "", "value": ""},
                    options=[], regex="", sort="disabled", refresh="onDashboardLoad",
                    hide="dontHide" if visible else "hideVariable", skipUrlSync=not (visible or sync),
                    multi=repeat, includeAll=repeat, allowCustomValue=False)


def view_variable(view):
    unit_suffix = " || coalesce(' (' || units || ')', '')" if view == "chart" else ""
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


def show_views(pattern):
    return resource("ConditionalRenderingGroup", visibility="show", condition="and", items=[
        resource("ConditionalRenderingVariable", variable="configured_views", operator="matches",
                 value=f"(^|,)({pattern})(,|$)")
    ])


def view_row(title, height, columns, width, panels):
    return resource("RowsLayoutRow", title=title, collapse=False, hideHeader=False,
                    conditionalRendering=show_views("|".join(view for _, view in panels)),
                    layout=resource("AutoGridLayout", maxColumnCount=columns, columnWidthMode="custom",
                                    columnWidth=width, rowHeightMode="custom", rowHeight=height,
                                    fillScreen=False, items=[
                        resource("AutoGridLayoutItem", element={"kind": "ElementReference", "name": f"panel-{id}"},
                                 repeat={"mode": "variable", "value": view},
                                 conditionalRendering=show_views(view))
                        for id, view in panels
                    ]))


views = [("state", "stat"), ("value", "stat"), ("gauge", "gauge"), ("chart", "timeseries")]
quick_points = panel(6, "Gyors adatpontnézegető", "table", 0, 0, 24, 10, sql=f"""
WITH machine AS ({MACHINE})
SELECT coalesce(s.name, '') AS "Jel", n.props->>'path' AS "Adatpont", latest.value #>> '{{}}' AS "Érték",
       {unit_label("n.props->>'units'")} AS "Egység", latest.time AS "Utolsó minta"
FROM machine m
JOIN raw.nodes n ON n.props->>'node_type'='DataItem'
 AND n.props->>'agentAlias'=m.props->>'agentAlias'
 AND n.props->>'deviceId'=m.props->>'deviceId'
LEFT JOIN kfgyr.schema_mappings sm ON sm.schema_id=m.schema_id
 AND n.props->>'path'=(rtrim(m.props->>'path', '/') || sm.endpoint)
LEFT JOIN kfgyr.signal_catalog s ON s.id=sm.signal_id
LEFT JOIN LATERAL (
 SELECT h.value, h.time FROM raw.history h
 WHERE h.node_id=m.node_id AND h.dataitem_id=n.node_id AND $__timeFilter(h.time)
 ORDER BY h.time DESC LIMIT 1
) latest ON true
ORDER BY 1
""")
quick_points["options"] = {"showHeader": True, "enablePagination": True}
menu = panel(7, "", "kfgyr-navigation-panel", 0, 0, 24, 2, sql="""
/* ${machine:sqlstring} ${dashboard:sqlstring} */
SELECT d.node_id::text AS machine_id, d.props->>'agentAlias' AS agent,
       d.props->>'deviceAlias' AS machine_name, m.id::text AS dashboard_id,
       m.name AS dashboard_name, m.is_default
FROM raw.nodes d LEFT JOIN kfgyr.machine_dashboards m
  ON m.agent_alias=d.props->>'agentAlias' AND m.device_id=d.props->>'deviceId'
WHERE d.props->>'node_type'='Device'
ORDER BY agent, machine_name, m.is_default DESC, m.name, m.id
""")
menu["options"] = {"mode": "monitoring"}
menu["transparent"] = True

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
        "links": [],
        "elements": {
            **{f"panel-{id}": panel_resource(signal_panel(id, view, kind))
               for id, (view, kind) in enumerate(views, 2)},
            "panel-6": panel_resource(quick_points, {"custom": {"filterable": True}}),
            "panel-7": panel_resource(menu),
        },
        "layout": resource("RowsLayout", rows=[
            resource("RowsLayoutRow", hideHeader=True, layout=resource("GridLayout", items=[
                resource("GridLayoutItem", x=0, y=0, width=24, height=2,
                         element={"kind": "ElementReference", "name": "panel-7"})
            ])),
            view_row("Áttekintés", 88, 6, 200, [(2, "state"), (3, "value")]),
            view_row("Műszerek", 155, 5, 220, [(4, "gauge")]),
            view_row("Grafikonok", 260, 2, 420, [(5, "chart")]),
            resource("RowsLayoutRow", hideHeader=True, layout=resource("GridLayout", items=[
                resource("GridLayoutItem", x=0, y=0, width=24, height=10,
                         element={"kind": "ElementReference", "name": "panel-6"})
            ])),
        ]),
        "variables": [
            query_variable("machine", "SELECT props->>'path' AS __text, node_id::text AS __value "
                           "FROM raw.nodes WHERE props->>'node_type'='Device' ORDER BY 1", sync=True, label="Gép"),
            query_variable("dashboard", """
SELECT m.name AS __text, m.id::text AS __value
FROM kfgyr.machine_dashboards m JOIN raw.nodes d
  ON m.agent_alias=d.props->>'agentAlias' AND m.device_id=d.props->>'deviceId'
WHERE d.props->>'node_type'='Device' AND d.node_id::text=${machine:sqlstring}
ORDER BY m.is_default DESC, lower(m.name), m.id
""", sync=True, label="Dashboard"),
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

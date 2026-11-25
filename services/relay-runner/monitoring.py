"""Runner-owned monitoring, signal catalog, and MTConnect schema configuration."""
from collections import Counter
import json
from pathlib import Path
import re
import uuid
from typing import Annotated, Literal

import psycopg
from psycopg.types.json import Jsonb
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from configuration import Problem

DEFAULTS = json.loads(Path(__file__).with_name("profiles.json").read_text(encoding="utf-8"))
# MTConnect 2.5 Device Information Model, section 6.1.1, UnitEnum.
MTCONNECT_UNITS = frozenset("""
AMPERE CELSIUS COULOMB COUNT COUNT/SECOND CUBIC_METER CUBIC_MILLIMETER
CUBIC_MILLIMETER/SECOND CUBIC_MILLIMETER/SECOND2 DECIBEL DEGREE DEGREE/SECOND
DEGREE/SECOND2 DEGREE_3D GRAM GRAM/CUBIC_METER HERTZ JOULE KILOGRAM LITER
LITER/SECOND METER/SECOND2 MICRO_RADIAN MILLIGRAM MILLIGRAM/CUBIC_MILLIMETER
MILLILITER MILLIMETER MILLIMETER/REVOLUTION MILLIMETER/SECOND MILLIMETER/SECOND2
MILLIMETER_3D NEWTON NEWTON_METER OHM OHM_METER PASCAL PASCAL/SECOND PASCAL_SECOND
PERCENT PH REVOLUTION/MINUTE REVOLUTION/SECOND REVOLUTION/SECOND2 SECOND
SIEMENS/METER SQUARE_MILLIMETER UNIT_VECTOR_3D VOLT VOLT_AMPERE
VOLT_AMPERE_REACTIVE WATT WATT_SECOND
""".split())
INITIAL_UNIT_LABELS = {
    "MILLIMETER": "mm",
    "MILLIMETER/SECOND": "mm/s",
    "REVOLUTION/MINUTE": "rpm",
    "DEGREE": "°",
    "DEGREE/SECOND": "°/s",
    "CELSIUS": "°C",
    "PERCENT": "%",
}
SIGNAL_ID = re.compile(r"^[a-zA-Z0-9_.:-]{1,128}$")
ENDPOINT = re.compile(r"^/(?:[^/?#\\]+/)*[^/?#\\]+$")
MACHINE = """
SELECT props->>'agentAlias', props->>'deviceId', props->>'path' FROM raw.nodes
WHERE node_id::text = %s AND props->>'node_type' = 'Device'
"""
SIGNALS = """
SELECT node_id::text, props->>'path', coalesce(props->>'units', ''),
       coalesce(props->>'category', ''), coalesce(props->>'type', ''),
       coalesce(props->>'subType', ''), coalesce(props->>'name', '')
FROM raw.nodes
WHERE props->>'node_type'='DataItem'
  AND props->>'agentAlias'=%s AND props->>'deviceId'=%s
ORDER BY 2
"""
LEGACY_SLOTS = {
    "generic": {"feedrate": "Előtolás", "execution": "Végrehajtási állapot"},
    "mill": {"spindle": "Orsófordulat", "feedrate": "Előtolás", "x": "X pozíció",
             "y": "Y pozíció", "z": "Z pozíció"},
    "lathe": {"spindle": "Orsófordulat", "x": "X pozíció", "z": "Z pozíció",
              "turret": "Revolverpozíció"},
}


def default_view(slot):
    return "state" if slot == "execution" else "chart"


class Panel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, allow_inf_nan=False)
    name: str | None = Field(default=None, max_length=120)
    signal_id: str | None = Field(default=None, max_length=128)
    point: str | None = Field(default=None, max_length=128)
    view: Literal["value", "state", "chart", "gauge"]
    minimum: float | None = None
    maximum: float | None = None
    color: Literal["blue", "green", "orange", "red", "purple", "yellow"] | None = None
    show_timeline: bool | None = None

    @model_validator(mode="after")
    def check_panel(self):
        if bool(self.signal_id) == bool(self.point):
            raise ValueError("A panelhez egy katalógusjelet vagy egy korábbi adatpontot válassz.")
        if self.signal_id and not SIGNAL_ID.fullmatch(self.signal_id):
            raise ValueError("Érvénytelen katalógusjel-azonosító.")
        if self.name is not None:
            self.name = self.name.strip() or None
        if self.show_timeline and self.view != "state":
            raise ValueError("Állapotidősor csak állapotpanelhez adható hozzá.")
        if self.view == "gauge" and (
            self.minimum is None or self.maximum is None or self.minimum >= self.maximum
        ):
            raise ValueError("A műszer maximuma legyen nagyobb a minimumnál.")
        return self


class DashboardCopyPreview(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    machine: str = Field(min_length=1, max_length=128)
    source_dashboard_id: int = Field(ge=1)


class DashboardCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    machine: str = Field(min_length=1, max_length=128)
    name: str = Field(min_length=1, max_length=120)
    source_dashboard_id: int | None = Field(default=None, ge=1)


class DashboardUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    id: int = Field(ge=1)
    name: str = Field(min_length=1, max_length=120)
    panels: list[Panel]
    revision: int = Field(ge=1)


class DashboardDefault(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    machine: str = Field(min_length=1, max_length=128)
    id: int = Field(ge=1)


class DashboardDelete(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    id: int = Field(ge=1)
    revision: int = Field(ge=1)


class Assignment(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    machine: str = Field(min_length=1, max_length=128)
    panels: list[Panel]
    revision: int = Field(ge=0)


class SignalCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    id: str = Field(min_length=1, max_length=128, pattern=r"^[a-zA-Z0-9_.:-]+$")
    name: str = Field(min_length=1, max_length=120)
    units: str = Field(default="", max_length=80)


class SignalUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    id: str = Field(min_length=1, max_length=128, pattern=r"^[a-zA-Z0-9_.:-]+$")
    name: str = Field(min_length=1, max_length=120)
    units: str = Field(default="", max_length=80)


class DisplayUnitsUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    labels: dict[str, Annotated[str, Field(max_length=40)]] = Field(max_length=len(MTCONNECT_UNITS))

    @field_validator("labels")
    @classmethod
    def check_unit_codes(cls, labels):
        if labels.keys() - MTCONNECT_UNITS:
            raise ValueError("Ismeretlen MTConnect-mértékegység.")
        if any("\x00" in label for label in labels.values()):
            raise ValueError("Érvénytelen megjelenítési mértékegység.")
        return {code: label.strip() for code, label in labels.items()}


class SchemaCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    name: str = Field(min_length=1, max_length=120)
    source_schema_id: str | None = Field(default=None, pattern=r"^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$")


class SchemaUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    name: str = Field(min_length=1, max_length=120)


class MappingWrite(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    signal_id: str = Field(min_length=1, max_length=128)
    endpoint: str = Field(min_length=2, max_length=512)


def migrate():
    with psycopg.connect(connect_timeout=5) as db:
        db.execute("SELECT pg_advisory_xact_lock(74313901)")
        db.execute("CREATE SCHEMA IF NOT EXISTS kfgyr")
        db.execute("""
            CREATE TABLE IF NOT EXISTS kfgyr.machine_monitoring (
                agent_alias text NOT NULL, device_id text NOT NULL,
                profile text NOT NULL, signals jsonb NOT NULL,
                revision integer NOT NULL DEFAULT 1,
                updated_at timestamptz NOT NULL DEFAULT now(),
                updated_by text NOT NULL,
                PRIMARY KEY (agent_alias, device_id)
            )
        """)
        db.execute("""
            CREATE TABLE IF NOT EXISTS kfgyr.machine_dashboards (
                id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                agent_alias text NOT NULL, device_id text NOT NULL,
                name text NOT NULL CHECK (length(btrim(name)) > 0),
                profile text NOT NULL DEFAULT 'generic', signals jsonb NOT NULL DEFAULT '[]',
                revision integer NOT NULL DEFAULT 1,
                created_at timestamptz NOT NULL DEFAULT now(),
                updated_at timestamptz NOT NULL DEFAULT now(), updated_by text NOT NULL,
                is_default boolean NOT NULL DEFAULT false
            )
        """)
        db.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS machine_dashboards_default_idx
            ON kfgyr.machine_dashboards (agent_alias, device_id) WHERE is_default
        """)
        db.execute("""
            CREATE TABLE IF NOT EXISTS kfgyr.signal_catalog (
                id text PRIMARY KEY CHECK (id ~ '^[a-zA-Z0-9_.:-]{1,128}$'),
                name text NOT NULL CHECK (length(btrim(name)) > 0),
                units text NOT NULL DEFAULT '',
                created_at timestamptz NOT NULL DEFAULT now(),
                updated_at timestamptz NOT NULL DEFAULT now()
            )
        """)
        db.execute("""
            CREATE TABLE IF NOT EXISTS kfgyr.display_units (
                code text PRIMARY KEY,
                label text NOT NULL CHECK (length(label) <= 40)
            )
        """)
        with db.cursor() as cursor:
            cursor.executemany("""
                INSERT INTO kfgyr.display_units (code, label)
                VALUES (%s, %s) ON CONFLICT (code) DO NOTHING
            """, INITIAL_UNIT_LABELS.items())
        db.execute("""
            CREATE TABLE IF NOT EXISTS kfgyr.machine_schemas (
                id text PRIMARY KEY,
                name text NOT NULL UNIQUE CHECK (length(btrim(name)) > 0),
                created_at timestamptz NOT NULL DEFAULT now(),
                updated_at timestamptz NOT NULL DEFAULT now()
            )
        """)
        db.execute("""
            CREATE TABLE IF NOT EXISTS kfgyr.schema_mappings (
                schema_id text NOT NULL REFERENCES kfgyr.machine_schemas(id) ON DELETE CASCADE,
                signal_id text NOT NULL REFERENCES kfgyr.signal_catalog(id) ON DELETE RESTRICT,
                endpoint text NOT NULL CHECK (endpoint LIKE '/%' AND endpoint NOT LIKE '%..%'),
                updated_at timestamptz NOT NULL DEFAULT now(),
                PRIMARY KEY (schema_id, signal_id),
                UNIQUE (schema_id, endpoint)
            )
        """)
        db.execute("""
            CREATE TABLE IF NOT EXISTS kfgyr.machine_schema_assignments (
                agent_alias text NOT NULL,
                device_id text NOT NULL,
                schema_id text NOT NULL REFERENCES kfgyr.machine_schemas(id) ON DELETE RESTRICT,
                updated_at timestamptz NOT NULL DEFAULT now(),
                PRIMARY KEY (agent_alias, device_id)
            )
        """)
        db.execute("CREATE TABLE IF NOT EXISTS kfgyr.schema_migrations (name text PRIMARY KEY)")
        migrated = db.execute("""
            INSERT INTO kfgyr.schema_migrations (name) VALUES ('machine_dashboards_v1')
            ON CONFLICT DO NOTHING RETURNING name
        """).fetchone()
        if migrated:
            db.execute("""
                INSERT INTO kfgyr.machine_dashboards
                    (agent_alias, device_id, name, profile, signals, revision, updated_at, updated_by, is_default)
                SELECT agent_alias, device_id, 'Áttekintés', profile, signals, revision,
                       updated_at, updated_by, true FROM kfgyr.machine_monitoring
            """)
        seed_catalog = db.execute("""
            INSERT INTO kfgyr.schema_migrations (name) VALUES ('signal_catalog_seed_v1')
            ON CONFLICT DO NOTHING RETURNING name
        """).fetchone()
        if seed_catalog:
            for signal in DEFAULTS.get("signals", []):
                db.execute("""
                    INSERT INTO kfgyr.signal_catalog (id, name, units)
                    VALUES (%s, %s, %s) ON CONFLICT (id) DO NOTHING
                """, (signal["id"], signal["name"], signal.get("units", "")))
        if db.execute("SELECT 1 FROM pg_roles WHERE rolname = 'grafana_reader'").fetchone():
            db.execute("GRANT USAGE ON SCHEMA kfgyr TO grafana_reader")
            db.execute("GRANT SELECT ON kfgyr.machine_monitoring, kfgyr.machine_dashboards, "
                       "kfgyr.signal_catalog, kfgyr.machine_schemas, kfgyr.schema_mappings, "
                       "kfgyr.machine_schema_assignments, kfgyr.display_units TO grafana_reader")


def display_units(db):
    labels = dict(db.execute("SELECT code, label FROM kfgyr.display_units").fetchall())
    return {"units": [{"code": code, "label": labels.get(code, "")} for code in sorted(MTCONNECT_UNITS)]}


def list_display_units():
    with psycopg.connect(connect_timeout=5) as db:
        return display_units(db)


def save_display_units(body):
    with psycopg.connect(connect_timeout=5) as db:
        with db.cursor() as cursor:
            cursor.executemany("""
                INSERT INTO kfgyr.display_units (code, label) VALUES (%s, %s)
                ON CONFLICT (code) DO UPDATE SET label=EXCLUDED.label
            """, sorted(body.labels.items()))
        return display_units(db)


def list_signals():
    with psycopg.connect(connect_timeout=5) as db:
        if not db.execute("SELECT to_regclass('kfgyr.signal_catalog')").fetchone()[0]:
            return {"signals": DEFAULTS.get("signals", [])}
        rows = db.execute("SELECT id, name, units FROM kfgyr.signal_catalog ORDER BY lower(name), id")
        return {"signals": [{"id": row[0], "name": row[1], "units": row[2]} for row in rows]}


def list_schemas():
    with psycopg.connect(connect_timeout=5) as db:
        if not db.execute("SELECT to_regclass('kfgyr.machine_schemas')").fetchone()[0]:
            return {"schemas": []}
        rows = db.execute("""
            SELECT s.id, s.name,
                   (SELECT count(*) FROM kfgyr.schema_mappings m WHERE m.schema_id=s.id),
                   (SELECT count(*) FROM kfgyr.machine_schema_assignments a WHERE a.schema_id=s.id)
            FROM kfgyr.machine_schemas s ORDER BY lower(s.name), s.id
        """)
        return {"schemas": [{"id": row[0], "name": row[1], "mapping_count": row[2],
                              "machine_count": row[3]} for row in rows]}


def list_machines():
    with psycopg.connect(connect_timeout=5) as db:
        if not db.execute("SELECT to_regclass('raw.nodes')").fetchone()[0]:
            return {"presets": DEFAULTS.get("presets", []), "machines": []}
        rows = db.execute("""
            SELECT d.node_id::text, d.props->>'path', a.schema_id
            FROM raw.nodes d
            LEFT JOIN kfgyr.machine_schema_assignments a
              ON a.agent_alias=d.props->>'agentAlias' AND a.device_id=d.props->>'deviceId'
            WHERE d.props->>'node_type'='Device'
              AND coalesce(d.props->>'agentAlias', '') <> '' AND coalesce(d.props->>'deviceId', '') <> ''
            ORDER BY 2
        """)
        return {"presets": DEFAULTS.get("presets", []),
                "machines": [{"id": row[0], "label": row[1], "schema_id": row[2]} for row in rows]}


def machine_info(db, machine):
    row = db.execute(MACHINE, (machine,)).fetchone()
    if not row or not all(row):
        raise Problem(404, "A gép nem található a tárolt eszközök között.")
    return row


def machine_key(db, machine):
    return machine_info(db, machine)[:2]


def get_machine_key(machine):
    with psycopg.connect(connect_timeout=5) as db:
        return machine_key(db, machine)


def machine_dataitems(machine):
    with psycopg.connect(connect_timeout=5) as db:
        agent, device, device_path = machine_info(db, machine)
        rows = db.execute(SIGNALS, (agent, device)).fetchall()
        items = []
        prefix = device_path.rstrip("/")
        for point_id, full_path, units, category, kind, subtype, name in rows:
            if not full_path:
                continue
            endpoint = full_path[len(prefix):] if full_path.startswith(prefix) else full_path
            if not endpoint.startswith("/"):
                endpoint = "/" + endpoint
            items.append({"id": point_id, "path": endpoint, "full_path": full_path, "name": name,
                          "units": units, "category": category, "type": kind, "subType": subtype})
        return {"machine": machine, "agent": agent, "device": device,
                "device_path": device_path, "dataitems": items}


def list_schema_mappings(schema_id):
    with psycopg.connect(connect_timeout=5) as db:
        schema = db.execute("SELECT id FROM kfgyr.machine_schemas WHERE id=%s", (schema_id,)).fetchone()
        if not schema:
            raise Problem(404, "A séma nem található.")
        rows = db.execute("""
            SELECT s.id, s.name, s.units, m.endpoint
            FROM kfgyr.signal_catalog s
            LEFT JOIN kfgyr.schema_mappings m ON m.signal_id=s.id AND m.schema_id=%s
            ORDER BY lower(s.name), s.id
        """, (schema_id,))
        return {"mappings": [{"signal_id": row[0], "signal_name": row[1],
                              "signal_units": row[2], "endpoint": row[3]} for row in rows]}


def _machine_signal_options(db, machine, legacy_points=()):
    agent, device, device_path = machine_info(db, machine)
    schema = db.execute("""
        SELECT a.schema_id FROM kfgyr.machine_schema_assignments a
        WHERE a.agent_alias=%s AND a.device_id=%s
    """, (agent, device)).fetchone()
    options = []
    if schema:
        rows = db.execute("""
            SELECT s.id, s.name, s.units, m.endpoint, n.node_id::text, coalesce(n.props->>'units', '')
            FROM kfgyr.schema_mappings m
            JOIN kfgyr.signal_catalog s ON s.id=m.signal_id
            JOIN raw.nodes n ON n.props->>'node_type'='DataItem'
              AND n.props->>'agentAlias'=%s AND n.props->>'deviceId'=%s
              AND n.props->>'path'=(%s || m.endpoint)
            WHERE m.schema_id=%s ORDER BY lower(s.name), s.id
        """, (agent, device, device_path.rstrip("/"), schema[0]))
        options.extend({"kind": "signal", "id": row[0], "label": row[1], "units": row[2],
                        "endpoint": row[3], "point_id": row[4], "point_units": row[5]} for row in rows)
    legacy_points = list(dict.fromkeys(legacy_points))
    if legacy_points:
        rows = db.execute("""
            SELECT node_id::text, props->>'path', coalesce(props->>'units', '')
            FROM raw.nodes WHERE props->>'node_type'='DataItem'
              AND props->>'agentAlias'=%s AND props->>'deviceId'=%s
              AND node_id::text = ANY(%s)
        """, (agent, device, legacy_points))
        options.extend({"kind": "point", "id": row[0], "label": row[1] or row[0],
                        "units": row[2]} for row in rows)
    return options


def machine_signal_options(machine, legacy_points=()):
    with psycopg.connect(connect_timeout=5) as db:
        return _machine_signal_options(db, machine, legacy_points)


def legacy_panels(profile, signals):
    if not isinstance(signals, dict):
        return []
    labels = LEGACY_SLOTS.get(profile, {})
    return [{"name": labels.get(slot, slot), "point": point, "view": default_view(slot)}
            for slot, point in signals.items() if point]


def panel_point_ids(panels):
    return [panel.get("point") for panel in panels if isinstance(panel, dict) and panel.get("point")]


def list_dashboards(machine):
    with psycopg.connect(connect_timeout=5) as db:
        key = machine_key(db, machine)
        rows = db.execute("""
            SELECT id, name, revision, is_default FROM kfgyr.machine_dashboards
            WHERE agent_alias=%s AND device_id=%s ORDER BY is_default DESC, lower(name), id
        """, key).fetchall()
        sources = db.execute("""
            SELECT d.id, d.name, d.agent_alias,
                   coalesce(node.props->>'deviceAlias', d.device_id)
            FROM kfgyr.machine_dashboards d
            LEFT JOIN LATERAL (
                SELECT props FROM raw.nodes WHERE props->>'node_type'='Device'
                  AND props->>'agentAlias'=d.agent_alias AND props->>'deviceId'=d.device_id
                ORDER BY node_id LIMIT 1
            ) node ON true
            ORDER BY lower(d.agent_alias), lower(coalesce(node.props->>'deviceAlias', d.device_id)),
                     lower(d.name), d.id
        """).fetchall()
        return {"dashboards": [
            {"id": row[0], "name": row[1], "revision": row[2], "is_default": row[3]}
            for row in rows
        ], "copy_sources": [
            {"id": row[0], "name": row[1], "agent": row[2], "machine": row[3]}
            for row in sources
        ]}


def get_assignment(machine):
    with psycopg.connect(connect_timeout=5) as db:
        key = machine_key(db, machine)
        row = db.execute("""
            SELECT id FROM kfgyr.machine_dashboards WHERE agent_alias=%s AND device_id=%s
            ORDER BY is_default DESC, id LIMIT 1
        """, key).fetchone()
        if not row:
            return {"panels": [], "revision": 0,
                    "options": _machine_signal_options(db, machine)}
    return read_dashboard(row[0])


def validate_dashboard_panels(db, machine, panels, saved_panels=()):
    agent, device, _ = machine_info(db, machine)
    available = {item["id"] for item in _machine_signal_options(db, machine)
                 if item["kind"] == "signal"}
    points = {row[0] for row in db.execute(SIGNALS, (agent, device))}
    # A schema change can leave existing references unresolved. Preserve them
    # without allowing unavailable references to be added or duplicated.
    saved_signals = Counter(panel.get("signal_id") for panel in saved_panels)
    saved_points = Counter(panel.get("point") for panel in saved_panels)
    for panel in panels:
        if panel.signal_id and panel.signal_id not in available:
            if saved_signals[panel.signal_id] <= 0:
                raise Problem(422, "A kiválasztott jelhez nincs hozzárendelt adatpont ezen a gépen.")
            saved_signals[panel.signal_id] -= 1
        if panel.point and panel.point not in points:
            if saved_points[panel.point] <= 0:
                raise Problem(422, "A kiválasztott adatpont nem ehhez a géphez tartozik.")
            saved_points[panel.point] -= 1


def save_assignment(body, actor):
    with psycopg.connect(connect_timeout=5) as db:
        agent, device, _ = machine_info(db, body.machine)
        db.execute("SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))", (agent + "/" + device,))
        current = db.execute("""
            SELECT id, profile, signals, revision FROM kfgyr.machine_dashboards
            WHERE agent_alias=%s AND device_id=%s
            ORDER BY is_default DESC, id LIMIT 1 FOR UPDATE
        """, (agent, device)).fetchone()
        if body.revision != (current[3] if current else 0):
            raise Problem(409, "A dashboardot közben módosították. Töltsd újra.")
        saved_panels = []
        if current:
            saved_panels = current[2] if isinstance(current[2], list) else legacy_panels(current[1], current[2])
        validate_dashboard_panels(db, body.machine, body.panels, saved_panels)
        panels = Jsonb([panel.model_dump(exclude_none=True) for panel in body.panels])
        if not current:
            row = db.execute("""
                INSERT INTO kfgyr.machine_dashboards
                    (agent_alias, device_id, name, signals, updated_by, is_default)
                VALUES (%s, %s, 'Áttekintés', %s, %s, true) RETURNING revision
            """, (agent, device, panels, actor)).fetchone()
        else:
            row = db.execute("""
                UPDATE kfgyr.machine_dashboards SET profile='generic', signals=%s,
                    updated_by=%s, updated_at=now(), revision=revision+1
                WHERE id=%s AND revision=%s RETURNING revision
            """, (panels, actor, current[0], body.revision)).fetchone()
        if not row:
            raise Problem(409, "A dashboardot közben módosították. Töltsd újra.")
        return {"revision": row[0]}


def read_dashboard(dashboard_id):
    with psycopg.connect(connect_timeout=5) as db:
        row = db.execute("""
            SELECT agent_alias, device_id, name, profile, signals, revision
            FROM kfgyr.machine_dashboards WHERE id=%s
        """, (dashboard_id,)).fetchone()
        if not row:
            raise Problem(404, "A dashboard nem található.")
        agent, device, name, profile, signals, revision = row
        panels = signals if isinstance(signals, list) else legacy_panels(profile, signals)
        machine = db.execute("""
            SELECT node_id::text FROM raw.nodes
            WHERE props->>'node_type'='Device' AND props->>'agentAlias'=%s AND props->>'deviceId'=%s
            ORDER BY node_id LIMIT 1
        """, (agent, device)).fetchone()
        options = _machine_signal_options(db, machine[0], panel_point_ids(panels)) if machine else []
        return {"id": dashboard_id, "name": name, "panels": panels, "revision": revision,
                "options": options}


def copy_dashboard_panels(db, machine, key, source_id):
    row = db.execute("""
        SELECT d.agent_alias, d.device_id, d.profile, d.signals, node.node_id::text
        FROM kfgyr.machine_dashboards d
        LEFT JOIN LATERAL (
            SELECT node_id FROM raw.nodes WHERE props->>'node_type'='Device'
              AND props->>'agentAlias'=d.agent_alias AND props->>'deviceId'=d.device_id
            ORDER BY node_id LIMIT 1
        ) node ON true
        WHERE d.id=%s
    """, (source_id,)).fetchone()
    if not row:
        raise Problem(422, "A forrásdashboard nem található.")

    source_agent, source_device, profile, signals, source_machine = row
    panels = signals if isinstance(signals, list) else legacy_panels(profile, signals)
    same_machine = key == (source_agent, source_device)
    available = _machine_signal_options(db, machine, panel_point_ids(panels) if same_machine else ())
    signal_ids = {item["id"] for item in available if item["kind"] == "signal"}
    point_ids = {item["id"] for item in available if item["kind"] == "point"}
    source_points = {}
    if not same_machine and source_machine and panel_point_ids(panels):
        for item in _machine_signal_options(db, source_machine):
            if item["id"] in signal_ids:
                source_points.setdefault(item["point_id"], set()).add(item["id"])

    copied, omitted = [], []
    for panel in panels:
        if panel.get("signal_id") in signal_ids or panel.get("point") in point_ids:
            copied.append(panel)
        elif len(matches := source_points.get(panel.get("point"), ())) == 1:
            copied.append({k: v for k, v in panel.items() if k != "point"} | {"signal_id": next(iter(matches))})
        else:
            omitted.append(panel)
    return copied, omitted


def preview_dashboard_copy(body):
    with psycopg.connect(connect_timeout=5) as db:
        copied, omitted = copy_dashboard_panels(db, body.machine, machine_key(db, body.machine),
                                                body.source_dashboard_id)
        signal_ids = {panel["signal_id"] for panel in omitted if panel.get("signal_id") and not panel.get("name")}
        names = {}
        if signal_ids:
            names = {signal: name for signal, name in db.execute(
                "SELECT id, name FROM kfgyr.signal_catalog WHERE id=ANY(%s)", (list(signal_ids),)
            )}
        return {"copied_panels": len(copied), "skipped_panels": [
            {"name": panel.get("name") or names.get(panel.get("signal_id")) or panel.get("signal_id")
             or panel.get("point") or "Névtelen panel", "view": panel["view"]}
            for panel in omitted
        ]}


def create_dashboard(body, actor):
    name = body.name.strip()
    if not name:
        raise Problem(422, "Adj nevet a dashboardnak.")
    with psycopg.connect(connect_timeout=5) as db:
        agent, device, _ = machine_info(db, body.machine)
        db.execute("SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))", (agent + "/" + device,))
        machine_info(db, body.machine)
        panels, skipped = [], []
        if body.source_dashboard_id is not None:
            panels, skipped = copy_dashboard_panels(db, body.machine, (agent, device), body.source_dashboard_id)
        row = db.execute("""
            INSERT INTO kfgyr.machine_dashboards (agent_alias, device_id, name, signals, updated_by, is_default)
            VALUES (%s, %s, %s, %s, %s, NOT EXISTS (
                SELECT 1 FROM kfgyr.machine_dashboards WHERE agent_alias=%s AND device_id=%s
            )) RETURNING id
        """, (agent, device, name, Jsonb(panels), actor, agent, device)).fetchone()
        return {"id": row[0], "skipped_panels": len(skipped)}


def update_dashboard(body, actor):
    name = body.name.strip()
    if not name:
        raise Problem(422, "Adj nevet a dashboardnak.")
    with psycopg.connect(connect_timeout=5) as db:
        row = db.execute("""
            SELECT agent_alias, device_id, profile, signals, revision
            FROM kfgyr.machine_dashboards WHERE id=%s FOR UPDATE
        """, (body.id,)).fetchone()
        if not row:
            raise Problem(404, "A dashboard nem található.")
        agent, device, profile, signals, revision = row
        if revision != body.revision:
            raise Problem(409, "A dashboardot közben módosították. Töltsd újra.")
        machine = db.execute("""
            SELECT node_id::text FROM raw.nodes WHERE props->>'node_type'='Device'
              AND props->>'agentAlias'=%s AND props->>'deviceId'=%s ORDER BY node_id LIMIT 1
        """, (agent, device)).fetchone()
        if not machine:
            raise Problem(404, "A dashboard gépe nem található.")
        saved_panels = signals if isinstance(signals, list) else legacy_panels(profile, signals)
        validate_dashboard_panels(db, machine[0], body.panels, saved_panels)
        result = db.execute("""
            UPDATE kfgyr.machine_dashboards SET name=%s, profile='generic', signals=%s,
                updated_by=%s, updated_at=now(), revision=revision+1
            WHERE id=%s AND revision=%s RETURNING revision
        """, (name, Jsonb([panel.model_dump(exclude_none=True) for panel in body.panels]),
              actor, body.id, body.revision)).fetchone()
        if not result:
            raise Problem(409, "A dashboardot közben módosították. Töltsd újra.")
        return {"revision": result[0]}


def delete_dashboard(body):
    with psycopg.connect(connect_timeout=5) as db:
        row = db.execute("""
            SELECT agent_alias, device_id, is_default FROM kfgyr.machine_dashboards WHERE id=%s
        """, (body.id,)).fetchone()
        if not row:
            raise Problem(404, "A dashboard nem található.")
        agent, device, _ = row
        db.execute("SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))", (agent + "/" + device,))
        deleted = db.execute("""
            DELETE FROM kfgyr.machine_dashboards WHERE id=%s AND revision=%s RETURNING is_default
        """, (body.id, body.revision)).fetchone()
        if not deleted:
            raise Problem(409, "A dashboardot közben módosították. Töltsd újra.")
        if deleted[0]:
            db.execute("""
                UPDATE kfgyr.machine_dashboards SET is_default=true
                WHERE id=(SELECT id FROM kfgyr.machine_dashboards
                          WHERE agent_alias=%s AND device_id=%s ORDER BY id LIMIT 1)
            """, (agent, device))
        return {"deleted": True}


def set_default_dashboard(body):
    with psycopg.connect(connect_timeout=5) as db:
        agent, device = machine_key(db, body.machine)
        db.execute("SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))", (agent + "/" + device,))
        target = db.execute("""
            SELECT is_default FROM kfgyr.machine_dashboards
            WHERE id=%s AND agent_alias=%s AND device_id=%s
        """, (body.id, agent, device)).fetchone()
        if target is None:
            raise Problem(404, "A dashboard nem található ennél a gépnél.")
        if not target[0]:
            db.execute("""
                UPDATE kfgyr.machine_dashboards SET is_default=false
                WHERE agent_alias=%s AND device_id=%s AND is_default
            """, (agent, device))
            db.execute("UPDATE kfgyr.machine_dashboards SET is_default=true WHERE id=%s", (body.id,))
    return {"id": body.id}


def create_signal(body):
    name = body.name.strip()
    if not name:
        raise Problem(422, "Adj meg nevet a jelnek.")
    with psycopg.connect(connect_timeout=5) as db:
        try:
            db.execute("INSERT INTO kfgyr.signal_catalog (id, name, units) VALUES (%s, %s, %s)",
                       (body.id, name, body.units.strip()))
        except psycopg.errors.UniqueViolation:
            raise Problem(409, "Ez a jelazonosító már létezik.") from None
    return {"signal": {"id": body.id, "name": name, "units": body.units.strip()}}


def update_signal(body):
    name = body.name.strip()
    if not name:
        raise Problem(422, "Adj meg nevet a jelnek.")
    with psycopg.connect(connect_timeout=5) as db:
        row = db.execute("""
            UPDATE kfgyr.signal_catalog SET name=%s, units=%s, updated_at=now()
            WHERE id=%s RETURNING id
        """, (name, body.units.strip(), body.id)).fetchone()
        if not row:
            raise Problem(404, "A jel nem található.")
    return {"signal": {"id": body.id, "name": name, "units": body.units.strip()}}


def delete_signal(signal_id):
    with psycopg.connect(connect_timeout=5) as db:
        mapped = db.execute("SELECT 1 FROM kfgyr.schema_mappings WHERE signal_id=%s LIMIT 1", (signal_id,)).fetchone()
        used = db.execute("""
            SELECT 1 FROM kfgyr.machine_dashboards d
            CROSS JOIN LATERAL jsonb_array_elements(
                CASE WHEN jsonb_typeof(d.signals)='array' THEN d.signals ELSE '[]'::jsonb END
            ) p
            WHERE p->>'signal_id'=%s LIMIT 1
        """, (signal_id,)).fetchone()
        if mapped or used:
            raise Problem(409, "A jel sémában vagy dashboardon szerepel. Előbb távolítsd el a hozzárendeléseket.")
        deleted = db.execute("DELETE FROM kfgyr.signal_catalog WHERE id=%s RETURNING id", (signal_id,)).fetchone()
        if not deleted:
            raise Problem(404, "A jel nem található.")
    return {"deleted": True}


def create_schema(body):
    name = body.name.strip()
    if not name:
        raise Problem(422, "Adj meg nevet a sémának.")
    schema_id = str(uuid.uuid4())
    mapping_count = 0
    with psycopg.connect(connect_timeout=5) as db:
        if body.source_schema_id is not None:
            source = db.execute(
                "SELECT id FROM kfgyr.machine_schemas WHERE id=%s FOR KEY SHARE", (body.source_schema_id,)
            ).fetchone()
            if source is None:
                raise Problem(404, "A másolni kívánt séma nem található.")
        try:
            db.execute("INSERT INTO kfgyr.machine_schemas (id, name) VALUES (%s, %s)", (schema_id, name))
        except psycopg.errors.UniqueViolation:
            raise Problem(409, "Ilyen nevű séma már létezik.") from None
        if body.source_schema_id is not None:
            mapping_count = db.execute("""
                INSERT INTO kfgyr.schema_mappings (schema_id, signal_id, endpoint)
                SELECT %s, signal_id, endpoint FROM kfgyr.schema_mappings WHERE schema_id=%s
            """, (schema_id, body.source_schema_id)).rowcount
    return {"schema": {"id": schema_id, "name": name, "mapping_count": mapping_count, "machine_count": 0}}


def update_schema(schema_id, body):
    name = body.name.strip()
    if not name:
        raise Problem(422, "Adj meg nevet a sémának.")
    with psycopg.connect(connect_timeout=5) as db:
        try:
            row = db.execute("""
                UPDATE kfgyr.machine_schemas SET name=%s, updated_at=now()
                WHERE id=%s RETURNING id
            """, (name, schema_id)).fetchone()
        except psycopg.errors.UniqueViolation:
            raise Problem(409, "Ilyen nevű séma már létezik.") from None
        if not row:
            raise Problem(404, "A séma nem található.")
    return {"schema": {"id": schema_id, "name": name}}


def delete_schema(schema_id):
    with psycopg.connect(connect_timeout=5) as db:
        assigned = db.execute("SELECT 1 FROM kfgyr.machine_schema_assignments WHERE schema_id=%s LIMIT 1",
                              (schema_id,)).fetchone()
        if assigned:
            raise Problem(409, "A séma géphez van rendelve. Előbb válassz másik sémát ezekhez a gépekhez.")
        deleted = db.execute("DELETE FROM kfgyr.machine_schemas WHERE id=%s RETURNING id", (schema_id,)).fetchone()
        if not deleted:
            raise Problem(404, "A séma nem található.")
    return {"deleted": True}


def validate_endpoint(endpoint):
    endpoint = endpoint.strip()
    if (not ENDPOINT.fullmatch(endpoint) or "//" in endpoint or
            any(part in (".", "..") for part in endpoint.split("/"))):
        raise Problem(422, "A végpont gépen belüli, / jellel kezdődő útvonal legyen, például /Axes/Linear[X]/Position.")
    return endpoint


def save_schema_mapping(schema_id, body):
    endpoint = validate_endpoint(body.endpoint)
    with psycopg.connect(connect_timeout=5) as db:
        if not db.execute("SELECT 1 FROM kfgyr.machine_schemas WHERE id=%s", (schema_id,)).fetchone():
            raise Problem(404, "A séma nem található.")
        if not db.execute("SELECT 1 FROM kfgyr.signal_catalog WHERE id=%s", (body.signal_id,)).fetchone():
            raise Problem(404, "A jel nem található.")
        existing = db.execute("""
            SELECT signal_id FROM kfgyr.schema_mappings
            WHERE schema_id=%s AND endpoint=%s AND signal_id<>%s
        """, (schema_id, endpoint, body.signal_id)).fetchone()
        if existing:
            raise Problem(409, "Ez a végpont már egy másik jelhez tartozik ebben a sémában.")
        db.execute("""
            INSERT INTO kfgyr.schema_mappings (schema_id, signal_id, endpoint)
            VALUES (%s, %s, %s)
            ON CONFLICT (schema_id, signal_id) DO UPDATE
            SET endpoint=EXCLUDED.endpoint, updated_at=now()
        """, (schema_id, body.signal_id, endpoint))
    return {"mapping": {"schema_id": schema_id, "signal_id": body.signal_id, "endpoint": endpoint}}


def delete_schema_mapping(schema_id, signal_id):
    with psycopg.connect(connect_timeout=5) as db:
        deleted = db.execute("""
            DELETE FROM kfgyr.schema_mappings WHERE schema_id=%s AND signal_id=%s RETURNING signal_id
        """, (schema_id, signal_id)).fetchone()
        if not deleted:
            raise Problem(404, "A hozzárendelés nem található.")
    return {"deleted": True}


def validate_schema_assignments(config, previous):
    previous_agents = {agent.get("alias"): agent for agent in previous.get("relay", {}).get("agents", [])
                       if isinstance(agent, dict)}
    with psycopg.connect(connect_timeout=5) as db:
        known = {row[0] for row in db.execute("SELECT id FROM kfgyr.machine_schemas")}
    for agent in config.get("relay", {}).get("agents", []):
        if not isinstance(agent, dict):
            continue
        old = previous_agents.get(agent.get("alias"))
        if old == agent:
            # Older installations may keep running with unassigned devices until edited.
            continue
        for device in agent.get("devices", []):
            schema_id = device.get("schema_id") if isinstance(device, dict) else None
            if not isinstance(schema_id, str) or not schema_id:
                raise Problem(400, "Minden géphez válassz sémát az agent mentése előtt.")
            if schema_id not in known:
                raise Problem(400, "A géphez választott séma már nem létezik. Töltsd újra a sémalistát.")
    return True


def purge_agent_data(aliases):
    with psycopg.connect(connect_timeout=5) as db:
        db.execute("SET LOCAL lock_timeout = '5s'")
        if db.execute("SELECT to_regclass('raw.nodes')").fetchone()[0]:
            affected = db.execute("""
                SELECT node_id, props->>'agentAlias',
                       CASE WHEN props->>'node_type'='Device' THEN props->>'deviceId' END
                FROM raw.nodes WHERE props->>'agentAlias'=ANY(%s)
                ORDER BY node_id FOR UPDATE
            """, (aliases,)).fetchall()
            for _, agent, device in affected:
                if device:
                    db.execute("SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))", (agent + "/" + device,))
            nodes = [row[0] for row in affected]
            if nodes:
                # Delete references first. History and bins may be TimescaleDB hypertables.
                db.execute("DELETE FROM raw.history WHERE node_id=ANY(%s)", (nodes,))
                db.execute("DELETE FROM raw.history WHERE dataitem_id=ANY(%s)", (nodes,))
                db.execute("DELETE FROM raw.bins WHERE device_id=ANY(%s)", (nodes,))
                db.execute("DELETE FROM raw.edges WHERE from_id=ANY(%s) OR to_id=ANY(%s)", (nodes, nodes))
                db.execute("DELETE FROM raw.nodes WHERE node_id=ANY(%s)", (nodes,))
        db.execute("DELETE FROM kfgyr.machine_dashboards WHERE agent_alias=ANY(%s)", (aliases,))
        db.execute("DELETE FROM kfgyr.machine_monitoring WHERE agent_alias=ANY(%s)", (aliases,))
        db.execute("DELETE FROM kfgyr.machine_schema_assignments WHERE agent_alias=ANY(%s)", (aliases,))


def sync_machine_schema_assignments(config):
    assigned = []
    machines = []
    for agent in config.get("relay", {}).get("agents", []):
        if not isinstance(agent, dict) or not isinstance(agent.get("devices"), list):
            continue
        alias = agent.get("alias")
        for device in agent["devices"]:
            if not isinstance(device, dict) or not isinstance(device.get("id"), str):
                continue
            machines.append((alias, device["id"]))
            schema_id = device.get("schema_id")
            if schema_id:
                assigned.append((alias, device["id"], schema_id))
    with psycopg.connect(connect_timeout=5) as db:
        existing = db.execute("SELECT agent_alias, device_id FROM kfgyr.machine_schema_assignments").fetchall()
        keep = set(machines)
        for key in existing:
            if key not in keep:
                db.execute("DELETE FROM kfgyr.machine_schema_assignments WHERE agent_alias=%s AND device_id=%s", key)
        for agent, device, schema_id in assigned:
            db.execute("""
                INSERT INTO kfgyr.machine_schema_assignments (agent_alias, device_id, schema_id)
                VALUES (%s, %s, %s)
                ON CONFLICT (agent_alias, device_id) DO UPDATE
                SET schema_id=EXCLUDED.schema_id, updated_at=now()
            """, (agent, device, schema_id))

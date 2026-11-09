"""Runner-owned monitoring configuration stored separately from relay revisions."""
import json
from pathlib import Path
from typing import Literal

import psycopg
from psycopg.types.json import Jsonb
from pydantic import BaseModel, ConfigDict, Field, model_validator

from configuration import Problem

PROFILES = json.loads(Path(__file__).with_name("profiles.json").read_text(encoding="utf-8"))
MACHINE = """
SELECT props->>'agentAlias', props->>'deviceId' FROM raw.nodes
WHERE node_id::text = %s AND props->>'node_type' = 'Device'
"""
SIGNALS = """
SELECT node_id::text, props->>'path' FROM raw.nodes
WHERE props->>'node_type' = 'DataItem'
  AND props->>'agentAlias' = %s AND props->>'deviceId' = %s
ORDER BY 2
"""


def default_view(slot):
    return "state" if slot == "execution" else "chart"


PRESETS = [
    {"label": label, "panels": [
        {"name": name, "point": "", "view": default_view(slot)}
        for slot, name in slots.items()
    ]}
    for label, slots in [
        ("CNC eszterga", {"execution": "Üzemállapot", "feedrate": "Előtolás", **PROFILES["lathe"]["signals"]}),
        ("CNC megmunkálóközpont", {"execution": "Üzemállapot", **PROFILES["mill"]["signals"]}),
    ]
]


class Panel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, allow_inf_nan=False)
    name: str = Field(min_length=1, max_length=120)
    point: str = Field(min_length=1, max_length=128)
    view: Literal["value", "state", "chart", "gauge"]
    minimum: float | None = None
    maximum: float | None = None

    @model_validator(mode="after")
    def check_panel(self):
        self.name = self.name.strip()
        if not self.name:
            raise ValueError("Adj nevet a panelnek.")
        if self.view == "gauge" and (
            self.minimum is None or self.maximum is None or self.minimum >= self.maximum
        ):
            raise ValueError("A műszer maximuma legyen nagyobb a minimumnál.")
        return self


class Assignment(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    machine: str = Field(min_length=1, max_length=128)
    panels: list[Panel]
    revision: int = Field(ge=0)


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
        if db.execute("SELECT 1 FROM pg_roles WHERE rolname = 'grafana_reader'").fetchone():
            db.execute("GRANT USAGE ON SCHEMA kfgyr TO grafana_reader")
            db.execute("GRANT SELECT ON kfgyr.machine_monitoring TO grafana_reader")


def list_machines():
    with psycopg.connect(connect_timeout=5) as db:
        if not db.execute("SELECT to_regclass('raw.nodes')").fetchone()[0]:
            return {"presets": PRESETS, "machines": []}
        rows = db.execute("""
            SELECT node_id::text, props->>'path' FROM raw.nodes
            WHERE props->>'node_type' = 'Device'
              AND coalesce(props->>'agentAlias', '') <> '' AND coalesce(props->>'deviceId', '') <> ''
            ORDER BY 2
        """)
        return {"presets": PRESETS, "machines": [{"id": row[0], "label": row[1]} for row in rows]}


def machine_key(db, machine):
    row = db.execute(MACHINE, (machine,)).fetchone()
    if not row or not all(row):
        raise Problem(404, "A gép nem található a tárolt eszközök között.")
    return row


def get_assignment(machine):
    with psycopg.connect(connect_timeout=5) as db:
        key = machine_key(db, machine)
        current = db.execute("""
            SELECT profile, signals, revision FROM kfgyr.machine_monitoring
            WHERE agent_alias = %s AND device_id = %s
        """, key).fetchone() or ("generic", {}, 0)
        options = db.execute(SIGNALS, key)
        profile, signals, revision = current
        panels = signals if isinstance(signals, list) else [
            {"name": name, "point": signals[slot], "view": default_view(slot)}
            for slot, name in PROFILES.get(profile, {}).get("signals", {}).items() if slot in signals
        ]
        return {"panels": panels, "revision": revision,
                "options": [{"id": row[0], "label": row[1]} for row in options]}


def save_assignment(body, actor):
    with psycopg.connect(connect_timeout=5) as db:
        key = machine_key(db, body.machine)
        valid = {row[0] for row in db.execute(SIGNALS, key)}
        if {panel.point for panel in body.panels} - valid:
            raise Problem(422, "A kiválasztott adatpont nem ehhez a géphez tartozik.")
        values = ("generic", Jsonb([panel.model_dump(exclude_none=True) for panel in body.panels]), actor)
        if body.revision == 0:
            result = db.execute("""
                INSERT INTO kfgyr.machine_monitoring (agent_alias, device_id, profile, signals, updated_by)
                VALUES (%s, %s, %s, %s, %s) ON CONFLICT DO NOTHING RETURNING revision
            """, (*key, *values))
        else:
            result = db.execute("""
                UPDATE kfgyr.machine_monitoring
                SET profile=%s, signals=%s, updated_by=%s, updated_at=now(), revision=revision+1
                WHERE agent_alias=%s AND device_id=%s AND revision=%s RETURNING revision
            """, (*values, *key, body.revision))
        row = result.fetchone()
        if not row:
            raise Problem(409, "A gépprofilt közben módosították. Töltsd újra.")
        return {"revision": row[0]}

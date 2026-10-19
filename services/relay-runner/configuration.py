"""Validated, versioned configuration owned exclusively by the runner."""
import copy
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import secrets
import threading
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, Field
import yaml

from runner import atomic_write, read_json, read_revision

MAX_BODY = 1024 * 1024
RETENTION = re.compile(r"^[1-9][0-9]{0,3}\s*(seconds?|minutes?|hours?|days?|weeks?|months?|years?)$")
ID = re.compile(r"^[a-zA-Z0-9_.:-]{1,128}$")


class Problem(Exception):
    def __init__(self, status, message):
        self.status = status
        self.message = message
        super().__init__(message)


class SaveRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    base_revision: str = Field(min_length=1, max_length=80)
    config: dict


class RollbackRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    base_revision: str = Field(min_length=1, max_length=80)
    revision: str = Field(pattern=r"^[a-zA-Z0-9_-]{1,80}$")


def valid_alias(value):
    return (isinstance(value, str) and 1 <= len(value) <= 64 and value[0].isalnum()
            and all(c.isalnum() or c in "_. -" for c in value))


def validate_retention(value):
    if value not in (None, "") and (not isinstance(value, str) or not RETENTION.fullmatch(value)):
        raise Problem(400, "Érvénytelen megőrzési idő. Példa: 1week vagy 30days.")


def validate(config, previous, policy):
    client, relay = config.get("client"), config.get("relay")
    if not isinstance(client, dict) or not isinstance(relay, dict) or not isinstance(client.get("name"), str) or not client["name"].strip():
        raise Problem(400, "A monitoring neve és a relay konfiguráció kötelező.")
    try:
        ZoneInfo(client.get("timezone", ""))
    except (ZoneInfoNotFoundError, ValueError, TypeError):
        raise Problem(400, "Érvénytelen időzóna.")
    validate_retention(relay.get("retention"))
    agents = relay.get("agents")
    if not isinstance(agents, list) or len(agents) > 100:
        raise Problem(400, "Legfeljebb 100 agent adható meg.")
    old = {a["alias"]: a for a in previous.get("relay", {}).get("agents", [])}
    seen = set()
    for agent in agents:
        if not isinstance(agent, dict) or not valid_alias(agent.get("alias")) or agent["alias"] in seen:
            raise Problem(400, "Az agent neve legyen egyedi, 1–64 karakteres név.")
        seen.add(agent["alias"])
        policy.parse(agent.get("url", ""))
        if "ignore" in agent and not isinstance(agent["ignore"], bool):
            raise Problem(400, "Az agent engedélyezése logikai érték lehet.")
        validate_retention(agent.get("retention"))
        devices = agent.get("devices", [])
        if not isinstance(devices, list) or len(devices) > 1000:
            raise Problem(400, "Legfeljebb 1000 eszköznév adható meg agentenként.")
        old_devices = {d["id"]: d["alias"] for d in old.get(agent["alias"], {}).get("devices", [])}
        ids, names = set(), set()
        for device in devices:
            if not isinstance(device, dict) or not isinstance(device.get("id"), str) or not ID.fullmatch(device["id"]) or not valid_alias(device.get("alias")):
                raise Problem(400, "Érvénytelen eszközazonosító vagy megjelenítési név.")
            if device["id"] in ids or device["alias"] in names:
                raise Problem(400, "Ismétlődő eszközazonosító vagy megjelenítési név.")
            ids.add(device["id"])
            names.add(device["alias"])
            if device["id"] in old_devices and old_devices[device["id"]] != device["alias"]:
                raise Problem(400, "Meglévő eszköz neve az adatfolytonosság miatt nem módosítható.")
            validate_retention(device.get("retention"))
            items = device.get("dataitems", [])
            if not isinstance(items, list):
                raise Problem(400, "A dataitems mező lista lehet.")
            for item in items:
                if not isinstance(item, dict):
                    raise Problem(400, "Érvénytelen dataitem.")
                validate_retention(item.get("retention"))


class Store:
    def __init__(self, directory, policy):
        self.directory = Path(directory)
        self.policy = policy
        self.lock = threading.RLock()
        self.directory.mkdir(parents=True, exist_ok=True)

    def load_revision(self, revision, checksum=None):
        try:
            content = read_revision(self.directory, {"revision": revision, "sha256": checksum}) if checksum else self._revision_bytes(revision)
        except FileNotFoundError:
            raise Problem(404, "A konfigurációverzió nem található.") from None
        config = yaml.safe_load(content)
        if not isinstance(config, dict):
            raise Problem(500, "A tárolt konfiguráció hibás.")
        return {"revision": revision, "config": config, "yaml": content.decode()}

    def _revision_bytes(self, revision):
        from runner import REVISION
        if not REVISION.fullmatch(revision):
            raise Problem(400, "Érvénytelen konfigurációverzió.")
        content = (self.directory / "revisions" / (revision + ".yaml")).read_bytes()
        if len(content) > MAX_BODY:
            raise Problem(413, "A konfiguráció túl nagy.")
        return content

    def load(self):
        with self.lock:
            manifest = read_json(self.directory / "desired.json")
            if manifest:
                return self.load_revision(manifest["revision"], manifest["sha256"])
            config = {"client": {"name": "Monitoring", "timezone": "Europe/Budapest"}, "relay": {"agents": []}}
            return {"revision": "initial", "config": config, "yaml": yaml.safe_dump(config, allow_unicode=True, sort_keys=False)}

    def save(self, base, config, actor):
        with self.lock:
            try:
                json.dumps(config, allow_nan=False)
            except (ValueError, TypeError):
                raise Problem(400, "A konfiguráció csak érvényes JSON értékeket tartalmazhat.") from None
            before = self.load()
            if before["revision"] != base:
                raise Problem(409, "A konfiguráció közben megváltozott. Töltsd újra az oldalt.")
            validate(config, before["config"], self.policy)
            failed = read_json(self.directory / "runner-state.json", {}).get("failed_revision")
            if config == before["config"] and failed != base and (self.directory / "desired.json").exists():
                return before
            content = yaml.safe_dump(config, allow_unicode=True, sort_keys=False).encode()
            if len(content) > MAX_BODY:
                raise Problem(413, "A konfiguráció túl nagy.")
            revision = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S") + "_" + secrets.token_hex(6)
            revisions = self.directory / "revisions"
            revisions.mkdir(exist_ok=True)
            atomic_write(revisions / (revision + ".yaml"), content)
            audit = {"revision": revision, "previous_revision": base, "actor": actor[:200], "created_at": datetime.now(timezone.utc).isoformat()}
            atomic_write(revisions / (revision + ".json"), json.dumps(audit).encode())
            manifest = {"revision": revision, "sha256": hashlib.sha256(content).hexdigest()}
            atomic_write(self.directory / "desired.json", json.dumps(manifest).encode())
            return {"revision": revision, "config": copy.deepcopy(config), "yaml": content.decode()}

    def rollback(self, base, revision, actor):
        with self.lock:
            return self.save(base, self.load_revision(revision)["config"], actor)

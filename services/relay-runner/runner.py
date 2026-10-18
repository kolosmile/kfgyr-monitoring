"""Supervise the unmodified Ladder99 relay; exchange versioned files with Grafana."""
import hashlib
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import sys
import tempfile
import time

REVISION = re.compile(r"^[a-zA-Z0-9_-]{1,80}$")


def atomic_write(path, content):
    path = Path(path)
    fd, name = tempfile.mkstemp(prefix=".pending-", dir=path.parent)
    try:
        with os.fdopen(fd, "wb") as handle:
            os.fchmod(handle.fileno(), 0o660)
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(name, path)
        directory = os.open(path.parent, os.O_RDONLY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def read_json(path, default=None):
    try:
        return json.loads(Path(path).read_text())
    except FileNotFoundError:
        return default


def read_revision(directory, manifest):
    revision = manifest.get("revision", "")
    if not REVISION.fullmatch(revision):
        raise ValueError("Invalid configuration revision")
    content = (directory / "revisions" / (revision + ".yaml")).read_bytes()
    if len(content) > 1024 * 1024:
        raise ValueError("Configuration too large")
    if hashlib.sha256(content).hexdigest() != manifest.get("sha256"):
        raise ValueError("Configuration checksum mismatch")
    return content


class Runner:
    def __init__(self):
        self.directory = Path(os.environ.get("KFGYR_CONFIG_DIR", "/var/lib/kfgyr-monitoring"))
        self.runtime = Path(os.environ.get("KFGYR_RELAY_RUNTIME_DIR", "/run/kfgyr-relay"))
        self.grace = float(os.environ.get("KFGYR_RELAY_STARTUP_SECONDS", "10"))
        self.directory.mkdir(parents=True, exist_ok=True)
        self.runtime.mkdir(parents=True, exist_ok=True)
        self.stopping = False
        self.child = None
        self.active = None
        self.pending = False
        self.started = 0
        self.last_status = 0
        self.message = ""
        self.state = "waiting"
        self.requested = None
        self.saved = read_json(self.directory / "runner-state.json", {})
        self.failed = self.saved.get("failed_revision")
        self.good = self.saved.get("last_good")

    def persist(self):
        atomic_write(self.directory / "runner-state.json", json.dumps({
            "last_good": self.good, "failed_revision": self.failed
        }).encode())

    def status(self, state=None, message=None):
        if state is not None:
            self.state = state
        if message is not None:
            self.message = message
        atomic_write(self.directory / "status.json", json.dumps({
            "state": self.state,
            "message": self.message,
            "revision": self.active.get("revision") if self.active else None,
            "requested_revision": self.requested.get("revision") if self.requested else None,
            "failed_revision": self.failed,
            "pid": self.child.pid if self.child and self.child.poll() is None else None,
            "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "updated_unix": time.time(),
        }).encode())
        self.last_status = time.monotonic()

    def stop_child(self):
        if self.child and self.child.poll() is None:
            os.killpg(self.child.pid, signal.SIGTERM)
            try:
                self.child.wait(timeout=15)
            except subprocess.TimeoutExpired:
                os.killpg(self.child.pid, signal.SIGKILL)
                self.child.wait(timeout=5)
        self.child = None

    def start(self, manifest):
        content = read_revision(self.directory, manifest)
        # Validate using exactly the YAML parser installed in the upstream image.
        check = subprocess.run([
            "node", "--input-type=module", "-e",
            "import fs from 'fs'; import yaml from 'js-yaml'; "
            "const c=yaml.load(fs.readFileSync(0,'utf8')); "
            "if(!c?.client?.timezone || !Array.isArray(c?.relay?.agents)) process.exit(2);"
        ], input=content, cwd="/usr/app", stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=10)
        if check.returncode:
            raise ValueError("Relay YAML validation failed")
        self.stop_child()
        atomic_write(self.runtime / "setup.yaml", content)
        environment = os.environ.copy()
        environment["L99_SETUP_FOLDER"] = str(self.runtime)
        self.active = manifest
        self.child = subprocess.Popen(["node", "/usr/app/src/index.js"], env=environment, cwd="/usr/app", start_new_session=True)
        self.started = time.monotonic()
        self.pending = True
        self.status("applying", "A relay folyamat elindult; az indulási időszak ellenőrzése folyamatban.")
        print("runner: starting revision", manifest["revision"], flush=True)

    def reject(self, manifest, reason):
        self.failed = manifest["revision"]
        self.pending = False
        self.persist()
        print("runner: rejected revision", self.failed, reason, flush=True)
        if self.good and self.good["revision"] != self.failed:
            self.start(self.good)
            self.status("applying", "Az új konfiguráció nem indult el; visszaállás a korábbi verzióra.")
        else:
            self.stop_child()
            self.status("failed", "A relay nem tudott elindulni. Javítsd a konfigurációt, majd ments új verziót.")

    def run(self):
        def shutdown(_signum, _frame):
            self.stopping = True
        signal.signal(signal.SIGTERM, shutdown)
        signal.signal(signal.SIGINT, shutdown)
        self.status("starting", "A relay-runner indul.")
        try:
            while not self.stopping:
                try:
                    self.requested = read_json(self.directory / "desired.json")
                    target = self.requested
                    if target and target.get("revision") == self.failed:
                        target = self.good
                    if target and (not self.active or target["revision"] != self.active["revision"]):
                        try:
                            self.start(target)
                        except (ValueError, OSError, subprocess.SubprocessError) as error:
                            self.reject(target, str(error))
                    if self.child and self.child.poll() is not None:
                        code = self.child.returncode
                        if self.pending:
                            self.reject(self.active, "relay exited during startup: " + str(code))
                        else:
                            self.status("restarting", "A relay folyamat kilépett; újraindítás folyamatban.")
                            if time.monotonic() - self.started >= 5:
                                self.start(self.active)
                    if self.child and self.child.poll() is None and self.pending and time.monotonic() - self.started >= self.grace:
                        self.pending = False
                        self.good = self.active
                        if self.failed == self.active["revision"]:
                            self.failed = None
                        self.persist()
                        self.status("running", "A relay folyamat fut. Az adatbeérkezést a dashboardon ellenőrizd.")
                    if time.monotonic() - self.last_status >= 5:
                        self.status()
                except (ValueError, OSError, KeyError) as error:
                    print("runner: control error", str(error), flush=True)
                    self.status("failed", "A konfiguráció vagy az állapotfájl nem olvasható. Ellenőrizd a runner naplóját.")
                time.sleep(1)
        finally:
            self.stop_child()
            self.status("stopped", "A relay-runner leállt.")


def healthcheck():
    directory = Path(os.environ.get("KFGYR_CONFIG_DIR", "/var/lib/kfgyr-monitoring"))
    status = read_json(directory / "status.json", {})
    if status.get("state") != "running" or time.time() - status.get("updated_unix", 0) > 30:
        return 1
    try:
        os.kill(int(status["pid"]), 0)
    except (OSError, KeyError, ValueError):
        return 1
    return 0


if __name__ == "__main__":
    os.umask(0o007)
    if "--healthcheck" in sys.argv:
        sys.exit(healthcheck())
    Runner().run()

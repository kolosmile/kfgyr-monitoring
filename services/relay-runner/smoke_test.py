"""Linux/Docker integration check with a disposable fake relay and isolated config."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import uuid

image = sys.argv[1] if len(sys.argv) > 1 else "ghcr.io/kolosmile/kfgyr-relay-runner:0.3.0"
name = "kfgyr-runner-smoke-" + uuid.uuid4().hex[:10]


def wait_status(root, condition, timeout=35):
    deadline = time.monotonic() + timeout
    last = {}
    while time.monotonic() < deadline:
        try:
            last = json.loads((root / "status.json").read_text())
            if condition(last):
                return last
        except (FileNotFoundError, json.JSONDecodeError):
            pass
        time.sleep(0.5)
    raise AssertionError("runner state timeout: " + json.dumps(last))


def request(root, revision, title):
    content = ("client:\n  name: " + title + "\n  timezone: Europe/Budapest\nrelay:\n  agents: []\n").encode()
    (root / "revisions" / (revision + ".yaml")).write_bytes(content)
    pending = root / "pending.json"
    pending.write_text(json.dumps({"revision": revision, "sha256": hashlib.sha256(content).hexdigest()}))
    os.replace(pending, root / "desired.json")


with tempfile.TemporaryDirectory(prefix="kfgyr-runner-smoke-") as temporary:
    directory = Path(temporary)
    config = directory / "config"
    (config / "revisions").mkdir(parents=True)
    fake = directory / "fake.js"
    fake.write_text("""import fs from 'fs';
import yaml from 'js-yaml';
const config=yaml.load(fs.readFileSync(process.env.L99_SETUP_FOLDER+'/setup.yaml','utf8'));
if(config.client.name==='fail') process.exit(42);
console.log('FAKE_RELAY_STARTED');
process.on('SIGTERM',()=>{console.log('FAKE_RELAY_STOPPED');process.exit(0)});
setInterval(()=>{},1000);
""")
    request(config, "first", "initial")
    os.chmod(directory, 0o755)
    os.chmod(config, 0o770)
    os.chmod(config / "revisions", 0o770)
    try:
        subprocess.run(["docker", "run", "-d", "--name", name, "--network", "none",
                        "--user", "1000:0",
                        "-e", "KFGYR_RELAY_STARTUP_SECONDS=2",
                        "-e", "KFGYR_RUNNER_API_TOKEN=smoke-test-token-0123456789-abcdefghijklmnopqrstuvwxyz",
                        "--mount", "type=bind,src="+str(config)+",dst=/var/lib/kfgyr-monitoring",
                        "--mount", "type=bind,src="+str(fake)+",dst=/usr/app/src/index.js,readonly",
                        image], check=True, stdout=subprocess.DEVNULL)
        first = wait_status(config, lambda s: s.get("state") == "running" and s.get("revision") == "first")
        request(config, "second", "updated")
        second = wait_status(config, lambda s: s.get("state") == "running" and s.get("revision") == "second")
        assert first["pid"] != second["pid"], "config apply did not restart relay"
        request(config, "broken", "fail")
        wait_status(config, lambda s: s.get("state") == "running" and s.get("revision") == "second" and s.get("failed_revision") == "broken")
        subprocess.run(["docker", "exec", name, "python3", "/opt/kfgyr/server.py", "--healthcheck"], check=True)
        subprocess.run(["docker", "restart", "--time", "20", name], check=True, stdout=subprocess.DEVNULL)
        wait_status(config, lambda s: s.get("state") == "running" and s.get("revision") == "second" and s.get("failed_revision") == "broken")
        subprocess.run(["docker", "stop", "--time", "20", name], check=True, stdout=subprocess.DEVNULL)
        logs = subprocess.check_output(["docker", "logs", name], stderr=subprocess.STDOUT).decode()
        assert logs.count("FAKE_RELAY_STOPPED") >= 3, "graceful shutdown was not propagated"
        assert json.loads((config / "status.json").read_text())["state"] == "stopped"
        print("PASS: start, revision apply, early-failure rollback, restart recovery, healthcheck and graceful stop")
    finally:
        subprocess.run(["docker", "rm", "-f", name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

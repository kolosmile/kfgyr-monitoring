"""Seed a new shared configuration directory; never overwrite an existing desired config."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re

parser = argparse.ArgumentParser()
parser.add_argument("source", type=Path)
parser.add_argument("destination", type=Path)
parser.add_argument("--revision", default="initial")
args = parser.parse_args()
if not re.fullmatch(r"[a-zA-Z0-9_-]{1,80}", args.revision):
    raise SystemExit("Invalid revision")
os.umask(0o007)
args.destination.mkdir(parents=True, exist_ok=True)
manifest = args.destination / "desired.json"
if manifest.exists():
    raise SystemExit("A desired configuration already exists; seed aborted")
content = args.source.read_bytes()
revisions = args.destination / "revisions"
revisions.mkdir(exist_ok=True)
with (revisions / (args.revision + ".yaml")).open("xb") as handle:
    handle.write(content)
    handle.flush()
    os.fsync(handle.fileno())
with manifest.open("x") as handle:
    json.dump({"revision": args.revision, "sha256": hashlib.sha256(content).hexdigest()}, handle)
    handle.flush()
    os.fsync(handle.fileno())
print("Seeded", args.revision)

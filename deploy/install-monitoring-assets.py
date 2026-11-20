"""Install a verified Grafana plugin release before Grafana starts."""

import argparse
import hashlib
import io
import json
import os
import re
import shutil
import tempfile
from pathlib import Path
from urllib.request import Request, urlopen
from zipfile import ZipFile


REPOSITORY = "kolosmile/kfgyr-monitoring"
RELEASES = f"https://api.github.com/repos/{REPOSITORY}/releases"
RAW = f"https://raw.githubusercontent.com/{REPOSITORY}"
PLUGIN = "kfgyr-monitoring-app"
DASHBOARDS = {
    "home.json": ("55d75adada483a4a1ac53f63741960be64756a11/dashboards/managed/home.json", "kfgyr-home"),
    "machine-monitoring.json": (
        "55d75adada483a4a1ac53f63741960be64756a11/dashboards/managed/machine-monitoring.json",
        "kfgyr-machine-monitoring",
    ),
    "mazak-digital-twin.json": (
        "170f50ec049965fab5383b6eecee6eb5eab5efc2/examples/mazak-digital-twin.json",
        "kfgyr-mazak-digital-twin",
    ),
}


def download(url):
    with urlopen(Request(url, headers={"User-Agent": "kfgyr-monitoring-installer"}), timeout=45) as response:
        return response.read()


def plugin_version(path):
    manifest = path / "plugin.json"
    panel = path / "navigation" / "plugin.json"
    if not all(file.is_file() for file in (manifest, panel, path / "module.js", path / "navigation/module.js")):
        return None
    app = json.loads(manifest.read_text(encoding="utf-8"))
    navigation = json.loads(panel.read_text(encoding="utf-8"))
    version = app["info"]["version"]
    if app["id"] == PLUGIN and navigation["id"] == "kfgyr-navigation-panel" and navigation["info"]["version"] == version:
        return version
    return None


def install_plugin(root, requested):
    if requested != "latest" and not re.fullmatch(r"plugin-v\d+\.\d+\.\d+", requested):
        raise ValueError(f"Invalid plugin release: {requested}")
    release = json.loads(download(f"{RELEASES}/latest" if requested == "latest" else f"{RELEASES}/tags/{requested}"))
    tag = release["tag_name"]
    if not re.fullmatch(r"plugin-v\d+\.\d+\.\d+", tag):
        raise RuntimeError(f"Unexpected plugin release: {tag}")
    version = tag.removeprefix("plugin-v")
    root.mkdir(parents=True, exist_ok=True)
    target = root / PLUGIN
    marker = root / f".{PLUGIN}-verified"
    if marker.is_file() and marker.read_text().strip() == version and plugin_version(target) == version:
        print(f"Grafana plugin {version} is already installed", flush=True)
        return

    name = f"{PLUGIN}-{version}.zip"
    asset = next((asset for asset in release["assets"] if asset["name"] == name), None)
    if not asset:
        raise RuntimeError(f"Release {tag} is missing {name}")
    data = download(asset["browser_download_url"])
    if asset.get("digest") != "sha256:" + hashlib.sha256(data).hexdigest():
        raise RuntimeError(f"SHA-256 mismatch for {name}")

    with tempfile.TemporaryDirectory(dir=root, prefix=".plugin-stage-") as temporary:
        stage = Path(temporary)
        with ZipFile(io.BytesIO(data)) as package:
            package.extractall(stage)
        candidate = stage / PLUGIN
        if plugin_version(candidate) != version:
            raise RuntimeError(f"Plugin files do not match release {tag}")
        binaries = list(candidate.glob("gpx_*"))
        if not binaries:
            raise RuntimeError("Missing Grafana backend binaries")
        for binary in binaries:
            binary.chmod(0o755)

        previous = stage / "previous"
        if target.exists():
            target.rename(previous)
        try:
            candidate.rename(target)
        except OSError:
            if previous.exists():
                previous.rename(target)
            raise
    marker.write_text(version + "\n", encoding="utf-8")
    print(f"Installed Grafana plugin {version}", flush=True)


def install_dashboards(directory):
    if all((directory / name).is_file() for name in DASHBOARDS):
        return
    directory.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=directory) as temporary:
        stage = Path(temporary)
        for name, (source, uid) in DASHBOARDS.items():
            content = download(f"{RAW}/{source}")
            model = json.loads(content)
            if model.get("uid", model.get("metadata", {}).get("name")) != uid:
                raise RuntimeError(f"Unexpected dashboard UID: {name}")
            (stage / name).write_bytes(content)
        for name in DASHBOARDS:
            if not (directory / name).is_file():
                os.replace(stage / name, directory / name)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--plugin-dir", type=Path, required=True)
    parser.add_argument("--dashboard-dir", type=Path)
    args = parser.parse_args()
    install_plugin(args.plugin_dir, os.environ.get("KFGYR_PLUGIN_RELEASE") or "latest")
    if args.dashboard_dir:
        install_dashboards(args.dashboard_dir)


if __name__ == "__main__":
    main()

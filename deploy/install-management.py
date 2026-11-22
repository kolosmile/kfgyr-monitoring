"""Set up KFGyR management resources in a running Grafana organization."""

import argparse
import base64
from datetime import datetime, timezone
import getpass
import json
import os
from pathlib import Path
import sys
from urllib.error import HTTPError
from urllib.parse import urlencode, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener


DEFAULT_TEAM = "KFGyR kezelők"
DEMO_FOLDER_UID = "dfzd3yhtd8c1sd"
DEMO_DASHBOARDS = {"kfgyr-data-export", "kfgyr-l99-demo"}


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def grafana_api(base_url, org_id, auth):
    opener = build_opener(NoRedirect)

    def request(path, method="GET", data=None, *, missing=False):
        headers = {"Authorization": auth, "X-Grafana-Org-Id": str(org_id), "Content-Type": "application/json"}
        payload = json.dumps(data).encode() if data is not None else None
        try:
            with opener.open(Request(base_url + "/api/" + path, payload, headers, method=method), timeout=15) as response:
                return json.load(response)
        except HTTPError as exc:
            if missing and exc.code == 404:
                return None
            raise RuntimeError(f"Grafana {method} /api/{path}: HTTP {exc.code}") from None

    return request


def ensure_team(request, name):
    params = urlencode({"name": name, "perpage": 100})
    entries = request("teams/search?" + params)["teams"]
    matches = [team for team in entries if team["name"] == name]
    if matches:
        return matches[0]["id"]
    return request("teams", "POST", {"name": name})["teamId"]


def remove_demo_folder(request, backup_root):
    folder_path = f"folders/{DEMO_FOLDER_UID}"
    folder = request(folder_path, missing=True)
    if folder is None:
        print("KFGyR Demo is already absent")
        return
    if folder["title"] != "KFGyR Demo":
        raise RuntimeError("The target folder is no longer named KFGyR Demo")
    params = urlencode({"folderUIDs": DEMO_FOLDER_UID, "limit": 100})
    contents = request("search?" + params)
    if any(item["type"] != "dash-db" or item["uid"] not in DEMO_DASHBOARDS for item in contents):
        raise RuntimeError("The Demo folder contains resources outside the requested cleanup")
    backup = Path(backup_root) / datetime.now(timezone.utc).strftime("kfgyr-demo-%Y%m%dT%H%M%S%fZ")
    backup.mkdir(parents=True, mode=0o700)
    (backup / "folder.json").write_text(json.dumps(folder, ensure_ascii=False, indent=2), encoding="utf-8")
    for item in contents:
        uid = item["uid"]
        dashboard = request(f"dashboards/uid/{uid}")
        if dashboard["meta"].get("provisioned") or dashboard["meta"].get("folderUid") != DEMO_FOLDER_UID:
            raise RuntimeError(f"Unexpected dashboard ownership: {uid}")
        (backup / f"{uid}.json").write_text(json.dumps(dashboard, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Demo folder backup: {backup}", flush=True)
    for item in contents:
        request(f'dashboards/uid/{item["uid"]}', "DELETE")
    request(folder_path, "DELETE")
    if request(folder_path, missing=True) is not None:
        raise RuntimeError("The Demo folder is still present")
    print("KFGyR Demo folder removed")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default=os.getenv("KFGYR_GRAFANA_URL", "http://127.0.0.1:3000"))
    parser.add_argument("--org-id", type=int, default=int(os.getenv("KFGYR_ADMIN_ORG_ID", "1")))
    parser.add_argument("--remove-demo", action="store_true")
    parser.add_argument("--backup-dir", type=Path, default=Path("artifacts"))
    args = parser.parse_args()
    base_url = args.url.rstrip("/")
    url = urlsplit(base_url)
    if url.scheme not in ("http", "https") or not url.hostname or url.username or url.password or url.query or url.fragment:
        parser.error("Grafana URL must be an HTTP(S) base URL without credentials")

    token = os.getenv("KFGYR_GRAFANA_MANAGEMENT_TOKEN")
    if token:
        auth = "Bearer " + token
    else:
        if not sys.stdin.isatty():
            parser.error("Use an interactive terminal or set KFGYR_GRAFANA_MANAGEMENT_TOKEN")
        username = os.getenv("KFGYR_GRAFANA_ADMIN_USER", "admin")
        password = getpass.getpass(f"Grafana password ({username}): ")
        auth = "Basic " + base64.b64encode(f"{username}:{password}".encode()).decode()
    request = grafana_api(base_url, args.org_id, auth)
    name = os.getenv("KFGYR_OPERATOR_TEAM_NAME", "").strip() or DEFAULT_TEAM
    team_id = ensure_team(request, name)
    print(f"Grafana team ready: {name} (ID {team_id})")
    if args.remove_demo:
        remove_demo_folder(request, args.backup_dir)


if __name__ == "__main__":
    try:
        main()
    except (OSError, RuntimeError) as exc:
        raise SystemExit(str(exc)) from None

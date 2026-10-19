import copy
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import tempfile
import threading
import time
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from configuration import Problem, Store
from discovery import Discovery, Policy, local_networks, probe
from runner import atomic_write
from server import create_app

TOKEN = "test-token-" + "a" * 40
CONFIG = {"client": {"name": "Demo", "timezone": "Europe/Budapest"}, "relay": {"agents": [
    {"alias": "Demo", "url": "http://192.168.88.20:5000", "retention": "1week", "devices": [{"id": "d1", "alias": "Mazak"}]}
]}, "custom": {"preserve": True}}


class APITests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.policy = Policy(hosts="demo.mtconnect.org", networks="192.168.88.0/24", route_path="missing", discovery_networks="192.168.88.0/24")
        self.app = create_app(self.temp.name, TOKEN, self.policy, supervise=False)
        self.client = self.enterContext(TestClient(self.app))
        self.client.headers.update({"Authorization": "Bearer " + TOKEN})

    def seed(self):
        return self.client.put("/v1/config", json={"base_revision": "initial", "config": copy.deepcopy(CONFIG)})

    def test_auth_covers_every_endpoint_and_openapi(self):
        for path in ("/v1/config", "/v1/status", "/v1/networks", "/v1/discovery", "/openapi.json", "/docs"):
            response = self.client.get(path, headers={"Authorization": "Bearer wrong"})
            self.assertEqual(response.status_code, 401, path)
            self.assertNotIn(TOKEN, response.text)
        self.assertEqual(self.client.get("/healthz", headers={"Authorization": ""}).status_code, 200)
        self.assertEqual(self.client.get("/openapi.json").status_code, 200)

    def test_save_concurrency_unknown_fields_and_rollback(self):
        initial = self.seed().json()
        changed = copy.deepcopy(initial["config"])
        changed["client"]["name"] = "Changed"
        response = self.client.put("/v1/config", json={"base_revision": initial["revision"], "config": changed}, headers={"X-KFGYR-Actor": "admin"})
        self.assertEqual(response.status_code, 200, response.text)
        second = response.json()
        self.assertTrue(second["config"]["custom"]["preserve"])
        stale = self.client.put("/v1/config", json={"base_revision": initial["revision"], "config": changed})
        self.assertEqual(stale.status_code, 409)
        restored = self.client.post("/v1/rollback", json={"base_revision": second["revision"], "revision": initial["revision"]})
        self.assertEqual(restored.status_code, 200, restored.text)
        self.assertEqual(restored.json()["config"], CONFIG)
        audit = json.loads((Path(self.temp.name) / "revisions" / (second["revision"] + ".json")).read_text())
        self.assertEqual(audit["actor"], "admin")
        self.assertEqual(self.client.post("/v1/rollback", json={"base_revision": second["revision"], "revision": "../desired"}).status_code, 422)

    def test_rejected_config_does_not_change_manifest(self):
        saved = self.seed().json()
        for key, value in (("retention", "0days"), ("retention", "1week'; DROP TABLE raw.history; --"), ("url", "http://127.0.0.1")):
            config = copy.deepcopy(CONFIG)
            config["relay"]["agents"][0][key] = value
            self.assertEqual(self.client.put("/v1/config", json={"base_revision": saved["revision"], "config": config}).status_code, 400)
        config = copy.deepcopy(CONFIG)
        config["relay"]["agents"][0]["devices"][0]["alias"] = "Renamed"
        self.assertEqual(self.client.put("/v1/config", json={"base_revision": saved["revision"], "config": config}).status_code, 400)
        self.assertEqual(self.client.get("/v1/config").json()["revision"], saved["revision"])

    def test_checksum_mismatch_fails_closed_and_body_is_bounded(self):
        saved = self.seed().json()
        path = Path(self.temp.name) / "revisions" / (saved["revision"] + ".yaml")
        path.write_text("changed")
        with self.assertRaises(ValueError):
            self.app.state.store.load()
        response = self.client.put("/v1/config", content=b"x" * (1024 * 1024 + 1))
        self.assertEqual(response.status_code, 413)
        self.assertEqual(self.client.post("/v1/discovery", json={"network": "100.64.0.0/10", "ports": [5000]}).status_code, 400)
        self.assertEqual(self.client.post("/v1/discovery", json={"network": "192.168.88.0/24", "ports": [0]}).status_code, 400)


class NetworkTests(unittest.TestCase):
    def test_host_route_detection_excludes_docker_and_default_routes(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "routes"
            path.write_text("Iface Destination Gateway Flags RefCnt Use Metric Mask\n"
                            "enp0s25 00000000 0158A8C0 0003 0 0 100 00000000\n"
                            "docker0 0000000A 00000000 0001 0 0 0 00FFFFFF\n"
                            "enp0s25 0058A8C0 00000000 0001 0 0 100 00FFFFFF\n")
            self.assertEqual(local_networks(path), [{"cidr": "192.168.88.0/24", "interface": "enp0s25", "source": "detected"}])

    def test_policy_rejects_unsafe_targets(self):
        policy = Policy(hosts="demo.mtconnect.org", networks="192.168.88.0/24", route_path="missing", discovery_networks="")
        for url in ("http://127.0.0.1", "http://169.254.169.254", "http://db:5432", "file:///etc/passwd", "https://user:pass@demo.mtconnect.org", "https://demo.mtconnect.org?token=a", "http://192.168.1.1", "http://demo.mtconnect.org:0"):
            with self.assertRaises(Problem, msg=url):
                policy.parse(url)

    def test_probe_validates_real_http_and_rejects_xml_entities(self):
        class Handler(BaseHTTPRequestHandler):
            data = b'<MTConnectDevices xmlns="urn:mtconnect.org:MTConnectDevices:2.2"><Devices><Device id="d1" name="Mazak" uuid="test"/></Devices></MTConnectDevices>'
            def do_GET(self):
                self.send_response(200)
                self.end_headers()
                self.wfile.write(self.data)
            def log_message(self, *_args):
                pass
        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        self.addCleanup(server.server_close)
        self.addCleanup(server.shutdown)
        policy = Policy(hosts="", networks="", route_path="missing", discovery_networks="")
        # Loopback is permitted only by this test double, never by production Policy.
        policy.allowed_ip = lambda address, named=False: address == "127.0.0.1"
        url = f"http://127.0.0.1:{server.server_port}"
        self.assertEqual(probe(policy, url)["devices"][0]["id"], "d1")
        Handler.data = b'<!DOCTYPE x [<!ENTITY attack SYSTEM "file:///etc/passwd">]><MTConnectDevices>&attack;</MTConnectDevices>'
        with self.assertRaises(Problem):
            probe(policy, url)

    def test_scan_progress_cancellation_and_scope(self):
        policy = Policy(hosts="", networks="192.168.88.0/24", route_path="missing", discovery_networks="192.168.88.0/24")
        manager = Discovery(policy)
        self.addCleanup(manager.shutdown)
        with self.assertRaises(Problem):
            manager.start("192.168.0.0/16", [5000])
        gate = threading.Event()
        def fake_probe(*_args, **_kwargs):
            gate.wait(1)
            return {"devices": [{"id": "d1", "name": "Demo", "uuid": "test"}]}
        with patch("discovery.probe", side_effect=fake_probe):
            job = manager.start("192.168.88.0/30", [5000])
            with self.assertRaises(Problem):
                manager.start("192.168.88.0/30", [5000])
            manager.cancel(job["id"])
            gate.set()
            deadline = time.monotonic() + 3
            while manager.get(job["id"])["state"] in ("running", "cancelling") and time.monotonic() < deadline:
                time.sleep(.01)
            self.assertEqual(manager.get(job["id"])["state"], "cancelled")
            job = manager.start("192.168.88.0/30", [5000])
            while manager.get(job["id"])["state"] == "running" and time.monotonic() < deadline:
                time.sleep(.01)
            completed = manager.get(job["id"])
            self.assertEqual(completed["completed"], completed["total"])
            self.assertEqual(len(completed["results"]), 2)


if __name__ == "__main__":
    unittest.main()

import copy
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import tempfile
import threading
import time
import unittest
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from configuration import Problem, Store
from discovery import Discovery, Policy, local_networks, probe
from monitoring import Panel, validate_dashboard_panels
from runner import atomic_write
from server import create_app

TOKEN = "test-token-" + "a" * 40
CONFIG = {"client": {"name": "Demo", "timezone": "Europe/Budapest"}, "relay": {"agents": [
    {"alias": "Demo", "url": "http://192.168.88.20:5000", "retention": "1week", "devices": [{"id": "d1", "alias": "Mazak"}]}
]}, "custom": {"preserve": True}}


class DashboardPanelTests(unittest.TestCase):
    def test_schema_change_keeps_saved_panels_and_allows_new_available_signal(self):
        db = MagicMock()
        db.execute.return_value = [("available-point",)]
        missing = Panel(signal_id="old_spindle", view="chart")
        old_point = Panel(point="old-point", view="chart")
        new = Panel(signal_id="tool_number", view="value")
        saved = [missing.model_dump(), old_point.model_dump()]
        with patch("monitoring.machine_info", return_value=("Mazak", "d1", "Mazak/CV5")), \
             patch("monitoring._machine_signal_options", return_value=[{"id": "tool_number", "kind": "signal"}]):
            validate_dashboard_panels(db, "4295", [new, missing, old_point], saved)
            validate_dashboard_panels(db, "4295", [new], saved)
            for panels in ([missing, missing], [old_point, old_point], [Panel(signal_id="unknown", view="value")]):
                with self.subTest(panels=panels), self.assertRaises(Problem):
                    validate_dashboard_panels(db, "4295", panels, saved)
            with self.assertRaises(Problem):
                validate_dashboard_panels(db, "4295", [missing])


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

    def test_confirmed_agent_removal_follows_pending_revisions_but_not_rollback(self):
        store = self.app.state.store
        initial = self.seed().json()
        removed = copy.deepcopy(CONFIG)
        removed["relay"]["agents"] = []
        disabled = copy.deepcopy(CONFIG)
        disabled["relay"]["agents"][0]["ignore"] = True
        paused = store.save(initial["revision"], disabled, "operator", purge_removed_agents=True)
        manifest = store.directory / "desired.json"
        self.assertNotIn("purge_agents", json.loads(manifest.read_text()))
        deletion = store.save(paused["revision"], removed, "operator", purge_removed_agents=True)
        self.assertEqual(json.loads(manifest.read_text())["purge_agents"], ["Demo"])
        self.assertEqual(json.loads((store.directory / "revisions" / (deletion["revision"] + ".json")).read_text())
                         ["purge_agents"], ["Demo"])
        removed["client"]["name"] = "Changed"
        pending = store.save(deletion["revision"], removed, "operator", purge_removed_agents=True)
        self.assertEqual(json.loads(manifest.read_text())["purge_agents"], ["Demo"])
        restored = store.save(pending["revision"], CONFIG, "operator", purge_removed_agents=True)
        self.assertNotIn("purge_agents", json.loads(manifest.read_text()))
        store.rollback(restored["revision"], deletion["revision"], "operator")
        self.assertNotIn("purge_agents", json.loads(manifest.read_text()))

    def test_rejected_config_does_not_change_manifest(self):
        saved = self.seed().json()
        for key, value in (("retention", "0days"), ("retention", "1week'; DROP TABLE raw.history; --"), ("url", "http://127.0.0.1")):
            config = copy.deepcopy(CONFIG)
            config["relay"]["agents"][0][key] = value
            self.assertEqual(self.client.put("/v1/config", json={"base_revision": saved["revision"], "config": config}).status_code, 400)
        self.assertEqual(self.client.get("/v1/config").json()["revision"], saved["revision"])

    def test_device_alias_can_be_changed(self):
        saved = self.seed().json()
        config = copy.deepcopy(CONFIG)
        config["relay"]["agents"][0]["devices"][0]["alias"] = "Renamed"
        response = self.client.put("/v1/config", json={"base_revision": saved["revision"], "config": config})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["config"]["relay"]["agents"][0]["devices"][0]["alias"], "Renamed")

    def test_machine_dataitems_return_name_separately_from_path(self):
        db = MagicMock()
        db.execute.return_value.fetchall.return_value = [
            ("4342", "Mazak/CV5/Axes/Rotary[C]/RotaryVelocityActual", "REVOLUTION/MINUTE",
             "SAMPLE", "ROTARY_VELOCITY", "ACTUAL", "Srpm"),
            ("4390", "Mazak/CV5/Controller/Path/ProgramEdit", "", "EVENT", "PROGRAM_EDIT", "", ""),
        ]
        with patch("monitoring.psycopg.connect") as connect, \
             patch("monitoring.machine_info", return_value=("Mazak", "d1", "Mazak/CV5")):
            connect.return_value.__enter__.return_value = db
            response = self.client.get("/v1/machines/4295/dataitems")
        self.assertEqual(response.status_code, 200, response.text)
        first, second = response.json()["dataitems"]
        self.assertEqual(first["name"], "Srpm")
        self.assertEqual(first["path"], "/Axes/Rotary[C]/RotaryVelocityActual")
        self.assertEqual(second["name"], "")

    def test_dashboard_routes_dispatch_and_require_authentication(self):
        with patch("monitoring.list_dashboards", return_value={"dashboards": []}) as listing:
            response = self.client.get("/v1/machines/123/dashboards")
            self.assertEqual(response.status_code, 200)
            listing.assert_called_once_with("123")
            self.assertEqual(self.client.get("/v1/machines/123/dashboards",
                                             headers={"Authorization": "Bearer wrong"}).status_code, 401)
        with patch("monitoring.create_dashboard", return_value={"id": 7}) as create:
            response = self.client.post("/v1/dashboards", json={"machine": "123", "name": "Áttekintés"})
            self.assertEqual(response.json(), {"id": 7})
            self.assertEqual(create.call_args.args[0].machine, "123")
        with patch("monitoring.set_default_dashboard", return_value={"id": 7}) as choose:
            payload = {"machine": "123", "id": 7}
            response = self.client.put("/v1/dashboards/default", json=payload)
            self.assertEqual(response.json(), {"id": 7})
            self.assertEqual(choose.call_args.args[0].model_dump(), payload)
            self.assertEqual(self.client.put("/v1/dashboards/default", json={"id": 7}).status_code, 422)
        with patch("monitoring.delete_dashboard", return_value={"deleted": True}) as delete:
            response = self.client.post("/v1/dashboards/delete", json={"id": 7, "revision": 2})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(delete.call_args.args[0].revision, 2)

    def test_dashboard_save_after_machine_schema_change(self):
        db = MagicMock()
        saved_panel = {"signal_id": "old_spindle", "view": "chart"}
        db.execute.return_value.fetchone.side_effect = [
            ("Mazak", "d1", "generic", [saved_panel], 3), ("4295",),
            ("Mazak", "d1", "Mazak/CV5"), (4,),
        ]
        panels = [saved_panel, {"signal_id": "tool_number", "view": "value"}]
        with patch("monitoring.psycopg.connect") as connect, \
             patch("monitoring._machine_signal_options", return_value=[{"id": "tool_number", "kind": "signal"}]):
            connect.return_value.__enter__.return_value = db
            response = self.client.put("/v1/dashboards", json={
                "id": 7, "name": "Áttekintés", "panels": panels, "revision": 3,
            })
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json(), {"revision": 4})
        self.assertEqual(db.execute.call_args.args[1][1].obj, panels)

    def test_dashboard_copy_preview_matches_creation(self):
        source = [
            {"signal_id": "rpm", "view": "gauge"},
            {"signal_id": "old_spindle", "view": "chart"},
            {"name": "X pozíció", "point": "old-point", "view": "chart"},
        ]
        source_row = ("Source", "d1", "generic", source, "22")
        db = MagicMock()
        db.execute.return_value.fetchone.side_effect = [source_row, source_row, (8,)]
        db.execute.return_value.__iter__.return_value = [("old_spindle", "C orsófordulat")]
        with patch("monitoring.psycopg.connect") as connect, \
             patch("monitoring.machine_info", return_value=("Target", "d2", "Target/CV5")), \
             patch("monitoring._machine_signal_options", side_effect=[
                 [{"id": "rpm", "kind": "signal"}], [], [{"id": "rpm", "kind": "signal"}], [],
             ]):
            connect.return_value.__enter__.return_value = db
            payload = {"machine": "123", "source_dashboard_id": 7}
            self.assertEqual(self.client.post("/v1/dashboards/copy-preview", json=payload,
                                              headers={"Authorization": "Bearer wrong"}).status_code, 401)
            preview = self.client.post("/v1/dashboards/copy-preview", json=payload)
            self.assertEqual(preview.json(), {"copied_panels": 1, "skipped_panels": [
                {"name": "C orsófordulat", "view": "chart"}, {"name": "X pozíció", "view": "chart"},
            ]})
            created = self.client.post("/v1/dashboards", json={**payload, "name": "Másolat"})
        self.assertEqual(created.json(), {"id": 8, "skipped_panels": 2})
        self.assertEqual(db.execute.call_args.args[1][3].obj, source[:1])

    def test_machine_availability_uses_configured_agent(self):
        self.seed()
        with patch("monitoring.get_machine_key", return_value=("Demo", "d1")), \
             patch("server.probe", return_value={"devices": [{"id": "d1"}]}) as check:
            response = self.client.get("/v1/availability/123")
            self.assertEqual(response.json(), {"status": "online", "agent_status": "online"})
            self.assertEqual(check.call_args.args[1], "http://192.168.88.20:5000")
        with patch("monitoring.get_machine_key", return_value=("Demo", "d1")), \
             patch("server.probe", return_value={"devices": []}):
            self.assertEqual(self.client.get("/v1/availability/123").json(),
                             {"status": "unknown", "agent_status": "online"})
        with patch("monitoring.get_machine_key", return_value=("Demo", "d1")), \
             patch("server.probe", side_effect=Problem(502, "Az agent nem érhető el.")):
            self.assertEqual(self.client.get("/v1/availability/123").json(),
                             {"status": "offline", "agent_status": "offline"})

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
        Handler.data = b'<MTConnectDevices><Devices/></MTConnectDevices>'
        self.assertEqual(probe(policy, url)["devices"], [])
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

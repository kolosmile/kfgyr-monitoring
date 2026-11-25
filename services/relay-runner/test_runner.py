import hashlib
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, patch

from runner import Runner, atomic_write, healthcheck, read_revision


class ConfigurationProtocolTests(unittest.TestCase):
    def test_runner_retries_agent_cleanup_before_accepting_revision(self):
        with tempfile.TemporaryDirectory() as directory:
            purge = Mock(side_effect=[False, True])
            with patch.dict(os.environ, {"KFGYR_CONFIG_DIR": directory, "KFGYR_RELAY_RUNTIME_DIR": directory}):
                runner = Runner(purge_removed=purge)
            runner.good = {"revision": "old"}
            runner.active = runner.requested = {"revision": "new", "purge_agents": ["Removed"]}
            runner.pending = True
            with patch("runner.time.monotonic", return_value=10):
                runner.finish_apply()
                runner.finish_apply()
            purge.assert_called_once_with(runner.active)
            self.assertEqual(runner.good["revision"], "old")
            self.assertTrue(runner.pending)
            with patch("runner.time.monotonic", return_value=16):
                runner.finish_apply()
                runner.finish_apply()
            self.assertEqual(purge.call_count, 2)
            self.assertEqual(runner.good["revision"], "new")
            self.assertFalse(runner.pending)

    def test_checksum_and_revision_path_are_required(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "revisions").mkdir()
            data = b"client: {}\nrelay: {}\n"
            (root / "revisions" / "valid.yaml").write_bytes(data)
            manifest = {"revision": "valid", "sha256": hashlib.sha256(data).hexdigest()}
            self.assertEqual(read_revision(root, manifest), data)
            with self.assertRaises(ValueError):
                read_revision(root, {**manifest, "sha256": "wrong"})
            with self.assertRaises(ValueError):
                read_revision(root, {**manifest, "revision": "../escape"})

    def test_atomic_replacement_and_health_requires_live_fresh_process(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "status.json"
            atomic_write(target, b'{"state":"waiting"}')
            self.assertEqual(json.loads(target.read_text())["state"], "waiting")
            with patch.dict(os.environ, {"KFGYR_CONFIG_DIR": directory}):
                self.assertEqual(healthcheck(), 1)
                atomic_write(target, json.dumps({"state": "running", "pid": os.getpid(), "updated_unix": 0}).encode())
                self.assertEqual(healthcheck(), 1)
                with patch("runner.time.time", return_value=20), patch("runner.os.kill"):
                    self.assertEqual(healthcheck(), 0)
            self.assertEqual(list(Path(directory).glob(".pending-*")), [])


if __name__ == "__main__":
    unittest.main()

import os
import unittest
from unittest.mock import patch

import psycopg
from psycopg.conninfo import conninfo_to_dict

import monitoring


TEST_DSN = os.getenv("KFGYR_TEST_PURGE_DSN")


@unittest.skipUnless(TEST_DSN, "requires the disposable TimescaleDB service")
class AgentCleanupTests(unittest.TestCase):
    def test_agent_cleanup_is_scoped_and_atomic(self):
        self.assertEqual(conninfo_to_dict(TEST_DSN).get("dbname"), "kfgyr_cleanup_test")
        connect = psycopg.connect
        with connect(TEST_DSN, autocommit=True) as db:
            db.execute("""
                CREATE EXTENSION IF NOT EXISTS timescaledb;
                CREATE SCHEMA raw;
                CREATE SCHEMA kfgyr;
                CREATE TABLE raw.nodes (node_id bigint PRIMARY KEY, props jsonb NOT NULL);
                CREATE TABLE raw.history (
                    node_id bigint REFERENCES raw.nodes, dataitem_id bigint REFERENCES raw.nodes,
                    time timestamptz NOT NULL, value jsonb
                );
                SELECT create_hypertable('raw.history', 'time');
                CREATE TABLE raw.bins (device_id bigint REFERENCES raw.nodes, time timestamptz NOT NULL);
                SELECT create_hypertable('raw.bins', 'time');
                CREATE TABLE raw.edges (from_id bigint REFERENCES raw.nodes, to_id bigint REFERENCES raw.nodes);
                CREATE TABLE raw.test_holds_node (node_id bigint REFERENCES raw.nodes);
                CREATE TABLE kfgyr.machine_dashboards (agent_alias text, device_id text);
                CREATE TABLE kfgyr.machine_monitoring (LIKE kfgyr.machine_dashboards);
                CREATE TABLE kfgyr.machine_schema_assignments (LIKE kfgyr.machine_dashboards);
                CREATE TABLE kfgyr.machine_schemas (name text);
                INSERT INTO raw.nodes VALUES
                    (1,'{"agentAlias":"Removed","node_type":"Device","deviceId":"d1"}'),
                    (2,'{"agentAlias":"Removed","node_type":"DataItem"}'),
                    (3,'{"agentAlias":"Other","node_type":"Device","deviceId":"d1"}'),
                    (4,'{"agentAlias":"Other","node_type":"DataItem"}');
                INSERT INTO raw.history VALUES (1,2,now(),'10'), (3,4,now(),'20');
                INSERT INTO raw.bins VALUES (1,now()), (3,now());
                INSERT INTO raw.edges VALUES (1,2), (3,4);
                INSERT INTO raw.test_holds_node VALUES (2);
                INSERT INTO kfgyr.machine_dashboards VALUES ('Removed','d1'), ('Other','d1');
                INSERT INTO kfgyr.machine_monitoring SELECT * FROM kfgyr.machine_dashboards;
                INSERT INTO kfgyr.machine_schema_assignments SELECT * FROM kfgyr.machine_dashboards;
                INSERT INTO kfgyr.machine_schemas VALUES ('Shared');
            """)
            with patch("monitoring.psycopg.connect", side_effect=lambda **kw: connect(TEST_DSN, **kw)):
                with self.assertRaises(psycopg.errors.ForeignKeyViolation):
                    monitoring.purge_agent_data(["Removed"])
                self.assertEqual(db.execute("SELECT count(*) FROM raw.history").fetchone()[0], 2)
                self.assertEqual(db.execute("SELECT count(*) FROM raw.bins").fetchone()[0], 2)
                self.assertEqual(db.execute("SELECT count(*) FROM raw.edges").fetchone()[0], 2)
                db.execute("DELETE FROM raw.test_holds_node")
                monitoring.purge_agent_data(["Removed"])
                monitoring.purge_agent_data(["Removed"])
            self.assertEqual(db.execute("SELECT node_id FROM raw.nodes ORDER BY node_id").fetchall(), [(3,), (4,)])
            self.assertEqual(db.execute("SELECT node_id, dataitem_id FROM raw.history").fetchall(), [(3, 4)])
            self.assertEqual(db.execute("SELECT device_id FROM raw.bins").fetchall(), [(3,)])
            self.assertEqual(db.execute("SELECT from_id, to_id FROM raw.edges").fetchall(), [(3, 4)])
            self.assertEqual(db.execute("SELECT agent_alias FROM kfgyr.machine_dashboards").fetchall(), [("Other",)])
            self.assertEqual(db.execute("SELECT agent_alias FROM kfgyr.machine_monitoring").fetchall(), [("Other",)])
            self.assertEqual(db.execute("SELECT agent_alias FROM kfgyr.machine_schema_assignments").fetchall(), [("Other",)])
            self.assertEqual(db.execute("SELECT name FROM kfgyr.machine_schemas").fetchall(), [("Shared",)])

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from server import repository, storage
from server.telemetry import _random_road_position


class RoadNetworkTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_dir.cleanup)
        db_patch = patch("server.storage.DB_PATH", Path(self.temp_dir.name) / "test.sqlite3")
        db_patch.start()
        self.addCleanup(db_patch.stop)
        storage.initialize_database()

    def test_migration_replaces_roads_without_moving_citizen_reports(self):
        with storage.connection() as conn:
            users_before = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
            history_before = conn.execute("SELECT COUNT(*) FROM incident_history").fetchone()[0]
            citizen = conn.execute(
                "SELECT id, lat, lng FROM incidents WHERE source = 'ciudadano' LIMIT 1"
            ).fetchone()
            camera = conn.execute("SELECT id FROM cameras LIMIT 1").fetchone()
            synthetic = conn.execute(
                "SELECT id FROM incidents WHERE source != 'ciudadano' LIMIT 1"
            ).fetchone()
            conn.execute("DELETE FROM app_metadata WHERE key = 'road_network_version'")
            conn.execute("DELETE FROM roads")
            conn.execute(
                "INSERT INTO roads (id, name, klass, points_json) VALUES (?, ?, ?, ?)",
                ("legacy-road", "Legacy Road", "calle", json.dumps([[10.69, -71.64], [10.691, -71.64]])),
            )
            conn.execute("UPDATE cameras SET lat = ?, lng = ? WHERE id = ?", (10.692, -71.635, camera["id"]))
            conn.execute(
                """UPDATE incidents
                   SET lat = ?, lng = ?, road_id = 'legacy-road', road_name = 'Legacy Road',
                       title = 'Incidente en Legacy Road'
                   WHERE id = ?""",
                (10.692, -71.635, synthetic["id"]),
            )
            citizen_position = (citizen["lat"], citizen["lng"])

            storage._migrate_road_network(conn)

            self.assertEqual(
                conn.execute("SELECT COUNT(*) FROM roads").fetchone()[0],
                len(storage._read_json("roads.json", [])),
            )
            self.assertEqual(conn.execute("SELECT COUNT(*) FROM users").fetchone()[0], users_before)
            self.assertEqual(conn.execute("SELECT COUNT(*) FROM incident_history").fetchone()[0], history_before)
            self.assertTrue(conn.execute("SELECT road_id FROM cameras WHERE id = ?", (camera["id"],)).fetchone()[0].startswith("osm-"))
            migrated = conn.execute("SELECT road_id, title FROM incidents WHERE id = ?", (synthetic["id"],)).fetchone()
            self.assertTrue(migrated["road_id"].startswith("osm-"))
            self.assertNotIn("Legacy Road", migrated["title"])
            unchanged = conn.execute("SELECT lat, lng FROM incidents WHERE id = ?", (citizen["id"],)).fetchone()
            self.assertEqual((unchanged["lat"], unchanged["lng"]), citizen_position)

    def test_telemetry_alerts_require_a_real_road_position(self):
        roads = repository.list_roads()
        self.assertIsNone(_random_road_position([]))
        self.assertIsNone(_random_road_position([{"points": []}]))

        position = _random_road_position(roads)
        self.assertIsNotNone(position)
        incident = repository.create_telemetry_incident({
            "type": "accidente",
            "severity": "media",
            "source": "sensor",
            "title": "Prueba de telemetría",
            "lat": position["lat"],
            "lng": position["lng"],
        })
        self.assertTrue(incident["roadId"].startswith("osm-"))

        with storage.connection() as conn:
            count_before = conn.execute("SELECT COUNT(*) FROM incidents").fetchone()[0]
        with self.assertRaises(RuntimeError):
            repository.create_telemetry_incident({
                "type": "accidente",
                "severity": "media",
                "source": "sensor",
                "title": "Ubicación inválida",
                "lat": 20,
                "lng": 0,
            })
        with storage.connection() as conn:
            self.assertEqual(conn.execute("SELECT COUNT(*) FROM incidents").fetchone()[0], count_before)


if __name__ == "__main__":
    unittest.main()

import asyncio
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException

from server import repository, storage
from server.app import create_report_route


class InputValidationTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_dir.cleanup)
        db_patch = patch("server.storage.DB_PATH", Path(self.temp_dir.name) / "test.sqlite3")
        db_patch.start()
        self.addCleanup(db_patch.stop)
        storage.initialize_database()

    def test_report_rejects_non_finite_coordinates(self):
        for lat, lng in (("nan", "-71.63"), ("10.69", "inf")):
            with self.subTest(lat=lat, lng=lng):
                with self.assertRaises(HTTPException) as error:
                    asyncio.run(create_report_route(
                        {"lat": lat, "lng": lng},
                        user={"id": "test-user"},
                    ))
                self.assertEqual(error.exception.status_code, 422)

    def test_appeal_rejects_malformed_contact_ground_and_attachment_size(self):
        with storage.connection() as conn:
            violation = conn.execute("SELECT code FROM violations LIMIT 1").fetchone()
            user = conn.execute("SELECT id, name FROM users LIMIT 1").fetchone()
        self.assertIsNotNone(violation)
        self.assertIsNotNone(user)
        base = {
            "motivos": ["GM-01"],
            "declaracion": "Esta declaración contiene más de sesenta caracteres para superar la validación del formulario.",
            "contacto": {"email": "persona@example.com"},
            "adjuntos": [],
        }
        cases = (
            {**base, "motivos": [["GM-01"]]},
            {**base, "contacto": "persona@example.com"},
            {**base, "adjuntos": [{"name": "prueba.pdf", "size": -1}]},
        )
        for body in cases:
            with self.subTest(body=body):
                with self.assertRaises(repository.HttpError) as error:
                    repository.create_appeal(violation["code"], body, dict(user))
                self.assertEqual(error.exception.status, 422)


if __name__ == "__main__":
    unittest.main()

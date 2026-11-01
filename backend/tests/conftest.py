"""Keep all test imports and API writes away from the demonstration database."""

import os
import sys
from pathlib import Path
from tempfile import TemporaryDirectory

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
_database_dir = TemporaryDirectory(prefix="arooohi-tests-")
os.environ["DATABASE_PATH"] = str(Path(_database_dir.name) / "test.db")
os.environ["DEMO_MODE"] = "1"  # Tests must never select an external payment gateway.
# DEMO_MODE is fail-closed in application code; set it above before any app import.


def pytest_sessionfinish(session, exitstatus):
    _database_dir.cleanup()


# ---- Shared row factories for the unit-level model tests -------------------
# Kept lazy (imports inside the fixtures) so conftest stays importable without
# the application on PYTHONPATH, mirroring how the test modules import the app.

def _new_id():
    import uuid

    return str(uuid.uuid4())


@pytest.fixture
def make_user():
    def _make(name: str = "Test User", role: str = "rider", gender: str = "other") -> str:
        from app.models.database import get_db, init_db

        init_db()
        uid = _new_id()
        conn = get_db()
        conn.execute(
            """INSERT INTO users (id, name, bracu_email, password_hash, role, gender, is_verified)
               VALUES (?, ?, ?, ?, ?, ?, 1)""",
            (uid, name, f"{uid}@g.bracu.ac.bd", "x", role, gender),
        )
        conn.commit()
        conn.close()
        return uid

    return _make


@pytest.fixture
def make_ride(make_user):
    def _make(driver_id: str, status: str = "scheduled") -> str:
        from app.models.database import get_db

        rid = _new_id()
        conn = get_db()
        conn.execute(
            """INSERT INTO rides (id, driver_id, source, destination, base_fare, status)
               VALUES (?, ?, 'Start', 'Finish', 100.0, ?)""",
            (rid, driver_id, status),
        )
        conn.commit()
        conn.close()
        return rid

    return _make


@pytest.fixture
def add_passenger():
    def _add(ride_id: str, passenger_id: str, status: str = "accepted") -> str:
        from app.models.database import get_db

        pid = _new_id()
        conn = get_db()
        conn.execute(
            """INSERT INTO ride_passengers (id, ride_id, passenger_id, status)
               VALUES (?, ?, ?, ?)""",
            (pid, ride_id, passenger_id, status),
        )
        conn.commit()
        conn.close()
        return pid

    return _add

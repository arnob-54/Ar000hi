"""Regression tests for the Phase-1 security/correctness hardening pass."""

import os
import subprocess
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models import chat
from app.models.errors import DomainError

BACKEND_DIR = Path(__file__).resolve().parents[1]
client = TestClient(app)


# ── Reflected XSS on the simulated gateway page ──────────────────────────────

def test_gateway_page_escapes_query_error(make_user):
    from app.models.database import get_db

    user = make_user()
    conn = get_db()
    conn.execute(
        "INSERT INTO bkash_payments (id, user_id, amount, status) VALUES (?, ?, ?, ?)",
        ("pay-xss-test", user, 10.0, "created"),
    )
    conn.commit()
    conn.close()

    res = client.get(
        "/bkash/checkout/pay-xss-test",
        params={"error": "<script>alert('xss')</script>"},
    )

    assert res.status_code == 200
    assert "<script>alert" not in res.text
    assert "&lt;script&gt;" in res.text


def test_gateway_page_escapes_payment_id_path():
    res = client.get("/bkash/checkout/%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E")

    assert res.status_code == 404
    assert "<img" not in res.text
    assert "&lt;img" in res.text


# ── Chat message length: reject, do not silently truncate ────────────────────

def test_overlong_chat_message_is_rejected(make_user, make_ride):
    user = make_user()
    ride = make_ride(user)

    with pytest.raises(DomainError) as exc:
        chat.save_message(ride, user, "Tester", "a" * (chat.MAX_MESSAGE_CHARS + 1))

    assert exc.value.status_code == 400
    assert str(chat.MAX_MESSAGE_CHARS) in exc.value.detail


def test_max_length_chat_message_is_stored_unchanged(make_user, make_ride):
    user = make_user()
    ride = make_ride(user)
    message = "b" * chat.MAX_MESSAGE_CHARS

    saved = chat.save_message(ride, user, "Tester", message)

    assert saved["message"] == message


# ── Seat capacity is check-then-insert safe under concurrency ────────────────

def test_concurrent_joins_cannot_overbook(make_user, make_ride):
    from concurrent.futures import ThreadPoolExecutor

    from app.models import rides
    from app.models.errors import DomainError
    from app.schemas.rides import JoinRideRequest

    driver = make_user("Driver")
    ride = make_ride(driver)
    riders = [make_user(f"Rider {i}") for i in range(5)]

    from app.models.database import get_db

    conn = get_db()
    conn.execute("UPDATE rides SET total_seats = 1 WHERE id = ?", (ride,))
    conn.commit()
    conn.close()

    def attempt(rider_id):
        try:
            rides.join_ride(ride, JoinRideRequest(seats=1), rider_id)
            return "joined"
        except DomainError:
            return "rejected"

    with ThreadPoolExecutor(max_workers=len(riders)) as pool:
        results = list(pool.map(attempt, riders))

    assert results.count("joined") == 1
    assert results.count("rejected") == len(riders) - 1

    conn = get_db()
    seats = conn.execute(
        "SELECT COALESCE(SUM(seats), 0) AS s FROM ride_passengers WHERE ride_id = ? AND status IN ('requested', 'accepted')",
        (ride,),
    ).fetchone()["s"]
    conn.close()
    assert seats == 1


# ── DEMO_MODE is fail-closed when the environment says nothing ───────────────

def _run_import(snippet: str, tmp_path: Path, secret_key: str | None) -> subprocess.CompletedProcess:
    env = dict(os.environ)
    env.pop("DEMO_MODE", None)
    env.pop("SECRET_KEY", None)
    if secret_key is not None:
        env["SECRET_KEY"] = secret_key
    env["DATABASE_PATH"] = str(tmp_path / "demo-mode.db")
    env["PYTHONPATH"] = str(BACKEND_DIR) + os.pathsep + env.get("PYTHONPATH", "")
    return subprocess.run(
        [sys.executable, "-c", snippet],
        cwd=BACKEND_DIR,
        env=env,
        capture_output=True,
        text=True,
        timeout=60,
    )


def test_unset_demo_mode_disables_demo_behaviour(tmp_path):
    result = _run_import(
        """
import app.models.auth as auth
import app.payments.factory as factory
from app.main import app

assert auth.DEMO_MODE is False
assert factory.DEMO_MODE is False
paths = {getattr(route, "path", "") for route in app.routes}
assert not any(path.startswith("/bkash") for path in paths), paths
print("FAIL_CLOSED_OK")
""",
        tmp_path,
        secret_key="a-real-secret",
    )

    assert result.returncode == 0, result.stderr
    assert "FAIL_CLOSED_OK" in result.stdout


def test_unset_demo_mode_refuses_the_default_secret(tmp_path):
    result = _run_import("import app.models.identity", tmp_path, secret_key=None)

    assert result.returncode != 0
    assert "SECRET_KEY" in result.stderr

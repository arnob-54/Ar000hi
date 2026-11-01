"""Seed the fixed accounts used by `e2e/live-test.js`.

Run against the same `DATABASE_PATH` the backend uses:

    DEMO_MODE=1 python backend/seed_e2e.py

The script is idempotent: rerunning it refreshes the passwords and keeps the
driver's profile approved. It creates only what the browser suite assumes —
the admin account comes from `init_db()`.

Accounts (from e2e/live-test.js):
  driver.live@g.bracu.ac.bd   / secret1  (approved driver)
  rider.live@g.bracu.ac.bd    / secret2  (rider)
  intruder.live@g.bracu.ac.bd / secret3  (rider, not a participant)
"""
import os
import sys
import uuid

# The auth module refuses the default secret unless demo mode is explicit.
os.environ.setdefault("DEMO_MODE", "1")
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.models.database import db_session, init_db  # noqa: E402
from app.models.identity import hash_password  # noqa: E402

ACCOUNTS = [
    ("usr_e2e_driver", "Test Driver", "driver.live@g.bracu.ac.bd", "01711111111", "male", "driver", "secret1"),
    ("usr_e2e_rider", "Rider Person", "rider.live@g.bracu.ac.bd", "01722222222", "female", "rider", "secret2"),
    ("usr_e2e_intruder", "Nosy User", "intruder.live@g.bracu.ac.bd", "01733333333", "other", "rider", "secret3"),
]


def main() -> None:
    init_db()
    with db_session() as conn:
        for uid, name, email, phone, gender, role, password in ACCOUNTS:
            row = conn.execute(
                "SELECT id FROM users WHERE bracu_email = ?", (email,)
            ).fetchone()
            if row:
                conn.execute(
                    """UPDATE users
                       SET name = ?, phone = ?, gender = ?, role = ?,
                           password_hash = ?, is_verified = 1, is_active = 1
                       WHERE bracu_email = ?""",
                    (name, phone, gender, role, hash_password(password), email),
                )
                uid = row["id"]
            else:
                conn.execute(
                    """INSERT INTO users
                           (id, name, bracu_email, phone, password_hash,
                            gender, role, is_verified, is_active)
                       VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1)""",
                    (uid, name, email, phone, hash_password(password), gender, role),
                )

            if role != "driver":
                continue

            profile = conn.execute(
                "SELECT id FROM driver_profiles WHERE user_id = ?", (uid,)
            ).fetchone()
            if profile:
                conn.execute(
                    """UPDATE driver_profiles
                       SET verification_status = 'approved', admin_notes = ''
                       WHERE user_id = ?""",
                    (uid,),
                )
            else:
                conn.execute(
                    """INSERT INTO driver_profiles
                           (id, user_id, vehicle_type, vehicle_model,
                            vehicle_plate, verification_status)
                       VALUES (?, ?, 'car', 'Toyota Axio', 'BRACU-E2E', 'approved')""",
                    (str(uuid.uuid4()), uid),
                )

    print("[OK] e2e accounts ready (driver.live/rider.live/intruder.live)")


if __name__ == "__main__":
    main()

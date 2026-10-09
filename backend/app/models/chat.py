"""Ride chat permissions, rate limits and persistence."""
import uuid
import time
import threading
from datetime import datetime, timezone
from app.models.database import get_db
from app.models.participants import is_ride_participant

_MAX_MSGS_PER_10S = 20
_spam: dict[str, list[float]] = {}
_spam_lock = threading.Lock()


def _allow_message(user_id: str) -> bool:
    """Return True if the user is under the send rate cap; else False."""
    now = time.time()
    with _spam_lock:
        stamps = [t for t in _spam.get(user_id, []) if now - t < 10]
        if len(stamps) >= _MAX_MSGS_PER_10S:
            return False
        stamps.append(now)
        _spam[user_id] = stamps
        return True





def sender_for_ride(ride_id: str, user_id: str) -> str | None:
    from app.models.database import get_db
    conn = get_db()
    if not is_ride_participant(ride_id, user_id):
        conn.close()
        return None
    user = conn.execute("SELECT name FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    return user["name"] if user else "Unknown"


def save_message(ride_id: str, user_id: str, sender_name: str, message: str) -> dict:
    message = message[:500]
    msg_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc).replace(tzinfo=None).isoformat()
    conn = get_db()
    conn.execute(
        "INSERT INTO chat_messages (id, ride_id, sender_id, message, created_at) VALUES (?, ?, ?, ?, ?)",
        (msg_id, ride_id, user_id, message, created_at),
    )
    conn.commit()
    conn.close()
    return {
        "id": msg_id, "ride_id": ride_id, "sender_id": user_id,
        "sender_name": sender_name, "message": message, "created_at": created_at,
    }

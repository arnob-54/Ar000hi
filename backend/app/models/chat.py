"""Ride chat permissions, rate limits and persistence."""
import uuid
from datetime import datetime, timezone

from app.models.database import db_session
from app.models.errors import DomainError
from app.models.participants import is_ride_participant
from app.models.rate_limit import SlidingWindowLimiter

_MAX_MSGS_PER_10S = 20
MAX_MESSAGE_CHARS = 500
_spam_limiter = SlidingWindowLimiter(_MAX_MSGS_PER_10S, 10)


def _allow_message(user_id: str) -> bool:
    """Return True if the user is under the send rate cap; else False."""
    return _spam_limiter.allow(user_id)


def sender_for_ride(ride_id: str, user_id: str) -> str | None:
    with db_session() as conn:
        if not is_ride_participant(ride_id, user_id):
            return None
        user = conn.execute("SELECT name FROM users WHERE id = ?", (user_id,)).fetchone()
        return user["name"] if user else "Unknown"


def save_message(ride_id: str, user_id: str, sender_name: str, message: str) -> dict:
    # Reject over-long messages instead of silently truncating the tail: the
    # sender gets a visible error and the stored/broadcast text is unchanged.
    if len(message) > MAX_MESSAGE_CHARS:
        raise DomainError(
            status_code=400,
            detail=f"Messages are limited to {MAX_MESSAGE_CHARS} characters.",
        )
    msg_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc).replace(tzinfo=None).isoformat()
    with db_session() as conn:
        conn.execute(
            "INSERT INTO chat_messages (id, ride_id, sender_id, message, created_at) VALUES (?, ?, ?, ?, ?)",
            (msg_id, ride_id, user_id, message, created_at),
        )
        return {
            "id": msg_id, "ride_id": ride_id, "sender_id": user_id,
            "sender_name": sender_name, "message": message, "created_at": created_at,
        }

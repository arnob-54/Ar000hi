"""Arooohi notification service — centralized mock delivery.

Delivery is still simulated (SOS alerts, ride shares and cancellation notices are
logged rather than sent by SMS/email/push), but every notification now goes
through this module so a real gateway can be swapped in at one place and the
output is structured, level-controlled and capturable by the test suite.
"""

import logging
from typing import Any

logger = logging.getLogger("arooohi.notifications")


def notify_sos_alert(alert_data: dict[str, Any]) -> dict[str, str]:
    """Mock SOS alert notification.

    Emits one WARNING-level record per alerted contact, plus the alert header.
    """
    contacts = alert_data.get("contacts_notified") or []
    location = alert_data.get("location") or {}
    user = alert_data.get("user") or {}
    alert_id = alert_data.get("id", "unknown")

    logger.warning(
        "SOS alert %s from %s (%s) at %s,%s — notifying %d contact(s)",
        alert_id,
        user.get("name", "?"),
        user.get("email", "?"),
        location.get("lat", "?"),
        location.get("lng", "?"),
        len(contacts),
    )
    for contact in contacts:
        logger.warning(
            "  -> %s: %s", contact.get("name", "?"), contact.get("phone", "?")
        )

    return {
        "status": "notifications_sent",
        "message": "Alert dispatched to trusted contacts + campus security",
        "alert_id": alert_id,
    }


def notify_ride_cancelled(
    ride_id: str, canceller_name: str, amount: float
) -> dict[str, str]:
    """Mock ride cancellation notification."""
    logger.info(
        "Ride %s cancelled by %s — penalty BDT %.2f", ride_id, canceller_name, amount
    )
    return {
        "status": "notification_sent",
        "message": "Cancellation fee recorded",
    }


def notify_ride_shared(
    share_url: str,
    contacts: list[dict[str, Any]],
    user: dict[str, Any] | None = None,
) -> dict[str, str]:
    """Mock trusted-contact share notification (Feature 12)."""
    user = user or {}
    logger.info(
        "%s (%s) shared ride details %s with %d trusted contact(s)",
        user.get("name", "?"),
        user.get("email", "?"),
        share_url,
        len(contacts),
    )
    for contact in contacts:
        logger.info(
            "  -> %s: %s", contact.get("name", "?"), contact.get("phone", "?")
        )
    return {
        "status": "notification_sent",
        "message": f"Ride details shared with {len(contacts)} trusted contact(s)",
    }

"""Arooohi Notification Service — centralized mock notifications."""

from typing import Any, Dict, List


def notify_sos_alert(alert_data: Dict[str, Any]) -> Dict[str, str]:
    """Mock SOS alert notification.

    In production, this would send SMS, email, or push notifications.
    Currently logs the alert details for demo purposes.
    """
    contacts = alert_data.get('contacts_notified', [])
    location = alert_data.get('location', {})

    # Mock notification: print to console (will be replaced with real gateway)
    print("\n[SOS] EMERGENCY ALERT")
    print(f"   Location: {location.get('lat', '?')}, {location.get('lng', '?')}")
    print(f"   Contacts notified: {len(contacts)}")
    for i, contact in enumerate(contacts, 1):
        print(f"      {i}. {contact.get('name', '?')} ({contact.get('phone', '?')})")

    # Also notify campus security as fallback
    print(f"   -> Campus security (01700000000) notified as safety fallback")

    return {
        "status": "notifications_sent",
        "message": "Alert dispatched to trusted contacts + campus security",
        "alert_id": alert_data.get('id', 'unknown')
    }


def notify_ride_cancelled(ride_id: str, canceller_name: str, amount: float) -> Dict[str, str]:
    """Mock ride cancellation notification."""
    print(f"\n[CANCELLATION] Ride {ride_id} cancelled by {canceller_name}")
    amount_str = "{:.2f}".format(amount)
    print(f"   Penalty amount: BDT {amount_str}")

    return {
        "status": "notification_sent",
        "message": "Cancellation fee recorded"
    }

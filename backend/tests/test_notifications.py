"""Unit tests for the centralized mock notification service."""

import logging

from app.models import notifications


def test_sos_alert_logs_instead_of_printing(capsys, caplog):
    caplog.set_level(logging.WARNING, logger="arooohi.notifications")

    result = notifications.notify_sos_alert(
        {
            "id": "alert-1",
            "user": {"name": "Ayesha", "email": "ayesha@g.bracu.ac.bd"},
            "location": {"lat": 23.77, "lng": 90.42},
            "contacts_notified": [
                {"name": "Mum", "phone": "01711111111"},
                {"name": "Campus Security", "phone": "01700000000"},
            ],
        }
    )

    assert result["status"] == "notifications_sent"
    assert result["alert_id"] == "alert-1"
    assert "SOS alert alert-1" in caplog.text
    assert "Ayesha" in caplog.text
    assert "Mum: 01711111111" in caplog.text
    assert "2 contact(s)" in caplog.text
    # Regression guard: the old implementation wrote to stdout with print().
    assert capsys.readouterr().out == ""


def test_ride_cancelled_is_logged(capsys, caplog):
    caplog.set_level(logging.INFO, logger="arooohi.notifications")

    result = notifications.notify_ride_cancelled("ride-1", "Rahim", 42.5)

    assert result["status"] == "notification_sent"
    assert "ride-1" in caplog.text
    assert "Rahim" in caplog.text
    assert "BDT 42.50" in caplog.text
    assert capsys.readouterr().out == ""


def test_ride_shared_is_logged(capsys, caplog):
    caplog.set_level(logging.INFO, logger="arooohi.notifications")

    result = notifications.notify_ride_shared(
        "https://example.test/track/abc",
        [{"name": "Mum", "phone": "01711111111"}],
        {"name": "Ayesha", "email": "ayesha@g.bracu.ac.bd"},
    )

    assert result["status"] == "notification_sent"
    assert "Ayesha" in caplog.text
    assert "https://example.test/track/abc" in caplog.text
    assert "Mum: 01711111111" in caplog.text
    assert capsys.readouterr().out == ""

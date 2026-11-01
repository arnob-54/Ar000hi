"""Direct unit tests for the shared ride-participant permission helper."""

from app.models.participants import is_ride_participant


def test_driver_is_a_participant(make_user, make_ride):
    driver = make_user("Driver")
    ride = make_ride(driver)

    assert is_ride_participant(ride, driver) is True


def test_accepted_and_completed_passengers_are_participants(
    make_user, make_ride, add_passenger
):
    driver = make_user("Driver")
    accepted = make_user("Accepted")
    completed = make_user("Completed")
    requested = make_user("Requested")
    cancelled = make_user("Cancelled")
    ride = make_ride(driver)

    add_passenger(ride, accepted, "accepted")
    add_passenger(ride, completed, "completed")
    add_passenger(ride, requested, "requested")
    add_passenger(ride, cancelled, "cancelled")

    assert is_ride_participant(ride, accepted) is True
    assert is_ride_participant(ride, completed) is True
    assert is_ride_participant(ride, requested) is False
    assert is_ride_participant(ride, cancelled) is False


def test_outsiders_and_unknown_rides_are_not_participants(make_user, make_ride):
    driver = make_user("Driver")
    outsider = make_user("Outsider")
    ride = make_ride(driver)

    assert is_ride_participant(ride, outsider) is False
    assert is_ride_participant("does-not-exist", outsider) is False
    assert is_ride_participant("does-not-exist", driver) is False

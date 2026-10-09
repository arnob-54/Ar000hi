"""Ride participant permission checks."""

from app.models.database import get_db


def is_ride_participant(ride_id: str, user_id: str) -> bool:
    """Check if user is the driver or an accepted passenger on a ride.
    
    Returns True if:
    - user is the ride driver, OR
    - user has an accepted/completed seat on the ride
    """
    conn = get_db()
    try:
        # Check if user is the driver
        ride = conn.execute(
            "SELECT driver_id FROM rides WHERE id = ?", (ride_id,)
        ).fetchone()
        if ride and ride["driver_id"] == user_id:
            return True
        
        # Check if user is an accepted passenger
        row = conn.execute(
            """SELECT id FROM ride_passengers
               WHERE ride_id = ? AND passenger_id = ? 
               AND status IN ('accepted', 'completed')""",
            (ride_id, user_id)
        ).fetchone()
        return row is not None
    finally:
        conn.close()

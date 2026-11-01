"""Ride cancellation policy and penalty (Feature 18)."""
from datetime import datetime as dt, timezone

from app.models import ledger as ws
from app.models.database import db_session
from app.models.errors import DomainError
from app.models.notifications import notify_ride_cancelled
from app.schemas.rides import CancelRideRequest

# ---------------------------------------------------------------------------
# Feature 18: Ride Cancellation Policy & Penalty
#
# "Dispatch" is the moment the driver presses Start (status flips to 'active').
# Cancelling before dispatch is free. After dispatch the cancelling party is
# charged, because the other side has already committed: the driver is en route,
# or seats were held out of the pool.
#
# The fee is a percentage of what the ride was worth to the person cancelling,
# clamped so it is neither trivial on a cheap hop nor punitive on a long
# surge-priced trip. It is charged to the wallet (Feature 9) as a `penalty`
# ledger row, so it appears in the transaction history like any other movement.
# ---------------------------------------------------------------------------
PENALTY_RATE = 0.20      # 20% of the cancelling party's fare exposure
MIN_PENALTY = 20.0       # BDT floor, so a late cancel is never a rounding error
MAX_PENALTY = 150.0      # BDT ceiling


def _passenger_fare_share(conn, ride, passenger_id: str) -> float:
    """This passenger's seat-weighted slice of the ride total (Feature 5 math)."""
    for entry in ws.ride_shares(conn, ride):
        if entry["passenger_id"] == passenger_id:
            return entry["share"]
    return 0.0


def _cancellation_quote(conn, ride, user_id: str) -> dict:
    """What cancelling would cost `user_id` right now. No side effects.

    Shared by the preview endpoint and the cancel endpoint, so the warning the
    user sees and the amount actually charged can never drift apart.
    """
    is_driver = ride["driver_id"] == user_id
    role = "driver" if is_driver else "passenger"

    if is_driver:
        exposure = round(ride["base_fare"] * ride["surge_multiplier"], 2)
    else:
        exposure = _passenger_fare_share(conn, ride, user_id)

    if ride["status"] != "active":
        return {
            "will_be_charged": False,
            "penalty": 0.0,
            "exposure": exposure,
            "dispatched": False,
            "role": role,
            "reason": "This ride has not been dispatched yet, so cancelling is free.",
        }

    penalty = round(min(max(exposure * PENALTY_RATE, MIN_PENALTY), MAX_PENALTY), 2)
    who = "your passengers are already on board" if is_driver else "your driver is already en route"
    return {
        "will_be_charged": True,
        "penalty": penalty,
        "exposure": exposure,
        "dispatched": True,
        "role": role,
        "reason": (
            "This ride has already started and " + who + ". A BDT "
            + format(penalty, ".2f") + " late-cancellation fee ("
            + str(int(PENALTY_RATE * 100)) + "% of BDT " + format(exposure, ".2f")
            + ") will be charged to your wallet."
        ),
    }


def _load_cancellable(conn, ride_id: str, user_id: str):
    """Fetch the ride and confirm `user_id` is allowed to cancel it.

    The caller owns the connection (``db_session``), so this helper never closes
    it — an early ``raise`` must leave cleanup to the context manager.
    """
    ride = conn.execute("SELECT * FROM rides WHERE id = ?", (ride_id,)).fetchone()
    if not ride:
        raise DomainError(status_code=404, detail="Ride not found")
    if ride["status"] in ("completed", "cancelled"):
        status = ride["status"]
        raise DomainError(
            status_code=400,
            detail="This ride is already " + status + " and cannot be cancelled",
        )

    is_driver = ride["driver_id"] == user_id
    seat = conn.execute(
        """SELECT * FROM ride_passengers
           WHERE ride_id = ? AND passenger_id = ? AND status IN ('requested', 'accepted')""",
        (ride_id, user_id),
    ).fetchone()
    if not is_driver and not seat:
        raise DomainError(status_code=403, detail="You are not part of this ride")
    return ride, is_driver, seat


def cancellation_policy(ride_id: str, user_id: str):
    """Preview what cancelling costs, so the UI can warn before anything happens."""
    with db_session() as conn:
        ride, _is_driver, _seat = _load_cancellable(conn, ride_id, user_id)
        quote = _cancellation_quote(conn, ride, user_id)
        balance = ws.balance_of(conn, user_id)
        return {
            "ride_id": ride_id,
            "ride_status": ride["status"],
            "wallet_balance": balance,
            "policy": {
                "free_before_dispatch": True,
                "penalty_rate": PENALTY_RATE,
                "min_penalty": MIN_PENALTY,
                "max_penalty": MAX_PENALTY,
            },
            **quote,
        }


def cancel_ride(ride_id: str, body: CancelRideRequest, user_id: str):
    """Driver cancels the whole ride; a passenger cancels only their own seat."""
    with db_session() as conn:
        ride, is_driver, seat = _load_cancellable(conn, ride_id, user_id)
        quote = _cancellation_quote(conn, ride, user_id)
        canceller = conn.execute("SELECT name FROM users WHERE id = ?", (user_id,)).fetchone()
        now = dt.now(timezone.utc).replace(tzinfo=None).isoformat()
        reason = (body.reason or "").strip()[:300]

        charged = 0.0
        uncharged_note = ""
        if quote["will_be_charged"]:
            note = "Late cancellation - " + str(ride["source"]) + " to " + str(ride["destination"])
            try:
                with ws.atomic(conn):
                    ws.post(conn, user_id, "penalty", -quote["penalty"],
                            ride_id=ride_id, note=note)
                charged = quote["penalty"]
            except ValueError as e:
                # Prepaid wallet with too little in it. The cancellation still goes
                # through -- trapping someone in a ride they cannot leave is worse --
                # but no money is invented: the fee goes uncollected and is reported.
                uncharged_note = str(e)

        if is_driver:
            conn.execute(
                """UPDATE rides SET status = 'cancelled', cancelled_at = ?, cancelled_by = ?,
                       cancel_reason = ? WHERE id = ?""",
                (now, user_id, reason, ride_id),
            )
            conn.execute(
                """UPDATE ride_passengers SET status = 'cancelled', cancelled_at = ?
                   WHERE ride_id = ? AND status IN ('requested', 'accepted')""",
                (now, ride_id),
            )
            affected = "ride"
        else:
            conn.execute(
                """UPDATE ride_passengers SET status = 'cancelled', cancelled_at = ?,
                       penalty_amount = ? WHERE id = ?""",
                (now, charged, seat["id"]),
            )
            affected = "seat"

        conn.commit()
        balance = ws.balance_of(conn, user_id)

        if is_driver:
            notify_ride_cancelled(
                ride_id, canceller["name"] if canceller else user_id, charged
            )

        if charged > 0:
            msg = ("Cancelled. A BDT " + format(charged, ".2f")
                   + " late-cancellation fee was charged to your wallet.")
        elif uncharged_note:
            msg = ("Cancelled. The BDT " + format(quote["penalty"], ".2f")
                   + " late-cancellation fee could not be collected (" + uncharged_note + ").")
        else:
            msg = "Cancelled free of charge - the ride had not been dispatched yet."

        return {
            "message": msg,
            "cancelled": affected,
            "penalty_charged": charged,
            "penalty_due": quote["penalty"],
            "uncollected": bool(uncharged_note),
            "wallet_balance": balance,
            "ride_status": "cancelled" if is_driver else ride["status"],
        }

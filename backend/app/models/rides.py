"""Rides model: ride lifecycle, listing and per-ride queries.

The former god file is now an orchestrator: geo math lives in ``geo.py``,
hotspot data in ``hotspots.py``, matching in ``matching.py`` and the
cancellation policy in ``cancellation.py``. Names are re-exported here so the
public surface of ``app.models.rides`` is unchanged.
"""
import uuid
from datetime import datetime as dt, timezone

from app.models import ledger as ws
from app.models.cancellation import (
    MAX_PENALTY,
    MIN_PENALTY,
    PENALTY_RATE,
    _cancellation_quote,
    _load_cancellable,
    cancel_ride,
    cancellation_policy,
)
from app.models.database import db_session
from app.models.errors import DomainError
from app.models.geo import _estimate_distance_km, _path_length_km
from app.models.hotspots import CAMPUS_CLUSTERS, HOTSPOTS, ZONES, get_hotspots
from app.models.matching import match_rides
from app.models.participants import is_ride_participant
from app.models.surge import compute_current_multiplier
from app.schemas.rides import (
    CreateRideRequest,
    EndRideRequest,
    JoinRideRequest,
    UpdateStopStatusRequest,
)

def create_ride(body: CreateRideRequest, user_id: str):
    """Driver creates a new ride with multi-stop and scheduling support."""
    with db_session() as conn:
        user = conn.execute("SELECT is_verified, role, gender FROM users WHERE id = ?", (user_id,)).fetchone()
        if not user:
            raise DomainError(status_code=404, detail="User not found")
        if not user["is_verified"]:
            raise DomainError(status_code=403, detail="Verify your BRACU email before creating rides")

        if body.female_only and user["gender"] != "female":
            raise DomainError(status_code=403, detail="Only female drivers can create female-only rides")

        if body.base_fare <= 0:
            raise DomainError(status_code=400, detail="base_fare must be positive")

        if body.total_seats < 1 or body.total_seats > 10:
            raise DomainError(status_code=400, detail="total_seats must be between 1 and 10")

        if body.scheduled_at:
            try:
                # Accept standard ISO-8601 timestamps, including the UTC `Z` format
                # emitted by the dashboard. Treat a timezone-less legacy value as UTC.
                parsed = dt.fromisoformat(body.scheduled_at.replace("Z", "+00:00"))
                if parsed.tzinfo is None:
                    parsed = parsed.replace(tzinfo=timezone.utc)
            except (TypeError, ValueError):
                raise DomainError(status_code=400, detail="Scheduled time must be a valid ISO-8601 timestamp")

            if parsed <= dt.now(timezone.utc):
                raise DomainError(status_code=400, detail="Scheduled time must be in the future")

        surge, _, _ = compute_current_multiplier(conn)

        ride_id = str(uuid.uuid4())
        conn.execute(
            """INSERT INTO rides (id, driver_id, source, destination, base_fare, surge_multiplier, total_seats, scheduled_at, female_only)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (ride_id, user_id, body.source.strip(), body.destination.strip(),
             round(body.base_fare, 2), surge, body.total_seats, body.scheduled_at, int(body.female_only))
        )
        for idx, stop in enumerate(body.stops):
            if stop.strip():
                conn.execute(
                    "INSERT INTO ride_stops (id, ride_id, sequence, place, status) VALUES (?, ?, ?, ?, 'pending')",
                    (str(uuid.uuid4()), ride_id, idx, stop.strip())
                )
        conn.commit()

        return {"message": "Ride created", "ride_id": ride_id, "status": "scheduled", "surge_multiplier": surge, "total_seats": body.total_seats}


def join_ride(ride_id: str, body: JoinRideRequest, user_id: str):
    """Rider requests a seat on a ride, optionally specifying their pickup and drop-off stops."""
    # BEGIN IMMEDIATE takes the write lock before the capacity SUM is read, so
    # two concurrent joins cannot both pass the check and overbook the ride.
    with db_session(immediate=True) as conn:
        ride = conn.execute("SELECT * FROM rides WHERE id = ?", (ride_id,)).fetchone()
        if not ride:
            raise DomainError(status_code=404, detail="Ride not found")
        if ride["status"] not in ("scheduled", "active"):
            raise DomainError(status_code=400, detail="Ride is not open for passengers")
        if ride["driver_id"] == user_id:
            raise DomainError(status_code=400, detail="You cannot join your own ride")
        if body.seats < 1:
            raise DomainError(status_code=400, detail="seats must be at least 1")

        user = conn.execute("SELECT gender FROM users WHERE id = ?", (user_id,)).fetchone()
        if ride["female_only"] and user["gender"] != "female":
            raise DomainError(status_code=403, detail="This is a female-only ride")

        taken = conn.execute(
            """SELECT COALESCE(SUM(seats), 0) AS s FROM ride_passengers
               WHERE ride_id = ? AND status IN ('requested', 'accepted')""",
            (ride_id,)
        ).fetchone()["s"]
        capacity = ride["total_seats"] or 4
        if taken + body.seats > capacity:
            raise DomainError(
                status_code=400,
                detail=f"Not enough seats. This ride has {capacity} seats and {taken} are taken."
            )

        existing = conn.execute(
            "SELECT id FROM ride_passengers WHERE ride_id = ? AND passenger_id = ? AND status IN ('requested','accepted')",
            (ride_id, user_id)
        ).fetchone()
        if existing:
            raise DomainError(status_code=400, detail="You already have a pending/accepted seat on this ride")

        # A seat request is a reservation, not a wallet debit. Keeping the estimate
        # here lets the UI tell a rider whether they need to top up before the ride
        # ends, while still allowing a normal carpool request from a new ৳0 wallet.
        # The existing settlement flow remains the only place that debits a wallet.
        projected = ws.projected_share(conn, ride, body.seats)
        balance = ws.balance_of(conn, user_id)

        stop_rows = conn.execute(
            "SELECT sequence, place FROM ride_stops WHERE ride_id = ? ORDER BY sequence ASC",
            (ride_id,)
        ).fetchall()
        route_places = [ride["source"], *(stop["place"] for stop in stop_rows), ride["destination"]]
        route_positions = {}
        for position, place in enumerate(route_places):
            key = place.strip().casefold()
            if key and key not in route_positions:
                route_positions[key] = (position, place)

        pickup = (body.pickup_stop or "").strip() or ride["source"]
        dropoff = (body.dropoff_stop or "").strip() or ride["destination"]
        pickup_route = route_positions.get(pickup.casefold())
        dropoff_route = route_positions.get(dropoff.casefold())
        if not pickup_route or not dropoff_route:
            raise DomainError(status_code=400, detail="Pickup and drop-off must be stops on this ride's route")
        if pickup_route[0] >= dropoff_route[0]:
            raise DomainError(status_code=400, detail="Pickup must be before drop-off on this ride's route")

        # Store the canonical route names rather than a case variant sent by a client.
        pickup = pickup_route[1]
        dropoff = dropoff_route[1]

        pid = str(uuid.uuid4())
        conn.execute(
            """INSERT INTO ride_passengers (id, ride_id, passenger_id, seats, pickup_stop, dropoff_stop, status)
               VALUES (?, ?, ?, ?, ?, ?, 'requested')""",
            (pid, ride_id, user_id, body.seats, pickup, dropoff)
        )
        conn.commit()
        return {
            "message": "Ride request sent",
            "passenger_id": pid,
            "status": "requested",
            "pickup_stop": pickup,
            "dropoff_stop": dropoff,
            "seats": body.seats,
            "estimated_share": projected,
            "wallet_balance": balance,
            "requires_topup": balance < projected,
            "topup_amount": round(max(0.0, projected - balance), 2),
        }


def accept_passenger(ride_id: str, passenger_id: str, user_id: str):
    """Driver accepts a passenger's ride request."""
    with db_session() as conn:
        ride = conn.execute("SELECT * FROM rides WHERE id = ?", (ride_id,)).fetchone()
        if not ride:
            raise DomainError(status_code=404, detail="Ride not found")
        if ride["driver_id"] != user_id:
            raise DomainError(status_code=403, detail="Only the driver can accept passengers")

        result = conn.execute(
            "UPDATE ride_passengers SET status = 'accepted' WHERE id = ? AND ride_id = ?",
            (passenger_id, ride_id)
        )
        conn.commit()
        if result.rowcount == 0:
            raise DomainError(status_code=404, detail="Ride request not found")
        return {"message": "Passenger accepted"}


def update_stop_status(ride_id: str, stop_id: str, body: UpdateStopStatusRequest, user_id: str):
    """Driver updates progress of a stop (pending, reached, departed)."""
    if body.status not in ("pending", "reached", "departed"):
        raise DomainError(status_code=400, detail="Status must be pending, reached, or departed")

    with db_session() as conn:
        ride = conn.execute("SELECT driver_id FROM rides WHERE id = ?", (ride_id,)).fetchone()
        if not ride:
            raise DomainError(status_code=404, detail="Ride not found")
        if ride["driver_id"] != user_id:
            raise DomainError(status_code=403, detail="Only the driver can update stop progress")

        res = conn.execute(
            "UPDATE ride_stops SET status = ? WHERE id = ? AND ride_id = ?",
            (body.status, stop_id, ride_id)
        )
        conn.commit()
        if res.rowcount == 0:
            raise DomainError(status_code=404, detail="Stop not found for this ride")
        return {"message": f"Stop status updated to {body.status}", "stop_id": stop_id, "status": body.status}


def start_ride(ride_id: str, user_id: str):
    """Driver starts the ride."""
    with db_session() as conn:
        ride = conn.execute("SELECT * FROM rides WHERE id = ?", (ride_id,)).fetchone()
        if not ride:
            raise DomainError(status_code=404, detail="Ride not found")
        if ride["driver_id"] != user_id:
            raise DomainError(status_code=403, detail="Only the driver can start the ride")

        now = dt.now(timezone.utc).replace(tzinfo=None).isoformat()
        conn.execute(
            "UPDATE rides SET status = 'active', started_at = ? WHERE id = ?",
            (now, ride_id)
        )
        conn.commit()
        return {"message": "Ride started", "status": "active"}


def end_ride(ride_id: str, body: EndRideRequest, user_id: str):
    """Driver ends the ride — computes distance (tracking points or estimate) for eco tracking."""
    with db_session() as conn:
        ride = conn.execute("SELECT * FROM rides WHERE id = ?", (ride_id,)).fetchone()
        if not ride:
            raise DomainError(status_code=404, detail="Ride not found")
        if ride["driver_id"] != user_id:
            raise DomainError(status_code=403, detail="Only the driver can end the ride")

        distance = body.distance_km
        if distance is None:
            session = conn.execute(
                """SELECT id FROM tracking_sessions
                   WHERE user_id = ? AND is_active = 0
                   ORDER BY created_at DESC LIMIT 1""",
                (user_id,)
            ).fetchone()
            points = []
            if session:
                points = conn.execute(
                    "SELECT lat, lng FROM tracking_points WHERE session_id = ? ORDER BY created_at ASC",
                    (session["id"],)
                ).fetchall()
            path = _path_length_km(points)
            distance = path if path > 0.0 else _estimate_distance_km(ride["source"], ride["destination"])

        conn.execute(
            """UPDATE rides SET status = 'completed', distance_km = ?, ended_at = ? WHERE id = ?""",
            (round(distance, 2), dt.now(timezone.utc).replace(tzinfo=None).isoformat(), ride_id)
        )
        conn.execute(
            "UPDATE ride_passengers SET status = 'completed' WHERE ride_id = ? AND status = 'accepted'",
            (ride_id,)
        )
        conn.commit()

        # Feature 9: settle the fare from rider wallets into the driver's wallet.
        # Idempotent — re-ending a ride will not charge anyone twice.
        settlement = {"status": "skipped"}
        try:
            ride = conn.execute("SELECT * FROM rides WHERE id = ?", (ride_id,)).fetchone()
            settlement = ws.settle_ride(conn, ride)
        except Exception as e:
            # Never fail the ride completion because settlement had a problem; the
            # ride is over either way and the fare can be reconciled afterwards.
            settlement = {"status": "error", "detail": str(e)}

        return {
            "message": "Ride completed",
            "distance_km": round(distance, 2),
            "settlement": settlement,
        }


def list_rides(user_id: str, female_only: bool=False):
    """List rides: mine (as driver/passenger) + open available rides."""
    with db_session() as conn:
        user = conn.execute("SELECT gender FROM users WHERE id = ?", (user_id,)).fetchone()
        if not user:
            raise DomainError(status_code=404, detail="User not found")

        mine = conn.execute(
            """SELECT r.*, u.name AS driver_name, u.id AS driver_id
               FROM rides r JOIN users u ON r.driver_id = u.id
               WHERE r.driver_id = ?
                  OR r.id IN (
                      SELECT ride_id FROM ride_passengers
                      WHERE passenger_id = ? AND status IN ('requested', 'accepted')
                  )
               ORDER BY r.created_at DESC""",
            (user_id, user_id)
        ).fetchall()

        avail_query = """SELECT r.*, u.name AS driver_name, u.id AS driver_id
               FROM rides r JOIN users u ON r.driver_id = u.id
               WHERE r.driver_id != ?
                 AND r.status IN ('scheduled', 'active')
                 AND r.id NOT IN (
                     SELECT ride_id FROM ride_passengers
                     WHERE passenger_id = ? AND status IN ('requested', 'accepted')
                 )
                 AND (r.female_only = 0 OR ? = 'female')"""
        params = [user_id, user_id, user["gender"]]

        if female_only:
            avail_query += " AND r.female_only = 1"

        avail_query += " ORDER BY r.created_at DESC"
        available = conn.execute(avail_query, params).fetchall()

        stops = conn.execute("SELECT id, ride_id, sequence, place, status FROM ride_stops ORDER BY sequence ASC").fetchall()
        ride_stops_map = {}
        for s in stops:
            ride_stops_map.setdefault(s["ride_id"], []).append({
                "id": s["id"], "sequence": s["sequence"], "place": s["place"], "status": s["status"]
            })

        passengers = conn.execute(
            """SELECT ride_id, SUM(seats) as taken FROM ride_passengers
               WHERE status IN ('requested', 'accepted') GROUP BY ride_id"""
        ).fetchall()
        taken_map = {p["ride_id"]: p["taken"] for p in passengers}

        my_seats = conn.execute(
            """SELECT ride_id, status FROM ride_passengers
               WHERE passenger_id = ? AND status IN ('requested', 'accepted')""",
            (user_id,),
        ).fetchall()
        my_seat_map = {row["ride_id"]: row["status"] for row in my_seats}


        def _ser(ride):
            total_seats = ride["total_seats"] or 4
            taken = taken_map.get(ride["id"], 0)
            return {
                "id": ride["id"],
                "driver_id": ride["driver_id"],
                "driver_name": ride["driver_name"],
                "source": ride["source"],
                "destination": ride["destination"],
                "status": ride["status"],
                "distance_km": ride["distance_km"],
                "base_fare": ride["base_fare"],
                "surge_multiplier": ride["surge_multiplier"],
                "total_seats": total_seats,
                "available_seats": max(0, total_seats - taken),
                "scheduled_at": ride["scheduled_at"],
                "started_at": ride["started_at"],
                "ended_at": ride["ended_at"],
                "created_at": ride["created_at"],
                "female_only": bool(ride["female_only"]),
                "stops": ride_stops_map.get(ride["id"], []),
                "my_seat_status": my_seat_map.get(ride["id"]),
            }

        return {
            "mine": [_ser(r) for r in mine],
            "available": [_ser(r) for r in available],
        }


def get_ride(ride_id: str, user_id: str):
    """Ride detail including passenger stops and multi-stop progress."""
    with db_session() as conn:
        ride = conn.execute(
            """SELECT r.*, u.name AS driver_name, u.gender AS driver_gender FROM rides r
               JOIN users u ON r.driver_id = u.id WHERE r.id = ?""",
            (ride_id,)
        ).fetchone()
        if not ride:
            raise DomainError(status_code=404, detail="Ride not found")
        if not is_ride_participant(ride_id, user_id):
            raise DomainError(status_code=403, detail="Only ride participants can view this ride")

        passengers = conn.execute(
            """SELECT rp.id, rp.passenger_id, rp.seats, rp.status, rp.pickup_stop, rp.dropoff_stop, u.name AS passenger_name, u.gender AS passenger_gender
               FROM ride_passengers rp JOIN users u ON rp.passenger_id = u.id
               WHERE rp.ride_id = ?""",
            (ride_id,)
        ).fetchall()

        stops = conn.execute(
            "SELECT id, sequence, place, status FROM ride_stops WHERE ride_id = ? ORDER BY sequence ASC",
            (ride_id,)
        ).fetchall()


        total_seats = ride["total_seats"] or 4
        taken = sum(p["seats"] for p in passengers if p["status"] in ("requested", "accepted"))

        return {
            "id": ride["id"],
            "driver_id": ride["driver_id"],
            "driver_name": ride["driver_name"],
            "driver_gender": ride["driver_gender"],
            "source": ride["source"],
            "destination": ride["destination"],
            "status": ride["status"],
            "distance_km": ride["distance_km"],
            "base_fare": ride["base_fare"],
            "surge_multiplier": ride["surge_multiplier"],
            "total_seats": total_seats,
            "available_seats": max(0, total_seats - taken),
            "scheduled_at": ride["scheduled_at"],
            "started_at": ride["started_at"],
            "ended_at": ride["ended_at"],
            "created_at": ride["created_at"],
            "female_only": bool(ride["female_only"]),
            "stops": [
                {"id": s["id"], "sequence": s["sequence"], "place": s["place"], "status": s["status"]}
                for s in stops
            ],
            "passengers": [
                {
                    "id": p["id"],
                    "passenger_id": p["passenger_id"],
                    "passenger_name": p["passenger_name"],
                    "passenger_gender": p["passenger_gender"],
                    "seats": p["seats"],
                    "pickup_stop": p["pickup_stop"] or ride["source"],
                    "dropoff_stop": p["dropoff_stop"] or ride["destination"],
                    "status": p["status"],
                }
                for p in passengers
            ],
        }


def ride_cost_split(ride_id: str, user_id: str):
    """Ride Cost Splitter — total = base_fare x surge; split by SEATS among accepted
    passengers, with whole-taka largest-remainder rounding so shares sum exactly
    to `total`.
    """
    with db_session() as conn:
        ride = conn.execute("SELECT * FROM rides WHERE id = ?", (ride_id,)).fetchone()
        if not ride:
            raise DomainError(status_code=404, detail="Ride not found")

        is_driver = ride["driver_id"] == user_id
        participant = conn.execute(
            "SELECT id FROM ride_passengers WHERE ride_id = ? AND passenger_id = ? AND status IN ('accepted', 'completed')",
            (ride_id, user_id)
        ).fetchone()
        if not is_driver and not participant:
            raise DomainError(status_code=403, detail="Only ride participants can view fare split details")

        accepted = conn.execute(
            """SELECT rp.id, rp.passenger_id, rp.seats, rp.pickup_stop, rp.dropoff_stop, u.name
               FROM ride_passengers rp JOIN users u ON rp.passenger_id = u.id
               WHERE rp.ride_id = ? AND rp.status IN ('accepted', 'completed')""",
            (ride_id,)
        ).fetchall()

        total = round(ride["base_fare"] * ride["surge_multiplier"], 2)
        seat_weights = [max(int(r["seats"]), 1) for r in accepted]
        total_seats = sum(seat_weights)
        seat_shares = _split_total(total, total_seats) if total_seats > 0 else []

        breakdown = []
        share_idx = 0
        for r in accepted:
            weight = max(int(r["seats"]), 1)
            share = round(sum(seat_shares[share_idx:share_idx + weight]), 2)
            share_idx += weight
            breakdown.append({
                "passenger": r["name"],
                "seats": weight,
                "share": share,
                "pickup_stop": r["pickup_stop"] or ride["source"],
                "dropoff_stop": r["dropoff_stop"] or ride["destination"]
            })

        return {
            "ride_id": ride_id,
            "source": ride["source"],
            "destination": ride["destination"],
            "base_fare": ride["base_fare"],
            "surge_multiplier": ride["surge_multiplier"],
            "total": total,
            "total_seats": total_seats,
            "passenger_count": len(accepted),
            "per_seat": round(seat_shares[0], 2) if seat_shares else None,
            "breakdown": breakdown,
        }

def _split_total(total: float, parts: int) -> list[float]:
    """Largest-remainder split at paisa (0.01 taka) resolution so the parts sum
    EXACTLY to `total`. Fixes the rounding drift of naive `round(total / n, 2)`.

    Delegates to `wallet_service.split_total` so the fare the splitter DISPLAYS
    and the amount the wallet CHARGES can never diverge (Feature 9)."""
    return ws.split_total(total, parts)


def get_ride_messages(ride_id: str, user_id: str):
    """Ride Chat history (participants only)."""
    with db_session() as conn:
        ride = conn.execute("SELECT driver_id FROM rides WHERE id = ?", (ride_id,)).fetchone()
        if not ride:
            raise DomainError(status_code=404, detail="Ride not found")

        if not is_ride_participant(ride_id, user_id):
            raise DomainError(status_code=403, detail="Only ride participants can view the chat")

        messages = conn.execute(
            """SELECT cm.id, cm.sender_id, cm.message, cm.created_at, u.name AS sender_name
               FROM chat_messages cm JOIN users u ON cm.sender_id = u.id
               WHERE cm.ride_id = ? ORDER BY cm.created_at ASC""",
            (ride_id,)
        ).fetchall()

        return [
            {
                "id": m["id"],
                "sender_id": m["sender_id"],
                "sender_name": m["sender_name"],
                "message": m["message"],
                "created_at": m["created_at"],
            }
            for m in messages
        ]

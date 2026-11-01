"""Campus-zone smart matching (Feature 6).

Scoring is kept separate from persistence so it can be unit-tested in isolation.
"""
from datetime import datetime as dt

from app.models.database import db_session
from app.models.errors import DomainError
from app.models.geo import _haversine_km
from app.models.hotspots import CAMPUS_CLUSTERS, ZONES

def match_rides(user_id: str, source: str | None=None, pickup: str | None=None, destination: str | None=None, dropoff: str | None=None, scheduled_date: str | None=None, scheduled_time: str | None=None, class_time: str | None=None, female_only: bool=False):
    """Smart Matching Algorithm:
    Matches riders with open rides heading to their destination or passing through their intermediate stops.
    Supports proximity zone matching, class schedule time-flex matching, and female-only filtering.
    """
    effective_source = (source or pickup or "").strip()
    effective_destination = (destination or dropoff or "").strip()
    effective_time = (scheduled_time or class_time or "").strip()

    with db_session() as conn:
        user = conn.execute("SELECT gender FROM users WHERE id = ?", (user_id,)).fetchone()
        if not user:
            raise DomainError(status_code=404, detail="User not found")

        if female_only and user["gender"] != "female":
            raise DomainError(status_code=403, detail="Female-only matching is available for female students only")

        # Fetch available scheduled/active rides
        rides = conn.execute(
            """SELECT r.*, u.name AS driver_name, u.gender AS driver_gender
               FROM rides r JOIN users u ON r.driver_id = u.id
               WHERE r.driver_id != ?
                 AND r.status IN ('scheduled', 'active')
                 AND r.id NOT IN (
                     SELECT ride_id FROM ride_passengers
                     WHERE passenger_id = ? AND status IN ('requested', 'accepted')
                 )
                 AND (r.female_only = 0 OR ? = 'female')
               ORDER BY r.created_at DESC""",
            (user_id, user_id, user["gender"])
        ).fetchall()

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


        norm_src = effective_source.lower()
        norm_dst = effective_destination.lower()

        matched_results = []

        for r in rides:
            ride_id = r["id"]
            total_seats = r["total_seats"] or 4
            taken_seats = taken_map.get(ride_id, 0)
            available_seats = max(0, total_seats - taken_seats)
            if available_seats <= 0:
                continue

            if female_only and not r["female_only"]:
                continue

            ride_src = r["source"].strip().lower()
            ride_dst = r["destination"].strip().lower()
            r_stops = ride_stops_map.get(ride_id, [])
            stop_names = [s["place"].strip().lower() for s in r_stops]

            score = 0
            reasons = []

            # Source / Pickup scoring
            if not norm_src:
                score += 40
            elif norm_src == ride_src or norm_src in ride_src or ride_src in norm_src:
                score += 50
                reasons.append("Exact Pickup Point")
            else:
                # Check cluster membership
                same_cluster = False
                for cluster_name, cluster_places in CAMPUS_CLUSTERS.items():
                    if norm_src in cluster_places and ride_src in cluster_places:
                        same_cluster = True
                        break

                s_coord = ZONES.get(norm_src)
                rs_coord = ZONES.get(ride_src)
                if same_cluster or (s_coord and rs_coord and _haversine_km(s_coord, rs_coord) <= 0.4):
                    score += 45
                    reasons.append("Same Campus Pickup Zone")
                elif s_coord and rs_coord:
                    dist = _haversine_km(s_coord, rs_coord)
                    if dist <= 1.2:
                        score += 35
                        reasons.append(f"Nearby Pickup ({round(dist, 1)}km)")
                    elif dist <= 2.5:
                        score += 20
                        reasons.append(f"Connecting Corridor ({round(dist, 1)}km)")
                    else:
                        score += 0
                else:
                    score += 10

            # Destination / Drop-off scoring (checks main destination + intermediate stops)
            if not norm_dst:
                score += 40
            elif norm_dst == ride_dst or norm_dst in ride_dst or ride_dst in norm_dst:
                score += 50
                reasons.append("Direct Destination Match")
            elif norm_dst in stop_names:
                score += 45
                matched_stop = next((s["place"] for s in r_stops if s["place"].strip().lower() == norm_dst), norm_dst)
                reasons.append(f"Multi-Stop Route Match: {matched_stop}")
            else:
                # Proximity and cluster check across destination + all stops
                d_coord = ZONES.get(norm_dst)
                best_dist = 999.0
                best_place = ""
                dest_matched_cluster = False

                for place_name in [ride_dst, *stop_names]:
                    for cluster_name, cluster_places in CAMPUS_CLUSTERS.items():
                        if norm_dst in cluster_places and place_name in cluster_places:
                            dest_matched_cluster = True
                            best_place = place_name
                            break
                    p_coord = ZONES.get(place_name)
                    if d_coord and p_coord:
                        d = _haversine_km(d_coord, p_coord)
                        if d < best_dist:
                            best_dist = d
                            best_place = place_name

                if dest_matched_cluster or best_dist <= 0.4:
                    score += 48
                    reasons.append(f"BRACU Campus Zone Drop-off ({best_place.title()})")
                elif best_dist <= 1.2:
                    score += 35
                    reasons.append(f"Near Drop-off ({round(best_dist, 1)}km of {best_place.title()})")
                elif best_dist <= 2.5:
                    score += 20
                    reasons.append(f"Nearby Corridor ({round(best_dist, 1)}km of {best_place.title()})")
                else:
                    score += 0

            # Time & Class Schedule scoring
            if effective_time or scheduled_date:
                if r["scheduled_at"]:
                    try:
                        r_dt = dt.fromisoformat(r["scheduled_at"].replace("Z", "+00:00"))
                        if effective_time:
                            # Extract hour:minute
                            req_parts = effective_time.split(":")
                            if len(req_parts) == 2:
                                req_h, req_m = int(req_parts[0]), int(req_parts[1])
                                diff_mins = abs((r_dt.hour * 60 + r_dt.minute) - (req_h * 60 + req_m))
                                if diff_mins <= 30:
                                    score += 15
                                    reasons.append(f"Class Time Match ({effective_time})")
                                elif diff_mins <= 60:
                                    score += 8
                                    reasons.append(f"Near Class Time (±{diff_mins}m)")
                                else:
                                    score -= 10
                    except Exception:
                        pass

            if bool(r["female_only"]):
                reasons.append("🌸 Female-Only Carpool")

            # Require a valid match score if user provided explicit filters
            if norm_src and norm_dst and score < 50:
                continue

            matched_results.append({
                "id": r["id"],
                "driver_id": r["driver_id"],
                "driver_name": r["driver_name"],
                "source": r["source"],
                "destination": r["destination"],
                "status": r["status"],
                "distance_km": r["distance_km"],
                "base_fare": r["base_fare"],
                "surge_multiplier": r["surge_multiplier"],
                "total_seats": total_seats,
                "available_seats": available_seats,
                "scheduled_at": r["scheduled_at"],
                "female_only": bool(r["female_only"]),
                "stops": r_stops,
                "match_score": min(100, score),
                "match_reasons": reasons if reasons else ["General Campus Route"],
            })

        matched_results.sort(key=lambda x: (x["match_score"], x["scheduled_at"] or ""), reverse=True)
        return matched_results

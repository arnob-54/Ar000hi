"""Pure geospatial helpers — no database or web-framework dependencies."""
import math

from app.models.hotspots import ZONES

EARTH_RADIUS_KM = 6371.0


def _haversine_km(a: tuple, b: tuple) -> float:
    lat1, lon1 = a
    lat2, lon2 = b
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    h = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(h))


def _estimate_distance_km(source: str, destination: str) -> float:
    """Estimate distance from the zone lookup; fall back to a default for the demo."""
    s = ZONES.get(source.strip().lower())
    d = ZONES.get(destination.strip().lower())
    if s and d:
        return round(_haversine_km(s, d), 2)
    return 5.0  # default demo distance


def _path_length_km(points) -> float:
    """Sum of consecutive haversine legs over an ordered list of (lat, lng) points."""
    pts = [(p["lat"], p["lng"]) for p in points]
    if len(pts) < 2:
        return 0.0
    return sum(_haversine_km(pts[i], pts[i + 1]) for i in range(len(pts) - 1))

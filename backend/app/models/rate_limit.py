"""In-process sliding-window rate limiting.

The demo runs a single uvicorn worker, so plain in-memory state is sufficient.
Isolating it here keeps the constraint in one place and lets a Redis-backed
implementation be dropped in for multi-worker/Postgres deployments without
touching the feature modules that call it.
"""

import threading
import time


class SlidingWindowLimiter:
    """Count events per key inside a rolling time window.

    All public methods are thread-safe. ``allow`` is the atomic check-and-record
    used by message spam guards; ``is_limited`` + ``record`` serve flows that must
    report the limit before recording an attempt.
    """

    def __init__(self, limit: int, window_seconds: float):
        self.limit = limit
        self.window_seconds = window_seconds
        self._events: dict[str, list[float]] = {}
        self._lock = threading.Lock()

    def _prune(self, key: str, now: float) -> list[float]:
        stamps = [t for t in self._events.get(key, []) if now - t < self.window_seconds]
        self._events[key] = stamps
        return stamps

    def is_limited(self, key: str) -> bool:
        with self._lock:
            return len(self._prune(key, time.time())) >= self.limit

    def record(self, key: str) -> None:
        with self._lock:
            stamps = self._prune(key, time.time())
            stamps.append(time.time())
            self._events[key] = stamps

    def allow(self, key: str) -> bool:
        """Record one event and return False if the key had already hit the cap."""
        with self._lock:
            now = time.time()
            if len(self._prune(key, now)) >= self.limit:
                return False
            self._events[key].append(now)
            return True

    def reset(self) -> None:
        """Clear all state (tests and explicit logout-style flows)."""
        with self._lock:
            self._events.clear()

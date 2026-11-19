"""A small in-memory limit on failed sign-ins, to slow down password guessing.

Each client address may fail to sign in a few times per minute; after that the login endpoint
answers 429 Too Many Requests until the oldest failure is more than a minute old.

It lives in this process's memory, which fits a single API instance (the Render free plan runs
one). Several instances would each keep their own count; a shared store such as Redis would be
the next step then.
"""

import time
from collections import deque
from threading import Lock

WINDOW_SECONDS = 60
MAX_TRACKED_CLIENTS = 10_000  # bounds memory if many different addresses fail


class FailedLoginLimiter:
    def __init__(self, max_failures: int, window_seconds: float = WINDOW_SECONDS) -> None:
        self.max_failures = max_failures
        self.window = window_seconds
        self._failures: dict[str, deque[float]] = {}
        self._lock = Lock()

    def _recent(self, key: str, now: float) -> deque[float]:
        times = self._failures.get(key, deque())
        while times and now - times[0] >= self.window:
            times.popleft()
        return times

    def retry_after(self, key: str) -> int:
        """Seconds until this client may try again, or 0 if it may try now."""
        now = time.monotonic()
        with self._lock:
            times = self._recent(key, now)
            if not times:
                self._failures.pop(key, None)
                return 0
            if len(times) < self.max_failures:
                return 0
            return max(1, int(self.window - (now - times[0])) + 1)

    def record_failure(self, key: str) -> None:
        now = time.monotonic()
        with self._lock:
            if key not in self._failures and len(self._failures) >= MAX_TRACKED_CLIENTS:
                self._failures.pop(next(iter(self._failures)))  # drop the oldest-tracked client
            times = self._recent(key, now)
            times.append(now)
            self._failures[key] = times

    def reset(self) -> None:
        with self._lock:
            self._failures.clear()

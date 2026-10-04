"""One shared memory budget for everything heavy the backend does.

Why this exists
---------------
The free Render box has 512 MB. A single page load used to start, all at once:
  * ~8 YouTube Music requests (home shelves + genre shelves), each one a multi-MB JSON
    document that is expanded into Python dicts (tens of MB each while being parsed),
  * the personalised-mix lookups, and
  * a yt-dlp resolution, which also launches a Deno child process (100-250 MB).
Each part was individually "fine"; together they blew past 512 MB and the instance was
OOM-killed (which also kills any audio currently being proxied).

How it works
------------
* A weighted gate (capacity ``MEM_BUDGET``). Light YouTube Music work costs 1 unit, a
  yt-dlp resolution costs ``MEM_YTDLP_COST`` units, so e.g. four light fetches can run
  together, or one yt-dlp run plus one light fetch, but never everything at once.
* Before starting heavy work we look at the real memory in use (this process *plus* its
  child processes such as Deno). Above ``MEM_SOFT_MB`` we force a garbage collection and
  hand freed pages back to the OS; above ``MEM_HARD_MB`` we wait for other work to finish
  and, if memory does not come down, answer 503 + Retry-After instead of letting the
  whole container get killed.
"""
from __future__ import annotations

import ctypes
import gc
import logging
import os
import threading
import time
from contextlib import contextmanager
from typing import Iterator

logger = logging.getLogger(__name__)

SOFT_MB = float(os.environ.get("MEM_SOFT_MB", "360"))
HARD_MB = float(os.environ.get("MEM_HARD_MB", "430"))
BUDGET = max(2, int(os.environ.get("MEM_BUDGET", "4")))
LIGHT_COST = 1
YTDLP_COST = max(1, min(BUDGET, int(os.environ.get("MEM_YTDLP_COST", "3"))))

_PAGE = os.sysconf("SC_PAGE_SIZE") if hasattr(os, "sysconf") else 4096


class Busy(RuntimeError):
    """The server is at its memory budget; the caller should retry shortly."""


# --------------------------------------------------------------------------- measuring


def _statm_rss_bytes(pid: int | str) -> int | None:
    try:
        with open(f"/proc/{pid}/statm") as f:
            return int(f.read().split()[1]) * _PAGE
    except Exception:  # noqa: BLE001 - not Linux / process vanished
        return None


def _child_pids() -> list[int]:
    me = os.getpid()
    out: list[int] = []
    try:
        for name in os.listdir("/proc"):
            if not name.isdigit() or int(name) == me:
                continue
            try:
                with open(f"/proc/{name}/stat") as f:
                    stat = f.read()
                # "pid (comm) S ppid ..." - comm may contain spaces/parens, so split after the last ')'
                ppid = int(stat.rsplit(")", 1)[1].split()[1])
            except Exception:  # noqa: BLE001
                continue
            if ppid == me:
                out.append(int(name))
    except Exception:  # noqa: BLE001
        pass
    return out


def rss_mb(include_children: bool = True) -> float | None:
    """Resident memory in MB for this process (and, by default, its direct children)."""
    own = _statm_rss_bytes("self")
    if own is None:
        return None
    total = own
    if include_children:
        for pid in _child_pids():
            total += _statm_rss_bytes(pid) or 0
    return round(total / 1048576, 1)


def release_memory() -> None:
    """Collect garbage and give freed heap pages back to the OS (glibc only)."""
    gc.collect()
    try:
        ctypes.CDLL("libc.so.6").malloc_trim(0)
    except Exception:  # noqa: BLE001
        pass


# --------------------------------------------------------------------------- the gate


class _WeightedGate:
    def __init__(self, capacity: int) -> None:
        self.capacity = capacity
        self.used = 0
        self._cond = threading.Condition()

    def acquire(self, cost: int, timeout: float | None) -> bool:
        deadline = None if timeout is None else time.monotonic() + max(0.0, timeout)
        with self._cond:
            while self.used + cost > self.capacity:
                if deadline is None:
                    self._cond.wait()
                    continue
                left = deadline - time.monotonic()
                if left <= 0:
                    return False
                self._cond.wait(left)
            self.used += cost
            return True

    def release(self, cost: int) -> None:
        with self._cond:
            self.used = max(0, self.used - cost)
            self._cond.notify_all()


_gate = _WeightedGate(BUDGET)
_local = threading.local()


def in_flight() -> int:
    return _gate.used


def _wait_for_headroom(timeout: float, blocking: bool) -> None:
    """Make sure real memory use is acceptable before taking on more work."""
    used = rss_mb()
    if used is None or used < SOFT_MB:
        return
    release_memory()
    used = rss_mb() or 0.0
    if used < HARD_MB:
        return
    if not blocking:
        raise Busy(f"Server memory is high ({used:.0f} MB).")
    deadline = time.monotonic() + timeout
    while used >= HARD_MB:
        # Nothing else of ours is running: waiting would not help, so just carry on.
        if _gate.used == 0:
            return
        left = deadline - time.monotonic()
        if left <= 0:
            raise Busy(f"Server memory is high ({used:.0f} MB). Try again in a moment.")
        time.sleep(min(0.25, left))
        release_memory()
        used = rss_mb() or 0.0


@contextmanager
def slot(cost: int = LIGHT_COST, *, timeout: float = 30.0, blocking: bool = True) -> Iterator[None]:
    """Hold part of the memory budget while doing heavy work.

    Re-entrant per thread: if this thread already holds a slot, nested use is free (so a
    helper can take a slot without deadlocking against its caller).
    """
    if getattr(_local, "held", 0):
        yield
        return

    cost = max(1, min(cost, BUDGET))
    _wait_for_headroom(timeout, blocking)
    if not _gate.acquire(cost, timeout if blocking else 0.0):
        raise Busy("Server is busy. Try again in a moment.")
    _local.held = cost
    try:
        yield
    finally:
        _local.held = 0
        _gate.release(cost)
        used = rss_mb()
        if used is not None and used >= SOFT_MB * 0.75:
            release_memory()


def light(timeout: float = 30.0):
    """Slot for one YouTube Music request + parsing (fetch, parse and drop the raw JSON inside it)."""
    return slot(LIGHT_COST, timeout=timeout)

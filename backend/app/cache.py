from __future__ import annotations

from threading import Lock
from typing import Any

from cachetools import TTLCache

# Search / browse: 15 minutes
# Resolved stream URLs: ~5 hours (Google CDN URLs expire)
_search = TTLCache(maxsize=512, ttl=15 * 60)
_browse = TTLCache(maxsize=256, ttl=15 * 60)
_streams = TTLCache(maxsize=256, ttl=5 * 60 * 60)
_lock = Lock()


def get_search(key: str) -> Any | None:
    with _lock:
        return _search.get(key)


def set_search(key: str, value: Any) -> None:
    with _lock:
        _search[key] = value


def get_browse(key: str) -> Any | None:
    with _lock:
        return _browse.get(key)


def set_browse(key: str, value: Any) -> None:
    with _lock:
        _browse[key] = value


def get_stream(key: str) -> Any | None:
    with _lock:
        return _streams.get(key)


def set_stream(key: str, value: Any) -> None:
    with _lock:
        _streams[key] = value


def drop_stream(key: str) -> None:
    with _lock:
        _streams.pop(key, None)

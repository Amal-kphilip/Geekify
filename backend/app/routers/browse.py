from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, HTTPException

from app import cache
from app.models import ArtistPage, CollectionPage, HomeResponse
from app.models import Track
from app.services.innertube_client import (
    music_browse,
    music_next,
    music_radio,
    parse_artist,
    parse_collection,
    parse_home,
)
from app.services.parsers import extract_tracks

logger = logging.getLogger(__name__)
router = APIRouter()


_HOME_ENDPOINTS = ["FEmusic_home", "FEmusic_explore", "FEmusic_charts", "FEmusic_new_releases"]


def _load_home_endpoint(endpoint: str):
    try:
        return parse_home(music_browse(endpoint)).shelves
    except Exception as exc:  # noqa: BLE001
        logger.warning("home endpoint %s failed: %s", endpoint, exc)
        return []


@router.get("/home", response_model=HomeResponse)
def home():
    hit = cache.get_browse("home_rich")
    if hit:
        return hit

    with ThreadPoolExecutor(max_workers=len(_HOME_ENDPOINTS)) as pool:
        results = list(pool.map(_load_home_endpoint, _HOME_ENDPOINTS))

    combined_shelves = []
    seen_titles: set[str] = set()
    for shelves in results:
        for s in shelves:
            title_clean = s.title.strip().lower()
            if title_clean not in seen_titles and len(s.items) > 0:
                seen_titles.add(title_clean)
                combined_shelves.append(s)

    if not combined_shelves:
        raise HTTPException(status_code=502, detail="Could not load the YouTube Music home feed. Try again shortly.")

    res = HomeResponse(shelves=combined_shelves[:20])
    cache.set_browse("home_rich", res)
    return res


@router.get("/related/{video_id}", response_model=list[Track])
def related(video_id: str):
    key = f"related:{video_id}"
    hit = cache.get_browse(key)
    if hit:
        return hit
    tracks: list[Track] = []
    try:
        raw = music_radio(video_id)
        tracks = extract_tracks(raw, limit=50)
    except Exception:
        try:
            raw = music_next(video_id)
            tracks = extract_tracks(raw, limit=50)
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=502, detail="Could not load recommendations") from exc
    tracks = [t for t in tracks if t.videoId != video_id]
    if tracks:
        cache.set_browse(key, tracks)
    return tracks


@router.get("/artist/{channel_id}", response_model=ArtistPage)
def artist(channel_id: str):
    key = f"artist:{channel_id}"
    hit = cache.get_browse(key)
    if hit:
        return hit
    try:
        raw = music_browse(channel_id)
    except Exception as exc:
        raise HTTPException(status_code=404, detail="Artist not found") from exc
    parsed = parse_artist(raw, channel_id)
    cache.set_browse(key, parsed)
    return parsed


@router.get("/album/{playlist_id}", response_model=CollectionPage)
def album(playlist_id: str):
    return _collection(playlist_id, "album")


@router.get("/playlist/{playlist_id}", response_model=CollectionPage)
def playlist(playlist_id: str):
    return _collection(playlist_id, "playlist")


def _collection(ident: str, kind: str) -> CollectionPage:
    key = f"{kind}:{ident}"
    hit = cache.get_browse(key)
    if hit:
        return hit

    # Candidate browse IDs. Albums (MPRE...), artists (UC...) and already-prefixed
    # ids are browsed as-is; bare playlist ids need the "VL" prefix.
    candidates: list[str] = []
    if ident.startswith(("MPRE", "UC", "FE")):
        candidates.append(ident)
    elif ident.startswith("VL"):
        candidates.extend([ident, ident[2:]])
    else:
        candidates.extend([f"VL{ident}", ident])

    raw = None
    last_err: Exception | None = None
    for cand in candidates:
        try:
            raw = music_browse(cand)
            if raw:
                break
        except Exception as exc:
            last_err = exc
            continue

    if not raw:
        raise HTTPException(status_code=404, detail="Collection not found") from last_err

    parsed = parse_collection(raw, ident, kind)
    if not parsed.tracks:
        raise HTTPException(status_code=404, detail="Collection not found")
    cache.set_browse(key, parsed)
    return parsed

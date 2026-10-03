from __future__ import annotations

import logging
import random
from concurrent.futures import ThreadPoolExecutor
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Response

from app import cache
from app.models import ArtistPage, CollectionPage, HomeResponse, Shelf
from app.models import Track
from app.services.innertube_client import (
    music_browse,
    music_next,
    music_radio,
    music_search,
    parse_artist,
    parse_collection,
    parse_home,
    parse_search,
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


# (shelf title, search query, result kind). A few are picked at random on every
# home load so the page doesn't look identical each visit.
_GENRE_SHELVES: list[tuple[str, str, str]] = [
    ("Malayalam hits", "Malayalam hits", "playlist"),
    ("Malayalam new releases", "new Malayalam songs", "album"),
    ("Hindi hits", "Hindi hits", "playlist"),
    ("Tamil hits", "Tamil hits", "playlist"),
    ("Telugu hits", "Telugu hits", "playlist"),
    ("Punjabi hits", "Punjabi hits", "playlist"),
    ("Hip-hop", "hip hop hits", "playlist"),
    ("Pop hits", "pop hits", "playlist"),
    ("Lo-fi & chill", "lofi chill beats", "playlist"),
    ("Workout", "workout music", "playlist"),
    ("Throwback", "throwback hits", "playlist"),
    ("Party", "party songs", "playlist"),
    ("Rock classics", "classic rock", "playlist"),
    ("Romantic", "romantic songs", "playlist"),
    ("K-pop", "k-pop hits", "playlist"),
    ("Fresh albums", "new albums", "album"),
]


def _genre_shelf(spec: tuple[str, str, str]) -> Optional[Shelf]:
    title, query, kind = spec
    try:
        key = f"{query}|{kind}"  # same key format as the /search route, so the cache is shared
        parsed = cache.get_search(key)
        if not parsed:
            parsed = parse_search(music_search(query, kind), query, kind)
            if parsed.albums or parsed.playlists:
                cache.set_search(key, parsed)
        cards = parsed.playlists if kind == "playlist" else parsed.albums
        return Shelf(title=title, items=list(cards[:20])) if cards else None
    except Exception as exc:  # noqa: BLE001
        logger.warning("genre shelf %s failed: %s", title, exc)
        return None


def _home_pool() -> list[Shelf]:
    """Generic YouTube Music shelves; cached for a while because they are slow to fetch."""
    hit = cache.get_browse("home_pool")
    if hit:
        return hit
    with ThreadPoolExecutor(max_workers=len(_HOME_ENDPOINTS)) as pool:
        results = list(pool.map(_load_home_endpoint, _HOME_ENDPOINTS))
    combined: list[Shelf] = []
    seen_titles: set[str] = set()
    for shelves in results:
        for s in shelves:
            title_clean = s.title.strip().lower()
            if title_clean not in seen_titles and len(s.items) > 0:
                seen_titles.add(title_clean)
                combined.append(s)
    if combined:
        cache.set_browse("home_pool", combined)
    return combined


@router.get("/home", response_model=HomeResponse)
def home(response: Response, seed: Optional[int] = Query(None)):
    # The browser / CDN must never cache this: every page load should get a fresh mix.
    response.headers["Cache-Control"] = "no-store"
    rng = random.Random(seed) if seed is not None else random.Random()

    picks = rng.sample(_GENRE_SHELVES, 4)
    with ThreadPoolExecutor(max_workers=5) as ex:
        genre_future = [ex.submit(_genre_shelf, spec) for spec in picks]
        pool = _home_pool()
        genre_shelves = [f.result() for f in genre_future]
    genre_shelves = [g for g in genre_shelves if g]

    shelves = [Shelf(title=s.title, items=rng.sample(list(s.items), len(s.items))) for s in pool]
    rng.shuffle(shelves)
    # Drop in the genre shelves at random positions near the top.
    for g in genre_shelves:
        shelves.insert(rng.randint(0, min(4, len(shelves))), g)

    if not shelves:
        raise HTTPException(status_code=502, detail="Could not load the YouTube Music home feed. Try again shortly.")
    return HomeResponse(shelves=shelves[:18])


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

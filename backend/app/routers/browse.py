from __future__ import annotations

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

router = APIRouter()


@router.get("/home", response_model=HomeResponse)
def home():
    hit = cache.get_browse("home_rich")
    if hit:
        return hit

    combined_shelves = []
    seen_titles = set()

    for endpoint in ["FEmusic_home", "FEmusic_explore", "FEmusic_charts", "FEmusic_new_releases"]:
        try:
            raw = music_browse(endpoint)
            parsed = parse_home(raw)
            for s in parsed.shelves:
                title_clean = s.title.strip().lower()
                if title_clean not in seen_titles and len(s.items) > 0:
                    seen_titles.add(title_clean)
                    combined_shelves.append(s)
        except Exception:
            continue

    if not combined_shelves:
        raw = music_browse("FEmusic_home")
        combined_shelves = parse_home(raw).shelves

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
        raw = music_next(video_id)
        tracks = extract_tracks(raw, limit=50)
    tracks = [t for t in tracks if t.videoId != video_id]
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

    # Generate candidate browse IDs
    candidates: list[str] = []
    if not ident.startswith(("VL", "FE")):
        candidates.append(f"VL{ident}")
    candidates.append(ident)
    if ident.startswith("VL"):
        candidates.append(ident[2:])

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
    if not parsed.tracks and ident.startswith("UC"):
        raise HTTPException(status_code=404, detail="Collection not found")
    cache.set_browse(key, parsed)
    return parsed

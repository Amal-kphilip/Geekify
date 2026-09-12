from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app import cache
from app.models import SearchResponse, Track
from app.services.innertube_client import (
    PlayabilityError,
    music_search,
    parse_search,
    player_response,
    playability_or_raise,
    track_from_player,
)

router = APIRouter()


@router.get("/search", response_model=SearchResponse)
def search(
    q: str = Query(..., min_length=1),
    type: Optional[str] = Query(None, alias="type"),
):
    kind = type if type in {"song", "album", "artist", "playlist"} else None
    key = f"{q}|{kind or 'all'}"
    hit = cache.get_search(key)
    if hit:
        return hit
    raw = music_search(q, kind)
    parsed = parse_search(raw, q, kind)
    cache.set_search(key, parsed)
    return parsed


@router.get("/track/{video_id}", response_model=Track)
def track(video_id: str):
    key = f"track:{video_id}"
    hit = cache.get_browse(key)
    if hit:
        return hit
    try:
        data, _client = player_response(video_id)
        playability_or_raise(data, video_id)
        parsed = track_from_player(data, video_id)
    except Exception:
        try:
            from app.services.cipher import extract_track_with_ytdlp
            parsed = extract_track_with_ytdlp(video_id)
        except Exception as exc:
            raise HTTPException(
                status_code=404,
                detail={
                    "error": "unplayable",
                    "status": "ERROR",
                    "reason": "Could not load track metadata.",
                    "videoId": video_id,
                },
            ) from exc
    cache.set_browse(key, parsed)
    return parsed

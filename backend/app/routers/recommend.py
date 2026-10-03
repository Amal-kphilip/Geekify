from __future__ import annotations

import hashlib
import logging
from concurrent.futures import ThreadPoolExecutor
from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app import cache
from app.models import Track
from app.services.innertube_client import music_next, music_radio
from app.services.parsers import extract_tracks
from app.services.recommender import Signal, build_mixes

logger = logging.getLogger(__name__)
router = APIRouter()


class SignalIn(BaseModel):
    videoId: str
    artist: str = ""
    title: str = ""


class MixRequest(BaseModel):
    # Newest first. Likes are weighted higher than plain plays.
    liked: list[SignalIn] = Field(default_factory=list)
    recent: list[SignalIn] = Field(default_factory=list)


class Mix(BaseModel):
    id: str
    title: str
    subtitle: str
    tracks: list[Track]


class MixResponse(BaseModel):
    mixes: list[Mix] = Field(default_factory=list)
    seeds: list[str] = Field(default_factory=list)


def _related(video_id: str) -> list[Track]:
    # Same cache key as /api/related so both endpoints share work.
    key = f"related:{video_id}"
    hit = cache.get_browse(key)
    if hit:
        return hit
    tracks: list[Track] = []
    try:
        tracks = extract_tracks(music_radio(video_id), limit=50)
    except Exception:  # noqa: BLE001
        try:
            tracks = extract_tracks(music_next(video_id), limit=50)
        except Exception as exc:  # noqa: BLE001
            logger.warning("related failed for %s: %s", video_id, exc)
            return []
    tracks = [t for t in tracks if t.videoId != video_id]
    if tracks:
        cache.set_browse(key, tracks)
    return tracks


def _sig(items: list[SignalIn], limit: int) -> list[Signal]:
    return [Signal(video_id=i.videoId, artist=i.artist, title=i.title) for i in items[:limit] if i.videoId]


@router.post("/recommend/mix", response_model=MixResponse)
def recommend_mix(req: MixRequest) -> MixResponse:
    liked = _sig(req.liked, 40)
    recent = _sig(req.recent, 30)
    if not liked and not recent:
        return MixResponse()

    ckey = "mix:" + hashlib.sha1(
        ("|".join(s.video_id for s in liked) + "#" + "|".join(s.video_id for s in recent)).encode()
    ).hexdigest()
    hit = cache.get_browse(ckey)
    if hit:
        return hit

    # Radio lookups are light HTTP calls; 3 at a time keeps memory flat on small hosts.
    with ThreadPoolExecutor(max_workers=3) as pool:
        mixes, seeds = build_mixes(liked, recent, _related, map_fn=pool.map)

    res = MixResponse(
        mixes=[Mix(id=m.id, title=m.title, subtitle=m.subtitle, tracks=m.tracks) for m in mixes],
        seeds=seeds,
    )
    if res.mixes:
        cache.set_browse(ckey, res)
    return res

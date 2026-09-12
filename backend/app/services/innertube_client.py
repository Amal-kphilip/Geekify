from __future__ import annotations

import logging
import time
from typing import Any, Optional

import innertube
from innertube.enums import Endpoint

from app.models import ArtistPage, ArtistRef, Card, CollectionPage, HomeResponse, SearchResponse, Shelf, Track
from app.services import parsers as P

logger = logging.getLogger(__name__)

SEARCH_PARAMS = {
    "song": "EgWKAQIIAWoKEAkQBRAKEAMQBA%3D%3D",
    "album": "EgWKAQIYAWoKEAkQChAFEAMQBA%3D%3D",
    "artist": "EgWKAQIgAWoKEAkQChAFEAMQBA%3D%3D",
    "playlist": "EgWKAQJQAWoKEAkQChAFEAMQBA%3D%3D",
}

PLAYER_CLIENTS = ("ANDROID", "ANDROID_MUSIC", "IOS", "IOS_MUSIC")
BROWSE_CLIENTS = ("WEB_REMIX", "WEB")
PLAYER_PARAMS = "CgIQBg=="


class PlayabilityError(Exception):
    def __init__(self, status: str, reason: str | None, video_id: str):
        self.status = status
        self.reason = reason
        self.video_id = video_id
        super().__init__(reason or status)


def _client(name: str) -> innertube.InnerTube:
    return innertube.InnerTube(name)


def _call_with_retry(fn, *, attempts: int = 3, backoff: float = 0.8) -> Any:
    last: Exception | None = None
    for i in range(attempts):
        try:
            return fn()
        except Exception as exc:  # noqa: BLE001
            last = exc
            logger.warning("innertube call failed (attempt %s): %s", i + 1, exc)
            time.sleep(backoff * (2**i))
    assert last is not None
    raise last


def music_search(query: str, type_: str | None = None) -> dict:
    params = SEARCH_PARAMS.get(type_ or "", None)

    def _do():
        client = _client("WEB_REMIX")
        if params:
            return client.search(query, params=params)
        return client.search(query)

    try:
        return _call_with_retry(_do)
    except Exception:
        return _call_with_retry(lambda: _client("WEB").search(query))


def music_browse(browse_id: str, params: str | None = None) -> dict:
    last_err: Exception | None = None
    for name in BROWSE_CLIENTS:
        try:
            client = _client(name)
            return _call_with_retry(lambda c=client: c.browse(browse_id, params=params))
        except Exception as exc:  # noqa: BLE001
            last_err = exc
            logger.warning("browse via %s failed: %s", name, exc)
    raise last_err or RuntimeError("browse failed")


def music_next(video_id: str) -> dict:
    def _do():
        return _client("WEB_REMIX").next(video_id=video_id)

    try:
        return _call_with_retry(_do)
    except Exception:
        return _call_with_retry(lambda: _client("WEB").next(video_id=video_id))


def music_radio(video_id: str) -> dict:
    playlist_id = f"RDAMVM{video_id}"
    return _call_with_retry(lambda: _client("WEB_REMIX").next(video_id=video_id, playlist_id=playlist_id))


def player_response(video_id: str) -> tuple[dict, str]:
    last_err: Exception | None = None
    for name in PLAYER_CLIENTS:
        try:
            client = _client(name)

            def _do(c=client):
                return c(
                    Endpoint.PLAYER,
                    body={"videoId": video_id, "params": PLAYER_PARAMS},
                )

            data = _call_with_retry(_do, attempts=2, backoff=0.4)
            status = (data.get("playabilityStatus") or {}).get("status", "UNKNOWN")
            if status == "OK" and (data.get("streamingData") or data.get("videoDetails")):
                return data, name
            if status in {"UNPLAYABLE", "LOGIN_REQUIRED", "ERROR"}:
                # try next client — some restrictions differ by client
                last_err = PlayabilityError(
                    status,
                    (data.get("playabilityStatus") or {}).get("reason"),
                    video_id,
                )
                continue
            return data, name
        except PlayabilityError:
            raise
        except Exception as exc:  # noqa: BLE001
            last_err = exc
            logger.warning("player %s failed: %s", name, exc)
    if isinstance(last_err, PlayabilityError):
        raise last_err
    # last resort: WEB_REMIX (often ciphered)
    data = _call_with_retry(
        lambda: _client("WEB_REMIX")(
            Endpoint.PLAYER, body={"videoId": video_id, "params": PLAYER_PARAMS}
        )
    )
    return data, "WEB_REMIX"


def playability_or_raise(data: dict, video_id: str) -> None:
    ps = data.get("playabilityStatus") or {}
    status = ps.get("status") or "UNKNOWN"
    reason = ps.get("reason") or (ps.get("messages") or [None])[0]
    if status == "OK":
        return
    mapped = reason or status
    if status == "LOGIN_REQUIRED":
        mapped = reason or "This track is age-restricted and cannot be played."
    elif status == "UNPLAYABLE":
        mapped = reason or "This track is unplayable (region-locked, private, or removed)."
    elif status == "ERROR":
        mapped = reason or "This track is unavailable."
    raise PlayabilityError(status, mapped, video_id)


def pick_audio_format(streaming: dict) -> dict | None:
    formats = list(streaming.get("adaptiveFormats") or []) + list(streaming.get("formats") or [])
    audio: list[dict] = []
    for fmt in formats:
        mime = str(fmt.get("mimeType") or "")
        has_audio = "audio/" in mime or fmt.get("audioQuality") or fmt.get("audioSampleRate")
        has_video = "video/" in mime or (fmt.get("width") and "audio/" not in mime)
        if has_audio and not has_video:
            audio.append(fmt)
        elif has_audio and "audio/" in mime:
            audio.append(fmt)
    audio.sort(key=lambda f: int(f.get("bitrate") or f.get("averageBitrate") or 0), reverse=True)
    return audio[0] if audio else None


def track_from_player(data: dict, video_id: str) -> Track:
    details = data.get("videoDetails") or {}
    micro = (data.get("microformat") or {}).get("playerMicroformatRenderer") or {}
    thumbs = P.best_thumbnails((details.get("thumbnail") or {}).get("thumbnails") or [])
    if not thumbs:
        thumbs = P.find_thumbnails(micro)
    length = details.get("lengthSeconds")
    seconds = int(length) if str(length).isdigit() else None
    duration = None
    if seconds is not None:
        m, s = divmod(seconds, 60)
        h, m = divmod(m, 60)
        duration = f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"
    author = details.get("author") or "Unknown"
    return Track(
        videoId=details.get("videoId") or video_id,
        title=details.get("title") or "Unknown",
        artist=author,
        artists=[ArtistRef(name=author, id=details.get("channelId"))],
        thumbnails=thumbs,
        duration=duration,
        durationSeconds=seconds,
        type="song",
    )


def parse_search(raw: dict, query: str, type_: str | None) -> SearchResponse:
    songs: list[Track] = []
    albums: list[Card] = []
    artists: list[Card] = []
    playlists: list[Card] = []
    shelves_out: list[Shelf] = []

    for title, block in P.extract_shelves(raw):
        tracks = P.extract_tracks(block)
        cards = P.extract_cards(block)
        lower = title.lower()
        items: list = []
        if "artist" in lower:
            artists.extend([c for c in cards if c.type == "artist"] or cards)
            items = [c for c in cards if c.type == "artist"] or cards
        elif "album" in lower:
            albums.extend([c for c in cards if c.type == "album"] or cards)
            items = [c for c in cards if c.type == "album"] or cards
        elif "playlist" in lower:
            playlists.extend([c for c in cards if c.type == "playlist"] or cards)
            items = [c for c in cards if c.type == "playlist"] or cards
        else:
            songs.extend(tracks)
            items = tracks or cards
        if items:
            shelves_out.append(Shelf(title=title or "Results", items=items))

    if not songs:
        songs = P.extract_tracks(raw)
    if type_ == "song" and not songs:
        songs = P.extract_tracks(raw)
    if type_ == "album":
        albums = albums or P.extract_cards(raw, prefer="album") or P.extract_cards(raw)
    if type_ == "artist":
        artists = artists or P.extract_cards(raw, prefer="artist") or P.extract_cards(raw)
    if type_ == "playlist":
        playlists = playlists or P.extract_cards(raw, prefer="playlist") or P.extract_cards(raw)

    return SearchResponse(
        query=query,
        songs=_dedupe_tracks(songs),
        albums=_dedupe_cards(albums),
        artists=_dedupe_cards(artists),
        playlists=_dedupe_cards(playlists),
        shelves=shelves_out,
    )


def parse_home(raw: dict) -> HomeResponse:
    shelves: list[Shelf] = []
    for title, block in P.extract_shelves(raw):
        tracks = P.extract_tracks(block, limit=24)
        cards = P.extract_cards(block, limit=24)
        items: list = tracks if tracks and not cards else (cards or tracks)
        if not items:
            continue
        shelves.append(Shelf(title=title or "For you", items=items))
    if not shelves:
        tracks = P.extract_tracks(raw, limit=40)
        if tracks:
            shelves.append(Shelf(title="Quick picks", items=tracks))
    return HomeResponse(shelves=shelves[:16])


def parse_artist(raw: dict, channel_id: str) -> ArtistPage:
    header = P.header_text(raw)
    songs: list[Track] = []
    albums: list[Card] = []
    singles: list[Card] = []
    related: list[Card] = []
    for title, block in P.extract_shelves(raw):
        lower = title.lower()
        if "song" in lower or "top" in lower:
            songs.extend(P.extract_tracks(block, limit=20))
        elif "single" in lower or "ep" in lower:
            singles.extend(P.extract_cards(block, limit=20))
        elif "album" in lower:
            albums.extend(P.extract_cards(block, limit=20))
        elif "appear" in lower or "similar" in lower or "fan" in lower or "artist" in lower:
            related.extend(P.extract_cards(block, limit=16))
    if not songs:
        songs = P.extract_tracks(raw, limit=15)
    return ArtistPage(
        id=channel_id,
        name=header.get("name") or "Artist",
        description=header.get("description"),
        thumbnails=header.get("thumbnails") or [],
        songs=_dedupe_tracks(songs)[:25],
        albums=_dedupe_cards(albums),
        singles=_dedupe_cards(singles),
        related=_dedupe_cards(related),
    )


def parse_collection(raw: dict, ident: str, kind: str) -> CollectionPage:
    header = P.header_text(raw)
    tracks = P.extract_tracks(raw, limit=250)
    subtitle = header.get("subtitle")
    artist = None
    artist_id = None
    if subtitle:
        artist = str(subtitle).split("•")[0].strip()
    return CollectionPage(
        id=ident,
        title=header.get("name") or ident,
        subtitle=subtitle,
        description=header.get("description"),
        type="album" if kind == "album" else "playlist",
        year=header.get("year"),
        thumbnails=header.get("thumbnails") or [],
        tracks=_dedupe_tracks(tracks),
        artist=artist,
        artistId=artist_id,
    )


def _dedupe_tracks(tracks: list[Track]) -> list[Track]:
    seen: set[str] = set()
    out: list[Track] = []
    for t in tracks:
        if t.videoId in seen:
            continue
        seen.add(t.videoId)
        out.append(t)
    return out


def _dedupe_cards(cards: list[Card]) -> list[Card]:
    seen: set[str] = set()
    out: list[Card] = []
    for c in cards:
        if c.id in seen:
            continue
        seen.add(c.id)
        out.append(c)
    return out

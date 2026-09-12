from __future__ import annotations

import logging
from typing import Any
from urllib.parse import parse_qs, unquote, urlparse

import yt_dlp

logger = logging.getLogger(__name__)

_YDL_OPTS: dict[str, Any] = {
    "quiet": True,
    "no_warnings": True,
    "noprogress": True,
    "skip_download": True,
    "format": "bestaudio/best",
    "extract_flat": False,
    "js_runtimes": {"node": {}},
}


def parse_signature_cipher(cipher: str) -> dict[str, str]:
    parsed = parse_qs(cipher)
    return {k: v[0] if v else "" for k, v in parsed.items()}


def extract_url_with_ytdlp(video_id: str) -> tuple[str, str]:
    """Return (url, mime_type) using yt-dlp, always picking the highest quality audio format."""
    with yt_dlp.YoutubeDL(_YDL_OPTS) as ydl:
        info = ydl.extract_info(
            f"https://www.youtube.com/watch?v={video_id}", download=False
        )
    if not info:
        raise RuntimeError("yt-dlp returned no metadata")

    formats = info.get("formats") or []
    # Filter for pure audio streams with direct URLs
    audio_formats = [
        f
        for f in formats
        if f.get("url")
        and (f.get("vcodec") in (None, "none") or "audio" in str(f.get("mimeType", "")).lower())
        and (f.get("abr") or 0) > 0
    ]
    # Sort strictly by audio bitrate (abr) descending so we get 160k opus / 128k aac
    audio_formats.sort(key=lambda f: float(f.get("abr") or 0), reverse=True)

    if audio_formats:
        best_fmt = audio_formats[0]
        mime = best_fmt.get("mimetype") or best_fmt.get("ext") or "audio/webm"
        return best_fmt["url"], _guess_mime(mime, best_fmt["url"])

    # Fallback to info.get("url") if formats list was empty
    url = info.get("url")
    if url:
        mime = info.get("mimetype") or info.get("ext") or "audio/webm"
        return url, _guess_mime(mime, url)

    raise RuntimeError("yt-dlp could not resolve an audio URL")


from app.models import ArtistRef, Thumbnail, Track


def extract_track_with_ytdlp(video_id: str) -> Track:
    """Return a Track model populated from yt-dlp metadata."""
    with yt_dlp.YoutubeDL(_YDL_OPTS) as ydl:
        info = ydl.extract_info(
            f"https://www.youtube.com/watch?v={video_id}", download=False
        )
    if not info:
        raise RuntimeError("yt-dlp returned no metadata")

    title = info.get("title") or "Unknown"
    author = info.get("artist") or info.get("uploader") or info.get("channel") or "Unknown"
    duration_secs = int(info.get("duration") or 0) if info.get("duration") else None
    duration_str = None
    if duration_secs:
        m, s = divmod(duration_secs, 60)
        h, m = divmod(m, 60)
        duration_str = f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"

    raw_thumbs = info.get("thumbnails") or []
    thumbs: list[Thumbnail] = []
    for t in raw_thumbs:
        if t.get("url"):
            thumbs.append(Thumbnail(url=t["url"], width=t.get("width"), height=t.get("height")))

    return Track(
        videoId=video_id,
        title=title,
        artist=author,
        artists=[ArtistRef(name=author, id=info.get("channel_id"))],
        thumbnails=thumbs,
        duration=duration_str,
        durationSeconds=duration_secs,
        type="song",
    )


def _guess_mime(hint: str | None, url: str) -> str:
    if hint and "/" in hint and not hint.startswith("http"):
        return hint.split(";")[0]
    path = unquote(urlparse(url).path).lower()
    if path.endswith(".m4a") or "mp4" in path:
        return "audio/mp4"
    return "audio/webm"


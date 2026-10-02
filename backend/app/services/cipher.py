from __future__ import annotations

import logging
import base64
import os
from pathlib import Path
import tempfile
from typing import Any
from urllib.parse import parse_qs, unquote, urlparse

import yt_dlp

from app.models import ArtistRef, Thumbnail, Track

logger = logging.getLogger(__name__)

# Player clients understood by current yt-dlp releases (the old android_music /
# ios_music / android_creator / safari names no longer exist and were ignored).
_CLIENTS_PRIMARY = ["android_vr", "tv"]
_CLIENTS_SECONDARY = ["ios", "web_safari", "mweb"]
_CLIENTS_TERTIARY = ["web", "web_embedded", "tv_embedded"]


def _fmt_headers(fmt: dict, info: dict) -> dict[str, str]:
    """Headers yt-dlp says must accompany this URL (UA etc.); googlevideo rejects mismatches with 403."""
    raw = fmt.get("http_headers") or info.get("http_headers") or {}
    keep = {"user-agent", "accept", "accept-language", "referer", "origin"}
    return {k: str(v) for k, v in raw.items() if k.lower() in keep}


def _is_direct(f: dict) -> bool:
    """Only plain HTTP(S) progressive formats can be range-proxied (no HLS/DASH manifests)."""
    proto = str(f.get("protocol") or "https")
    return proto.startswith("http") and "dash" not in proto and "m3u8" not in proto


def _get_cookie_file() -> str | None:
    """Find or create a cookies file from env vars or standard paths."""
    for candidate in [
        os.environ.get("YOUTUBE_COOKIES_PATH"),
        "cookies.txt",
        "backend/cookies.txt",
        str(Path(__file__).resolve().parent.parent.parent / "cookies.txt"),
    ]:
        if candidate and os.path.isfile(candidate):
            return os.path.abspath(candidate)

    # 1. Plain text cookies in env var
    raw = os.environ.get("YOUTUBE_COOKIES")
    if raw and len(raw.strip()) > 10:
        path = os.path.join(tempfile.gettempdir(), "geekify_yt_cookies.txt")
        try:
            with open(path, "w", encoding="utf-8") as f:
                f.write(raw)
            return path
        except Exception as err:
            logger.warning("Failed writing YOUTUBE_COOKIES to %s: %s", path, err)

    # 2. Base64 encoded cookies in env var
    raw_b64 = os.environ.get("YOUTUBE_COOKIES_BASE64")
    if raw_b64:
        path = os.path.join(tempfile.gettempdir(), "geekify_yt_cookies.txt")
        try:
            decoded = base64.b64decode(raw_b64).decode("utf-8")
            with open(path, "w", encoding="utf-8") as f:
                f.write(decoded)
            return path
        except Exception as err:
            logger.warning("Failed writing YOUTUBE_COOKIES_BASE64 to %s: %s", path, err)

    return None


def _get_ydl_opts(clients: list[str]) -> dict[str, Any]:
    opts: dict[str, Any] = {
        "quiet": True,
        "no_warnings": True,
        "noprogress": True,
        "skip_download": True,
        "noplaylist": True,
        "socket_timeout": 20,
        "extractor_args": {
            "youtube": {
                "player_client": clients,
            }
        },
    }
    cookie_file = _get_cookie_file()
    if cookie_file:
        opts["cookiefile"] = cookie_file
    return opts


def parse_signature_cipher(cipher: str) -> dict[str, str]:
    parsed = parse_qs(cipher)
    return {k: v[0] if v else "" for k, v in parsed.items()}


def _pick_best_audio_format(info: dict) -> tuple[str, str, dict[str, str]] | tuple[None, None, dict[str, str]]:
    formats = info.get("formats") or []

    # 1. First preference: pure audio streams (no video track, e.g. opus 160k / m4a 128k)
    pure_audio = [
        f
        for f in formats
        if f.get("url")
        and _is_direct(f)
        and not str(f.get("ext") or "").startswith("mhtml")
        and not str(f.get("format_id", "")).startswith("sb")
        and f.get("vcodec") in (None, "none")
        and f.get("acodec") not in (None, "none")
    ]
    pure_audio.sort(
        key=lambda f: float(f.get("abr") or f.get("tbr") or f.get("bitrate") or 0),
        reverse=True,
    )
    if pure_audio:
        best_fmt = pure_audio[0]
        ext = best_fmt.get("ext")
        mime = best_fmt.get("mimetype") or ("audio/mp4" if ext in ("m4a", "mp4") else "audio/webm")
        return best_fmt["url"], _guess_mime(mime, best_fmt["url"]), _fmt_headers(best_fmt, info)

    # 2. Second preference: muxed streams with audio (e.g. format 18 AAC)
    muxed_audio = [
        f
        for f in formats
        if f.get("url")
        and _is_direct(f)
        and not str(f.get("ext") or "").startswith("mhtml")
        and not str(f.get("format_id", "")).startswith("sb")
        and f.get("acodec") not in (None, "none")
    ]
    if muxed_audio:
        muxed_audio.sort(key=lambda f: float(f.get("tbr") or 0), reverse=True)
        best_fmt = muxed_audio[0]
        mime = "audio/mp4" if best_fmt.get("ext") in ("mp4", "m4a") else "audio/webm"
        return best_fmt["url"], mime, _fmt_headers(best_fmt, info)

    # 3. Direct info url fallback
    url = info.get("url")
    if url:
        return url, _guess_mime(info.get("ext") or "audio/webm", url), _fmt_headers(info, info)

    return None, None, {}


def extract_url_with_ytdlp(video_id: str) -> tuple[str, str, dict[str, str]]:
    """Return (url, mime_type, request_headers) using yt-dlp, picking the best playable audio stream."""
    errs: list[str] = []

    # 1. Primary: YouTube Music endpoint (android_music, ios_music)
    try:
        with yt_dlp.YoutubeDL(_get_ydl_opts(_CLIENTS_PRIMARY)) as ydl:
            info = ydl.extract_info(
                f"https://music.youtube.com/watch?v={video_id}", download=False
            )
            if info:
                url, mime, hdrs = _pick_best_audio_format(info)
                if url and mime:
                    return url, mime, hdrs
                errs.append("music: no format with direct url")
    except Exception as exc:
        errs.append(f"music: {exc}")

    # 2. Secondary: Mobile & embedded clients on standard YouTube
    try:
        with yt_dlp.YoutubeDL(_get_ydl_opts(_CLIENTS_SECONDARY)) as ydl:
            info = ydl.extract_info(
                f"https://www.youtube.com/watch?v={video_id}", download=False
            )
            if info:
                url, mime, hdrs = _pick_best_audio_format(info)
                if url and mime:
                    return url, mime, hdrs
                errs.append("video: no format with direct url")
    except Exception as exc:
        errs.append(f"video: {exc}")

    # 3. Tertiary: Generic fallback
    try:
        with yt_dlp.YoutubeDL(_get_ydl_opts(_CLIENTS_TERTIARY)) as ydl:
            info = ydl.extract_info(
                f"https://www.youtube.com/watch?v={video_id}", download=False
            )
            if info:
                url, mime, hdrs = _pick_best_audio_format(info)
                if url and mime:
                    return url, mime, hdrs
                errs.append("generic: no format with direct url")
    except Exception as exc:
        errs.append(f"generic: {exc}")

    raise RuntimeError(f"Could not resolve audio for {video_id}: {'; '.join(errs)}")


def extract_track_with_ytdlp(video_id: str) -> Track:
    """Return a Track model populated from yt-dlp metadata."""
    try:
        with yt_dlp.YoutubeDL(_get_ydl_opts(_CLIENTS_PRIMARY)) as ydl:
            info = ydl.extract_info(
                f"https://music.youtube.com/watch?v={video_id}", download=False
            )
    except Exception:
        with yt_dlp.YoutubeDL(_get_ydl_opts(_CLIENTS_SECONDARY)) as ydl:
            info = ydl.extract_info(
                f"https://www.youtube.com/watch?v={video_id}", download=False
            )

    if not info:
        raise RuntimeError("yt-dlp returned no metadata")
    if info.get("entries"):
        info = next((e for e in info["entries"] if e), info)

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


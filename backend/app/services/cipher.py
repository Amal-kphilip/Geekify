from __future__ import annotations

import ctypes
import gc
import logging
import threading
from contextlib import contextmanager
import base64
import os
import shutil
from pathlib import Path
import tempfile
from typing import Any
from urllib.parse import parse_qs, unquote, urlparse

import yt_dlp

from app.models import ArtistRef, Thumbnail, Track

logger = logging.getLogger(__name__)


class ResolverBusy(RuntimeError):
    """Another yt-dlp resolution is running and we were told not to wait."""


# Each yt-dlp run can launch a Deno process to solve YouTube's JS challenge
# (100-250 MB). On a 512 MB host, two at once get the service OOM-killed, so
# every resolution goes through this gate (override with YTDLP_MAX_CONCURRENT).
_GATE = threading.BoundedSemaphore(max(1, int(os.environ.get("YTDLP_MAX_CONCURRENT", "1"))))


def _release_memory() -> None:
    gc.collect()
    try:  # hand freed heap pages back to the OS (glibc only; harmless elsewhere)
        ctypes.CDLL("libc.so.6").malloc_trim(0)
    except Exception:  # noqa: BLE001
        pass


@contextmanager
def resolver_slot(blocking: bool = True, timeout: float = 120.0):
    if blocking:
        acquired = _GATE.acquire(timeout=timeout)
    else:
        acquired = _GATE.acquire(blocking=False)
    if not acquired:
        raise ResolverBusy("Server is busy resolving another track. Try again in a moment.")
    try:
        yield
    finally:
        _GATE.release()
        _release_memory()

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
            # yt-dlp rewrites the cookie file on exit; hosts like Render mount
            # secret files read-only, so always work on a writable copy.
            dest = os.path.join(tempfile.gettempdir(), "geekify_yt_cookies.txt")
            try:
                shutil.copyfile(candidate, dest)
                return dest
            except Exception as err:
                logger.warning("Could not copy cookies %s -> %s: %s", candidate, dest, err)
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


def cookies_configured() -> bool:
    return _get_cookie_file() is not None


def _get_ydl_opts(clients: list[str], *, use_cookies: bool = True, ydl_logger: Any = None) -> dict[str, Any]:
    opts: dict[str, Any] = {
        "quiet": True,
        "no_warnings": ydl_logger is None,
        "noprogress": True,
        "skip_download": True,
        "noplaylist": True,
        "socket_timeout": 20,
        # We only need metadata + URLs: never fail just because the default
        # "bestvideo+bestaudio" selector found nothing; we pick formats ourselves.
        "ignore_no_formats_error": True,
        "format": "bestaudio/best",
        # YouTube's web/tv clients need a JS runtime to solve signature challenges.
        # Whichever of these is installed (pip install deno / node) will be used.
        "js_runtimes": {"deno": {}, "node": {}},
        "extractor_args": {"youtube": {"player_client": clients}},
    }
    if ydl_logger is not None:
        opts["logger"] = ydl_logger
    if use_cookies:
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


def _env_clients(name: str, default: list[str]) -> list[str]:
    raw = os.environ.get(name, "")
    vals = [c.strip() for c in raw.split(",") if c.strip()]
    return vals or default


def _attempts() -> list[tuple[str, list[str], bool, str]]:
    """(label, player clients, send cookies?, url). Cookie-capable clients first, then cookie-less mobile ones."""
    watch = "https://www.youtube.com/watch?v={id}"
    music = "https://music.youtube.com/watch?v={id}"
    cookie_clients = _env_clients("YTDLP_COOKIE_CLIENTS", ["tv", "web_safari", "mweb", "web_creator"])
    plain_clients = _env_clients("YTDLP_PLAIN_CLIENTS", ["android_vr", "ios"])
    out: list[tuple[str, list[str], bool, str]] = []
    if cookies_configured():
        out.append(("cookies+music", cookie_clients, True, music))
        out.append(("cookies+video", cookie_clients, True, watch))
    out.append(("nocookies+mobile", plain_clients, False, watch))
    out.append(("nocookies+music", plain_clients, False, music))
    return out


def extract_url_with_ytdlp(video_id: str, *, blocking: bool = True) -> tuple[str, str, dict[str, str]]:
    """Return (url, mime_type, request_headers) using yt-dlp, picking the best playable audio stream."""
    with resolver_slot(blocking=blocking):
        return _extract_url_locked(video_id)


def _extract_url_locked(video_id: str) -> tuple[str, str, dict[str, str]]:
    errs: list[str] = []
    for label, clients, use_cookies, url_t in _attempts():
        try:
            with yt_dlp.YoutubeDL(_get_ydl_opts(clients, use_cookies=use_cookies)) as ydl:
                info = ydl.extract_info(url_t.format(id=video_id), download=False)
            if not info:
                errs.append(f"{label}: no info")
                continue
            url, mime, hdrs = _pick_best_audio_format(info)
            if url and mime:
                logger.info("resolved %s via %s", video_id, label)
                return url, mime, hdrs
            errs.append(f"{label}: no direct audio format ({len(info.get('formats') or [])} formats)")
        except Exception as exc:  # noqa: BLE001
            errs.append(f"{label}: {str(exc)[:220]}")
    raise RuntimeError(f"Could not resolve audio for {video_id}: " + " | ".join(errs))


class _CollectLogger:
    def __init__(self) -> None:
        self.lines: list[str] = []

    def debug(self, msg: str) -> None:
        if not str(msg).startswith("[debug] "):
            self.lines.append(str(msg)[:300])

    def info(self, msg: str) -> None:
        self.lines.append(str(msg)[:300])

    def warning(self, msg: str) -> None:
        self.lines.append("WARN " + str(msg)[:300])

    def error(self, msg: str) -> None:
        self.lines.append("ERR " + str(msg)[:300])


def diagnose(video_id: str) -> dict[str, Any]:
    with resolver_slot(blocking=True, timeout=120.0):
        return _diagnose_locked(video_id)


def _diagnose_locked(video_id: str) -> dict[str, Any]:
    """Run every resolution attempt and report what yt-dlp said (for debugging hosted deployments)."""
    import shutil as _sh

    report: dict[str, Any] = {
        "yt_dlp": yt_dlp.version.__version__,
        "cookies": cookies_configured(),
        "js_runtime": {"deno": bool(_sh.which("deno")), "node": bool(_sh.which("node"))},
        "attempts": [],
    }
    for label, clients, use_cookies, url_t in _attempts():
        lg = _CollectLogger()
        entry: dict[str, Any] = {"label": label, "clients": clients}
        try:
            with yt_dlp.YoutubeDL(_get_ydl_opts(clients, use_cookies=use_cookies, ydl_logger=lg)) as ydl:
                info = ydl.extract_info(url_t.format(id=video_id), download=False)
            fmts = (info or {}).get("formats") or []
            url, mime, _ = _pick_best_audio_format(info or {})
            entry.update(ok=bool(url), formats=len(fmts), mime=mime)
        except Exception as exc:  # noqa: BLE001
            entry.update(ok=False, error=str(exc)[:300])
        entry["log"] = lg.lines[-12:]
        report["attempts"].append(entry)
        if entry.get("ok"):
            break
    return report


def extract_track_with_ytdlp(video_id: str) -> Track:
    with resolver_slot(blocking=True, timeout=60.0):
        return _extract_track_locked(video_id)


def _extract_track_locked(video_id: str) -> Track:
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


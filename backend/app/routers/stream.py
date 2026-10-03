from __future__ import annotations

import logging
import threading
from dataclasses import dataclass

import httpx
from fastapi import APIRouter, BackgroundTasks, HTTPException, Request, Response
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse

from app import cache
from app.cache import drop_stream
from app.services.cipher import ResolverBusy, diagnose, extract_url_with_ytdlp

logger = logging.getLogger(__name__)
router = APIRouter()

_HOP_BY_HOP = {
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
}

_FORWARD_REQUEST = {"range", "if-range"}
_FORWARD_RESPONSE = {
    "content-type",
    "content-length",
    "content-range",
    "accept-ranges",
}


# One pooled client for all proxied streams: re-using connections avoids a TLS
# handshake to googlevideo on every track change.
_http = httpx.AsyncClient(
    follow_redirects=True,
    timeout=httpx.Timeout(60.0, connect=15.0),
    limits=httpx.Limits(max_connections=40, max_keepalive_connections=10, keepalive_expiry=60),
)

# Only resolve one video_id at a time (prewarm + real request share the result),
# and cap background prewarms so a small free-tier box isn't starved.
_inflight: dict[str, threading.Lock] = {}
_inflight_guard = threading.Lock()


@dataclass
class ResolvedStream:
    url: str
    mime: str
    itag: int | None
    client: str
    headers: dict | None = None


def _resolve_stream_sync(video_id: str, *, blocking: bool = True) -> ResolvedStream:
    cached = cache.get_stream(video_id)
    if isinstance(cached, ResolvedStream):
        return cached

    with _inflight_guard:
        lock = _inflight.setdefault(video_id, threading.Lock())
    try:
        with lock:
            # Another thread (e.g. a prewarm) may have finished while we waited.
            cached = cache.get_stream(video_id)
            if isinstance(cached, ResolvedStream):
                return cached
            try:
                url, mime, fmt_headers = extract_url_with_ytdlp(video_id, blocking=blocking)
            except ResolverBusy as exc:
                raise HTTPException(
                    status_code=503,
                    detail={"error": "busy", "reason": str(exc), "videoId": video_id},
                    headers={"Retry-After": "5"},
                ) from exc
            except Exception as exc:
                logger.warning("yt-dlp resolution failed for %s: %s", video_id, exc)
                raise HTTPException(
                    status_code=502,
                    detail={
                        "error": "stream_unavailable",
                        "status": "ERROR",
                        "reason": str(exc),
                        "videoId": video_id,
                    },
                ) from exc
            resolved = ResolvedStream(url=url, mime=mime, itag=None, client="yt-dlp", headers=fmt_headers)
            cache.set_stream(video_id, resolved)
            return resolved
    finally:
        with _inflight_guard:
            _inflight.pop(video_id, None)


def _prewarm_sync(video_id: str) -> None:
    if isinstance(cache.get_stream(video_id), ResolvedStream):
        return
    try:
        # Never queue behind (or alongside) a real request: if the resolver is busy, skip.
        _resolve_stream_sync(video_id, blocking=False)
    except Exception:  # noqa: BLE001 - best effort only
        pass


@router.get("/prewarm/{video_id}")
async def prewarm(video_id: str, background: BackgroundTasks):
    """Resolve + cache the stream URL ahead of time so the next track starts instantly."""
    if isinstance(cache.get_stream(video_id), ResolvedStream):
        return {"cached": True}
    background.add_task(run_in_threadpool, _prewarm_sync, video_id)
    return {"cached": False, "queued": True}


@router.get("/diag/{video_id}")
async def diag(video_id: str):
    """Debug helper: shows what yt-dlp does for this video on this server."""
    return await run_in_threadpool(diagnose, video_id)


@router.api_route("/stream/{video_id}", methods=["GET", "HEAD", "OPTIONS"])
async def stream(video_id: str, request: Request):
    if request.method == "OPTIONS":
        return Response(
            status_code=204,
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
                "Access-Control-Allow-Headers": "*",
            },
        )

    # Run blocking resolution in threadpool to keep the asyncio loop responsive
    resolved: ResolvedStream = await run_in_threadpool(_resolve_stream_sync, video_id)

    headers: dict[str, str] = {
        "User-Agent": "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/124.0.0.0 Mobile Safari/537.36",
        "Accept": "*/*",
    }
    # Use the exact headers yt-dlp resolved the URL with (UA must match the client).
    headers.update(resolved.headers or {})
    headers["Accept-Encoding"] = "identity"
    if rng := request.headers.get("range"):
        headers["Range"] = rng
    if if_range := request.headers.get("if-range"):
        headers["If-Range"] = if_range

    try:
        upstream = await _http.send(
            _http.build_request("GET", resolved.url, headers=headers),
            stream=True,
        )
    except Exception as exc:  # noqa: BLE001
        drop_stream(video_id)
        logger.warning("upstream stream failed, cache dropped: %s", exc)
        raise HTTPException(status_code=502, detail={"error": "cdn_error", "reason": str(exc), "videoId": video_id}) from exc

    # If the cached URL expired, drop cache and ask client to retry
    if upstream.status_code >= 400 and upstream.status_code != 416:
        code = upstream.status_code
        await upstream.aclose()
        drop_stream(video_id)
        logger.warning("googlevideo returned %s for %s (url cache dropped)", code, video_id)
        raise HTTPException(
            status_code=502,
            detail={
                "error": "cdn_rejected",
                "reason": f"YouTube's CDN rejected the stream (HTTP {code}). Update yt-dlp or add cookies.",
                "videoId": video_id,
            },
        )

    resp_headers = {
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=300",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges, Content-Type",
    }
    for hk, hv in upstream.headers.items():
        lk = hk.lower()
        if lk in _FORWARD_RESPONSE and lk not in _HOP_BY_HOP:
            resp_headers[hk] = hv
    if "content-type" not in {k.lower() for k in resp_headers}:
        resp_headers["Content-Type"] = resolved.mime

    if request.method == "HEAD":
        await upstream.aclose()
        return Response(status_code=upstream.status_code, headers=resp_headers)

    async def body():
        try:
            async for chunk in upstream.aiter_bytes(64 * 1024):
                yield chunk
        finally:
            await upstream.aclose()

    return StreamingResponse(body(), status_code=upstream.status_code, headers=resp_headers, media_type=resolved.mime)

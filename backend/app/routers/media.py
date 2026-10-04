from __future__ import annotations

from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

router = APIRouter()

# One shared client. Creating an AsyncClient per request builds a fresh SSL context
# every time, which is slow and memory-hungry on a 512 MB host.
_http = httpx.AsyncClient(
    follow_redirects=True,
    timeout=20.0,
    limits=httpx.Limits(max_connections=20, max_keepalive_connections=5, keepalive_expiry=30),
)

_ALLOWED_HOSTS = {
    "i.ytimg.com",
    "i1.ytimg.com",
    "i9.ytimg.com",
    "lh3.googleusercontent.com",
    "yt3.ggpht.com",
    "yt3.googleusercontent.com",
    "music.youtube.com",
}


@router.get("/thumb")
async def thumb(u: str = Query(..., min_length=8)):
    parsed = urlparse(u)
    host = (parsed.hostname or "").lower()
    if parsed.scheme not in {"http", "https"} or host not in _ALLOWED_HOSTS:
        raise HTTPException(status_code=400, detail="Blocked thumbnail host")
    headers = {"User-Agent": "Mozilla/5.0", "Accept": "image/*"}
    try:
        upstream = await _http.send(_http.build_request("GET", u, headers=headers), stream=True)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail="Thumbnail fetch failed") from exc

    if upstream.status_code >= 400:
        await upstream.aclose()
        raise HTTPException(status_code=upstream.status_code, detail="Thumbnail unavailable")

    resp_headers = {
        "Cache-Control": "public, max-age=86400",
        "Content-Type": upstream.headers.get("content-type", "image/jpeg"),
    }

    async def body():
        try:
            async for chunk in upstream.aiter_bytes(32 * 1024):
                yield chunk
        finally:
            await upstream.aclose()

    return StreamingResponse(body(), status_code=200, headers=resp_headers)

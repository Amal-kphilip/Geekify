from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import browse, media, recommend, search, stream

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

@asynccontextmanager
async def lifespan(_: FastAPI):
    # Every blocking call runs in a worker thread; each thread can grow its own
    # malloc arena. Fewer threads = a flatter memory profile on small hosts.
    import anyio.to_thread

    anyio.to_thread.current_default_thread_limiter().total_tokens = int(os.environ.get("MAX_THREADS", "24"))
    yield


app = FastAPI(title="Geekify API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Length", "Content-Range", "Accept-Ranges"],
)



def _rss_mb() -> float | None:
    try:  # current resident memory (Linux)
        with open("/proc/self/statm") as f:
            return round(int(f.read().split()[1]) * os.sysconf("SC_PAGE_SIZE") / 1048576, 1)
    except Exception:  # noqa: BLE001
        return None


app.include_router(search.router, prefix="/api")
app.include_router(stream.router, prefix="/api")
app.include_router(browse.router, prefix="/api")
app.include_router(media.router, prefix="/api")
app.include_router(recommend.router, prefix="/api")


@app.get("/api/health")
def health():
    from app.services.cipher import cookies_configured
    import yt_dlp

    return {
        "ok": True,
        "service": "geekify",
        "yt_dlp": yt_dlp.version.__version__,
        "cookies": cookies_configured(),
        "rss_mb": _rss_mb(),
    }

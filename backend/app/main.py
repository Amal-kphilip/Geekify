from __future__ import annotations

import asyncio
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import memguard
from app.routers import browse, media, recommend, search, stream

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

async def _housekeeping() -> None:
    """Every so often, return freed memory to the OS so the idle footprint stays small."""
    while True:
        await asyncio.sleep(45)
        try:
            used = memguard.rss_mb(include_children=False)
            if used is not None and used > 200 and memguard.in_flight() == 0:
                await run_in_threadpool(memguard.release_memory)
        except Exception:  # noqa: BLE001 - housekeeping must never crash the app
            logging.getLogger(__name__).debug("housekeeping failed", exc_info=True)


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Every blocking call runs in a worker thread; each thread can grow its own
    # malloc arena, and each concurrent upstream response is several MB of JSON.
    # Fewer threads = a flatter memory profile on small hosts.
    import anyio.to_thread

    anyio.to_thread.current_default_thread_limiter().total_tokens = int(os.environ.get("MAX_THREADS", "12"))
    task = asyncio.create_task(_housekeeping())
    try:
        yield
    finally:
        task.cancel()


app = FastAPI(title="Geekify API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Length", "Content-Range", "Accept-Ranges"],
)



@app.exception_handler(memguard.Busy)
async def _busy_handler(_: Request, exc: memguard.Busy) -> JSONResponse:
    # Shed load politely instead of getting the whole container OOM-killed.
    return JSONResponse(
        status_code=503,
        content={"detail": {"error": "busy", "reason": str(exc)}},
        headers={"Retry-After": "3"},
    )


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
        "rss_mb": memguard.rss_mb(include_children=False),
        "mem_total_mb": memguard.rss_mb(),
        "mem_in_flight": memguard.in_flight(),
    }

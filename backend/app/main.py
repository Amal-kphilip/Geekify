from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import browse, media, recommend, search, stream

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

app = FastAPI(title="Geekify API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Length", "Content-Range", "Accept-Ranges"],
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
    }

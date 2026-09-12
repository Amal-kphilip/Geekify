# Geekify

Full-stack music streaming UI with a glassmorphism shell. Search, browse, and playback metadata come from YouTube Music via InnerTube; audio bytes are resolved on the server (ANDROID client first, yt-dlp cipher fallback) and **proxied** so the browser never sees Google CDN URLs.

## Run locally

You need two processes: FastAPI on `8000` and Next.js on `3000`. Next rewrites `/api/*` to the backend.

```bash
# backend
cd backend
python -m venv .venv
# Windows
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

```bash
# frontend
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## API

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/search?q=&type=` | `type` is `song`, `album`, `artist`, or `playlist` |
| GET | `/api/track/{videoId}` | metadata |
| GET | `/api/stream/{videoId}` | audio proxy, **Range** supported |
| GET | `/api/related/{videoId}` | radio / autoplay queue |
| GET | `/api/artist/{channelId}` | |
| GET | `/api/album/{playlistId}` | |
| GET | `/api/playlist/{playlistId}` | |
| GET | `/api/home` | YT Music home shelves |
| GET | `/api/health` | |

Stream URLs are cached ~5 hours. Search/browse cached 15 minutes.

## Keyboard

- Space — play / pause
- ← / → — seek 5s
- ↑ / ↓ — volume

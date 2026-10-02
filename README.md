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

## Configuration

| Variable | Where | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | frontend | Backend origin (default `http://127.0.0.1:8000`). When set, audio is streamed straight from the backend instead of through Next's proxy. |
| `YOUTUBE_COOKIES_PATH` / `YOUTUBE_COOKIES` / `YOUTUBE_COOKIES_BASE64` | backend | Optional cookies for yt-dlp. Hosted/datacenter IPs are often challenged by YouTube; cookies fix most "stream unavailable" errors. |

## Troubleshooting

- **Songs won't play:** keep `yt-dlp` current (`pip install -U yt-dlp`) — YouTube changes break old versions quickly. On cloud hosts, supply cookies (above).
- **Empty home / search:** check the backend log; InnerTube calls that return 4xx are no longer retried, so failures show up immediately.

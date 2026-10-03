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
| GET | `/api/home?seed=` | YT Music home shelves, shuffled on every call, plus random genre shelves. Sent with `Cache-Control: no-store`. |
| GET | `/api/prewarm/{videoId}` | resolve + cache a stream URL in the background so the next track starts instantly |
| POST | `/api/recommend/mix` | body `{liked: [{videoId, artist, title}], recent: [...]}` (newest first) -> `{mixes, seeds}`. See "Recommendations". |
| GET | `/api/health` | |

Stream URLs are cached ~5 hours. Search/browse data is cached 15 minutes, but the home endpoint reshuffles that pool on each request.

On page load the app immediately pings `/api/health` (wakes a sleeping free-tier backend), starts fetching the home feed and pre-resolves the last played track - it does not wait for you to press play. Home shows personalised mixes (see below) and a "Jump back in" shelf built from your listening history.

## Recommendations

`POST /api/recommend/mix` powers the "Your mixes" row on Home (`backend/app/services/recommender.py`, no ML libraries or database needed):

1. **Seeds**: every favourite and recent play is weighted (favourites count more, newer counts more); the strongest are picked with at most two per artist.
2. **Candidates**: YouTube Music's radio is queried for tracks similar to each seed.
3. **Scoring**: rank-decayed score per seed, a boost for tracks suggested by several seeds, and a boost for artists you already gravitate to. Songs you already know are dropped.
4. **Diversity**: a greedy re-rank limits repeats from the same artist.
5. **Mixes**: *Made for you*, *Fresh finds* (artists you haven't played) and *More like \<artist\>*.

It works for guests too, using local history; an account makes the same taste follow you across devices.

## Accounts (optional)

Accounts use Firebase Authentication (email/password + Google) and Firestore to sync favourites, playlists and history. Without the variables below the app simply runs in guest mode.

1. [Firebase console](https://console.firebase.google.com) -> create a project -> **Add app -> Web** and copy the config values.
2. **Authentication -> Sign-in method**: enable *Email/Password* and *Google*.
3. **Authentication -> Settings -> Authorized domains**: add your site's domain (e.g. `your-app.vercel.app`).
4. **Firestore Database -> Create database**, then paste `firestore.rules` from this repo into the **Rules** tab and publish. (It lets each user read and write only their own document.)
5. Set the frontend variables (Vercel -> Settings -> Environment Variables, or `frontend/.env.local`) and redeploy:

```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

How sync behaves: on first sign-in on a device, local guest data is merged into the account; afterwards the cloud copy is the source of truth and changes are saved a couple of seconds after you make them. Signing out clears local data from that device.

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

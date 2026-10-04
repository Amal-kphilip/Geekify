# Geekify

Geekify is a full-stack music streaming project built as a learning and development project.

The app lets users search for music, browse artists/albums/playlists, play tracks, manage favourites and playlists, and get recommendations based on their listening activity.

The frontend is built with **Next.js**, while the backend uses **FastAPI**. Music metadata and related-track information are retrieved from YouTube Music through its InnerTube API. Audio streams are resolved by the backend and proxied to the browser instead of exposing the resolved Google CDN URL directly.

## Features

* Search for songs, albums, artists and playlists
* Browse YouTube Music content
* Audio playback with seeking
* Related tracks and autoplay
* Recently played history
* Favourites
* Playlists
* Personalised mixes
* Guest mode using local storage
* Optional account-based synchronisation
* Firebase Authentication
* Firestore synchronisation
* Keyboard controls
* Responsive music player
* Backend caching for frequently requested data

## Tech Stack

### Frontend

* Next.js
* React
* TypeScript
* CSS
* Firebase Authentication

### Backend

* Python
* FastAPI
* YouTube Music InnerTube
* yt-dlp
* In-memory caching

### Cloud Services

* Firebase Authentication
* Cloud Firestore

## How it works

The project is split into two main applications:

```text
                 Geekify
                    │
          ┌─────────┴─────────┐
          │                   │
      Next.js              FastAPI
      Frontend              Backend
          │                   │
          │          ┌────────┼─────────┐
          │          │        │         │
          │       InnerTube  yt-dlp   Cache
          │          │        │
          │          └────┬───┘
          │               │
          └─────── Audio / Metadata
```

The browser communicates with the Next.js application. API requests are forwarded to the FastAPI backend.

For playback, the backend resolves an available audio stream and proxies the audio data to the frontend. This keeps the resolved Google CDN URL on the server side.

## Running locally

Geekify currently requires two processes:

* FastAPI backend on port `8000`
* Next.js frontend on port `3000`

### 1. Start the backend

```bash
cd backend

python -m venv .venv
```

On Windows:

```bash
.venv\Scripts\activate
```

Install the dependencies:

```bash
pip install -r requirements.txt
```

Start FastAPI:

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### 2. Start the frontend

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Then open:

```text
http://localhost:3000
```

## API

| Method | Endpoint                     | Description                                    |
| ------ | ---------------------------- | ---------------------------------------------- |
| GET    | `/api/search?q=&type=`       | Search for songs, albums, artists or playlists |
| GET    | `/api/track/{videoId}`       | Get track metadata                             |
| GET    | `/api/stream/{videoId}`      | Stream audio                                   |
| GET    | `/api/related/{videoId}`     | Get related tracks                             |
| GET    | `/api/artist/{channelId}`    | Get artist information                         |
| GET    | `/api/album/{playlistId}`    | Get album information                          |
| GET    | `/api/playlist/{playlistId}` | Get playlist information                       |
| GET    | `/api/home?seed=`            | Get the home feed                              |
| GET    | `/api/prewarm/{videoId}`     | Resolve and cache a stream before playback     |
| POST   | `/api/recommend/mix`         | Generate personalised mixes                    |
| GET    | `/api/health`                | Check backend availability                     |

Audio stream URLs are cached for approximately five hours. Search and browse responses are cached for approximately fifteen minutes.

The home feed is reshuffled when requested so that the same cached content does not always appear in the same order.

## Recommendations

Geekify has a lightweight recommendation system implemented in:

```text
backend/app/services/recommender.py
```

It does not use a machine-learning model or a separate recommendation database.

The current approach is based on listening history and YouTube Music's related-track results.

### 1. Selecting seeds

Favourite and recently played tracks are used as recommendation seeds.

Favourites receive more weight, while newer listening activity receives a higher weight than older activity. The system also limits how many seeds can come from the same artist.

### 2. Finding candidates

For each selected seed, related tracks are requested from YouTube Music.

These tracks become candidates for the recommendation system.

### 3. Scoring

Candidates receive scores based on:

* How strongly their seed was weighted
* Their position in the related-track results
* Whether multiple seeds produced the same track
* Whether the artist is already familiar to the listener

Tracks that the user has already listened to are filtered out where possible.

### 4. Diversity

The final results are re-ranked to avoid filling a recommendation list with too many tracks from one artist.

### 5. Mixes

The current recommendation system produces different types of mixes, including:

* **Made for you**
* **Fresh finds**
* **More like `<artist>`**

The system also works in guest mode using locally stored listening history.

## Accounts

Accounts are optional.

Geekify can use Firebase for:

* Email/password authentication
* Google authentication
* Favourite synchronisation
* Playlist synchronisation
* Listening-history synchronisation

Without Firebase configuration, the application can still be used in guest mode.

### Firebase setup

1. Create a project in the [Firebase Console](https://console.firebase.google.com).
2. Add a Web application.
3. Enable Email/Password and Google sign-in.
4. Create a Firestore database.
5. Add the rules from `firestore.rules`.
6. Add the Firebase configuration to the frontend environment.

Example:

```text
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

The variables can be placed in:

```text
frontend/.env.local
```

or configured through the deployment platform.

### Data synchronisation

Guest data is stored locally.

When a user signs in for the first time on a device, the existing local data is merged into the account.

After that, the cloud copy becomes the main source of synchronised data.

Changes are saved shortly after they are made.

## Keyboard controls

| Key     | Action          |
| ------- | --------------- |
| `Space` | Play / pause    |
| `←`     | Seek backward   |
| `→`     | Seek forward    |
| `↑`     | Increase volume |
| `↓`     | Decrease volume |

## Configuration

| Variable                 | Location | Purpose                        |
| ------------------------ | -------- | ------------------------------ |
| `NEXT_PUBLIC_API_URL`    | Frontend | Backend URL                    |
| `YOUTUBE_COOKIES_PATH`   | Backend  | Path to cookies used by yt-dlp |
| `YOUTUBE_COOKIES`        | Backend  | Cookie data for yt-dlp         |
| `YOUTUBE_COOKIES_BASE64` | Backend  | Base64 encoded cookie data     |

If `NEXT_PUBLIC_API_URL` is not provided, the frontend uses the local backend configuration.

YouTube may challenge requests originating from some cloud/datacenter IP addresses. Cookies can help with some of these cases when using yt-dlp.

## Troubleshooting

### Playback does not work

First update yt-dlp:

```bash
pip install -U yt-dlp
```

YouTube changes its playback behaviour regularly, so older yt-dlp versions can stop resolving some streams.

If the application is running on a cloud server and YouTube requests are being challenged, configure the optional cookie variables.

### Search or Home is empty

Check the FastAPI terminal for errors.

The backend reports failed InnerTube requests directly rather than repeatedly retrying requests that have already returned an error.

### Backend is not responding

Make sure FastAPI is running:

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Then check:

```text
/api/health
```

## Project Structure

```text
Geekify/
├── backend/
│   ├── app/
│   │   ├── routes/
│   │   ├── services/
│   │   └── main.py
│   ├── requirements.txt
│   └── ...
│
├── frontend/
│   ├── app/
│   ├── components/
│   ├── lib/
│   └── ...
│
├── firestore.rules
└── README.md
```

## Current Limitations

Geekify depends on external YouTube services for music metadata and audio availability.

Because of this:

* YouTube changes can affect playback.
* Stream URLs are temporary.
* Some cloud IP addresses may be challenged.
* yt-dlp may require regular updates.
* Recommendation quality depends on the user's listening history.
* Guest data is device-local and is not automatically available on another device.

## Future Improvements

Some areas I would like to improve:

* Better recommendation quality
* More robust stream resolution
* Improved error handling
* More playback options
* Better mobile controls
* More extensive automated testing
* Improved caching
* Better offline handling

## Disclaimer

Geekify is a personal/educational software project.

It does not host music files itself. Music metadata and playback sources depend on third-party services, and users are responsible for using the application in accordance with the applicable terms and laws.

---

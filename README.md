# Geekify

[![Visit Website](https://img.shields.io/badge/Visit%20Website-geekify.vercel.app-22c55e?style=for-the-badge)](https://geekify.vercel.app)

A full-stack music streaming app built with **Next.js, TypeScript, FastAPI, and Firebase**.

Search for songs, artists, albums and playlists, play music, manage favourites and playlists, and get personalised recommendations based on listening activity.

## Preview

![Geekify](assets/geekify-home.png)

## Features

* Music search and playback
* Songs, albums, artists and playlists
* Favourites and playlists
* Recently played history
* Personalised mixes
* Guest mode and Firebase accounts
* Keyboard controls
* Responsive player
* Backend caching

## Tech Stack

**Frontend**

* Next.js
* React
* TypeScript

**Backend**

* Python
* FastAPI
* YouTube Music InnerTube
* yt-dlp

**Services**

* Firebase Authentication
* Cloud Firestore

## Architecture

```text
Browser
   |
   v
Next.js
   |
   v
FastAPI
   |
   +-- YouTube Music / InnerTube
   +-- yt-dlp
   +-- Cache
```

The backend handles metadata and audio stream resolution. Audio is proxied through the backend rather than exposing the resolved stream URL directly to the browser.

## Run Locally

### Backend

```bash
cd backend
python -m venv .venv
```

Windows:

```powershell
.venv\Scripts\activate
```

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

## Firebase

Firebase is optional. Without it, Geekify can run in guest mode.

For account synchronisation, configure:

```text
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

## Keyboard Controls

| Key     | Action       |
| ------- | ------------ |
| `Space` | Play / pause |
| `← / →` | Seek         |
| `↑ / ↓` | Volume       |

## Limitations

Geekify depends on YouTube services for music metadata and playback. Changes to YouTube or restrictions on cloud IP addresses may occasionally affect playback.

## Disclaimer

Geekify is a personal/educational project and does not host music files itself. Users are responsible for complying with applicable third-party terms and laws.

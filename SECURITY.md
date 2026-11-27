# Security Policy

## Supported Versions

Security updates are applied to the latest state of the `master` branch and the most recent release.

| Version | Supported |
| --- | --- |
| `master` | Yes |
| Older releases | No |

## Reporting a Vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Report vulnerabilities privately through GitHub Security Advisories:

- https://github.com/Amal-kphilip/Geekify/security/advisories/new

When reporting, include:

- A description of the vulnerability and its potential impact
- Steps to reproduce or a minimal proof of concept
- Affected files or endpoints (frontend, backend, or Firestore rules)

You can expect an initial acknowledgement within **7 days**, followed by status updates as the report is triaged and addressed.

> **Important:** Never paste Firebase service account credentials, API tokens, `.env` files, or YouTube cookie values (`YOUTUBE_COOKIES`, `YOUTUBE_COOKIES_BASE64`, `cookies.txt`) into public issues or pull requests.

## Security Architecture Notes

- **Firebase (Optional):** The frontend uses Firebase Authentication (Email/Password and Google) and Cloud Firestore when `NEXT_PUBLIC_FIREBASE_*` environment variables are configured; otherwise the app runs in guest-only mode. Access is governed by `firestore.rules`, which restricts each signed-in user to reading and writing only their own `/users/{uid}` document and `/users/{uid}/profile/avatar` document.
- **YouTube Cookies (Optional):** The backend optionally reads YouTube cookies from `YOUTUBE_COOKIES_PATH`, `YOUTUBE_COOKIES`, `YOUTUBE_COOKIES_BASE64`, or a local `cookies.txt` (gitignored) to pass to `yt-dlp` when resolving streams on hosted/datacenter IPs. Cookies are used only on the server and are never sent to the browser.
- **Backend Audio Proxy:** The FastAPI backend resolves YouTube Music metadata via InnerTube and audio stream URLs via `yt-dlp`. Resolved stream URLs are cached in memory for ~5 hours, and audio bytes are streamed through `/api/stream/{videoId}` so upstream CDN URLs are not exposed to the browser. No media files are stored on disk.

# Contributing to Geekify

Thank you for your interest in contributing to Geekify!

## Local Setup

You need two processes: the FastAPI backend on port `8000` and the Next.js frontend on port `3000`. Next.js rewrites `/api/*` requests to the backend.

### Backend (Python 3.11+)

```bash
cd backend
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt -r requirements-dev.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### Frontend (Node.js 22+)

```bash
cd frontend
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Without Firebase environment variables, the frontend runs in guest-only mode.

## Checks & Tests

Run these checks locally before opening a pull request:

### Frontend

```bash
cd frontend
npm run lint
npx tsc --noEmit
npm run build
```

### Backend

```bash
cd backend
python -c "import app.main"
python -m compileall -q app
pytest
```

## Branch & Pull Request Flow

1. Fork the repository and create a branch from `master`.
2. Make focused changes and keep them well-scoped.
3. Verify that all frontend and backend checks pass.
4. Open a pull request against `master` using the PR template.

## Commit Messages

This repository uses [Conventional Commits](https://www.conventionalcommits.org/) (used by Release Please to generate changelogs and version bumps):

- `feat:` a new feature
- `fix:` a bug fix
- `docs:` documentation-only changes
- `chore:` maintenance, tooling, or configuration updates
- `ci:` CI/CD workflow changes
- `refactor:` code refactoring without behavior changes
- `test:` adding or updating tests

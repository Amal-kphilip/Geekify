# GitHub Repository Settings Checklist

Manual settings to apply in **Amal-kphilip/Geekify** after merging this PR. Where supported, both the GitHub UI path and `gh` CLI commands are provided.

---

## 1. Actions Workflow Permissions (Required for Release Please)

Release Please cannot open or update release PRs without write permissions and PR creation enabled.

- **UI:** **Settings** → **Actions** → **General** → **Workflow permissions**:
  - Select **Read and write permissions**
  - Check **Allow GitHub Actions to create and approve pull requests**
  - Click **Save**

```bash
gh api -X PUT repos/Amal-kphilip/Geekify/actions/permissions/workflow \
  -f default_workflow_permissions=write \
  -F can_approve_pull_request_reviews=true
```

---

## 2. Security Features & Discussions

- **UI:** **Settings** → **Code security and analysis**:
  - Enable **Dependabot alerts**
  - Enable **Dependabot security updates**
  - Enable **Secret scanning** and **Push protection**
  - Enable **Private vulnerability reporting**
- **UI:** **Settings** → **General** → **Features**:
  - Enable **Discussions**

```bash
gh api -X PUT repos/Amal-kphilip/Geekify/vulnerability-alerts
gh api -X PUT repos/Amal-kphilip/Geekify/automated-security-fixes
gh api -X PUT repos/Amal-kphilip/Geekify/private-vulnerability-reporting
gh api -X PATCH repos/Amal-kphilip/Geekify \
  -F has_discussions=true \
  -f security_and_analysis='{"secret_scanning":{"status":"enabled"},"secret_scanning_push_protection":{"status":"enabled"}}'
```

---

## 3. Merge Strategy & Branch Cleanup

- **UI:** **Settings** → **General** → **Pull Requests**:
  - Enable **Allow squash merging**
  - Uncheck **Allow merge commits** and **Allow rebase merging**
  - Check **Automatically delete head branches**

```bash
gh api -X PATCH repos/Amal-kphilip/Geekify \
  -F allow_squash_merge=true \
  -F allow_merge_commit=false \
  -F allow_rebase_merge=false \
  -F delete_branch_on_merge=true
```

---

## 4. About Box (Description, Website & Topics)

- **UI:** On the repository main page, click the gear icon next to **About**:
  - **Description:** `Full-stack music streaming app built with Next.js and FastAPI, with search, playback, playlists, and personalised recommendations.`
  - **Website:** `https://geekify.vercel.app`
  - **Topics:** `nextjs`, `fastapi`, `youtube-music`, `music-player`, `typescript`, `python`, `tailwindcss`, `firebase`

```bash
gh repo edit Amal-kphilip/Geekify \
  --description "Full-stack music streaming app built with Next.js and FastAPI, with search, playback, playlists, and personalised recommendations." \
  --homepage "https://geekify.vercel.app" \
  --add-topic nextjs,fastapi,youtube-music,music-player,typescript,python,tailwindcss,firebase
```

---

## 5. Create Labeler & Stale-Exempt Labels

Ensure the labels referenced by `.github/labeler.yml` and `.github/workflows/stale.yml` exist:

```bash
gh label create frontend     --repo Amal-kphilip/Geekify --color "0075ca" --description "Frontend (Next.js / TypeScript)" --force
gh label create backend      --repo Amal-kphilip/Geekify --color "3572a5" --description "Backend (FastAPI / Python)" --force
gh label create infra        --repo Amal-kphilip/Geekify --color "fbca04" --description "Deployment & Firestore rules" --force
gh label create docs         --repo Amal-kphilip/Geekify --color "0075ca" --description "Documentation" --force
gh label create ci           --repo Amal-kphilip/Geekify --color "bfdadc" --description "GitHub Actions & workflows" --force
gh label create dependencies --repo Amal-kphilip/Geekify --color "0366d6" --description "Dependency updates" --force
gh label create pinned       --repo Amal-kphilip/Geekify --color "d4c5f9" --description "Exempt from stale bot" --force
gh label create security     --repo Amal-kphilip/Geekify --color "b60205" --description "Security-related" --force
```

---

## 6. Default Branch Ruleset (`master`) — Apply LAST

> **Wait until CI has run and passed on `master`** after merging this PR, so GitHub registers the exact status check names.

- **UI:** **Settings** → **Rules** → **Rulesets** → **New branch ruleset**:
  - **Ruleset Name:** `Protect master`
  - **Enforcement status:** `Active`
  - **Target branches:** Include default branch (`master`)
  - **Rules:**
    - **Restrict deletions** (enabled)
    - **Block force pushes** (enabled)
    - **Require a pull request before merging** (required approvals: `0`)
    - **Require status checks to pass**:
      - Check **Require branches to be up to date before merging**
      - Add exact job names:
        - `Frontend: Lint, Typecheck & Build`
        - `Backend: Install & Smoke test`

```bash
gh api -X POST repos/Amal-kphilip/Geekify/rulesets --input - <<'EOF'
{
  "name": "Protect master",
  "target": "branch",
  "enforcement": "active",
  "conditions": {
    "ref_name": {
      "include": ["~DEFAULT_BRANCH"],
      "exclude": []
    }
  },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": true,
        "required_status_checks": [
          { "context": "Frontend: Lint, Typecheck & Build" },
          { "context": "Backend: Install & Smoke test" }
        ]
      }
    }
  ]
}
EOF
```

---

## 7. Deployment Note (Vercel & Render)

Both **Vercel** (frontend) and **Render** (backend) auto-deploy directly from `master`. A failed CI check does **not** prevent them from deploying a commit that has already been merged into `master`. Keep the `master` branch ruleset active so broken commits are blocked before merge.

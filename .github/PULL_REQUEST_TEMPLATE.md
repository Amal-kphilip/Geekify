## Summary

<!-- Describe what this pull request changes and why. -->

## Type of Change

- [ ] Bug fix (`fix:`)
- [ ] New feature (`feat:`)
- [ ] Documentation (`docs:`)
- [ ] CI / tooling / maintenance (`ci:` / `chore:`)
- [ ] Refactor (`refactor:`)

## Checklist

- [ ] Frontend checks pass (`cd frontend && npm run lint && npx tsc --noEmit && npm run build`)
- [ ] Backend smoke test passes (`cd backend && python -c "import app.main" && python -m compileall -q app && pytest`)
- [ ] No secrets, tokens, `.env` files, or cookies are included

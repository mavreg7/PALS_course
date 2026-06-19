---
name: push-to-github
description: Diagnose and fix why `git push` and the GitHub MCP write tools fail with 403 "Resource not accessible by integration" in a Claude Code cloud (web) session, and hand off a verified patch when needed. Use whenever a push or PR is blocked in a cloud session.
---

# Pushing to GitHub from a cloud session

## What's happening
In a Claude Code **web/cloud** session, all git traffic goes through a GitHub
proxy that authenticates with **your connected GitHub token** and only allows
pushing to the **current working branch**. The `mcp__github__*` write tools ride
the **same token**.

If that token is **read-only on repository contents**, every write fails:
- `git push` → `HTTP 403` on `git-receive-pack`
- MCP write (push_files / create_branch / create_or_update_file) →
  `403 Resource not accessible by integration`

This is a **connection-permission** problem, not a code problem, and it cannot
be fixed from inside the container. Reads (clone/fetch/PR browsing) keep working.

## Diagnose first
```bash
bash .claude/skills/push-to-github/push.sh
```
Reports the owner/repo, current branch, whether the proxy will accept a push,
and whether github.com is reachable.

## The fix — make native pushes work again (do ONE)
Both restore the behaviour where `git push` and the MCP tools "just work", with
no token inside the container:

1. **Re-authorize the Claude GitHub App with write access.**
   GitHub → Settings → Applications → Installed GitHub Apps → **Claude** →
   Configure → select the repo and set **Repository contents = Read and write**
   (approve any pending permission request).
2. **Or run `/web-setup` from your terminal** to sync your local `gh` CLI token
   (which has `repo` write scope) to your Claude account. The proxy then
   translates to that write-capable token.

After either, retry:
```bash
git push -u origin "$(git rev-parse --abbrev-ref HEAD)"
```
Reference: https://code.claude.com/docs/en/claude-code-on-the-web
(sections "GitHub authentication options" and "GitHub proxy").

## When you can't fix the connection right now — hand off a patch
```bash
bash .claude/skills/push-to-github/push.sh --patch /tmp/changes.patch
```
This commits outstanding work, builds the patch, and **verifies it applies on
the real default branch** fetched directly from github.com. Send the file with
`SendUserFile`, then the human runs:
```bash
git fetch origin && git checkout main
git apply changes.patch && git add -A
git commit -m "<message>" && git push origin main
```

## Advanced (human-initiated only): one-off token push
github.com is on the sandbox's default allowlist, so a maintainer who wants a
single in-session push can add a least-privilege **fine-grained PAT (Contents:
Read and write, this repo only)** as the `GH_TOKEN` environment variable and run,
themselves:
```bash
git push "https://x-access-token:${GH_TOKEN}@github.com/<owner>/<repo>.git" \
  "HEAD:refs/heads/$(git rev-parse --abbrev-ref HEAD)"
```
Prefer fixing the connection (above) over carrying a token in the environment.
Never paste a PAT into chat.

## Opening a PR
Once the branch is pushed, try `mcp__github__create_pull_request(..., draft=true)`.
If it 403s, open it in the UI:
`https://github.com/<owner>/<repo>/compare/main...<branch>?expand=1`

## Notes
- Skills committed to the repo's `.claude/skills/` load in every future cloud
  session; user-level `~/.claude/skills/` do NOT. That's why this lives here.

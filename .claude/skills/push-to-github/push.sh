#!/usr/bin/env bash
# push-to-github helper for Claude Code cloud sessions.
# Read-only helper: it DIAGNOSES why pushes fail and produces a verified patch.
# It does NOT push for you — pushing is fixed at the connection level (see
# SKILL.md: reconnect the Claude GitHub App with write access, or /web-setup).
set -uo pipefail

origin_url="$(git config --get remote.origin.url || echo '')"
slug="$(printf '%s' "$origin_url" | sed -E 's#.*/git/##; s#\.git$##')"
owner="${slug%%/*}"; repo="${slug##*/}"
branch_default="${2:-main}"
cur_branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo HEAD)"
pub_url() { printf 'https://github.com/%s/%s.git' "$owner" "$repo"; }

diagnose() {
  echo "owner/repo     : $owner/$repo"
  echo "current branch : $cur_branch"
  echo -n "proxy push     : "
  if git push --dry-run -u origin "$cur_branch" >/dev/null 2>&1; then
    echo "OK — connection has write access; just run: git push -u origin $cur_branch"
  else
    echo "BLOCKED (403) — connected GitHub token is read-only. Fix the connection (see SKILL.md)."
  fi
  echo -n "github.com     : "
  if GIT_TERMINAL_PROMPT=0 git ls-remote "$(pub_url)" HEAD >/dev/null 2>&1; then echo "reachable (read)"; else echo "unreachable"; fi
}

make_patch() {
  local out="${1:-/tmp/${repo}_changes.patch}"
  if ! git diff --quiet || ! git diff --cached --quiet; then
    git add -A && git commit -m "WIP: changes for patch" >/dev/null
  fi
  GIT_TERMINAL_PROMPT=0 git fetch "$(pub_url)" "$branch_default" --quiet 2>/dev/null
  git diff FETCH_HEAD..HEAD > "$out"
  if git worktree add -q --detach /tmp/_verify FETCH_HEAD 2>/dev/null; then
    ( cd /tmp/_verify && git apply --check "$out" >/dev/null 2>&1 ) \
      && echo "PATCH OK: $out (applies cleanly on github.com/$owner/$repo:$branch_default)" \
      || echo "PATCH WARNING: $out does not apply cleanly on $branch_default — rebase needed"
    git worktree remove --force /tmp/_verify >/dev/null 2>&1; git worktree prune >/dev/null 2>&1
  else
    echo "PATCH WRITTEN: $out (could not auto-verify)"
  fi
}

case "${1:-}" in
  --patch) make_patch "${2:-/tmp/${repo}_changes.patch}" ;;
  *)       diagnose ;;
esac

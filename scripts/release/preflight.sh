#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

RELEASE_SHA="${1:-}"
if [[ ! "$RELEASE_SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Usage: npm run release:preflight -- <exact-main-commit-sha>" >&2
  exit 2
fi

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$CURRENT_BRANCH" != "main" ]]; then
  echo "Refusing preflight from '$CURRENT_BRANCH'; expected main." >&2
  exit 2
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Refusing preflight with a dirty worktree." >&2
  exit 2
fi

HEAD_SHA="$(git rev-parse HEAD)"
if [[ "$HEAD_SHA" != "$RELEASE_SHA" ]]; then
  echo "Refusing: HEAD ($HEAD_SHA) does not equal requested SHA ($RELEASE_SHA)." >&2
  exit 2
fi

if ! git show-ref --verify --quiet refs/remotes/origin/main; then
  echo "Refusing: fetch origin/main read-only, then retry." >&2
  exit 2
fi
git merge-base --is-ancestor "$RELEASE_SHA" origin/main

echo "Preflight target verified: $RELEASE_SHA"
echo "This command is read-only: it does not commit, push, migrate, deploy, promote, or dispatch workflows."

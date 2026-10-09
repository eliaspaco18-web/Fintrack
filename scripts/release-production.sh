#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ $# -lt 2 || $# -gt 3 ]]; then
  echo "Usage: scripts/release-production.sh migration_audit|stage_deployment <exact-40-character-main-SHA> [MIGRATIONS_REVIEWED]" >&2
  exit 1
fi

PHASE="$1"
RELEASE_SHA="$2"

[[ "$PHASE" == migration_audit || "$PHASE" == stage_deployment ]] || { echo 'Invalid phase' >&2; exit 1; }
[[ "$RELEASE_SHA" =~ ^[0-9a-f]{40}$ ]] || { echo 'Invalid release SHA' >&2; exit 1; }
[[ "$(git branch --show-current)" == main ]] || { echo 'A clean main checkout is required' >&2; exit 1; }
[[ -z "$(git status --porcelain --untracked-files=all)" ]] || { echo 'Checkout must be clean' >&2; exit 1; }
[[ "$(git rev-parse HEAD)" == "$RELEASE_SHA" ]] || { echo 'HEAD does not match the release SHA' >&2; exit 1; }

git fetch --no-tags origin main
[[ "$(git rev-parse origin/main)" == "$RELEASE_SHA" ]] || { echo 'Remote main changed' >&2; exit 1; }

if ! command -v gh >/dev/null 2>&1; then
  echo 'GitHub CLI is required; no workflow was started' >&2
  exit 1
fi

if [[ "$PHASE" == stage_deployment ]]; then
  [[ "${3:-}" == MIGRATIONS_REVIEWED ]] || { echo 'Explicit migration review acknowledgment required' >&2; exit 1; }
  echo 'Staging requires separately approved migrations and disabled automatic Production domain assignment.' >&2
  gh workflow run production-release.yml --ref main -f phase=stage_deployment -f commit_sha="$RELEASE_SHA" -f migration_gate=MIGRATIONS_REVIEWED
else
  [[ $# -eq 2 ]] || { echo 'Unexpected migration gate for audit phase' >&2; exit 1; }
  gh workflow run production-release.yml --ref main -f phase=migration_audit -f commit_sha="$RELEASE_SHA"
fi

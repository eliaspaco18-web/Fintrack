#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ $# -lt 1 ]]; then
  echo "Uso: scripts/release-production.sh \"mensaje del commit\""
  exit 1
fi

COMMIT_MESSAGE="$1"
WORKFLOW_FILE="production-release.yml"
TARGET_BRANCH="${TARGET_BRANCH:-main}"
GH_BIN="${GH_BIN:-}"

if [[ -z "$GH_BIN" ]]; then
  if command -v gh >/dev/null 2>&1; then
    GH_BIN="$(command -v gh)"
  elif [[ -x "$ROOT_DIR/.tools/gh/gh-current/bin/gh" ]]; then
    GH_BIN="$ROOT_DIR/.tools/gh/gh-current/bin/gh"
  fi
fi

echo "==> Validando rama actual"
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$CURRENT_BRANCH" != "$TARGET_BRANCH" ]]; then
  echo "Estás en '$CURRENT_BRANCH'. Cambia a '$TARGET_BRANCH' o exporta TARGET_BRANCH."
  exit 1
fi

echo "==> Preparando versión visible del release"
node scripts/prepare-release-manifest.mjs "$COMMIT_MESSAGE"

echo "==> Ejecutando checks locales de release"
npm run build
npm run typecheck
npm run test:e2e -- tests/e2e/login-ui.spec.ts tests/e2e/auth-redirect.spec.ts

echo "==> Preparando commit"
git add -A

if git diff --cached --quiet; then
  echo "No hay cambios staged para commitear."
else
  git commit -m "$COMMIT_MESSAGE"
fi

echo "==> Empujando cambios a GitHub"
git push origin "HEAD:$TARGET_BRANCH"

if [[ -n "$GH_BIN" ]]; then
  echo "==> Disparando workflow de producción en GitHub Actions"
  "$GH_BIN" workflow run "$WORKFLOW_FILE" --ref "$TARGET_BRANCH"
  echo "Workflow lanzado. Puedes seguirlo con: $GH_BIN run watch"
else
  echo "GitHub CLI no está disponible."
  echo "Dispara manualmente el workflow '$WORKFLOW_FILE' desde Actions en GitHub sobre la rama '$TARGET_BRANCH'."
fi

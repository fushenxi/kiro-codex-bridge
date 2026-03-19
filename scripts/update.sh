#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

cd "${ROOT_DIR}"

if [[ ! -d .git ]]; then
  echo "This directory is not a git repository yet."
  echo "Create a git repo first, then run this command again."
  exit 1
fi

WAS_RUNNING=0
if [[ -f "${ROOT_DIR}/.runtime/bridge.pid" ]] && kill -0 "$(cat "${ROOT_DIR}/.runtime/bridge.pid")" 2>/dev/null; then
  WAS_RUNNING=1
  bash "${ROOT_DIR}/scripts/stop-background.sh"
fi

git pull --ff-only

if [[ "${WAS_RUNNING}" == "1" ]]; then
  bash "${ROOT_DIR}/scripts/start-background.sh"
fi

echo "Update complete"

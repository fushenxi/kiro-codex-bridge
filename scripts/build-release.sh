#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DIST_DIR="${ROOT_DIR}/dist"
VERSION="$(node -p "require('${ROOT_DIR}/package.json').version")"
ARCHIVE_NAME="kiro-codex-bridge-v${VERSION}.zip"
ARCHIVE_PATH="${DIST_DIR}/${ARCHIVE_NAME}"

mkdir -p "${DIST_DIR}"
rm -f "${ARCHIVE_PATH}"

cd "${ROOT_DIR}"

zip -r "${ARCHIVE_PATH}" \
  README.md \
  README.zh-CN.md \
  LICENSE \
  TEST_MATRIX.md \
  package.json \
  .env.example \
  .gitignore \
  .dockerignore \
  Dockerfile \
  compose.yaml \
  server.mjs \
  scripts \
  -x "scripts/*.log" \
  -x "*.DS_Store" \
  -x "*/.DS_Store"

echo "Created ${ARCHIVE_PATH}"

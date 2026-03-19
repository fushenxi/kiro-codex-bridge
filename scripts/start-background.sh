#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RUNTIME_DIR="${ROOT_DIR}/.runtime"
PID_FILE="${RUNTIME_DIR}/bridge.pid"
LOG_FILE="${RUNTIME_DIR}/bridge.log"

mkdir -p "${RUNTIME_DIR}"

if [[ -f "${PID_FILE}" ]] && kill -0 "$(cat "${PID_FILE}")" 2>/dev/null; then
  echo "Bridge already running with PID $(cat "${PID_FILE}")"
  exit 0
fi

cd "${ROOT_DIR}"
nohup node server.mjs >> "${LOG_FILE}" 2>&1 &
echo $! > "${PID_FILE}"
echo "Started bridge with PID $(cat "${PID_FILE}")"

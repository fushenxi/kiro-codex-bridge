#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PID_FILE="${ROOT_DIR}/.runtime/bridge.pid"

if [[ ! -f "${PID_FILE}" ]]; then
  echo "Bridge is not running"
  exit 0
fi

PID="$(cat "${PID_FILE}")"
if kill -0 "${PID}" 2>/dev/null; then
  kill "${PID}"
  echo "Stopped bridge PID ${PID}"
else
  echo "Bridge PID ${PID} was not running"
fi

rm -f "${PID_FILE}"

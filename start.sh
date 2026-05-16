#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_PORT="${FRONTEND_PORT:-5500}"
BACKEND_PORT="${BACKEND_PORT:-8000}"

kill_port() {
  local port="$1"
  local pids
  pids="$(lsof -ti tcp:"$port" 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    echo "Stopping processes on port $port"
    kill $pids 2>/dev/null || true
    sleep 1
    kill -9 $pids 2>/dev/null || true
  fi
}

cleanup() {
  [[ -n "${backend_pid:-}" ]] && kill "$backend_pid" 2>/dev/null || true
  [[ -n "${frontend_pid:-}" ]] && kill "$frontend_pid" 2>/dev/null || true
}

trap cleanup EXIT INT TERM

kill_port "$FRONTEND_PORT"
kill_port "$BACKEND_PORT"

(
  cd "$ROOT_DIR/backend"
  HOST="${HOST:-127.0.0.1}" PORT="$BACKEND_PORT" \
  npm start
) &
backend_pid=$!

(
  cd "$ROOT_DIR/frontend"
  python3 -m http.server "$FRONTEND_PORT" --bind 127.0.0.1
) &
frontend_pid=$!

echo "Frontend: http://127.0.0.1:$FRONTEND_PORT"
echo "Backend:   http://127.0.0.1:$BACKEND_PORT"

while true; do
  if ! kill -0 "$backend_pid" 2>/dev/null; then
    echo "Backend process exited."
    exit 1
  fi
  if ! kill -0 "$frontend_pid" 2>/dev/null; then
    echo "Frontend process exited."
    exit 1
  fi
  sleep 1
done

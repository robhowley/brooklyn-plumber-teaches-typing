#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
root="$(pwd -P)"
url='http://127.0.0.1:4173'
log="$root/.tmp/preview.log"

# Never stop an unrelated service that happens to use the preview port.
pids=$(lsof -tiTCP:4173 -sTCP:LISTEN || true)
for pid in $pids; do
  cwd=$(lsof -a -p "$pid" -d cwd -Fn | awk '/^n/ {print substr($0, 2)}')
  command=$(ps -p "$pid" -o command=)
  if [[ "$cwd" != "$root" || "$command" != *"vite preview "* ]]; then
    printf 'Port 4173 belongs to another service (PID %s); leaving it running.\n' "$pid" >&2
    exit 1
  fi
done

node_modules/.bin/vite build
mkdir -p .tmp
for pid in $pids; do
  kill "$pid"
done
for ((i = 0; i < 50; i++)); do
  if ! lsof -tiTCP:4173 -sTCP:LISTEN >/dev/null 2>&1; then break; fi
  sleep 0.1
done
if lsof -tiTCP:4173 -sTCP:LISTEN >/dev/null 2>&1; then
  printf 'Port 4173 did not stop; no replacement started.\n' >&2
  exit 1
fi

nohup node_modules/.bin/vite preview --host 127.0.0.1 --port 4173 --strictPort > "$log" 2>&1 < /dev/null &
pid=$!
printf '%s\n' "$pid" > .tmp/preview.pid
for ((i = 0; i < 50; i++)); do
  if ! kill -0 "$pid" 2>/dev/null; then break; fi
  if curl --silent --fail --max-time 1 "$url/" >/dev/null; then
    printf 'Preview running at %s (PID %s). Log: %s\n' "$url" "$pid" "$log"
    exit 0
  fi
  sleep 0.1
done
kill "$pid" 2>/dev/null || true
rm -f .tmp/preview.pid
printf 'Preview failed to start; see %s\n' "$log" >&2
exit 1

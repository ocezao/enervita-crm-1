#!/usr/bin/env bash
set -euo pipefail
cd /opt/clients/enervita-crm-preview
set -a
source runtime/production.env
set +a
mkdir -p runtime
cleanup() {
  for f in runtime/api.pid runtime/web.pid runtime/proxy.pid; do
    if [ -s "$f" ]; then kill "$(cat "$f")" 2>/dev/null || true; fi
  done
}
trap cleanup EXIT INT TERM
for f in runtime/api.pid runtime/web.pid runtime/proxy.pid; do
  if [ -s "$f" ]; then kill "$(cat "$f")" 2>/dev/null || true; rm -f "$f"; fi
done
for port in 43123 43124 43210; do
  if command -v fuser >/dev/null 2>&1; then fuser -k "${port}/tcp" >/dev/null 2>&1 || true; fi
done
PORT=43123 HOST=127.0.0.1 npm run dev:api > runtime/api.log 2>&1 & echo $! > runtime/api.pid
( cd apps/web && npx vite preview --host 127.0.0.1 --port 43124 ) > runtime/web.log 2>&1 & echo $! > runtime/web.pid
node scripts/preview-proxy.cjs > runtime/proxy.log 2>&1 & echo $! > runtime/proxy.pid
for url in http://127.0.0.1:43123/health http://127.0.0.1:43124/login http://127.0.0.1:43210/health; do
  for i in $(seq 1 45); do
    if curl -fsS --max-time 2 "$url" >/dev/null 2>&1; then break; fi
    sleep 1
    if [ "$i" = 45 ]; then echo "Service did not become ready: $url" >&2; exit 1; fi
  done
done
echo "Enervita custom CRM stack ready on 127.0.0.1:43210"
wait -n
exit $?

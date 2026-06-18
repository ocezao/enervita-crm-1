#!/usr/bin/env bash
set -euo pipefail

log(){ echo "[$(date '+%F %T')] $*"; }

log "Web checks"
npm run -s lint --workspace @enervita/web
npm run -s typecheck --workspace @enervita/web
npm run -s build --workspace @enervita/web

log "API checks"
npm run -s typecheck --workspace @enervita/api
npm run -s test:api

log "Smoke tests (web)"
npm run -s test --workspace @enervita/web

log "CI gate passed"

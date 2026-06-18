#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${SMOKE_BASE_URL:-https://crm.enervita.com.br}"
EMAIL="${SMOKE_ADMIN_EMAIL:-${HERMES_CRM_ADMIN_EMAIL:-}}"
PASSWORD="${SMOKE_ADMIN_PASSWORD:-${HERMES_CRM_ADMIN_PASSWORD:-}}"
LEAD_ID="${SMOKE_LEAD_ID:-aa2bce8f-147c-49a7-9519-8fbebecefe0b}"

if [[ -z "$EMAIL" || -z "$PASSWORD" ]]; then
  echo "Missing SMOKE_ADMIN_EMAIL/SMOKE_ADMIN_PASSWORD or HERMES_CRM_ADMIN_*" >&2
  exit 2
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
LOGIN_BODY="$TMP_DIR/login.json"
DOC_BODY="$TMP_DIR/docs.json"
COOKIE_JAR="$TMP_DIR/cookies.txt"

HTTP_LOGIN=$(curl -sS -X POST "$BASE_URL/api/auth/login" \
  -H 'content-type: application/json' \
  -c "$COOKIE_JAR" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
  -o "$LOGIN_BODY" -w '%{http_code}')

if [[ "$HTTP_LOGIN" != "200" ]]; then
  echo "Login failed: HTTP $HTTP_LOGIN" >&2
  cat "$LOGIN_BODY" >&2 || true
  exit 3
fi

HTTP_DOCS=$(curl -sS -b "$COOKIE_JAR" "$BASE_URL/api/leads/$LEAD_ID/documents" \
  -o "$DOC_BODY" -w '%{http_code}')

if [[ "$HTTP_DOCS" != "200" ]]; then
  echo "Documents list failed: HTTP $HTTP_DOCS" >&2
  cat "$DOC_BODY" >&2 || true
  exit 4
fi

echo "SMOKE_OK: documents endpoint reachable (HTTP $HTTP_DOCS)"

# Keep output short but useful
head -c 220 "$DOC_BODY"
echo

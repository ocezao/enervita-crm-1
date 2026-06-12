#!/usr/bin/env bash
set -Eeuo pipefail

DOMAIN="https://crm.enervita.com.br"
OUTPUT_DIR=".deploy-screenshots"
EMAIL="${SMOKE_EMAIL:-hermes.prints@enervita.local}"
PASSWORD="${SMOKE_PASSWORD:-}"
ROUTES=()
EXPECT_MARKERS=()

usage() {
  cat <<'USAGE'
Usage: scripts/smoke-public-ui.sh [--domain URL] [--output-dir DIR] [--route PATH] [--expect TEXT]

Runs a headless Chrome smoke test against the public CRM domain.
Requires SMOKE_PASSWORD in the environment for authenticated routes.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) DOMAIN="$2"; shift 2 ;;
    --output-dir) OUTPUT_DIR="$2"; shift 2 ;;
    --route) ROUTES+=("$2"); shift 2 ;;
    --expect) EXPECT_MARKERS+=("$2"); shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; usage; exit 2 ;;
  esac
done

if [[ ${#ROUTES[@]} -eq 0 ]]; then ROUTES=("/dashboard"); fi
if [[ ${#EXPECT_MARKERS[@]} -eq 0 ]]; then EXPECT_MARKERS=("Enervita"); fi
[[ -n "$PASSWORD" ]] || { echo "SMOKE_PASSWORD is required" >&2; exit 2; }

CHROME="$(command -v google-chrome || command -v chromium || command -v chromium-browser || true)"
[[ -n "$CHROME" ]] || { echo "Chrome/Chromium not found" >&2; exit 127; }

mkdir -p "$OUTPUT_DIR"
NODE_SCRIPT="${OUTPUT_DIR}/smoke-runner.mjs"
cat > "$NODE_SCRIPT" <<'NODE'
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const chrome = process.env.CHROME;
const domain = process.env.DOMAIN;
const email = process.env.SMOKE_EMAIL;
const password = process.env.SMOKE_PASSWORD;
const outputDir = process.env.OUTPUT_DIR;
const routes = JSON.parse(process.env.ROUTES_JSON || '[]');
const expects = JSON.parse(process.env.EXPECTS_JSON || '[]');
const profile = `${outputDir}/chrome-profile-${Date.now()}`;
const port = 9222 + Math.floor(Math.random() * 1000);

function waitForExit(child) {
  return new Promise((resolve) => child.on('exit', resolve));
}

const child = spawn(chrome, [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });

try {
  let browserUrl;
  for (let i = 0; i < 50; i++) {
    try {
      const version = await fetch(`http://127.0.0.1:${port}/json/version`).then(r => r.json());
      browserUrl = version.webSocketDebuggerUrl;
      break;
    } catch {
      await delay(100);
    }
  }
  if (!browserUrl) throw new Error('Chrome DevTools did not start');

  const tabs = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(`${domain}/login`)}`, { method: 'PUT' }).then(r => r.json());
  const ws = new WebSocket(tabs.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  };
  await new Promise((resolve) => ws.onopen = resolve);
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const callId = ++id;
    pending.set(callId, (msg) => msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result));
    ws.send(JSON.stringify({ id: callId, method, params }));
  });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.setViewport', {}).catch(() => {});
  await delay(1200);

  async function evalJs(expression) {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  }

  await evalJs(`document.querySelector('input[name="email"], input[type="email"], input[aria-label="E-mail"]')?.focus()`);
  await send('Input.insertText', { text: email });
  await evalJs(`document.querySelector('input[name="password"], input[type="password"], input[aria-label="Senha"]')?.focus()`);
  await send('Input.insertText', { text: password });
  await evalJs(`document.querySelector('button[type="submit"], button')?.click()`);
  await delay(1800);

  const loginText = await evalJs('document.body.innerText');
  if (/senha inválidos|Authentication required|Entrar no Cockpit/.test(loginText)) {
    throw new Error(`Login smoke failed: ${loginText.slice(0, 180)}`);
  }

  async function waitForRouteData(route) {
    const startedAt = Date.now();
    let snapshot = null;
    while (Date.now() - startedAt < 30000) {
      snapshot = await evalJs(`(() => {
        const text = document.body.innerText || '';
        const loading = /Carregando|Loading|Aguarde/i.test(text);
        const dataNodes = document.querySelectorAll('tbody tr, article, .cursor-grab, [data-testid^="pipeline-column-"], [data-rbd-draggable-id], [draggable="true"]').length;
        const pageHeight = document.documentElement.scrollHeight;
        const viewportHeight = window.innerHeight;
        const pathname = window.location.pathname;
        return { text, loading, dataNodes, pageHeight, viewportHeight, pathname };
      })()`);
      const expectedVisible = expects.length === 0 || expects.some((marker) => snapshot.text.includes(marker));
      if (snapshot.pathname === route && !snapshot.loading && snapshot.text.length > 120 && expectedVisible) return snapshot;
      await delay(500);
    }
    throw new Error(`Route data did not finish loading before screenshot: ${route}. Last path: ${snapshot?.pathname}. Last text: ${(snapshot?.text || '').slice(0, 220)}`);
  }

  for (const route of routes) {
    await send('Page.navigate', { url: `${domain}${route}` });
    await delay(800);
    let currentPath = await evalJs('window.location.pathname');
    if (currentPath !== route) {
      await evalJs(`window.location.assign(${JSON.stringify(`${domain}${route}`)})`);
      await delay(1200);
    }
    const snapshot = await waitForRouteData(route);
    const text = snapshot.text;
    const safeRoute = route.replaceAll('/', '_') || 'home';
    fs.writeFileSync(`${outputDir}/text-${safeRoute}.txt`, text);
    fs.writeFileSync(`${outputDir}/metrics-${safeRoute}.json`, JSON.stringify({ route, dataNodes: snapshot.dataNodes, pageHeight: snapshot.pageHeight, viewportHeight: snapshot.viewportHeight }, null, 2));
    const shot = await send('Page.captureScreenshot', { format: 'png', fullPage: true });
    const filename = `${outputDir}/screenshot-${safeRoute}.png`;
    fs.writeFileSync(filename, Buffer.from(shot.data, 'base64'));
    console.log(`screenshot=${filename}`);
    console.log(`metrics=${JSON.stringify({ route, dataNodes: snapshot.dataNodes, pageHeight: snapshot.pageHeight, viewportHeight: snapshot.viewportHeight })}`);
  }

  const allText = routes.map(route => {
    const p = `${outputDir}/text-${route.replaceAll('/', '_') || 'home'}.txt`;
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  }).join('\n');
  // At least each expected marker must be visible in one of the route DOM texts or current route text.
  const finalText = allText + '\n' + await evalJs('document.body.innerText');
  for (const marker of expects) {
    if (!finalText.includes(marker)) throw new Error(`Expected marker not visible in browser DOM: ${marker}`);
  }

  ws.close();
  child.kill('SIGTERM');
  await waitForExit(child);
} catch (error) {
  child.kill('SIGTERM');
  console.error(error?.stack || String(error));
  process.exit(1);
}
NODE

CHROME="$CHROME" DOMAIN="$DOMAIN" SMOKE_EMAIL="$EMAIL" SMOKE_PASSWORD="$PASSWORD" OUTPUT_DIR="$OUTPUT_DIR" ROUTES_JSON="$(printf '%s\n' "${ROUTES[@]}" | jq -R . | jq -s .)" EXPECTS_JSON="$(printf '%s\n' "${EXPECT_MARKERS[@]}" | jq -R . | jq -s .)" node "$NODE_SCRIPT"

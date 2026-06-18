import { test } from '@playwright/test';
import type { ConsoleMessage, Page, Request, Response } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

type RouteCheckResult = {
  name: string;
  path: string;
  status: 'PASS' | 'FAIL';
  httpStatus: number | null;
  blankScreen: boolean;
  pageErrors: string[];
  consoleErrors: string[];
  requestErrors: string[];
  screenshotDesktop: string;
  screenshotMobile: string;
};

type DeadButton = {
  page: string;
  selector: string;
  reason: string;
  severity: 'OK' | 'WARNING' | 'BLOCKER';
};

type Report = {
  timestamp: string;
  baseUrl: string;
  apiBaseUrl: string;
  leadId: string;
  routeResults: RouteCheckResult[];
  login: {
    email: string;
    success: boolean;
    loginStatus?: number;
    meStatus?: number;
    errors: string[];
  };
  deadButtons: DeadButton[];
  forms: string[];
  result: 'PASS' | 'FAIL';
};

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5173';
const API_BASE_URL = process.env.E2E_API_URL || 'http://localhost:43123';
const SECRET_PATH = '/home/deploy/.secrets/homologacao/enervita-crm-homologacao.json';
const REPORT_PATH = path.join(process.cwd(), 'test-results', 'ui-report.md');
const SCREEN_DIR = path.join(process.cwd(), 'test-results', 'ui-screenshots');
const LOGIN_EMAIL = 'agencia+homolog@cesarmachado.com';

function nowIso() {
  return new Date().toISOString();
}

function safeWrite(filePath: string, content: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function normalizeSecretPassword(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw);
    return (
      parsed.senha ||
      parsed.password ||
      (parsed.user && (parsed.user.password || parsed.user?.credentials?.password)) ||
      null
    );
  } catch {
    return null;
  }
}

function readHomologPassword(): string {
  if (!fs.existsSync(SECRET_PATH)) {
    throw new Error(`Arquivo de segredo não encontrado: ${SECRET_PATH}`);
  }

  const raw = fs.readFileSync(SECRET_PATH, 'utf8');
  const password = normalizeSecretPassword(raw);
  if (!password) {
    throw new Error('Senha de homologação não encontrada no arquivo de segredo');
  }
  return password;
}

function isBlankOrNearBlank(bodyHtml: string): boolean {
  const normalized = bodyHtml.replace(/\s+/g, '').toLowerCase();
  return normalized.length < 30 || /<body><\/body>|loading\.\.\.|sem acesso|javascript is disabled/.test(normalized);
}

function hasMeaningfulDOM(pageContent: string): boolean {
  const normalized = pageContent.replace(/\s+/g, '').toLowerCase();
  return normalized.length > 1000;
}

function attachMonitors(page: Page) {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const requestErrors: string[] = [];

  const onPageError = (error: Error) => {
    pageErrors.push(String(error?.message || error));
  };

  const onConsole = (msg: ConsoleMessage) => {
    if (msg.type() === 'error') {
      const location = msg.location?.() || {};
      consoleErrors.push(`${msg.type()}: ${String(msg.text())} @ ${location.url || 'unknown'}:${location.lineNumber || ''}`);
    }
  };

  const onResponse = (resp: Response) => {
    const status = resp.status();
    const url = resp.url();
    const method = resp.request()?.method();
    if (status >= 500 || [401, 404].includes(status) || (status >= 400 && method !== 'OPTIONS')) {
      requestErrors.push(`${method} ${status} ${url}`);
    }
  };

  const onRequestFailed = (request: Request) => {
    const failure = request.failure?.();
    if (failure?.errorText) {
      requestErrors.push(`FAILED ${request.url()} - ${failure.errorText}`);
    }
  };

  page.on('pageerror', onPageError);
  page.on('console', onConsole);
  page.on('response', onResponse);
  page.on('requestfailed', onRequestFailed);

  return {
    detach: () => {
      page.off('pageerror', onPageError);
      page.off('console', onConsole);
      page.off('response', onResponse);
      page.off('requestfailed', onRequestFailed);
    },
    pageErrors,
    consoleErrors,
    requestErrors,
  };
}

async function collectCookiesHeader(page: Page, url = BASE_URL) {
  const cookies = await page.context().cookies(url);
  return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
}

async function readFirstLeadId(apiBaseUrl: string, cookieHeader: string): Promise<string | null> {
  if (!cookieHeader) {
    return null;
  }

  const endpoints = [`${apiBaseUrl}/api/leads?limit=1`, `${apiBaseUrl}/api/leads?page=1&limit=1`];

  for (const endpoint of endpoints) {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        cookie: cookieHeader,
      },
    });

    if (!response.ok) {
      continue;
    }

    const payload = await response.json();
    const candidates =
      payload?.data?.items ||
      payload?.data ||
      payload?.items ||
      payload?.leads ||
      payload?.results ||
      [];

    if (Array.isArray(candidates) && candidates.length > 0 && candidates[0]?.id) {
      return candidates[0].id;
    }
  }

  return null;
}

async function loginE2E(page: Page, password: string) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="email"], input[name="email"], input#email, input[autocomplete="email"]').first().waitFor({ timeout: 15000 }).catch(() => {});

  const email = page.locator('input[type="email"], input[name="email"], input#email, input[autocomplete="email"]').first();
  const passwordInput = page.locator('input[type="password"], input[name="password"], input#password, input[autocomplete="current-password"]').first();

  await email.fill(LOGIN_EMAIL);
  await passwordInput.fill(password);

  const loginResponsePromise = page.waitForResponse(
    (response: Response) => response.url().includes('/api/auth/login'),
    { timeout: 30000 }
  ).catch(() => null);

  await page.getByRole('button', { name: /entrar/i }).click({ timeout: 10000 }).catch(async () => {
    await page.getByRole('button', { name: /sign in/i }).click({ timeout: 10000 });
  });

  const loginResponse = await loginResponsePromise;
  return {
    response: loginResponse,
    cookieHeader: await collectCookiesHeader(page, BASE_URL),
  };
}

async function inspectRoute(page: Page, route: { name: string; path: string; optional?: boolean }, report: Report): Promise<RouteCheckResult> {
  const monitors = attachMonitors(page);
  const result: RouteCheckResult = {
    name: route.name,
    path: route.path,
    status: 'PASS',
    httpStatus: null,
    blankScreen: false,
    pageErrors: [],
    consoleErrors: [],
    requestErrors: [],
    screenshotDesktop: '',
    screenshotMobile: '',
  };

  try {
    const response = await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    result.httpStatus = response ? response.status() : null;
    await page.waitForLoadState('networkidle', { timeout: 30000 });

    const body = await page.locator('body').innerHTML();
    const blank = isBlankOrNearBlank(body);
    result.blankScreen = blank;

    const hasContent = hasMeaningfulDOM(body);
    if (blank || !hasContent) {
      result.status = 'FAIL';
    }

    const desktopShot = path.join(SCREEN_DIR, `${route.name}-${Date.now()}-desktop.png`);
    fs.mkdirSync(SCREEN_DIR, { recursive: true });
    await page.screenshot({ path: desktopShot, fullPage: true });
    result.screenshotDesktop = path.basename(desktopShot);

    const mobilePage = await page.context().newPage({ viewport: { width: 390, height: 844 } });
    const mobileMonitors = attachMonitors(mobilePage);
    await mobilePage.goto(`${BASE_URL}${route.path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await mobilePage.waitForLoadState('networkidle', { timeout: 30000 });
    const mobileShot = path.join(SCREEN_DIR, `${route.name}-${Date.now()}-mobile.png`);
    await mobilePage.screenshot({ path: mobileShot, fullPage: true });
    result.screenshotMobile = path.basename(mobileShot);
    mobileMonitors.detach();
    await mobilePage.close();

    result.pageErrors.push(...monitors.pageErrors, ...mobileMonitors.pageErrors);
    result.consoleErrors.push(...monitors.consoleErrors, ...mobileMonitors.consoleErrors);
    result.requestErrors.push(...monitors.requestErrors, ...mobileMonitors.requestErrors);

    if (result.requestErrors.length > 0) {
      result.status = 'FAIL';
    }

    if (!route.optional && result.status === 'FAIL') {
      report.result = 'FAIL';
      report.login.errors.push(`route_failure:${route.path}`);
    }

    return result;
  } catch (error) {
    result.status = 'FAIL';
    result.pageErrors.push(String(error));
    report.result = 'FAIL';
    report.login.errors.push(`route_exception:${route.path}:${String(error)}`);
    return result;
  } finally {
    monitors.detach();
  }
}

async function scanDeadButtons(page: Page, report: Report) {
  const buttons = await page.locator('button:visible, [role="button"]:visible').all();
  const primarySelectorRegex = /salvar|enviar|adicionar|criar|calcular|login|entrar|continuar|buscar/i;

  for (const button of buttons.slice(0, 40)) {
    const label = ((await button.innerText().catch(() => '')) || '').trim() || (await button.getAttribute('aria-label')) || 'sem-label';
    const disabled = await button.isDisabled().catch(() => false);
    if (disabled) {
      continue;
    }

    const beforeBody = await page.locator('body').innerHTML();

    try {
      await button.click({ timeout: 700 });
      await page.waitForTimeout(700);
      const afterBody = await page.locator('body').innerHTML();
      const changed = beforeBody !== afterBody;
      const spinner = await page.locator('[role="status"], .loading, .spinner, .loader').first().isVisible().catch(() => false);

      if (!changed && !spinner && primarySelectorRegex.test(label)) {
        report.deadButtons.push({
          page: page.url(),
          selector: label,
          reason: 'Sem efeito visual/rede após clique',
          severity: 'BLOCKER',
        });
      } else if (!changed && !spinner) {
        report.deadButtons.push({
          page: page.url(),
          selector: label,
          reason: 'Possível botão inerte',
          severity: 'WARNING',
        });
      }
    } catch {
      report.deadButtons.push({
        page: page.url(),
        selector: label,
        reason: 'Falha ao clicar',
        severity: 'BLOCKER',
      });
    }
  }
}

async function runDimensioningFlow(page: Page, report: Report) {
  try {
    const tab = page.getByRole('tab', { name: /dimension/i }).first();
    if (await tab.isVisible().catch(() => false)) {
      await tab.click({ timeout: 5000 });
      await page.waitForTimeout(800);
    }

    const cityField = page.getByLabel(/cidade/i).first();
    const ufField = page.getByLabel(/uf/i).first();
    const roofTypeField = page.getByLabel(/tipo/i).first();
    const averageConsumption = page.getByLabel(/consumo/i).first();
    const platesField = page.getByLabel(/placa/i).first();
    const calculateButton = page.getByRole('button', { name: /calcular/i }).first();

    const requiredFields = [cityField, ufField, calculateButton];
    const available = (await Promise.all(requiredFields.map((el) => el.isVisible().catch(() => false)))).some(Boolean);
    if (!available) {
      report.forms.push('dimensioning_missing_required_fields');
      report.result = 'FAIL';
      throw new Error('Dimensionamento sem campos principais encontrados');
    }

    if (await cityField.isVisible().catch(() => false)) {
      await cityField.fill('São Paulo');
    }
    if (await ufField.isVisible().catch(() => false)) {
      await ufField.fill('SP').catch(() => {});
    }
    if (await platesField.isVisible().catch(() => false)) {
      await platesField.fill('20').catch(() => {});
    }
    if (await averageConsumption.isVisible().catch(() => false)) {
      await averageConsumption.fill('300').catch(() => {});
    }
    if (await roofTypeField.isVisible().catch(() => false)) {
      await roofTypeField.click().catch(() => {});
    }

    await calculateButton.click({ timeout: 8000 }).catch(() => {
      throw new Error('Falha ao disparar cálculo de dimensionamento');
    });

    await page.waitForTimeout(1500);
    const hasResult =
      (await page.locator('text=/resultado|dimensionamento|placas|potência|kwh|inversor/i').first().isVisible().catch(() => false)) ||
      (await page.locator('[role="status"]').first().isVisible().catch(() => false));

    if (!hasResult) {
      report.forms.push('dimensioning_without_result_marker');
      report.result = 'FAIL';
      throw new Error('Resultado de dimensionamento não apareceu após cálculo');
    }

    const desktopShot = path.join(SCREEN_DIR, `dimensioning-${Date.now()}-desktop.png`);
    await page.screenshot({ path: desktopShot, fullPage: true });
    report.forms.push(`dimensioning_result_${path.basename(desktopShot)}`);
  } catch (error) {
    report.result = 'FAIL';
    report.forms.push(`dimensioning_error:${error instanceof Error ? error.message : String(error)}`);
  }
}

function buildReportMd(report: Report): string {
  const lines = [`# Relatório de Validação UI`];
  lines.push(`Data: ${report.timestamp}`);
  lines.push(`Base URL: ${report.baseUrl}`);
  lines.push(`API: ${report.apiBaseUrl}`);
  lines.push(`Lead utilizado: ${report.leadId}`);
  lines.push(`Resultado geral: ${report.result}`);
  lines.push('');

  lines.push('## Login');
  lines.push(`- email: ${report.login.email}`);
  lines.push(`- success: ${report.login.success}`);
  lines.push(`- /api/auth/login: ${report.login.loginStatus ?? 'N/A'}`);
  lines.push(`- /api/me: ${report.login.meStatus ?? 'N/A'}`);
  if (report.login.errors.length) {
    lines.push(`- erros: ${report.login.errors.join(' ; ')}`);
  } else {
    lines.push('- sem erros reportados');
  }

  lines.push('');
  lines.push('## Rotas');
  for (const route of report.routeResults) {
    lines.push(
      `- ${route.name} ${route.path}: ${route.status} HTTP=${route.httpStatus} blank=${route.blankScreen} pageErrors=${route.pageErrors.length} consoleErrors=${route.consoleErrors.length} requestErrors=${route.requestErrors.length} desktop=${route.screenshotDesktop} mobile=${route.screenshotMobile}`
    );
  }

  lines.push('');
  lines.push('## Botões mortos');
  if (report.deadButtons.length === 0) {
    lines.push('- Nenhum problema crítico detectado');
  } else {
    for (const row of report.deadButtons) {
      lines.push(`- [${row.severity}] ${row.page} :: ${row.selector} => ${row.reason}`);
    }
  }

  lines.push('');
  lines.push('## Formulários/Fluxos');
  if (report.forms.length === 0) {
    lines.push('- Nenhum fluxo crítico com erro');
  } else {
    for (const item of report.forms) {
      lines.push(`- ${item}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

async function runSuite(page: Page, opts: { includeFullChecks: boolean }) {
  const report: Report = {
    timestamp: nowIso(),
    baseUrl: BASE_URL,
    apiBaseUrl: API_BASE_URL,
    leadId: '',
    routeResults: [],
    login: {
      email: LOGIN_EMAIL,
      success: false,
      errors: [],
    },
    deadButtons: [],
    forms: [],
    result: 'PASS',
  };

  const password = readHomologPassword();
  const loginInfo = await loginE2E(page, password);
  if (!loginInfo.response) {
    report.login.errors.push('login_response_timeout');
    report.result = 'FAIL';
  } else {
    report.login.loginStatus = loginInfo.response.status();
    if (loginInfo.response.status() !== 200) {
      report.login.errors.push(`login_http_${loginInfo.response.status()}`);
      report.result = 'FAIL';
    }
  }

  const cookieHeader = loginInfo.cookieHeader || '';

  const meResp = await page.request.get(`${API_BASE_URL}/api/me`, {
    headers: {
      cookie: cookieHeader,
    },
  }).catch((error) => {
    report.login.errors.push(`me_request_error:${error}`);
    return null;
  });

  report.login.meStatus = meResp ? meResp.status() : undefined;
  if (!meResp || !meResp.ok()) {
    report.login.errors.push(`me_http_${meResp ? meResp.status() : 'na'}`);
    report.result = 'FAIL';
  }
  report.login.success = report.result !== 'FAIL';

  const leadId = await readFirstLeadId(API_BASE_URL, cookieHeader);
  if (!leadId) {
    report.result = 'FAIL';
    safeWrite(REPORT_PATH, buildReportMd({ ...report, result: 'FAIL', forms: [...report.forms, 'Sem lead real disponível para teste E2E'] }));
    throw new Error('Sem lead real disponível para teste E2E');
  }
  report.leadId = leadId;

  const routes = [
    { name: 'login', path: '/login' },
    { name: 'dashboard', path: '/' },
    { name: 'leads', path: '/leads' },
    { name: 'lead-detail', path: `/leads/${leadId}` },
    { name: 'tasks', path: '/tasks' },
    { name: 'ads', path: '/ads', optional: true },
    { name: 'automations', path: '/automations', optional: true },
  ];

  for (const route of routes) {
    const result = await inspectRoute(page, route, report);
    report.routeResults.push(result);

    if (route.name === 'lead-detail' && result.status === 'PASS') {
      if (opts.includeFullChecks) {
        await scanDeadButtons(page, report);
        await runDimensioningFlow(page, report);
      }
    }
  }

  if (report.result === 'FAIL' && opts.includeFullChecks) {
    // keep output for debugging, but still fail explicitly with collected reason
  }

  safeWrite(REPORT_PATH, buildReportMd(report));

  if (report.result === 'FAIL') {
    throw new Error(`UI validation failed. See ${REPORT_PATH}`);
  }
}

test('test:ui @smoke', async ({ page }) => {
  await runSuite(page, { includeFullChecks: false });
});

test('test:ui', async ({ page }) => {
  await runSuite(page, { includeFullChecks: true });
});

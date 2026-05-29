import { access, readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';

const files = {
  seedScript: 'apps/api/scripts/seed-admin.mjs',
  seedModule: 'apps/api/src/db/seedAdmin.ts',
  envExample: 'apps/api/.env.example',
  rootPackage: 'package.json',
  apiPackage: 'apps/api/package.json',
};

const failures = [];

async function readRequired(path) {
  try {
    await access(path);
    return await readFile(path, 'utf8');
  } catch {
    failures.push(`missing required file: ${path}`);
    return '';
  }
}

function hasSecretLeak(output, secrets) {
  return secrets.some((secret) => secret && output.includes(secret));
}

function buildSafeEnv(envOverrides) {
  const env = { ...process.env };
  for (const [key, value] of Object.entries(envOverrides)) {
    if (value === undefined || value === null) {
      delete env[key];
    } else {
      env[key] = value;
    }
  }
  return env;
}

function runSeedWithEnv(envOverrides) {
  return new Promise((resolve) => {
    const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    let child;
    try {
      child = spawn(npmBin, ['run', 'db:seed-admin'], {
        cwd: process.cwd(),
        env: buildSafeEnv(envOverrides),
        shell: true,
        windowsHide: true,
      });
    } catch (error) {
      resolve({ status: 1, stdout: '', stderr: error.message });
      return;
    }

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', (error) => {
      resolve({ status: 1, stdout, stderr: `${stderr}${error.message}` });
    });
    child.on('close', (status) => {
      resolve({ status, stdout, stderr });
    });
  });
}

async function expectValidationFailure(name, envOverrides, expectedPattern, secrets = []) {
  const result = await runSeedWithEnv(envOverrides);
  const output = `${result.stdout}\n${result.stderr}`;

  if (result.status === 0) {
    failures.push(`${name}: expected npm run db:seed-admin to fail`);
  }
  if (!expectedPattern.test(output)) {
    failures.push(`${name}: expected safe validation message matching ${expectedPattern}`);
  }
  if (/unsettled top-level await/i.test(output)) {
    failures.push(`${name}: output must not contain unsettled top-level await warning`);
  }
  if (/\$2[aby]\$\d{2}\$/i.test(output)) {
    failures.push(`${name}: output must not contain bcrypt hashes`);
  }
  if (hasSecretLeak(output, secrets)) {
    failures.push(`${name}: output must not contain provided secret values`);
  }
}

const [seedScript, seedModule, envExample, rootPackageRaw, apiPackageRaw] = await Promise.all([
  readRequired(files.seedScript),
  readRequired(files.seedModule),
  readRequired(files.envExample),
  readRequired(files.rootPackage),
  readRequired(files.apiPackage),
]);

let rootPackage = {};
let apiPackage = {};
try {
  rootPackage = JSON.parse(rootPackageRaw);
} catch {
  failures.push('root package.json must be valid JSON');
}
try {
  apiPackage = JSON.parse(apiPackageRaw);
} catch {
  failures.push('@enervita/api package.json must be valid JSON');
}

for (const envName of ['ADMIN_EMAIL', 'ADMIN_NAME', 'ADMIN_INITIAL_PASSWORD']) {
  if (!new RegExp(`^${envName}=`, 'm').test(envExample)) {
    failures.push(`missing ${envName} in apps/api/.env.example`);
  }
  if (!seedModule.includes(`process.env`) && !seedModule.includes(`env, '${envName}'`) && !seedModule.includes(`env[name]`)) {
    failures.push(`seed module must read ${envName} from process.env or injectable env`);
  }
}

if (!/bcryptjs/.test(seedModule) && !/argon2/.test(seedModule)) {
  failures.push('seed module must use bcryptjs or argon2 for password hashing');
}

if (!/hash\s*\(/.test(seedModule)) {
  failures.push('seed module must hash ADMIN_INITIAL_PASSWORD before storing it');
}

if (!/password_hash/i.test(seedModule)) {
  failures.push('seed module must store only password_hash');
}

if (/console\.(log|error|warn)\([^)]*ADMIN_INITIAL_PASSWORD/i.test(seedModule) || /console\.(log|error|warn)\([^)]*passwordHash/i.test(seedModule)) {
  failures.push('seed module must not log the initial password or password hash');
}

for (const sqlGuard of [
  'roles',
  'user_roles',
  'employee_profiles',
  'Admin already exists',
  'rollback',
  'connected',
  'transactionStarted',
]) {
  if (!seedModule.includes(sqlGuard)) failures.push(`seed module missing expected idempotent/admin behavior marker: ${sqlGuard}`);
}

if (!/select[\s\S]+roles[\s\S]+admin/i.test(seedModule)) {
  failures.push('seed module must check for an existing tenant admin role assignment before creating a user');
}

if (/process\.exit\(0\)/.test(seedModule) || /process\.exit\(0\)/.test(seedScript)) {
  failures.push('seed admin must not call process.exit(0) on idempotent success');
}

if (!/password_hash\s*=\s*\$4/i.test(seedModule)) {
  failures.push('existing same-tenant user promotion must update password_hash from ADMIN_INITIAL_PASSWORD');
}

if (rootPackage.scripts?.['db:seed-admin'] !== 'tsx apps/api/src/db/seedAdmin.ts') {
  failures.push('root package.json db:seed-admin must execute apps/api/src/db/seedAdmin.ts with tsx');
}
if (!rootPackage.scripts?.['test:seed-admin']) failures.push('root package.json must expose npm run test:seed-admin');
if (!apiPackage.dependencies?.bcryptjs) failures.push('@enervita/api package.json must depend on bcryptjs');
if (!apiPackage.dependencies?.pg) failures.push('@enervita/api package.json must depend on pg');
if (!apiPackage.devDependencies?.tsx) failures.push('@enervita/api package.json must include tsx as a devDependency');

if (!/seedInitialAdmin/.test(seedModule) || !/export\s+async\s+function\s+seedInitialAdmin/.test(seedModule)) {
  failures.push('apps/api/src/db/seedAdmin.ts must export the real seedInitialAdmin entrypoint');
}
if (/throw new Error\(['"]Use apps\/api\/scripts\/seed-admin\.mjs/.test(seedModule)) {
  failures.push('apps/api/src/db/seedAdmin.ts must not be a stub');
}
if (!/tsx/.test(seedScript) || !/src\/db\/seedAdmin\.ts/.test(seedScript.replaceAll('\\\\', '/'))) {
  failures.push('apps/api/scripts/seed-admin.mjs, if kept, must be a wrapper for the real TypeScript entrypoint');
}

await expectValidationFailure(
  'missing ADMIN_EMAIL validation',
  {
    DATABASE_URL: 'postgres://invalid:invalid@127.0.0.1:1/invalid',
    ADMIN_EMAIL: null,
    ADMIN_NAME: 'Safe Admin',
    ADMIN_INITIAL_PASSWORD: 'LocalOnlyPassword123!',
  },
  /Missing required environment variable: ADMIN_EMAIL/,
  ['LocalOnlyPassword123!'],
);

await expectValidationFailure(
  'short ADMIN_INITIAL_PASSWORD validation',
  {
    DATABASE_URL: 'postgres://invalid:invalid@127.0.0.1:1/invalid',
    ADMIN_EMAIL: 'safe-admin@example.test',
    ADMIN_NAME: 'Safe Admin',
    ADMIN_INITIAL_PASSWORD: 'tiny',
  },
  /ADMIN_INITIAL_PASSWORD must be at least 12 characters\./,
  ['tiny'],
);

if (failures.length > 0) {
  console.error('Seed admin contract validation failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Seed admin contract validation passed.');

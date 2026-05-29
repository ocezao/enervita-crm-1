import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import pg from 'pg';

const { Client } = pg;

const DEFAULT_DATABASE_URL = 'postgres://enervita:enervita@localhost:5432/enervita_crm';
const TENANT_SLUG = 'enervita';
const TENANT_NAME = 'Enervita';
const ADMIN_ROLE = 'admin';
const PASSWORD_MIN_LENGTH = 12;
const BCRYPT_ROUNDS = 12;

type SeedAdminEnv = Partial<Record<'DATABASE_URL' | 'ADMIN_EMAIL' | 'ADMIN_NAME' | 'ADMIN_INITIAL_PASSWORD', string>>;

function readRequiredEnv(env: SeedAdminEnv, name: keyof SeedAdminEnv): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function validateEmail(email: string): void {
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('ADMIN_EMAIL must be a valid email address.');
  }
}

function validateName(name: string): void {
  if (name.length < 2 || name.length > 120) {
    throw new Error('ADMIN_NAME must be between 2 and 120 characters.');
  }
}

function validatePassword(password: string): void {
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new Error(`ADMIN_INITIAL_PASSWORD must be at least ${PASSWORD_MIN_LENGTH} characters.`);
  }
}

export function printSeedAdminError(error: unknown): void {
  const safeError = error instanceof Error ? error : new Error(String(error));

  console.error('Admin seed failed.');
  console.error(safeError.message);

  if ('errors' in safeError && Array.isArray(safeError.errors)) {
    for (const nestedError of safeError.errors) {
      console.error(`- ${nestedError instanceof Error ? nestedError.message : String(nestedError)}`);
    }
  }
}

export async function seedInitialAdmin(env: SeedAdminEnv = process.env): Promise<void> {
  const adminEmail = readRequiredEnv(env, 'ADMIN_EMAIL').toLowerCase();
  const adminName = readRequiredEnv(env, 'ADMIN_NAME');
  const adminPassword = readRequiredEnv(env, 'ADMIN_INITIAL_PASSWORD');

  validateEmail(adminEmail);
  validateName(adminName);
  validatePassword(adminPassword);

  const databaseUrl = env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
  const client = new Client({ connectionString: databaseUrl });
  let connected = false;
  let transactionStarted = false;

  try {
    await client.connect();
    connected = true;

    await client.query('begin');
    transactionStarted = true;

    const tenantResult = await client.query(
      `insert into tenants (slug, name, status, metadata)
       values ($1, $2, 'active', '{"seededBy":"seed-admin"}'::jsonb)
       on conflict (slug) do update
         set name = excluded.name,
             status = 'active',
             updated_at = now()
       returning id`,
      [TENANT_SLUG, TENANT_NAME],
    );
    const tenantId = tenantResult.rows[0].id;

    const roleResult = await client.query(
      `insert into roles (tenant_id, name, description, is_system)
       values ($1, $2, 'Tenant administrator', true)
       on conflict (tenant_id, name) do update
         set description = excluded.description,
             is_system = true,
             updated_at = now()
       returning id`,
      [tenantId, ADMIN_ROLE],
    );
    const roleId = roleResult.rows[0].id;

    const existingAdminResult = await client.query(
      `select u.id
         from users u
         join user_roles ur on ur.tenant_id = u.tenant_id and ur.user_id = u.id
         join roles r on r.tenant_id = ur.tenant_id and r.id = ur.role_id
        where u.tenant_id = $1
          and r.name = $2
        limit 1`,
      [tenantId, ADMIN_ROLE],
    );

    if ((existingAdminResult.rowCount ?? 0) > 0) {
      await client.query('commit');
      transactionStarted = false;
      console.log('Admin already exists');
      return;
    }

    const existingUserResult = await client.query(
      `select id, tenant_id
         from users
        where lower(email) = lower($1)
        limit 1`,
      [adminEmail],
    );

    let userId: string;
    const passwordHash = await bcrypt.hash(adminPassword, BCRYPT_ROUNDS);

    if ((existingUserResult.rowCount ?? 0) > 0) {
      const existingUser = existingUserResult.rows[0];
      if (existingUser.tenant_id !== tenantId) {
        throw new Error('ADMIN_EMAIL is already used by another tenant.');
      }
      userId = existingUser.id;
      await client.query(
        `update users
            set name = $2,
                password_hash = $4,
                status = 'active',
                updated_at = now()
          where id = $1 and tenant_id = $3`,
        [userId, adminName, tenantId, passwordHash],
      );
    } else {
      const userResult = await client.query(
        `insert into users (tenant_id, name, email, password_hash, status, metadata)
         values ($1, $2, $3, $4, 'active', '{"seededBy":"seed-admin"}'::jsonb)
         returning id`,
        [tenantId, adminName, adminEmail, passwordHash],
      );
      userId = userResult.rows[0].id;
    }

    await client.query(
      `insert into user_roles (tenant_id, user_id, role_id, assigned_by)
       values ($1, $2, $3, $2)
       on conflict (tenant_id, user_id, role_id) do nothing`,
      [tenantId, userId, roleId],
    );

    await client.query(
      `insert into employee_profiles (tenant_id, user_id, employee_code, department, job_title, is_active, metadata)
       values ($1, $2, 'ADMIN-001', 'Administração', 'Administrador', true, '{"seededBy":"seed-admin"}'::jsonb)
       on conflict (user_id) do update
         set is_active = true,
             job_title = excluded.job_title,
             updated_at = now()`,
      [tenantId, userId],
    );

    await client.query('commit');
    transactionStarted = false;
    console.log('Admin seed completed');
  } catch (error) {
    if (connected && transactionStarted) {
      try {
        await client.query('rollback');
      } catch {
        // Ignore rollback failures; the original error is reported below.
      }
    }
    throw error;
  } finally {
    if (connected) {
      await client.end().catch(() => {});
    }
  }
}

const directRunPath = process.argv[1] === undefined ? undefined : resolve(process.argv[1]);
const isDirectRun = directRunPath !== undefined && fileURLToPath(import.meta.url) === directRunPath;

if (isDirectRun) {
  seedInitialAdmin().catch((error: unknown) => {
    printSeedAdminError(error);
    process.exitCode = 1;
  });
}

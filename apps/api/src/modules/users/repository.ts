import { PERMISSION_DEFINITIONS, PERMISSION_KEYS, PIPELINE_STAGE_KEYS } from '@enervita/shared';
import pg, { type PoolClient } from 'pg';
import type { CreateUserInput, UpdateUserInput } from './validation.ts';

const { Pool } = pg;
const BCRYPT_ROUNDS = 12;
const STAGE_PERMISSION_KEY = 'lead.stage_change';

export type AdminUserProfile = {
  id: string | null;
  employeeCode: string | null;
  department: string | null;
  jobTitle: string | null;
  managerUserId: string | null;
  hireDate: string | null;
  terminationDate: string | null;
  isActive: boolean | null;
};

export type AdminUser = {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  status: 'active' | 'inactive';
  roles: string[];
  permissions: string[];
  allowedStages: string[];
  profile: AdminUserProfile | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
};

export type AuditContext = {
  actorUserId: string;
  tenantId: string;
  ipAddress?: string;
  userAgent?: string;
};

export type UsersRepository = {
  listUsers(tenantId: string): Promise<AdminUser[]>;
  getUser(tenantId: string, userId: string): Promise<AdminUser | null>;
  createUser(context: AuditContext, input: CreateUserInput & { passwordHash: string }): Promise<AdminUser>;
  updateUser(context: AuditContext, userId: string, input: UpdateUserInput): Promise<AdminUser>;
  resetPassword(context: AuditContext, userId: string, passwordHash: string): Promise<AdminUser>;
  deleteUser(context: AuditContext, userId: string): Promise<AdminUser>;
  close?(): Promise<void>;
};

export class UsersConflictError extends Error {}
export class UsersNotFoundError extends Error {}
export class UsersOperationError extends Error {}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function rowToAdminUser(row: Record<string, unknown>): AdminUser {
  const profileId = row.profileId as string | null;
  const roles = normalizeStringArray(row.roles);
  const isAdmin = roles.includes('admin');

  return {
    id: row.id as string,
    tenantId: row.tenantId as string,
    name: row.name as string,
    email: row.email as string,
    status: row.status as 'active' | 'inactive',
    roles,
    permissions: isAdmin ? [...PERMISSION_KEYS] : normalizeStringArray(row.permissions),
    allowedStages: isAdmin ? [...PIPELINE_STAGE_KEYS] : normalizeStringArray(row.allowedStages),
    profile: profileId
      ? {
          id: profileId,
          employeeCode: row.employeeCode as string | null,
          department: row.department as string | null,
          jobTitle: row.jobTitle as string | null,
          managerUserId: row.managerUserId as string | null,
          hireDate: row.hireDate as string | null,
          terminationDate: row.terminationDate as string | null,
          isActive: row.profileIsActive as boolean | null,
        }
      : null,
    createdAt: row.createdAt as string,
    updatedAt: row.updatedAt as string,
    lastLoginAt: row.lastLoginAt as string | null,
  };
}

const userSelect = `select u.id,
                          u.tenant_id as "tenantId",
                          u.name,
                          u.email,
                          u.status,
                          u.created_at::text as "createdAt",
                          u.updated_at::text as "updatedAt",
                          u.last_login_at::text as "lastLoginAt",
                          ep.id as "profileId",
                          ep.employee_code as "employeeCode",
                          ep.department,
                          ep.job_title as "jobTitle",
                          ep.manager_user_id as "managerUserId",
                          ep.hire_date::text as "hireDate",
                          ep.termination_date::text as "terminationDate",
                          ep.is_active as "profileIsActive",
                          coalesce(array_agg(distinct r.name) filter (where r.name is not null), array[]::text[]) as roles,
                          coalesce(array_agg(distinct p.key) filter (where p.key is not null and up.effect = 'allow'), array[]::text[]) as permissions,
                          coalesce((
                            select array_agg(distinct usp.stage::text order by usp.stage::text)
                              from user_stage_permissions usp
                              join permissions stage_p on stage_p.id = usp.permission_id
                             where usp.tenant_id = u.tenant_id
                               and usp.user_id = u.id
                               and usp.effect = 'allow'
                               and stage_p.key = '${STAGE_PERMISSION_KEY}'
                          ), array[]::text[]) as "allowedStages"
                     from users u
                     left join employee_profiles ep on ep.tenant_id = u.tenant_id and ep.user_id = u.id
                     left join user_roles ur on ur.tenant_id = u.tenant_id and ur.user_id = u.id
                     left join roles r on r.tenant_id = ur.tenant_id and r.id = ur.role_id
                     left join user_permissions up on up.tenant_id = u.tenant_id and up.user_id = u.id
                     left join permissions p on p.id = up.permission_id`;

async function ensurePermissionCatalog(client: PoolClient): Promise<void> {
  for (const permission of PERMISSION_DEFINITIONS) {
    const [resource, ...actionParts] = permission.key.split('.');
    await client.query(
      `insert into permissions (key, resource, action, description)
       values ($1, $2, $3, $4)
       on conflict (key) do update
         set resource = excluded.resource,
             action = excluded.action,
             description = excluded.description`,
      [permission.key, resource, actionParts.join('.'), permission.label],
    );
  }
}

async function ensureRoles(client: PoolClient, tenantId: string, roles: string[], actorUserId: string): Promise<void> {
  for (const role of roles) {
    await client.query(
      `insert into roles (tenant_id, name, description, is_system)
       values ($1, $2, $3, false)
       on conflict (tenant_id, name) do update set updated_at = now()`,
      [tenantId, role, `${role} role`],
    );
  }
  await client.query('delete from user_roles where tenant_id = $1 and user_id = $2', [tenantId, actorUserId]);
  await client.query(
    `insert into user_roles (tenant_id, user_id, role_id, assigned_by)
     select $1, $2, r.id, $3
       from roles r
      where r.tenant_id = $1 and r.name = any($4::text[])
     on conflict do nothing`,
    [tenantId, actorUserId, actorUserId, roles],
  );
}

async function replaceRoles(client: PoolClient, tenantId: string, targetUserId: string, roles: string[], actorUserId: string): Promise<void> {
  for (const role of roles) {
    await client.query(
      `insert into roles (tenant_id, name, description, is_system)
       values ($1, $2, $3, false)
       on conflict (tenant_id, name) do update set updated_at = now()`,
      [tenantId, role, `${role} role`],
    );
  }
  await client.query('delete from user_roles where tenant_id = $1 and user_id = $2', [tenantId, targetUserId]);
  await client.query(
    `insert into user_roles (tenant_id, user_id, role_id, assigned_by)
     select $1, $2, r.id, $3
       from roles r
      where r.tenant_id = $1 and r.name = any($4::text[])
     on conflict do nothing`,
    [tenantId, targetUserId, actorUserId, roles],
  );
}

async function replacePermissions(client: PoolClient, tenantId: string, userId: string, permissions: string[], actorUserId: string): Promise<void> {
  await ensurePermissionCatalog(client);
  await client.query('delete from user_permissions where tenant_id = $1 and user_id = $2', [tenantId, userId]);
  await client.query(
    `insert into user_permissions (tenant_id, user_id, permission_id, effect, granted_by)
     select $1, $2, p.id, 'allow', $3
       from permissions p
      where p.key = any($4::text[])
     on conflict (tenant_id, user_id, permission_id) do update
       set effect = 'allow', granted_by = excluded.granted_by, granted_at = now(), expires_at = null`,
    [tenantId, userId, actorUserId, permissions],
  );
}

async function replaceAllowedStages(client: PoolClient, tenantId: string, userId: string, stages: string[], actorUserId: string): Promise<void> {
  await ensurePermissionCatalog(client);
  const permission = await client.query('select id from permissions where key = $1', [STAGE_PERMISSION_KEY]);
  const permissionId = permission.rows[0]?.id as string | undefined;
  if (!permissionId) throw new UsersOperationError('Stage permission catalog is unavailable');
  await client.query('delete from user_stage_permissions where tenant_id = $1 and user_id = $2', [tenantId, userId]);
  for (const stage of stages) {
    await client.query(
      `insert into user_stage_permissions (tenant_id, user_id, permission_id, stage, effect, granted_by)
       values ($1, $2, $3, $4::lead_stage, 'allow', $5)
       on conflict do nothing`,
      [tenantId, userId, permissionId, stage, actorUserId],
    );
  }
}

async function writeAudit(
  client: PoolClient,
  context: AuditContext,
  entityId: string,
  action: string,
  before: AdminUser | null,
  after: AdminUser | null,
): Promise<void> {
  await client.query(
    `insert into audit_logs (tenant_id, actor_user_id, entity_type, entity_id, action, before_data, after_data, ip_address, user_agent)
     values ($1, $2, 'user', $3, $4, $5::jsonb, $6::jsonb, nullif($7, '')::inet, $8)`,
    [
      context.tenantId,
      context.actorUserId,
      entityId,
      action,
      before ? JSON.stringify(before) : null,
      after ? JSON.stringify(after) : null,
      context.ipAddress ?? null,
      context.userAgent ?? null,
    ],
  );
}

async function selectOne(client: PoolClient, tenantId: string, userId: string): Promise<AdminUser | null> {
  const result = await client.query(
    `${userSelect}
      where u.tenant_id = $1 and u.id = $2
      group by u.id, ep.id
      limit 1`,
    [tenantId, userId],
  );
  return result.rows[0] ? rowToAdminUser(result.rows[0]) : null;
}

async function ensureOtherActiveAdmin(client: PoolClient, context: AuditContext, targetUserId: string, action: 'deactivate' | 'delete'): Promise<void> {
  if (targetUserId === context.actorUserId) {
    throw new UsersOperationError(action === 'delete' ? 'Cannot delete your own user' : 'Cannot deactivate your own user');
  }

  const roleResult = await client.query(
    `select count(*)::int as count
       from users u
       join user_roles ur on ur.tenant_id = u.tenant_id and ur.user_id = u.id
       join roles r on r.tenant_id = ur.tenant_id and r.id = ur.role_id
      where u.tenant_id = $1 and u.status = 'active' and r.name = 'admin' and u.id <> $2`,
    [context.tenantId, targetUserId],
  );
  if ((roleResult.rows[0]?.count ?? 0) < 1) {
    throw new UsersOperationError(action === 'delete' ? 'Cannot delete the last active admin' : 'Cannot deactivate the last active admin');
  }
}

async function ensureCanDeactivate(client: PoolClient, context: AuditContext, targetUserId: string, nextStatus?: 'active' | 'inactive'): Promise<void> {
  if (nextStatus !== 'inactive') return;
  await ensureOtherActiveAdmin(client, context, targetUserId, 'deactivate');
}

async function ensureCanDelete(client: PoolClient, context: AuditContext, targetUserId: string, target: AdminUser): Promise<void> {
  if (target.roles.includes('admin') || target.status === 'active') {
    await ensureOtherActiveAdmin(client, context, targetUserId, 'delete');
  }
}

export function createPgUsersRepository(databaseUrl: string): UsersRepository {
  const pool = new Pool({ connectionString: databaseUrl });

  return {
    async listUsers(tenantId) {
      const result = await pool.query(
        `${userSelect}
          where u.tenant_id = $1
          group by u.id, ep.id
          order by u.created_at desc`,
        [tenantId],
      );
      return result.rows.map(rowToAdminUser);
    },
    async getUser(tenantId, userId) {
      const client = await pool.connect();
      try {
        return await selectOne(client, tenantId, userId);
      } finally {
        client.release();
      }
    },
    async createUser(context, input) {
      const client = await pool.connect();
      try {
        await client.query('begin');
        const userResult = await client.query(
          `insert into users (tenant_id, name, email, password_hash, status)
           values ($1, $2, $3, $4, $5)
           returning id`,
          [context.tenantId, input.name, input.email, input.passwordHash, input.status],
        );
        const userId = userResult.rows[0].id as string;
        await client.query(
          `insert into employee_profiles (tenant_id, user_id, employee_code, department, job_title, manager_user_id, hire_date, termination_date, is_active)
           values ($1, $2, $3, $4, $5, $6, $7::date, $8::date, $9)`,
          [
            context.tenantId,
            userId,
            input.profile.employeeCode ?? null,
            input.profile.department ?? null,
            input.profile.jobTitle ?? null,
            input.profile.managerUserId ?? null,
            input.profile.hireDate ?? null,
            input.profile.terminationDate ?? null,
            input.profile.isActive ?? input.status === 'active',
          ],
        );
        await replaceRoles(client, context.tenantId, userId, input.roles, context.actorUserId);
        await replacePermissions(client, context.tenantId, userId, input.permissions, context.actorUserId);
        await replaceAllowedStages(client, context.tenantId, userId, input.allowedStages, context.actorUserId);
        const created = await selectOne(client, context.tenantId, userId);
        if (!created) throw new UsersNotFoundError('User not found after create');
        await writeAudit(client, context, userId, 'user.created', null, created);
        await client.query('commit');
        return created;
      } catch (error) {
        await client.query('rollback');
        if ((error as { code?: string }).code === '23505') throw new UsersConflictError('User email already exists');
        throw error;
      } finally {
        client.release();
      }
    },
    async updateUser(context, userId, input) {
      const client = await pool.connect();
      try {
        await client.query('begin');
        const before = await selectOne(client, context.tenantId, userId);
        if (!before) throw new UsersNotFoundError('User not found');
        await ensureCanDeactivate(client, context, userId, input.status);
        await client.query(
          `update users
              set name = coalesce($3, name),
                  email = coalesce($4, email),
                  status = coalesce($5, status),
                  updated_at = now()
            where tenant_id = $1 and id = $2`,
          [context.tenantId, userId, input.name ?? null, input.email ?? null, input.status ?? null],
        );
        if (input.profile) {
          await client.query(
            `insert into employee_profiles (tenant_id, user_id, employee_code, department, job_title, manager_user_id, hire_date, termination_date, is_active)
             values ($1, $2, $3, $4, $5, $6, $7::date, $8::date, coalesce($9, true))
             on conflict (user_id) do update
               set employee_code = coalesce(excluded.employee_code, employee_profiles.employee_code),
                   department = coalesce(excluded.department, employee_profiles.department),
                   job_title = coalesce(excluded.job_title, employee_profiles.job_title),
                   manager_user_id = coalesce(excluded.manager_user_id, employee_profiles.manager_user_id),
                   hire_date = coalesce(excluded.hire_date, employee_profiles.hire_date),
                   termination_date = coalesce(excluded.termination_date, employee_profiles.termination_date),
                   is_active = coalesce(excluded.is_active, employee_profiles.is_active),
                   updated_at = now()`,
            [
              context.tenantId,
              userId,
              input.profile.employeeCode ?? null,
              input.profile.department ?? null,
              input.profile.jobTitle ?? null,
              input.profile.managerUserId ?? null,
              input.profile.hireDate ?? null,
              input.profile.terminationDate ?? null,
              input.profile.isActive ?? null,
            ],
          );
        }
        if (input.roles) await replaceRoles(client, context.tenantId, userId, input.roles, context.actorUserId);
        if (input.permissions) await replacePermissions(client, context.tenantId, userId, input.permissions, context.actorUserId);
        if (input.allowedStages) await replaceAllowedStages(client, context.tenantId, userId, input.allowedStages, context.actorUserId);
        const after = await selectOne(client, context.tenantId, userId);
        if (!after) throw new UsersNotFoundError('User not found after update');
        await writeAudit(client, context, userId, 'user.updated', before, after);
        if (input.permissions || input.allowedStages) await writeAudit(client, context, userId, 'user.permissions_updated', before, after);
        await client.query('commit');
        return after;
      } catch (error) {
        await client.query('rollback');
        if ((error as { code?: string }).code === '23505') throw new UsersConflictError('User email already exists');
        throw error;
      } finally {
        client.release();
      }
    },
    async resetPassword(context, userId, passwordHash) {
      const client = await pool.connect();
      try {
        await client.query('begin');
        const before = await selectOne(client, context.tenantId, userId);
        if (!before) throw new UsersNotFoundError('User not found');
        await client.query('update users set password_hash = $3, updated_at = now() where tenant_id = $1 and id = $2', [
          context.tenantId,
          userId,
          passwordHash,
        ]);
        const after = await selectOne(client, context.tenantId, userId);
        if (!after) throw new UsersNotFoundError('User not found after reset');
        await writeAudit(client, context, userId, 'user.password_reset', before, after);
        await client.query('commit');
        return after;
      } catch (error) {
        await client.query('rollback');
        throw error;
      } finally {
        client.release();
      }
    },
    async deleteUser(context, userId) {
      const client = await pool.connect();
      try {
        await client.query('begin');
        const before = await selectOne(client, context.tenantId, userId);
        if (!before) throw new UsersNotFoundError('User not found');
        await ensureCanDelete(client, context, userId, before);
        await writeAudit(client, context, userId, 'user.deleted', before, null);
        const deleted = await client.query('delete from users where tenant_id = $1 and id = $2 returning id', [context.tenantId, userId]);
        if (deleted.rowCount !== 1) throw new UsersNotFoundError('User not found after delete');
        await client.query('commit');
        return before;
      } catch (error) {
        await client.query('rollback');
        throw error;
      } finally {
        client.release();
      }
    },
    async close() {
      await pool.end();
    },
  };
}

export { BCRYPT_ROUNDS, STAGE_PERMISSION_KEY };

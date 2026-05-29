import { PERMISSION_KEYS, PIPELINE_STAGE_KEYS } from '@enervita/shared';
import pg from 'pg';

const { Pool } = pg;

export type AuthUser = {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  passwordHash: string;
  roles: string[];
  permissions: string[];
  allowedStages: string[];
};

export type PublicUser = Omit<AuthUser, 'passwordHash'>;

export type UserRepository = {
  findActiveUserByEmail(email: string): Promise<AuthUser | null>;
  findActiveUserById(userId: string): Promise<AuthUser | null>;
  recordLogin(userId: string): Promise<void>;
  close?(): Promise<void>;
};

export function isAdminUser(user: Pick<AuthUser, 'roles'>): boolean {
  return user.roles.includes('admin');
}

export function toPublicUser(user: AuthUser): PublicUser {
  const isAdmin = isAdminUser(user);

  return {
    id: user.id,
    tenantId: user.tenantId,
    name: user.name,
    email: user.email,
    roles: user.roles,
    permissions: isAdmin ? [...PERMISSION_KEYS] : user.permissions,
    allowedStages: isAdmin ? [...PIPELINE_STAGE_KEYS] : user.allowedStages,
  };
}

export function createPgUserRepository(databaseUrl: string): UserRepository {
  const pool = new Pool({ connectionString: databaseUrl });

  async function findActiveUser(whereClause: string, value: string): Promise<AuthUser | null> {
    const result = await pool.query(
      `select u.id,
              u.tenant_id as "tenantId",
              u.name,
              u.email,
              u.password_hash as "passwordHash",
              coalesce(array_agg(distinct r.name) filter (where r.name is not null), array[]::text[]) as roles,
              coalesce(array_agg(distinct p.key) filter (
                where p.key is not null
                  and up.effect = 'allow'
                  and (up.expires_at is null or up.expires_at > now())
                  and not exists (
                    select 1
                      from user_permissions denied_up
                     where denied_up.tenant_id = u.tenant_id
                       and denied_up.user_id = u.id
                       and denied_up.permission_id = up.permission_id
                       and denied_up.effect = 'deny'
                       and (denied_up.expires_at is null or denied_up.expires_at > now())
                  )
              ), array[]::text[]) as permissions,
              coalesce((
                select array_agg(distinct usp.stage::text order by usp.stage::text)
                  from user_stage_permissions usp
                 where usp.tenant_id = u.tenant_id
                   and usp.user_id = u.id
                   and usp.effect = 'allow'
                   and (usp.expires_at is null or usp.expires_at > now())
                   and not exists (
                     select 1
                       from user_stage_permissions denied_usp
                      where denied_usp.tenant_id = usp.tenant_id
                        and denied_usp.user_id = usp.user_id
                        and denied_usp.stage = usp.stage
                        and denied_usp.effect = 'deny'
                        and (denied_usp.expires_at is null or denied_usp.expires_at > now())
                   )
              ), array[]::text[]) as "allowedStages"
         from users u
         left join user_roles ur on ur.tenant_id = u.tenant_id and ur.user_id = u.id
         left join roles r on r.tenant_id = ur.tenant_id and r.id = ur.role_id
         left join user_permissions up on up.tenant_id = u.tenant_id and up.user_id = u.id
         left join permissions p on p.id = up.permission_id
        where ${whereClause}
          and u.status = 'active'
          and u.password_hash is not null
        group by u.id, u.tenant_id, u.name, u.email, u.password_hash
        limit 1`,
      [value],
    );

    if ((result.rowCount ?? 0) === 0) return null;
    return result.rows[0] as AuthUser;
  }

  return {
    findActiveUserByEmail(email: string) {
      return findActiveUser('lower(u.email) = lower($1)', email);
    },
    findActiveUserById(userId: string) {
      return findActiveUser('u.id = $1', userId);
    },
    async recordLogin(userId: string) {
      await pool.query('update users set last_login_at = now(), updated_at = now() where id = $1', [userId]);
    },
    async close() {
      await pool.end();
    },
  };
}

import { PERMISSION_KEYS, PIPELINE_STAGE_KEYS } from '@enervita/shared';
import pg from 'pg';
import { saveAvatarToLocalUploads, type AvatarFileInput } from './avatarUpload.ts';

const { Pool } = pg;

export type AuthUser = {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  passwordHash: string;
  roles: string[];
  permissions: string[];
  allowedStages: string[];
  profile?: {
    department: string | null;
    jobTitle: string | null;
  } | null;
};

export type PublicUser = Omit<AuthUser, 'passwordHash'>;

export type UserRepository = {
  findActiveUserByEmail(email: string): Promise<AuthUser | null>;
  findActiveUserById(userId: string): Promise<AuthUser | null>;
  recordLogin(userId: string): Promise<void>;
  getSessionRevokedAtEpoch?(userId: string): Promise<number | null>;
  revokeSessions?(userId: string): Promise<void>;
  updateOwnProfile?(userId: string, input: { name?: string; email?: string; avatarUrl?: string | null }): Promise<AuthUser | null>;
  updateOwnPassword?(userId: string, passwordHash: string): Promise<AuthUser | null>;
  saveOwnAvatar?(userId: string, input: AvatarFileInput): Promise<AuthUser | null>;
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
    avatarUrl: user.avatarUrl ?? null,
    roles: user.roles,
    permissions: isAdmin ? [...PERMISSION_KEYS] : user.permissions,
    allowedStages: isAdmin ? [...PIPELINE_STAGE_KEYS] : user.allowedStages,
    profile: user.profile,
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
              nullif(u.metadata->>'avatarUrl', '') as "avatarUrl",
              u.password_hash as "passwordHash",
              case
                when ep.id is null then null
                else jsonb_build_object(
                  'department', ep.department,
                  'jobTitle', ep.job_title
                )
              end as profile,
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
         left join employee_profiles ep on ep.tenant_id = u.tenant_id and ep.user_id = u.id
         left join user_roles ur on ur.tenant_id = u.tenant_id and ur.user_id = u.id
         left join roles r on r.tenant_id = ur.tenant_id and r.id = ur.role_id
         left join user_permissions up on up.tenant_id = u.tenant_id and up.user_id = u.id
         left join permissions p on p.id = up.permission_id
        where ${whereClause}
          and u.status = 'active'
          and u.password_hash is not null
        group by u.id, u.tenant_id, u.name, u.email, u.metadata, u.password_hash, ep.id, ep.department, ep.job_title
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
    async getSessionRevokedAtEpoch(userId: string) {
      const result = await pool.query(
        `select nullif(metadata->>'sessionRevokedAtEpoch', '')::bigint as "sessionRevokedAtEpoch"
           from users
          where id = $1 and status = 'active'
          limit 1`,
        [userId],
      );
      const value = result.rows[0]?.sessionRevokedAtEpoch;
      return value == null ? null : Number(value);
    },
    async revokeSessions(userId: string) {
      await pool.query(
        `update users
            set metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{sessionRevokedAtEpoch}', to_jsonb(floor(extract(epoch from clock_timestamp()) * 1000)::bigint), true),
                updated_at = now()
          where id = $1 and status = 'active'`,
        [userId],
      );
    },
    async updateOwnProfile(userId: string, input: { name?: string; email?: string; avatarUrl?: string | null }) {
      const current = await this.findActiveUserById(userId);
      if (!current) return null;
      await pool.query(
        `update users
            set name = coalesce($2, name),
                email = coalesce($3, email),
                metadata = case
                  when $4::text is null then metadata - 'avatarUrl'
                  when $4::text = '__KEEP_AVATAR__' then metadata
                  else jsonb_set(metadata, '{avatarUrl}', to_jsonb($4::text), true)
                end,
                updated_at = now()
          where id = $1`,
        [userId, input.name ?? null, input.email ?? null, input.avatarUrl === undefined ? '__KEEP_AVATAR__' : input.avatarUrl],
      );
      return this.findActiveUserById(userId);
    },
    async updateOwnPassword(userId: string, passwordHash: string) {
      await pool.query('update users set password_hash = $2, updated_at = now() where id = $1 and status = \'active\'', [userId, passwordHash]);
      return this.findActiveUserById(userId);
    },
    async saveOwnAvatar(userId: string, input: AvatarFileInput) {
      const current = await this.findActiveUserById(userId);
      if (!current) return null;
      const avatarUrl = await saveAvatarToLocalUploads(userId, input);
      await pool.query(
        `update users
            set metadata = jsonb_set(metadata, '{avatarUrl}', to_jsonb($2::text), true),
                updated_at = now()
          where id = $1 and status = 'active'`,
        [userId, avatarUrl],
      );
      return this.findActiveUserById(userId);
    },
    async close() {
      await pool.end();
    },
  };
}

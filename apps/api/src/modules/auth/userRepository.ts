import pg from 'pg';

const { Pool } = pg;

export type AuthUser = {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  passwordHash: string;
  roles: string[];
};

export type PublicUser = Omit<AuthUser, 'passwordHash'>;

export type UserRepository = {
  findActiveUserByEmail(email: string): Promise<AuthUser | null>;
  findActiveUserById(userId: string): Promise<AuthUser | null>;
  recordLogin(userId: string): Promise<void>;
  close?(): Promise<void>;
};

export function toPublicUser(user: AuthUser): PublicUser {
  return {
    id: user.id,
    tenantId: user.tenantId,
    name: user.name,
    email: user.email,
    roles: user.roles,
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
              coalesce(array_agg(r.name order by r.name) filter (where r.name is not null), array[]::text[]) as roles
         from users u
         left join user_roles ur on ur.tenant_id = u.tenant_id and ur.user_id = u.id
         left join roles r on r.tenant_id = ur.tenant_id and r.id = ur.role_id
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

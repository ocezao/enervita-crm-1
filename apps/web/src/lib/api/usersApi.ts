export type AdminUserProfile = {
  id?: string | null;
  employeeCode?: string | null;
  department?: string | null;
  jobTitle?: string | null;
  managerUserId?: string | null;
  hireDate?: string | null;
  terminationDate?: string | null;
  isActive?: boolean | null;
};

export type AdminUser = {
  id: string;
  tenantId?: string;
  name: string;
  email: string;
  status: "active" | "inactive";
  roles: string[];
  permissions: string[];
  allowedStages: string[];
  profile: AdminUserProfile | null;
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string | null;
};

export type UserPayload = {
  name: string;
  email: string;
  status: "active" | "inactive";
  roles: string[];
  permissions: string[];
  allowedStages: string[];
  profile?: AdminUserProfile;
};

export type CreateUserPayload = UserPayload & { temporaryPassword: string };
export type UpdateUserPayload = Partial<UserPayload>;

async function parseError(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === "string" ? body.error : fallback;
  } catch {
    return fallback;
  }
}

async function request<T>(url: string, init?: RequestInit, fallback = "Operação não concluída."): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    headers: init?.body ? { "Content-Type": "application/json", ...(init.headers ?? {}) } : init?.headers,
    ...init,
  });
  if (!response.ok) throw new Error(await parseError(response, fallback));
  return (await response.json()) as T;
}

export const usersApi = {
  async list(): Promise<AdminUser[]> {
    const body = await request<{ users: AdminUser[] }>("/api/users", undefined, "Não foi possível carregar usuários.");
    return body.users;
  },
  async create(payload: CreateUserPayload): Promise<AdminUser> {
    const body = await request<{ user: AdminUser }>("/api/users", { method: "POST", body: JSON.stringify(payload) }, "Não foi possível criar usuário.");
    return body.user;
  },
  async get(id: string): Promise<AdminUser> {
    const body = await request<{ user: AdminUser }>(`/api/users/${id}`, undefined, "Não foi possível carregar usuário.");
    return body.user;
  },
  async update(id: string, payload: UpdateUserPayload): Promise<AdminUser> {
    const body = await request<{ user: AdminUser }>(`/api/users/${id}`, { method: "PATCH", body: JSON.stringify(payload) }, "Não foi possível atualizar usuário.");
    return body.user;
  },
  async resetPassword(id: string, temporaryPassword: string): Promise<AdminUser> {
    const body = await request<{ user: AdminUser }>(`/api/users/${id}/reset-password`, { method: "POST", body: JSON.stringify({ temporaryPassword }) }, "Não foi possível redefinir senha.");
    return body.user;
  },
};

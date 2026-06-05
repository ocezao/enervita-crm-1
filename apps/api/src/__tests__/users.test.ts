import assert from "node:assert/strict";
import { test } from "node:test";
import bcrypt from "bcryptjs";
import { createApp } from "../app.ts";
import { PERMISSION_KEYS, PIPELINE_STAGE_KEYS } from "@enervita/shared";
import type { AuthUser, UserRepository } from "../modules/auth/userRepository.ts";
import type { AdminUser, AuditContext, UsersRepository } from "../modules/users/repository.ts";
import type { CreateUserInput, UpdateUserInput } from "../modules/users/validation.ts";

const SESSION_SECRET = "test-secret-with-at-least-32-characters";

type TestUser = AuthUser & { status: "active" | "inactive" };

function makeAuthUser(overrides: Partial<TestUser> = {}): TestUser {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    tenantId: "22222222-2222-4222-8222-222222222222",
    name: "Admin Enervita",
    email: "admin@enervita.com.br",
    passwordHash: bcrypt.hashSync("SenhaSegura123!", 4),
    status: "active",
    roles: ["admin"],
    permissions: [],
    allowedStages: [],
    ...overrides,
  };
}

function makeUserRepository(user: TestUser | null): UserRepository {
  return {
    async findActiveUserByEmail(email: string) {
      return user && user.status === "active" && user.email.toLowerCase() === email.toLowerCase() ? user : null;
    },
    async findActiveUserById(id: string) {
      return user && user.status === "active" && user.id === id ? user : null;
    },
    async recordLogin() {},
  };
}

function makeAdminUser(overrides: Partial<AdminUser> = {}): AdminUser {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    tenantId: "22222222-2222-4222-8222-222222222222",
    name: "Funcionário Enervita",
    email: "funcionario@enervita.com.br",
    status: "active",
    roles: ["sdr"],
    permissions: ["lead.view"],
    allowedStages: ["novo_lead"],
    profile: {
      id: "44444444-4444-4444-8444-444444444444",
      employeeCode: "ENV-001",
      department: "Comercial",
      jobTitle: "SDR",
      managerUserId: null,
      hireDate: null,
      terminationDate: null,
      isActive: true,
    },
    createdAt: "2026-05-28T00:00:00.000Z",
    updatedAt: "2026-05-28T00:00:00.000Z",
    lastLoginAt: null,
    ...overrides,
  };
}

type FakeRepositoryOptions = {
  onCreate?: (context: AuditContext, input: CreateUserInput & { passwordHash: string }) => void;
  onUpdate?: (context: AuditContext, userId: string, input: UpdateUserInput) => void;
  onReset?: (context: AuditContext, userId: string, passwordHash: string) => void;
  onDelete?: (context: AuditContext, userId: string) => void;
};

function makeUsersRepository(options: FakeRepositoryOptions = {}): UsersRepository {
  const user = makeAdminUser();
  return {
    async listUsers(tenantId) {
      assert.equal(tenantId, user.tenantId);
      return [user];
    },
    async getUser(tenantId, userId) {
      assert.equal(tenantId, user.tenantId);
      return userId === user.id ? user : null;
    },
    async createUser(context, input) {
      options.onCreate?.(context, input);
      return makeAdminUser({
        id: "55555555-5555-4555-8555-555555555555",
        name: input.name,
        email: input.email,
        status: input.status,
        roles: input.roles,
        permissions: input.permissions,
        allowedStages: input.allowedStages,
      });
    },
    async updateUser(context, userId, input) {
      options.onUpdate?.(context, userId, input);
      return makeAdminUser({
        id: userId,
        name: input.name ?? user.name,
        email: input.email ?? user.email,
        status: input.status ?? user.status,
        roles: input.roles ?? user.roles,
        permissions: input.permissions ?? user.permissions,
        allowedStages: input.allowedStages ?? user.allowedStages,
      });
    },
    async resetPassword(context, userId, passwordHash) {
      options.onReset?.(context, userId, passwordHash);
      return makeAdminUser({ id: userId });
    },
    async deleteUser(context, userId) {
      options.onDelete?.(context, userId);
      return makeAdminUser({ id: userId });
    },
  };
}

async function loginAndGetCookie(app: ReturnType<typeof createApp>): Promise<string> {
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    headers: { "content-type": "application/json" },
    payload: { email: "admin@enervita.com.br", password: "SenhaSegura123!" },
  });
  assert.equal(login.statusCode, 200);
  return String(login.headers["set-cookie"]).split(";")[0];
}

test("GET /api/users requires authentication", async (t) => {
  const app = createApp({ userRepository: makeUserRepository(makeAuthUser()), usersRepository: makeUsersRepository(), sessionSecret: SESSION_SECRET });
  t.after(async () => app.close());

  const response = await app.inject({ method: "GET", url: "/api/users" });

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.json(), { error: "Authentication required" });
});

test("GET /api/users rejects authenticated users without user.manage", async (t) => {
  const actor = makeAuthUser({ roles: ["sdr"], permissions: [] });
  const app = createApp({ userRepository: makeUserRepository(actor), usersRepository: makeUsersRepository(), sessionSecret: SESSION_SECRET });
  t.after(async () => app.close());

  const cookie = await loginAndGetCookie(app);
  const response = await app.inject({ method: "GET", url: "/api/users", headers: { cookie } });

  assert.equal(response.statusCode, 403);
  assert.deepEqual(response.json(), { error: "Forbidden" });
});

test("GET /api/users lists sanitized users for admin", async (t) => {
  const app = createApp({ userRepository: makeUserRepository(makeAuthUser()), usersRepository: makeUsersRepository(), sessionSecret: SESSION_SECRET });
  t.after(async () => app.close());

  const cookie = await loginAndGetCookie(app);
  const response = await app.inject({ method: "GET", url: "/api/users", headers: { cookie } });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.users.length, 1);
  assert.equal(JSON.stringify(body).includes("password"), false);
  assert.deepEqual(body.users[0].permissions, ["lead.view"]);
});

test("GET /api/users exposes effective permissions and stages for admin-role users", async (t) => {
  const adminRecord = makeAdminUser({
    roles: ["admin"],
    permissions: [],
    allowedStages: [],
  });
  const usersRepository: UsersRepository = {
    async listUsers() { return [adminRecord]; },
    async getUser() { return adminRecord; },
    async createUser() { return adminRecord; },
    async updateUser() { return adminRecord; },
    async resetPassword() { return adminRecord; },
    async deleteUser() { return adminRecord; },
  };
  const app = createApp({ userRepository: makeUserRepository(makeAuthUser()), usersRepository, sessionSecret: SESSION_SECRET });
  t.after(async () => app.close());

  const cookie = await loginAndGetCookie(app);
  const response = await app.inject({ method: "GET", url: "/api/users", headers: { cookie } });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.deepEqual(body.users[0].permissions, [...PERMISSION_KEYS]);
  assert.deepEqual(body.users[0].allowedStages, [...PIPELINE_STAGE_KEYS]);
});

test("POST /api/users validates permission and stage keys", async (t) => {
  const app = createApp({ userRepository: makeUserRepository(makeAuthUser()), usersRepository: makeUsersRepository(), sessionSecret: SESSION_SECRET });
  t.after(async () => app.close());

  const cookie = await loginAndGetCookie(app);
  const invalidPermission = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: { cookie, "content-type": "application/json" },
    payload: { name: "Novo Usuário", email: "novo@enervita.com.br", temporaryPassword: "SenhaTemporaria123!", permissions: ["invalid.permission"], allowedStages: ["novo_lead"] },
  });
  assert.equal(invalidPermission.statusCode, 400);

  const invalidStage = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: { cookie, "content-type": "application/json" },
    payload: { name: "Novo Usuário", email: "novo@enervita.com.br", temporaryPassword: "SenhaTemporaria123!", permissions: ["lead.view"], allowedStages: ["etapa_invalida"] },
  });
  assert.equal(invalidStage.statusCode, 400);
});

test("POST /api/users creates user with hashed temporary password and sanitized response", async (t) => {
  let capturedHash = "";
  const app = createApp({
    userRepository: makeUserRepository(makeAuthUser()),
    usersRepository: makeUsersRepository({
      onCreate(_context, input) {
        capturedHash = input.passwordHash;
        assert.equal(input.temporaryPassword, "SenhaTemporaria123!");
        assert.notEqual(input.passwordHash, "SenhaTemporaria123!");
        assert.deepEqual(input.permissions, ["lead.view", "user.manage"]);
        assert.deepEqual(input.allowedStages, ["novo_lead", "qualificacao"]);
      },
    }),
    sessionSecret: SESSION_SECRET,
  });
  t.after(async () => app.close());

  const cookie = await loginAndGetCookie(app);
  const response = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: { cookie, "content-type": "application/json" },
    payload: {
      name: "Novo Usuário",
      email: "novo@enervita.com.br",
      temporaryPassword: "SenhaTemporaria123!",
      roles: ["sdr"],
      permissions: ["lead.view", "user.manage"],
      allowedStages: ["novo_lead", "qualificacao"],
      profile: { department: "Comercial", jobTitle: "SDR" },
    },
  });

  assert.equal(response.statusCode, 201);
  assert.equal(await bcrypt.compare("SenhaTemporaria123!", capturedHash), true);
  assert.equal(JSON.stringify(response.json()).includes("password"), false);
});

test("PATCH /api/users/:id updates permissions and allowed stages", async (t) => {
  const captured: { value?: UpdateUserInput } = {};
  const app = createApp({
    userRepository: makeUserRepository(makeAuthUser()),
    usersRepository: makeUsersRepository({ onUpdate(_context, _userId, input) { captured.value = input; } }),
    sessionSecret: SESSION_SECRET,
  });
  t.after(async () => app.close());

  const cookie = await loginAndGetCookie(app);
  const response = await app.inject({
    method: "PATCH",
    url: "/api/users/33333333-3333-4333-8333-333333333333",
    headers: { cookie, "content-type": "application/json" },
    payload: { permissions: ["lead.view"], allowedStages: ["novo_lead"], profile: { jobTitle: "Closer" } },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(captured.value?.permissions, ["lead.view"]);
  assert.deepEqual(captured.value?.allowedStages, ["novo_lead"]);
});

test("POST /api/users/:id/reset-password hashes password and never returns hash", async (t) => {
  let capturedHash = "";
  const app = createApp({
    userRepository: makeUserRepository(makeAuthUser()),
    usersRepository: makeUsersRepository({ onReset(_context, _userId, passwordHash) { capturedHash = passwordHash; } }),
    sessionSecret: SESSION_SECRET,
  });
  t.after(async () => app.close());

  const cookie = await loginAndGetCookie(app);
  const response = await app.inject({
    method: "POST",
    url: "/api/users/33333333-3333-4333-8333-333333333333/reset-password",
    headers: { cookie, "content-type": "application/json" },
    payload: { temporaryPassword: "NovaSenhaTemporaria123!" },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(await bcrypt.compare("NovaSenhaTemporaria123!", capturedHash), true);
  assert.equal(JSON.stringify(response.json()).includes("password"), false);
});


test("DELETE /api/users/:id deletes user and returns sanitized deleted record", async (t) => {
  const captured: { userId?: string; actorId?: string } = {};
  const app = createApp({
    userRepository: makeUserRepository(makeAuthUser()),
    usersRepository: makeUsersRepository({
      onDelete(context, userId) {
        captured.userId = userId;
        captured.actorId = context.actorUserId;
      },
    }),
    sessionSecret: SESSION_SECRET,
  });
  t.after(async () => app.close());

  const cookie = await loginAndGetCookie(app);
  const response = await app.inject({
    method: "DELETE",
    url: "/api/users/33333333-3333-4333-8333-333333333333",
    headers: { cookie },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(captured.userId, "33333333-3333-4333-8333-333333333333");
  assert.equal(captured.actorId, "11111111-1111-4111-8111-111111111111");
  assert.equal(response.json().user.id, "33333333-3333-4333-8333-333333333333");
  assert.equal(JSON.stringify(response.json()).includes("password"), false);
});

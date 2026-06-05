import assert from 'node:assert/strict';
import { test } from 'node:test';
import bcrypt from 'bcryptjs';
import { PERMISSION_KEYS, PIPELINE_STAGE_KEYS } from '@enervita/shared';
import { createApp } from '../app.ts';
import { requirePermission } from '../middleware/requireAuth.ts';

const SESSION_SECRET = 'test-secret-with-at-least-32-characters';

type TestUser = {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  passwordHash: string;
  status: 'active' | 'inactive';
  roles: string[];
  permissions: string[];
  allowedStages: string[];
  sessionRevokedAtEpoch?: number | null;
};

type AvatarFileInput = {
  fileName: string;
  mimeType: string;
  data: Buffer;
};

const uploadedAvatars: AvatarFileInput[] = [];

function makeUser(overrides: Partial<TestUser> = {}): TestUser {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    tenantId: '22222222-2222-2222-2222-222222222222',
    name: 'Admin Enervita',
    email: 'admin@enervita.com.br',
    avatarUrl: null,
    passwordHash: bcrypt.hashSync('SenhaSegura123!', 4),
    status: 'active',
    roles: ['admin'],
    permissions: [],
    allowedStages: [],
    ...overrides,
  };
}

function makeUserRepository(user: TestUser | null = makeUser()) {
  return {
    async findActiveUserByEmail(email: string) {
      if (!user || user.status !== 'active') return null;
      return user.email.toLowerCase() === email.toLowerCase() ? user : null;
    },
    async findActiveUserById(userId: string) {
      if (!user || user.status !== 'active') return null;
      return user.id === userId ? user : null;
    },
    async recordLogin(userId: string) {
      assert.equal(userId, user?.id);
    },
    async getSessionRevokedAtEpoch(userId: string) {
      if (!user || user.id !== userId) return null;
      return user.sessionRevokedAtEpoch ?? null;
    },
    async revokeSessions(userId: string) {
      assert.equal(userId, user?.id);
      if (user) user.sessionRevokedAtEpoch = Date.now();
    },
    async updateOwnProfile(userId: string, input: { name?: string; email?: string; avatarUrl?: string | null }) {
      assert.equal(userId, user?.id);
      if (!user) return null;
      if (input.name !== undefined) user.name = input.name;
      if (input.email !== undefined) user.email = input.email;
      if (input.avatarUrl !== undefined) user.avatarUrl = input.avatarUrl;
      return user;
    },
    async updateOwnPassword(userId: string, passwordHash: string) {
      assert.equal(userId, user?.id);
      if (!user) return null;
      user.passwordHash = passwordHash;
      return user;
    },
    async saveOwnAvatar(userId: string, input: AvatarFileInput) {
      assert.equal(userId, user?.id);
      uploadedAvatars.push(input);
      if (!user) return null;
      user.avatarUrl = `/uploads/avatars/${userId}-avatar.png`;
      return user;
    },
  };
}

async function loginAndGetCookie(app: ReturnType<typeof createApp>): Promise<string> {
  const login = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    headers: { 'content-type': 'application/json' },
    payload: { email: 'admin@enervita.com.br', password: 'SenhaSegura123!' },
  });
  assert.equal(login.statusCode, 200);
  return String(login.headers['set-cookie']).split(';')[0];
}

test('POST /api/auth/login rejects invalid credentials with generic error and no cookie', async (t) => {
  const app = createApp({ userRepository: makeUserRepository(), sessionSecret: SESSION_SECRET });
  t.after(async () => app.close());

  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    headers: { 'content-type': 'application/json' },
    payload: { email: 'admin@enervita.com.br', password: 'wrong-password' },
  });

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.json(), { error: 'Invalid email or password' });
  assert.equal(response.headers['set-cookie'], undefined);
});

test('POST /api/auth/login sets an httpOnly session cookie and does not return password_hash', async (t) => {
  const app = createApp({ userRepository: makeUserRepository(), sessionSecret: SESSION_SECRET });
  t.after(async () => app.close());

  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    headers: { 'content-type': 'application/json' },
    payload: { email: 'ADMIN@ENERVITA.COM.BR', password: 'SenhaSegura123!' },
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.deepEqual(body.user, {
    id: '11111111-1111-1111-1111-111111111111',
    tenantId: '22222222-2222-2222-2222-222222222222',
    name: 'Admin Enervita',
    email: 'admin@enervita.com.br',
    avatarUrl: null,
    roles: ['admin'],
    permissions: [...PERMISSION_KEYS],
    allowedStages: [...PIPELINE_STAGE_KEYS],
  });
  assert.equal(JSON.stringify(body).includes('password'), false);

  const setCookie = String(response.headers['set-cookie']);
  assert.match(setCookie, /^enervita_session=/);
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Lax/i);
  assert.doesNotMatch(setCookie, /SenhaSegura123!/);
});

test('GET /api/me requires a valid session cookie', async (t) => {
  const app = createApp({ userRepository: makeUserRepository(), sessionSecret: SESSION_SECRET });
  t.after(async () => app.close());

  const response = await app.inject({ method: 'GET', url: '/api/me' });

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.json(), { error: 'Authentication required' });
});

test('GET /api/me returns the current user from a valid session cookie', async (t) => {
  const app = createApp({ userRepository: makeUserRepository(), sessionSecret: SESSION_SECRET });
  t.after(async () => app.close());

  const cookie = await loginAndGetCookie(app);
  const response = await app.inject({ method: 'GET', url: '/api/me', headers: { cookie } });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json().user, {
    id: '11111111-1111-1111-1111-111111111111',
    tenantId: '22222222-2222-2222-2222-222222222222',
    name: 'Admin Enervita',
    email: 'admin@enervita.com.br',
    avatarUrl: null,
    roles: ['admin'],
    permissions: [...PERMISSION_KEYS],
    allowedStages: [...PIPELINE_STAGE_KEYS],
  });
});

test('POST /api/auth/logout clears the session cookie', async (t) => {
  const app = createApp({ userRepository: makeUserRepository(), sessionSecret: SESSION_SECRET });
  t.after(async () => app.close());

  const response = await app.inject({ method: 'POST', url: '/api/auth/logout' });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { ok: true });
  const setCookie = String(response.headers['set-cookie']);
  assert.match(setCookie, /^enervita_session=;/);
  assert.match(setCookie, /Max-Age=0/i);
  assert.match(setCookie, /HttpOnly/i);
});

test('POST /api/auth/logout revokes replay of the old session cookie', async (t) => {
  const app = createApp({ userRepository: makeUserRepository(), sessionSecret: SESSION_SECRET });
  t.after(async () => app.close());

  const cookie = await loginAndGetCookie(app);
  const logout = await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { cookie } });
  assert.equal(logout.statusCode, 200);

  const replay = await app.inject({ method: 'GET', url: '/api/me', headers: { cookie } });

  assert.equal(replay.statusCode, 401);
  assert.deepEqual(replay.json(), { error: 'Authentication required' });
});

test('POST /api/auth/login adds Secure when secure cookies are enabled', async (t) => {
  const app = createApp({
    userRepository: makeUserRepository(),
    sessionSecret: SESSION_SECRET,
    secureCookies: true,
  });
  t.after(async () => app.close());

  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    headers: { 'content-type': 'application/json' },
    payload: { email: 'admin@enervita.com.br', password: 'SenhaSegura123!' },
  });

  assert.equal(response.statusCode, 200);
  assert.match(String(response.headers['set-cookie']), /Secure/i);
});

test('POST /api/auth/login rate limits repeated invalid attempts', async (t) => {
  const app = createApp({ userRepository: makeUserRepository(), sessionSecret: SESSION_SECRET });
  t.after(async () => app.close());

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'content-type': 'application/json' },
      remoteAddress: '203.0.113.10',
      payload: { email: 'admin@enervita.com.br', password: 'wrong-password' },
    });
    assert.equal(response.statusCode, 401);
  }

  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    headers: { 'content-type': 'application/json' },
    remoteAddress: '203.0.113.10',
    payload: { email: 'admin@enervita.com.br', password: 'wrong-password' },
  });

  assert.equal(response.statusCode, 429);
  assert.deepEqual(response.json(), { error: 'Too many login attempts' });
});

test('GET /api/me rejects a tampered session cookie', async (t) => {
  const app = createApp({ userRepository: makeUserRepository(), sessionSecret: SESSION_SECRET });
  t.after(async () => app.close());

  const cookie = (await loginAndGetCookie(app)) + 'tampered';
  const response = await app.inject({ method: 'GET', url: '/api/me', headers: { cookie } });

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.json(), { error: 'Authentication required' });
});

test('POST /api/auth/login does not trust spoofed X-Forwarded-For for rate limiting', async (t) => {
  const app = createApp({ userRepository: makeUserRepository(), sessionSecret: SESSION_SECRET });
  t.after(async () => app.close());

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': `198.51.100.${attempt}` },
      remoteAddress: '203.0.113.20',
      payload: { email: 'admin@enervita.com.br', password: 'wrong-password' },
    });
    assert.equal(response.statusCode, 401);
  }

  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '198.51.100.200' },
    remoteAddress: '203.0.113.20',
    payload: { email: 'admin@enervita.com.br', password: 'wrong-password' },
  });

  assert.equal(response.statusCode, 429);
});

test('requirePermission allows admin users by bypass even without explicit permission', async (t) => {
  const repository = makeUserRepository(makeUser({ roles: ['admin'], permissions: [] }));
  const app = createApp({ userRepository: repository, sessionSecret: SESSION_SECRET });
  app.get('/api/test/user-manage', { preHandler: requirePermission('user.manage', { userRepository: repository, sessionSecret: SESSION_SECRET }) }, async () => ({ ok: true }));
  t.after(async () => app.close());

  const cookie = await loginAndGetCookie(app);
  const response = await app.inject({ method: 'GET', url: '/api/test/user-manage', headers: { cookie } });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { ok: true });
});

test('requirePermission rejects authenticated user without permission with generic 403', async (t) => {
  const user = makeUser({ roles: ['sdr'], permissions: [] });
  const repository = makeUserRepository(user);
  const app = createApp({ userRepository: repository, sessionSecret: SESSION_SECRET });
  app.get('/api/test/user-manage', { preHandler: requirePermission('user.manage', { userRepository: repository, sessionSecret: SESSION_SECRET }) }, async () => ({ ok: true }));
  t.after(async () => app.close());

  const cookie = await loginAndGetCookie(app);
  const response = await app.inject({ method: 'GET', url: '/api/test/user-manage', headers: { cookie } });

  assert.equal(response.statusCode, 403);
  assert.deepEqual(response.json(), { error: 'Forbidden' });
});

test('requirePermission allows authenticated user with user.manage permission', async (t) => {
  const user = makeUser({ roles: ['coordenador'], permissions: ['user.manage'] });
  const repository = makeUserRepository(user);
  const app = createApp({ userRepository: repository, sessionSecret: SESSION_SECRET });
  app.get('/api/test/user-manage', { preHandler: requirePermission('user.manage', { userRepository: repository, sessionSecret: SESSION_SECRET }) }, async () => ({ ok: true }));
  t.after(async () => app.close());

  const cookie = await loginAndGetCookie(app);
  const response = await app.inject({ method: 'GET', url: '/api/test/user-manage', headers: { cookie } });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { ok: true });
});

test('GET /api/me returns permissions and allowed stages without password hash', async (t) => {
  const user = makeUser({
    roles: ['sdr'],
    permissions: ['lead.view', 'user.manage'],
    allowedStages: ['novo_lead', 'qualificacao'],
  });
  const app = createApp({ userRepository: makeUserRepository(user), sessionSecret: SESSION_SECRET });
  t.after(async () => app.close());

  const cookie = await loginAndGetCookie(app);
  const response = await app.inject({ method: 'GET', url: '/api/me', headers: { cookie } });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.deepEqual(body.user.permissions, ['lead.view', 'user.manage']);
  assert.deepEqual(body.user.allowedStages, ['novo_lead', 'qualificacao']);
  assert.equal(JSON.stringify(body).includes('passwordHash'), false);
  assert.equal(JSON.stringify(body).includes('password_hash'), false);
});


test('PATCH /api/me lets the logged user update only their own personalization fields', async (t) => {
  const user = makeUser({ roles: ['sdr'], permissions: ['page.dashboard'], allowedStages: ['novo_lead'] });
  const app = createApp({ userRepository: makeUserRepository(user), sessionSecret: SESSION_SECRET });
  t.after(async () => app.close());

  const cookie = await loginAndGetCookie(app);
  const response = await app.inject({
    method: 'PATCH',
    url: '/api/me',
    headers: { cookie, 'content-type': 'application/json' },
    payload: { name: 'Maria SDR', email: 'maria@enervita.com.br', avatarUrl: 'https://cdn.enervita.test/maria.png', roles: ['admin'], permissions: ['user.manage'] },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json().user, {
    id: user.id,
    tenantId: user.tenantId,
    name: 'Maria SDR',
    email: 'maria@enervita.com.br',
    avatarUrl: 'https://cdn.enervita.test/maria.png',
    roles: ['sdr'],
    permissions: ['page.dashboard'],
    allowedStages: ['novo_lead'],
  });
});

test('PATCH /api/me rejects invalid self-service personalization payloads', async (t) => {
  const app = createApp({ userRepository: makeUserRepository(), sessionSecret: SESSION_SECRET });
  t.after(async () => app.close());

  const cookie = await loginAndGetCookie(app);
  const response = await app.inject({
    method: 'PATCH',
    url: '/api/me',
    headers: { cookie, 'content-type': 'application/json' },
    payload: { email: 'not-an-email' },
  });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.json(), { error: 'email must be valid' });
});
test('POST /api/me/avatar stores a local avatar upload for the logged user only', async (t) => {
  uploadedAvatars.length = 0;
  const user = makeUser({ roles: ['sdr'], permissions: ['page.dashboard'] });
  const app = createApp({ userRepository: makeUserRepository(user), sessionSecret: SESSION_SECRET });
  t.after(async () => app.close());

  const cookie = await loginAndGetCookie(app);
  const boundary = '----enervita-avatar-test';
  const payload = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="avatar"; filename="avatar.png"\r\nContent-Type: image/png\r\n\r\n`),
    Buffer.from('fake image bytes'),
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  const response = await app.inject({
    method: 'POST',
    url: '/api/me/avatar',
    headers: { cookie, 'content-type': `multipart/form-data; boundary=${boundary}` },
    payload,
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().user.avatarUrl, `/uploads/avatars/${user.id}-avatar.png`);
  assert.equal(uploadedAvatars.length, 1);
  assert.equal(uploadedAvatars[0]?.fileName, 'avatar.png');
  assert.equal(uploadedAvatars[0]?.mimeType, 'image/png');
  assert.deepEqual(uploadedAvatars[0]?.data, Buffer.from('fake image bytes'));
});

test('POST /api/me/avatar rejects non-image uploads', async (t) => {
  uploadedAvatars.length = 0;
  const app = createApp({ userRepository: makeUserRepository(), sessionSecret: SESSION_SECRET });
  t.after(async () => app.close());

  const cookie = await loginAndGetCookie(app);
  const boundary = '----enervita-avatar-invalid-test';
  const payload = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="avatar"; filename="avatar.txt"\r\nContent-Type: text/plain\r\n\r\nnot an image\r\n--${boundary}--\r\n`);

  const response = await app.inject({
    method: 'POST',
    url: '/api/me/avatar',
    headers: { cookie, 'content-type': `multipart/form-data; boundary=${boundary}` },
    payload,
  });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.json(), { error: 'avatar must be an image file' });
  assert.equal(uploadedAvatars.length, 0);
});

test('POST /api/me/password requires the current password before changing the logged user password', async (t) => {
  const user = makeUser({ roles: ['sdr'], permissions: ['page.dashboard'] });
  const app = createApp({ userRepository: makeUserRepository(user), sessionSecret: SESSION_SECRET });
  t.after(async () => app.close());

  const cookie = await loginAndGetCookie(app);
  const rejected = await app.inject({
    method: 'POST',
    url: '/api/me/password',
    headers: { cookie, 'content-type': 'application/json' },
    payload: { currentPassword: 'senha-errada', newPassword: 'NovaSenhaSegura123!' },
  });
  assert.equal(rejected.statusCode, 401);

  const accepted = await app.inject({
    method: 'POST',
    url: '/api/me/password',
    headers: { cookie, 'content-type': 'application/json' },
    payload: { currentPassword: 'SenhaSegura123!', newPassword: 'NovaSenhaSegura123!' },
  });

  assert.equal(accepted.statusCode, 200);
  assert.deepEqual(accepted.json(), { ok: true });
  assert.equal(await bcrypt.compare('NovaSenhaSegura123!', user.passwordHash), true);
});

test('GET /api/permissions/catalog requires login', async (t) => {
  const app = createApp({ userRepository: makeUserRepository(), sessionSecret: SESSION_SECRET });
  t.after(async () => app.close());

  const response = await app.inject({ method: 'GET', url: '/api/permissions/catalog' });

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.json(), { error: 'Authentication required' });
});

test('GET /api/permissions/catalog returns shared permissions catalog for logged user', async (t) => {
  const app = createApp({ userRepository: makeUserRepository(), sessionSecret: SESSION_SECRET });
  t.after(async () => app.close());

  const cookie = await loginAndGetCookie(app);
  const response = await app.inject({ method: 'GET', url: '/api/permissions/catalog', headers: { cookie } });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.ok(body.categories.user);
  assert.ok(body.permissions.some((permission: { key: string }) => permission.key === 'user.manage'));
  assert.ok(body.stages.some((stage: { key: string }) => stage.key === 'novo_lead'));
});

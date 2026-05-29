import assert from 'node:assert/strict';
import { test } from 'node:test';
import bcrypt from 'bcryptjs';
import { createApp } from '../app.ts';

const SESSION_SECRET = 'test-secret-with-at-least-32-characters';

type TestUser = {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  passwordHash: string;
  status: 'active' | 'inactive';
  roles: string[];
};

function makeUser(overrides: Partial<TestUser> = {}): TestUser {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    tenantId: '22222222-2222-2222-2222-222222222222',
    name: 'Admin Enervita',
    email: 'admin@enervita.com.br',
    passwordHash: bcrypt.hashSync('SenhaSegura123!', 4),
    status: 'active',
    roles: ['admin'],
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
  };
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
    roles: ['admin'],
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

  const login = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    headers: { 'content-type': 'application/json' },
    payload: { email: 'admin@enervita.com.br', password: 'SenhaSegura123!' },
  });
  const cookie = String(login.headers['set-cookie']).split(';')[0];

  const response = await app.inject({ method: 'GET', url: '/api/me', headers: { cookie } });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json().user, {
    id: '11111111-1111-1111-1111-111111111111',
    tenantId: '22222222-2222-2222-2222-222222222222',
    name: 'Admin Enervita',
    email: 'admin@enervita.com.br',
    roles: ['admin'],
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

  const login = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    headers: { 'content-type': 'application/json' },
    payload: { email: 'admin@enervita.com.br', password: 'SenhaSegura123!' },
  });
  const cookie = String(login.headers['set-cookie']).split(';')[0] + 'tampered';

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

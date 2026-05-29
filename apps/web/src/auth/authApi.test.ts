import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authApi } from './authApi';

describe('authApi', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('logs in using cookie credentials and returns the authenticated user', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ user: { id: 'u1', name: 'Cesar', email: 'cesar@example.com', role: 'admin' } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await authApi.login('cesar@example.com', 'senha-segura');

    expect(fetchMock).toHaveBeenCalledWith('/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'cesar@example.com', password: 'senha-segura' }),
    });
    expect(result.user).toEqual({ id: 'u1', name: 'Cesar', email: 'cesar@example.com', role: 'admin' });
  });

  it('returns null for /api/me when the API responds 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));

    await expect(authApi.me()).resolves.toBeNull();
  });

  it('logs out using cookie credentials', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await authApi.logout();

    expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
  });
});

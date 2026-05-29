import type { AuthUser, LoginResponse } from './authTypes';

async function parseError(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === 'string' ? body.error : fallback;
  } catch {
    return fallback;
  }
}

export const authApi = {
  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) throw new Error(await parseError(response, 'Não foi possível entrar.'));
    return (await response.json()) as LoginResponse;
  },
  async me(): Promise<AuthUser | null> {
    const response = await fetch('/api/me', { credentials: 'include' });
    if (response.status === 401) return null;
    if (!response.ok) throw new Error(await parseError(response, 'Não foi possível validar a sessão.'));
    const body = (await response.json()) as LoginResponse;
    return body.user;
  },
  async logout(): Promise<void> {
    const response = await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    if (!response.ok) throw new Error(await parseError(response, 'Não foi possível sair.'));
  },
};

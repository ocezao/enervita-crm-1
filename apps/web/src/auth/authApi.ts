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
  async updateProfile(payload: { name?: string; email?: string; avatarUrl?: string | null }): Promise<AuthUser> {
    const response = await fetch('/api/me', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(await parseError(response, 'Não foi possível atualizar perfil.'));
    const body = (await response.json()) as LoginResponse;
    return body.user;
  },
  async uploadAvatar(file: File): Promise<AuthUser> {
    const formData = new FormData();
    formData.append('avatar', file);
    const response = await fetch('/api/me/avatar', {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    if (!response.ok) throw new Error(await parseError(response, 'Não foi possível enviar a foto.'));
    const body = (await response.json()) as LoginResponse;
    return body.user;
  },
  async changePassword(payload: { currentPassword: string; newPassword: string }): Promise<void> {
    const response = await fetch('/api/me/password', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(await parseError(response, 'Não foi possível alterar senha.'));
  },
};

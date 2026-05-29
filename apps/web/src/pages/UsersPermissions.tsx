import { useEffect, useState } from 'react';
import { UserForm } from '../components/users/UserForm';
import { UserList } from '../components/users/UserList';
import { Button } from '../components/ui/Base';
import { PageHeader } from '../components/ui/LayoutComponents';
import { permissionsApi, type PermissionsCatalog } from '../lib/api/permissionsApi';
import { usersApi, type AdminUser, type CreateUserPayload, type UserPayload } from '../lib/api/usersApi';

export default function UsersPermissions() {
  const [catalog, setCatalog] = useState<PermissionsCatalog | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialData() {
      try {
        const [nextCatalog, nextUsers] = await Promise.all([permissionsApi.getCatalog(), usersApi.list()]);
        if (cancelled) return;
        setCatalog(nextCatalog);
        setUsers(nextUsers);
        setSelected(nextUsers[0] ?? null);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar usuários e permissões.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadInitialData();
    return () => { cancelled = true; };
  }, []);

  async function handleSubmit(payload: CreateUserPayload | UserPayload) {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const saved = selected
        ? await usersApi.update(selected.id, payload as UserPayload)
        : await usersApi.create(payload as CreateUserPayload);
      setUsers((current) => {
        const exists = current.some((user) => user.id === saved.id);
        return exists ? current.map((user) => user.id === saved.id ? saved : user) : [saved, ...current];
      });
      setSelected(saved);
      setSuccess(selected ? 'Usuário atualizado com sucesso.' : 'Usuário criado com sucesso.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar usuário.');
    } finally {
      setSaving(false);
    }
  }

  async function handleResetPassword(temporaryPassword: string) {
    if (!selected) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await usersApi.resetPassword(selected.id, temporaryPassword);
      setUsers((current) => current.map((user) => user.id === updated.id ? updated : user));
      setSelected(updated);
      setSuccess('Senha temporária definida com sucesso.');
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'Não foi possível redefinir senha.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuários e Permissões"
        description="Administre acesso às páginas, funções e etapas do funil."
        actions={<Button variant="outline" onClick={() => setSelected(null)}>Novo usuário</Button>}
      />

      {error && <div role="alert" className="rounded-xl border border-alert-red/20 bg-alert-red/5 px-4 py-3 text-sm text-alert-red">{error}</div>}
      {success && <div role="status" className="rounded-xl border border-energy-success/20 bg-mint-light/50 px-4 py-3 text-sm text-energy-success">{success}</div>}

      {loading && <div className="rounded-xl bg-white p-6 text-sm text-gray-500 shadow-sm">Carregando usuários e permissões...</div>}

      {!loading && catalog && (
        <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
          <UserList users={users} selectedId={selected?.id} onSelect={setSelected} onNew={() => setSelected(null)} />
          <UserForm key={selected?.id ?? 'new-user'} catalog={catalog} user={selected} saving={saving} onSubmit={handleSubmit} onResetPassword={selected ? handleResetPassword : undefined} />
        </div>
      )}
    </div>
  );
}

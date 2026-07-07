import { useEffect, useState } from 'react';
import { UserForm } from '../components/users/UserForm';
import { UserList } from '../components/users/UserList';
import { Badge, Button, Card } from '../components/ui/Base';
import { PageHeader } from '../components/ui/LayoutComponents';
import { permissionsApi, type PermissionsCatalog } from '../lib/api/permissionsApi';
import { usersApi, type AdminUser, type CreateUserPayload, type UserPayload } from '../lib/api/usersApi';

type UsersPermissionsProps = { embedded?: boolean };

export default function UsersPermissions({ embedded = false }: UsersPermissionsProps) {
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

  async function handleDeleteUser() {
    if (!selected) return;
    const confirmed = window.confirm(`Deletar o usuário ${selected.name}? Esta ação remove o acesso dele do CRM.`);
    if (!confirmed) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await usersApi.remove(selected.id);
      setUsers((current) => {
        const next = current.filter((user) => user.id !== selected.id);
        setSelected(next[0] ?? null);
        return next;
      });
      setSuccess('Usuário deletado com sucesso.');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Não foi possível deletar usuário.');
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
      {!embedded && (
        <PageHeader
          title="Usuários e acessos"
          description="Administre quem acessa o CRM, quais páginas cada pessoa vê e em quais etapas do funil pode atuar."
          actions={<Button variant="outline" onClick={() => setSelected(null)}>Novo usuário</Button>}
        />
      )}

      {embedded && (
        <Card className="relative overflow-hidden border-solar-orange/10 bg-gradient-to-br from-white via-white to-solar-orange/5 p-6 md:p-8">
          <div className="absolute -right-16 -top-20 h-44 w-44 rounded-full bg-orange-500/10 blur-3xl" />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <Badge variant="solar">Controle de acessos</Badge>
              <h2 className="mt-3 text-2xl md:text-3xl font-black text-text-primary tracking-tight">Usuários e acessos</h2>
              <p className="mt-2 text-sm md:text-base text-text-primary leading-relaxed">Liste todos os usuários, crie novos acessos, edite pessoas existentes e defina permissões por página, ação e etapa do funil comercial.</p>
            </div>
            <Button variant="outline" onClick={() => setSelected(null)} className="bg-bg-surface-1/80">Novo usuário</Button>
          </div>
        </Card>
      )}

      {error && <div role="alert" className="rounded-xl border border-alert-red/20 bg-red-500/5 px-4 py-3 text-sm text-alert-red">{error}</div>}
      {success && <div role="status" className="rounded-xl border border-energy-success/20 bg-mint-light/50 px-4 py-3 text-sm text-energy-success">{success}</div>}

      {loading && <div className="rounded-xl bg-bg-surface-1 p-6 text-sm text-text-secondary shadow-sm">Carregando usuários e permissões...</div>}

      {!loading && catalog && (
        <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
          <UserList users={users} selectedId={selected?.id} onSelect={setSelected} onNew={() => setSelected(null)} />
          <UserForm key={selected?.id ?? 'new-user'} catalog={catalog} user={selected} saving={saving} onSubmit={handleSubmit} onResetPassword={selected ? handleResetPassword : undefined} onDelete={selected ? handleDeleteUser : undefined} />
        </div>
      )}
    </div>
  );
}

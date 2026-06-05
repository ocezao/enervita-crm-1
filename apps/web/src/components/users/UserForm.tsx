import { useState } from 'react';
import type { PermissionsCatalog } from '../../lib/api/permissionsApi';
import type { AdminUser, CreateUserPayload, UserPayload } from '../../lib/api/usersApi';
import { Button, Card } from '../ui/Base';
import { PermissionCheckboxMatrix } from './PermissionCheckboxMatrix';
import { StagePermissionCheckboxes } from './StagePermissionCheckboxes';

type FormState = UserPayload & {
  temporaryPassword: string;
  jobTitle: string;
  department: string;
};

type Props = {
  catalog: PermissionsCatalog;
  user: AdminUser | null;
  saving: boolean;
  onSubmit: (payload: CreateUserPayload | UserPayload) => Promise<void>;
  onResetPassword?: (temporaryPassword: string) => Promise<void>;
  onDelete?: () => Promise<void>;
};

const emptyState: FormState = {
  name: '',
  email: '',
  status: 'active',
  roles: [],
  permissions: [],
  allowedStages: [],
  temporaryPassword: '',
  jobTitle: '',
  department: '',
};

function stateFromUser(user: AdminUser | null): FormState {
  if (!user) return emptyState;
  return {
    name: user.name,
    email: user.email,
    status: user.status,
    roles: user.roles ?? [],
    permissions: user.permissions ?? [],
    allowedStages: user.allowedStages ?? [],
    temporaryPassword: '',
    jobTitle: user.profile?.jobTitle ?? '',
    department: user.profile?.department ?? '',
  };
}

function toPayload(state: FormState, editing: boolean): CreateUserPayload | UserPayload {
  const base: UserPayload = {
    name: state.name.trim(),
    email: state.email.trim(),
    status: state.status,
    roles: state.roles,
    permissions: state.permissions,
    allowedStages: state.allowedStages,
    profile: {
      jobTitle: state.jobTitle.trim() || undefined,
      department: state.department.trim() || undefined,
      isActive: state.status === 'active',
    },
  };
  return editing ? base : { ...base, temporaryPassword: state.temporaryPassword };
}

export function UserForm({ catalog, user, saving, onSubmit, onResetPassword, onDelete }: Props) {
  const [state, setState] = useState<FormState>(() => stateFromUser(user));
  const [resetPassword, setResetPassword] = useState('');
  const editing = Boolean(user);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    await onSubmit(toPayload(state, editing));
    if (!editing) setState(emptyState);
  }

  async function handleResetPassword() {
    if (!resetPassword.trim() || !onResetPassword) return;
    await onResetPassword(resetPassword);
    setResetPassword('');
  }

  async function handleDelete() {
    if (!onDelete) return;
    await onDelete();
  }

  return (
    <Card className="p-5">
      <div className="mb-5">
        <h2 className="text-lg font-bold text-graphite">{editing ? 'Editar usuário' : 'Novo usuário'}</h2>
        <p className="text-xs text-gray-500">Defina dados, permissões e etapas permitidas. Senhas existentes nunca são exibidas.</p>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-graphite">Nome
            <input required value={state.name} onChange={(event) => setState({ ...state, name: event.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-solar-orange/30" />
          </label>
          <label className="text-sm font-medium text-graphite">E-mail
            <input required type="email" value={state.email} onChange={(event) => setState({ ...state, email: event.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-solar-orange/30" />
          </label>
          {!editing && (
            <label className="text-sm font-medium text-graphite">Senha temporária
              <input required type="password" value={state.temporaryPassword} onChange={(event) => setState({ ...state, temporaryPassword: event.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-solar-orange/30" />
            </label>
          )}
          <label className="text-sm font-medium text-graphite">Status
            <select value={state.status} onChange={(event) => setState({ ...state, status: event.target.value as 'active' | 'inactive' })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-solar-orange/30">
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
            </select>
          </label>
          <label className="text-sm font-medium text-graphite">Cargo
            <input value={state.jobTitle} onChange={(event) => setState({ ...state, jobTitle: event.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-solar-orange/30" />
          </label>
          <label className="text-sm font-medium text-graphite">Departamento
            <input value={state.department} onChange={(event) => setState({ ...state, department: event.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-solar-orange/30" />
          </label>
        </div>

        <section>
          <h3 className="mb-3 text-base font-bold text-graphite">Permissões</h3>
          <PermissionCheckboxMatrix catalog={catalog} selected={state.permissions} onChange={(permissions) => setState({ ...state, permissions })} />
        </section>

        <section>
          <h3 className="mb-3 text-base font-bold text-graphite">Etapas permitidas do funil</h3>
          <StagePermissionCheckboxes stages={catalog.stages} selected={state.allowedStages} onChange={(allowedStages) => setState({ ...state, allowedStages })} />
        </section>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar usuário'}</Button>
        </div>
      </form>

      {editing && onResetPassword && (
        <div className="mt-6 rounded-xl border border-alert-amber/20 bg-alert-amber/5 p-4">
          <h3 className="text-sm font-bold text-graphite">Redefinir senha</h3>
          <p className="mt-1 text-xs text-gray-500">Digite uma nova senha temporária. Nenhuma senha atual é exibida.</p>
          <div className="mt-3 flex gap-2">
            <input aria-label="Senha temporária para reset" type="password" value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-solar-orange/30" />
            <Button type="button" variant="outline" onClick={handleResetPassword} disabled={saving || !resetPassword.trim()}>Redefinir senha</Button>
          </div>
        </div>
      )}


      {editing && onDelete && (
        <div className="mt-4 rounded-xl border border-alert-red/20 bg-alert-red/5 p-4">
          <h3 className="text-sm font-bold text-alert-red">Deletar usuário</h3>
          <p className="mt-1 text-xs text-gray-500">Remove o acesso deste usuário do CRM. O sistema impede deletar o próprio usuário e protege o último admin ativo.</p>
          <div className="mt-3 flex justify-end">
            <Button type="button" variant="outline" onClick={handleDelete} disabled={saving} className="border-alert-red/30 text-alert-red hover:bg-alert-red/10">Deletar usuário</Button>
          </div>
        </div>
      )}
    </Card>
  );
}

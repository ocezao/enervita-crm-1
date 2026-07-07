import type { AdminUser } from '../../lib/api/usersApi';
import { ROLE_PROFILES, type RoleKey } from '@enervita/shared';
import { Badge, Button, Card } from '../ui/Base';

type Props = {
  users: AdminUser[];
  selectedId?: string;
  onSelect: (user: AdminUser) => void;
  onNew: () => void;
};

export function UserList({ users, selectedId, onSelect, onNew }: Props) {
  return (
    <Card className="p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-text-primary">Usuários</h2>
          <p className="text-xs text-text-secondary">{users.length} cadastrados</p>
        </div>
        <Button size="sm" onClick={onNew}>Novo</Button>
      </div>
      <div className="space-y-2" data-testid="users-list">
        {users.map((user) => (
          <button
            key={user.id}
            type="button"
            onClick={() => onSelect(user)}
            className={`w-full rounded-xl border p-3 text-left transition ${selectedId === user.id ? 'border-orange-500 bg-orange-500/5' : 'border-border-soft hover:bg-bg-surface-2/50'}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-text-primary">{user.name}</span>
              <Badge variant={user.status === 'active' ? 'success' : 'warning'}>{user.status === 'active' ? 'Ativo' : 'Inativo'}</Badge>
            </div>
            <p className="mt-1 truncate text-xs text-text-secondary">{user.email}</p>
            <p className="mt-1 text-[11px] font-semibold text-text-secondary">Área/Função: {user.profile?.department || 'sem área definida'}</p>
            <p className="mt-2 text-[11px] text-text-secondary">{user.permissions.length} permissões • {user.allowedStages.length} etapas</p>
          </button>
        ))}
      </div>
    </Card>
  );
}

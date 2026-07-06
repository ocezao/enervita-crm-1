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
          <h2 className="text-lg font-bold text-graphite">Usuários</h2>
          <p className="text-xs text-graphite-soft">{users.length} cadastrados</p>
        </div>
        <Button size="sm" onClick={onNew}>Novo</Button>
      </div>
      <div className="space-y-2" data-testid="users-list">
        {users.map((user) => (
          <button
            key={user.id}
            type="button"
            onClick={() => onSelect(user)}
            className={`w-full rounded-xl border p-3 text-left transition ${selectedId === user.id ? 'border-solar-orange bg-solar-orange/5' : 'border-warm-sand/50 hover:bg-warm-sand/50'}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-graphite">{user.name}</span>
              <Badge variant={user.status === 'active' ? 'success' : 'warning'}>{user.status === 'active' ? 'Ativo' : 'Inativo'}</Badge>
            </div>
            <p className="mt-1 truncate text-xs text-graphite-soft">{user.email}</p>
            <p className="mt-1 text-[11px] font-semibold text-graphite-soft">Área/Função: {user.profile?.department || 'sem área definida'}</p>
            <p className="mt-2 text-[11px] text-graphite-soft">{user.permissions.length} permissões • {user.allowedStages.length} etapas</p>
          </button>
        ))}
      </div>
    </Card>
  );
}

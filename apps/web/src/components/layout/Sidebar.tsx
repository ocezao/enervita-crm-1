import {
  LayoutDashboard,
  Users,
  Kanban,
  CheckSquare,
  Zap,
  Settings,
  Megaphone,
  FileText,
  Bot,
  UserCircle,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { userHasAnyPermission } from '../../auth/permissions';
import { useAuth } from '../../auth/useAuth';
import { cn } from '../../lib/utils';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/', requiredAny: ['page.dashboard'] },
  { icon: Users, label: 'Leads', path: '/leads', requiredAny: ['page.leads', 'lead.view'] },
  { icon: Kanban, label: 'Pipeline', path: '/pipeline', requiredAny: ['page.pipeline'] },
  { icon: CheckSquare, label: 'Tarefas', path: '/tasks', requiredAny: ['page.tasks'] },
  { icon: FileText, label: 'Propostas', path: '/proposals', requiredAny: ['page.proposals', 'proposal.view'] },
  { icon: Zap, label: 'Automações', path: '/automations', requiredAny: ['page.automations', 'automation.manage'] },
  { icon: Megaphone, label: 'Campanhas', path: '/ads', requiredAny: ['page.ads', 'ads.view'] },
  { icon: Bot, label: 'Assistente IA', path: '/ai', requiredAny: ['page.ai_assistant'] },
  { icon: UserCircle, label: 'Minha página', path: '/profile' },
  { icon: Settings, label: 'Configurações', path: '/settings', requiredAny: ['page.settings', 'settings.manage', 'user.manage'] },
];

export const Sidebar = () => {
  const { user } = useAuth();
  const visibleItems = navItems.filter((item) => !item.requiredAny || userHasAnyPermission(user, item.requiredAny));
  const initials = user?.name?.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'US';

  return (
    <aside data-crm-sidebar className="w-64 h-screen border-r border-border-soft bg-bg-surface-1 flex flex-col fixed left-0 top-0 z-20">
      <div className="px-6 py-5 flex items-center justify-center border-b border-border-hair">
        <img
          src="/brand/logo-enervita.webp"
          alt="Enervita"
          className="h-11 w-auto max-w-[170px] object-contain"
        />
      </div>

      <nav data-crm-sidebar-nav className="flex-1 px-4 py-4 space-y-1">
        {visibleItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group',
              isActive
                ? 'bg-orange-500/20 text-orange-400'
                : 'text-text-secondary hover:bg-bg-surface-2 hover:text-text-primary'
            )}
          >
            <item.icon size={20} className={cn('transition-colors shrink-0', 'group-hover:text-orange-400')} />
            <span data-crm-sidebar-label>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div data-crm-sidebar-user className="p-4 border-t border-border-hair">
        <div className="bg-glow-mint-soft p-4 rounded-2xl flex items-center gap-3">
          <div className="w-10 h-10 overflow-hidden rounded-full bg-mint-500 flex items-center justify-center text-white font-bold text-sm">
            {user?.avatarUrl ? <img src={user.avatarUrl} alt="Foto do perfil no menu" className="h-full w-full object-cover" /> : initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-text-primary truncate">{user?.name ?? 'Usuário'}</p>
            <p className="text-xs text-text-secondary truncate">{user?.email ?? 'Sessão ativa'}</p>
          </div>
        </div>
      </div>
    </aside>
  );
};

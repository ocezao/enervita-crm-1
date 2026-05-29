import {
  LayoutDashboard,
  Users,
  Kanban,
  CheckSquare,
  Zap,
  Settings,
  BarChart3,
  Link2,
  Sun,
  ShieldCheck,
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
  { icon: Zap, label: 'Automações', path: '/automations', requiredAny: ['page.automations', 'automation.manage'] },
  { icon: BarChart3, label: 'Analytics', path: '/analytics', requiredAny: ['page.analytics', 'analytics.view', 'tracking.view'] },
  { icon: Link2, label: 'Webhooks', path: '/webhooks', requiredAny: ['page.webhooks', 'webhook.manage', 'webhook.test'] },
  { icon: Settings, label: 'Configurações', path: '/settings', requiredAny: ['page.settings', 'settings.manage'] },
  { icon: ShieldCheck, label: 'Usuários e Permissões', path: '/users', requiredAny: ['page.users', 'user.manage'] },
];

export const Sidebar = () => {
  const { user } = useAuth();
  const visibleItems = navItems.filter((item) => !item.requiredAny || userHasAnyPermission(user, item.requiredAny));
  const initials = user?.name?.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'US';

  return (
    <aside className="w-64 h-screen border-r border-gray-100 bg-white flex flex-col fixed left-0 top-0 z-20">
      <div className="p-6 flex items-center gap-3">
        <div className="bg-solar-orange p-1.5 rounded-lg">
          <Sun className="text-white" size={24} fill="currentColor" />
        </div>
        <div>
          <h2 className="font-display font-bold text-lg leading-tight text-graphite">Cockpit</h2>
          <p className="text-[10px] uppercase tracking-widest text-solar-orange font-bold">Enervita Energia</p>
        </div>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-1">
        {visibleItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group',
              isActive
                ? 'bg-solar-orange/10 text-solar-orange'
                : 'text-gray-500 hover:bg-gray-50 hover:text-graphite'
            )}
          >
            <item.icon size={20} className={cn('transition-colors', 'group-hover:text-solar-orange')} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-50">
        <div className="bg-mint-light/50 p-4 rounded-2xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-energy-green flex items-center justify-center text-white font-bold text-sm">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-graphite truncate">{user?.name ?? 'Usuário'}</p>
            <p className="text-xs text-gray-500 truncate">{user?.email ?? 'Sessão ativa'}</p>
          </div>
        </div>
      </div>
    </aside>
  );
};

import { 
  LayoutDashboard, 
  Users, 
  Kanban, 
  CheckSquare, 
  Zap, 
  Settings, 
  BarChart3, 
  Link2,
  Sun
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { cn } from '../../lib/utils';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: Users, label: 'Leads', path: '/leads' },
  { icon: Kanban, label: 'Pipeline', path: '/pipeline' },
  { icon: CheckSquare, label: 'Tarefas', path: '/tasks' },
  { icon: Zap, label: 'Automações', path: '/automations' },
  { icon: BarChart3, label: 'Analytics', path: '/analytics' },
  { icon: Link2, label: 'Webhooks', path: '/webhooks' },
  { icon: Settings, label: 'Configurações', path: '/settings' },
];

export const Sidebar = () => {
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
        {navItems.map((item) => (
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
            JS
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-graphite truncate">Jules SDR</p>
            <p className="text-xs text-gray-500 truncate">Vendedor Senior</p>
          </div>
        </div>
      </div>
    </aside>
  );
};

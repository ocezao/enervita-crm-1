import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bell, Bot, Command, FileText, Kanban, LayoutDashboard, LogOut, Megaphone, Plus, Search, Settings, Sparkles, UserRound, Users, CheckSquare, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { userHasAnyPermission } from '../../auth/permissions';
import { Button } from '../ui/Base';
import { HttpCrmApi } from '../../lib/api/crmApi';
import type { Lead, Notification } from '../../lib/api/types';

type SearchSuggestion = {
  id: string;
  type: 'page' | 'subpage' | 'lead';
  label: string;
  description: string;
  path: string;
  keywords: string;
  icon: LucideIcon;
  requiredAny?: string[];
};

const pageSuggestions: SearchSuggestion[] = [
  { id: 'dashboard', type: 'page', label: 'Dashboard', description: 'Visão geral da operação comercial', path: '/', keywords: 'inicio home resumo indicadores kpi painel', icon: LayoutDashboard, requiredAny: ['page.dashboard'] },
  { id: 'leads', type: 'page', label: 'Leads', description: 'Lista de contatos e oportunidades', path: '/leads', keywords: 'contatos clientes oportunidades crm lista busca tags excluir editar', icon: Users, requiredAny: ['page.leads', 'lead.view'] },
  { id: 'pipeline', type: 'page', label: 'Pipeline', description: 'Funil comercial por etapa', path: '/pipeline', keywords: 'funil kanban etapas negociação qualificação proposta contrato perdido', icon: Kanban, requiredAny: ['page.pipeline'] },
  { id: 'tasks', type: 'page', label: 'Tarefas', description: 'Follow-ups e atividades atribuídas', path: '/tasks', keywords: 'tarefas follow up pendencias agenda atribuida responsavel vencimento', icon: CheckSquare, requiredAny: ['page.tasks'] },
  { id: 'proposals', type: 'page', label: 'Propostas', description: 'Propostas comerciais e simulações', path: '/proposals', keywords: 'propostas orçamento contrato economia simulação', icon: FileText, requiredAny: ['page.proposals', 'proposal.view'] },
  { id: 'automations', type: 'page', label: 'Automações', description: 'Fluxos e rotinas operacionais', path: '/automations', keywords: 'automacao automações n8n workflows fluxos gatilhos', icon: Zap, requiredAny: ['page.automations', 'automation.manage'] },
  { id: 'ads', type: 'page', label: 'Campanhas', description: 'Meta/Google Ads e mídia paga', path: '/ads', keywords: 'ads campanhas anúncios anuncios meta google trafego pago criativos', icon: Megaphone, requiredAny: ['page.ads', 'ads.view'] },
  { id: 'ai', type: 'page', label: 'Assistente IA', description: 'Perguntas sobre dados do CRM', path: '/ai', keywords: 'ia assistente inteligencia artificial chat pergunta dados', icon: Bot, requiredAny: ['page.ai_assistant'] },
  { id: 'settings', type: 'page', label: 'Configurações', description: 'Ajustes, usuários e permissões', path: '/settings', keywords: 'configuracoes ajustes usuários usuarios permissões permissoes aparência', icon: Settings, requiredAny: ['page.settings', 'settings.manage', 'user.manage'] },
  { id: 'settings-users', type: 'subpage', label: 'Usuários e permissões', description: 'Administrar equipe, funções e acessos', path: '/settings?tab=users', keywords: 'usuarios equipe permissoes permissões admin sdr etapas cargos', icon: UserRound, requiredAny: ['user.manage'] },
  { id: 'settings-appearance', type: 'subpage', label: 'Aparência do CRM', description: 'Logo, tema e identidade visual', path: '/settings?tab=appearance', keywords: 'aparencia aparência logo tema marca visual identidade', icon: Sparkles, requiredAny: ['page.settings', 'settings.manage', 'user.manage'] },
];

const crmApi = new HttpCrmApi();

function normalizeSearch(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function leadToSuggestion(lead: Lead): SearchSuggestion {
  const name = lead.contact?.name || 'Lead sem nome';
  const phone = lead.contact?.phone || '';
  const email = lead.contact?.email || '';
  const source = lead.leadSource || lead.contact?.source || '';
  return {
    id: `lead-${lead.id}`,
    type: 'lead',
    label: name,
    description: [phone, email, source, lead.stage].filter(Boolean).join(' · ') || 'Abrir lead',
    path: `/leads/${lead.id}`,
    keywords: [name, phone, email, source, lead.stage, lead.qualificationStatus, lead.utmCampaign, lead.utmSource, ...(lead.tags ?? []).map((tag) => tag.name)].filter(Boolean).join(' '),
    icon: Users,
    requiredAny: ['page.leads', 'lead.view'],
  };
}

export const Topbar = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadsLoaded, setLeadsLoaded] = useState(false);

  const visibleStaticSuggestions = useMemo(
    () => pageSuggestions.filter((item) => !item.requiredAny || userHasAnyPermission(user, item.requiredAny)),
    [user],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
        inputRef.current?.focus();
      }
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  useEffect(() => {
    if (!open || leadsLoaded || !userHasAnyPermission(user, ['page.leads', 'lead.view'])) return;
    crmApi.listLeads()
      .then((items) => setLeads(items.slice(0, 80)))
      .catch(() => setLeads([]))
      .finally(() => setLeadsLoaded(true));
  }, [open, leadsLoaded, user]);

  const refreshNotifications = useCallback(async () => {
    try {
      const data = await crmApi.listNotifications();
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {
      setNotifications([]);
      setUnreadCount(0);
    }
  }, []);

  useEffect(() => {
    void refreshNotifications();
  }, [refreshNotifications, user?.id]);

  useEffect(() => {
    if (!notificationsOpen) return;
    void refreshNotifications();
  }, [notificationsOpen, refreshNotifications]);

  const suggestions = useMemo(() => {
    const leadSuggestions = leads.map(leadToSuggestion);
    const all = [...visibleStaticSuggestions, ...leadSuggestions];
    const normalizedQuery = normalizeSearch(query);
    if (!normalizedQuery) return all.slice(0, 10);
    return all
      .map((item) => {
        const haystack = normalizeSearch(`${item.label} ${item.description} ${item.keywords}`);
        const starts = normalizeSearch(item.label).startsWith(normalizedQuery) ? 3 : 0;
        const contains = haystack.includes(normalizedQuery) ? 1 : 0;
        return { item, score: starts + contains };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || (a.item.type === 'lead' ? 1 : -1))
      .map(({ item }) => item)
      .slice(0, 12);
  }, [leads, query, visibleStaticSuggestions]);

  const goToSuggestion = (suggestion: SearchSuggestion) => {
    navigate(suggestion.path);
    setQuery('');
    setOpen(false);
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.readAt) {
      try {
        const updated = await crmApi.markNotificationRead(notification.id);
        setNotifications(prev => prev.map(item => item.id === notification.id ? updated : item));
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch {
        // Mantém a navegação mesmo se a leitura falhar.
      }
    }
    setNotificationsOpen(false);
    if (notification.href) navigate(notification.href);
  };

  const handleMarkAllNotificationsRead = async () => {
    try {
      await crmApi.markAllNotificationsRead();
      setNotifications(prev => prev.map(item => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })));
      setUnreadCount(0);
      void refreshNotifications();
    } catch {
      // Falha silenciosa: a lista será recarregada no próximo refresh.
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      navigate('/login', { replace: true });
    }
  };

  return (
    <header className="h-16 border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-10 px-8 flex items-center justify-between">
      <div className="flex items-center gap-4 w-1/3 min-w-[280px]">
        <div ref={wrapperRef} className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10" size={18} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder="Busque páginas, funções ou leads..."
            className="w-full bg-white border border-gray-200 rounded-xl py-2 pl-10 pr-14 text-sm focus:outline-none focus:ring-2 focus:ring-solar-orange/30 focus:border-solar-orange/50 transition-all"
            aria-label="Busca global"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 px-1.5 py-0.5 rounded border border-gray-200 bg-gray-50 text-[10px] text-gray-400">
            <Command size={10} /> K
          </div>

          {open && (
            <div className="absolute left-0 right-0 top-full mt-2 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl z-50">
              <div className="max-h-[420px] crm-scroll-panel overflow-y-auto p-2">
                {suggestions.length === 0 ? (
                  <div className="px-4 py-5 text-center text-sm text-gray-400">Nenhuma página ou lead encontrado.</div>
                ) : suggestions.map((suggestion) => {
                  const Icon = suggestion.icon;
                  return (
                    <button
                      key={suggestion.id}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => goToSuggestion(suggestion)}
                      className="w-full flex items-start gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-solar-orange/5 focus:bg-solar-orange/5 focus:outline-none transition-colors"
                    >
                      <div className="mt-0.5 h-8 w-8 rounded-xl bg-gray-50 flex items-center justify-center text-solar-orange shrink-0"><Icon size={16} /></div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-black text-graphite truncate">{suggestion.label}</p>
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold uppercase text-gray-400">{suggestion.type === 'lead' ? 'Lead' : suggestion.type === 'subpage' ? 'Subpágina' : 'Página'}</span>
                        </div>
                        <p className="mt-0.5 text-xs text-gray-500 truncate">{suggestion.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="border-t border-gray-50 px-3 py-2 text-[11px] text-gray-400">Digite nome, telefone, e-mail, página ou função. Clique em uma sugestão para abrir.</div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative">
          <Button variant="outline" size="icon" className="relative rounded-xl" aria-label="Notificações" title="Notificações" onClick={() => setNotificationsOpen(prev => !prev)}>
            <Bell size={20} className="text-gray-500" />
            {unreadCount > 0 && <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-alert-red px-1 text-[10px] font-black text-white">{unreadCount}</span>}
          </Button>
          {notificationsOpen && (
            <div className="absolute right-0 z-50 mt-3 w-80 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-gray-100 p-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-solar-orange">Notificações</p>
                  <p className="text-xs text-gray-500">{unreadCount} não lida{unreadCount === 1 ? '' : 's'}</p>
                </div>
                <button type="button" onClick={handleMarkAllNotificationsRead} className="text-xs font-bold text-energy-green hover:underline">Marcar todas</button>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="p-4 text-sm text-gray-500">Nenhuma notificação por enquanto.</p>
                ) : notifications.map((notification) => (
                  <button key={notification.id} type="button" onClick={() => handleNotificationClick(notification)} className="block w-full border-b border-gray-50 p-4 text-left hover:bg-gray-50">
                    <div className="flex items-start gap-3">
                      <span className={`mt-1 h-2 w-2 rounded-full ${notification.readAt ? 'bg-gray-200' : 'bg-solar-orange'}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-black text-graphite">{notification.title}</p>
                        {notification.body && <p className="mt-1 line-clamp-2 text-xs text-gray-500">{notification.body}</p>}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="hidden md:flex flex-col items-end leading-tight">
          <span className="text-sm font-semibold text-graphite">{user?.name ?? 'Operador'}</span>
          <span className="text-xs text-gray-400">{user?.email}</span>
        </div>
        <button type="button" onClick={() => navigate('/profile')} className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-energy-green text-sm font-black text-white ring-2 ring-white shadow-sm" aria-label="Abrir minha página">
          {user?.avatarUrl ? <img src={user.avatarUrl} alt="Foto do perfil no topo" className="h-full w-full object-cover" /> : (user?.name?.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'US')}
        </button>
        <div className="h-8 w-[1px] bg-gray-100 mx-2"></div>
        <Button variant="primary" className="gap-2 rounded-xl" onClick={() => navigate('/leads')} title="Abrir lista de leads">
          <Plus size={18} />
          <span>Leads</span>
        </Button>
        <Button variant="ghost" className="gap-2 rounded-xl" onClick={handleLogout}>
          <LogOut size={18} />
          <span>Sair</span>
        </Button>
      </div>
    </header>
  );
};

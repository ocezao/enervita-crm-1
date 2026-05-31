import { PageHeader } from '../components/ui/LayoutComponents';
import { Badge, Button, Card } from '../components/ui/Base';
import {
  User,
  Layers,
  Settings2,
  Link as LinkIcon,
  Database,
  Monitor,
  Workflow,
  CheckCircle2,
  ArrowRight,
  Target,
  Palette,
  LayoutDashboard,
  Eye,
  SlidersHorizontal,
  Sparkles,
  Moon,
  ShieldCheck,
  TableProperties,
  BellRing,
  MousePointer2,
  RotateCcw,
  Save,
  Wand2,
  SunMedium,
  PanelLeft,
  Type,
  Lock,
  Image as ImageIcon,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  type AppearanceSettings,
  type AppearancePresetId,
  applyAppearanceSettings,
  appearancePresets,
  defaultAppearanceSettings,
  loadAppearanceSettings,
  saveAppearanceSettings,
} from '../lib/appearance';
import { userHasAnyPermission } from '../auth/permissions';
import { useAuth } from '../auth/useAuth';
import { useAutomations, useLeads, useTasks, useWebhooks } from '../hooks/useCrm';
import UsersPermissions from './UsersPermissions';

type AnyIcon = typeof SunMedium;

export default function Settings() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const tabs = useMemo(() => [
    { id: 'general', label: 'Geral', icon: Settings2, requiredAny: ['page.settings', 'settings.manage'] },
    { id: 'users', label: 'Usuários', icon: User, requiredAny: ['user.manage'] },
    { id: 'pipeline', label: 'Etapas do Funil', icon: Layers, requiredAny: ['page.settings', 'settings.manage'] },
    { id: 'integrations', icon: LinkIcon, label: 'Integrações', requiredAny: ['page.settings', 'settings.manage'] },
    { id: 'appearance', label: 'Aparência', icon: Monitor, requiredAny: ['page.settings', 'settings.manage'] },
  ], []);

  const visibleTabs = useMemo(() => tabs.filter(tab => userHasAnyPermission(user, tab.requiredAny)), [tabs, user]);
  const requestedTab = searchParams.get('tab') ?? 'general';
  const activeTab = visibleTabs.some(tab => tab.id === requestedTab) ? requestedTab : visibleTabs[0]?.id ?? 'general';

  function openTab(tabId: string) {
    setSearchParams(tabId === 'general' ? {} : { tab: tabId });
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Configurações" description="Organize o CRM, a operação, as integrações e os acessos da equipe Enervita." />

      <div className="flex flex-col md:flex-row gap-8">
        <aside className="w-full md:w-64 space-y-1">
          {visibleTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => openTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab.id ? 'bg-solar-orange/10 text-solar-orange shadow-sm' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </aside>

        <main className="flex-1 min-w-0">
          {activeTab === 'general' && <GeneralSettings onOpenTab={openTab} />}
          {activeTab === 'users' && <UsersPermissions embedded />}
          {activeTab === 'pipeline' && <PipelineSettings />}
          {activeTab === 'appearance' && <AppearanceSettingsPanel />}
          {activeTab === 'integrations' && <IntegrationsSettings />}
          {activeTab !== 'general' && activeTab !== 'users' && activeTab !== 'pipeline' && activeTab !== 'appearance' && activeTab !== 'integrations' && (
            <Card className="p-12 text-center text-gray-400">Esta seção de configurações será implementada na versão final.</Card>
          )}
        </main>
      </div>
    </div>
  );
}

function GeneralSettings({ onOpenTab }: { onOpenTab: (tabId: string) => void }) {
  const { automations, loading: automationsLoading } = useAutomations();
  const { webhooks, deliveries, loading: webhooksLoading } = useWebhooks();

  const adminSummary = useMemo(() => {
    const activeAutomations = automations.filter(automation => automation.active).length;
    const failedDeliveries = deliveries.filter(delivery => delivery.status === 'failed').length;
    const activeWebhooks = webhooks.filter(webhook => webhook.status === 'active').length;
    return { activeAutomations, failedDeliveries, activeWebhooks };
  }, [automations, deliveries, webhooks]);

  const loading = automationsLoading || webhooksLoading;
  const [generalPrefs, setGeneralPrefs] = useState(() => {
    try { return JSON.parse(localStorage.getItem('enervita-crm-general-settings') ?? '{}') as { slaHours?: string; requireLostReason?: boolean; dailySummary?: boolean; defaultOwner?: string }; } catch { return {}; }
  });
  const [savedGeneral, setSavedGeneral] = useState(false);
  function updateGeneralPref(key: string, value: string | boolean) {
    setSavedGeneral(false);
    setGeneralPrefs(prev => ({ ...prev, [key]: value }));
  }
  function saveGeneralPrefs() {
    localStorage.setItem('enervita-crm-general-settings', JSON.stringify(generalPrefs));
    setSavedGeneral(true);
  }

  return (
    <div className="space-y-6">
      <Card className="relative overflow-hidden border-solar-orange/10 bg-gradient-to-br from-white via-white to-solar-orange/5">
        <div className="absolute -right-24 -top-28 h-64 w-64 rounded-full bg-solar-orange/10 blur-3xl" />
        <div className="absolute bottom-0 right-28 h-36 w-36 rounded-full bg-energy-green/10 blur-2xl" />
        <div className="relative p-6 md:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-3xl min-w-0">
            <div className="flex items-center gap-3 mb-3"><div className="p-2.5 rounded-2xl bg-solar-orange text-white shadow-lg shadow-solar-orange/20"><Settings2 size={22} /></div><Badge variant="solar">Controle total do administrador</Badge></div>
            <h3 className="text-2xl md:text-3xl font-black text-graphite tracking-tight">Central de Administração</h3>
            <p className="text-sm md:text-base text-gray-600 mt-2 leading-relaxed">Defina padrões comerciais, regras de governança, alertas e atalhos seguros para controlar o CRM da Enervita sem expor páginas ou funções para quem não tem permissão.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 min-w-0 w-full lg:w-auto lg:min-w-[280px]">
            <AdminMetric label="Leads ativos" value="CRM" tone="solar" />
            <AdminMetric label="SLA comercial" value="Ativo" tone="success" />
            <AdminMetric label="Automações" value={loading ? '...' : adminSummary.activeAutomations} tone="green" />
            <AdminMetric label="Webhooks" value={loading ? '...' : adminSummary.activeWebhooks} tone={adminSummary.failedDeliveries > 0 ? 'danger' : 'green'} />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
        <div className="space-y-6 min-w-0">
          <Card className="p-6">
            <SectionTitle icon={Settings2} title="Empresa e operação" description="Dados-base que orientam relatórios, atendimento e padrões do CRM." />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
              <Field label="Nome da empresa"><input readOnly className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-50" value="Enervita Energia Solar" /></Field>
              <Field label="E-mail de suporte"><input readOnly className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-50" value="contato@enervita.com.br" /></Field>
              <Field label="Fuso horário"><input readOnly className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-50" value="Brasília (GMT-3)" /></Field>
              <Field label="Moeda e idioma"><input readOnly className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-50" value="pt-BR / BRL" /></Field>
              <Field label="Horário comercial padrão" hint="Usado como referência para SLA e alertas."><input readOnly className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-50" value="Segunda a sexta, 08:00 às 18:00" /></Field>
              <Field label="Equipe responsável padrão" hint="Novos leads sem dono entram para triagem comercial."><input readOnly className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-50" value="Comercial / SDR Enervita" /></Field>
            </div>
          </Card>

          <Card className="p-6">
            <SectionTitle icon={SlidersHorizontal} title="Preferências operacionais" description="Configurações funcionais salvas neste CRM para orientar a operação do gestor." />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
              <Field label="SLA do primeiro contato" hint="Usado como referência visual para alertas e rotina comercial."><select value={generalPrefs.slaHours ?? '4'} onChange={event => updateGeneralPref('slaHours', event.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white"><option value="1">Até 1 hora</option><option value="4">Até 4 horas</option><option value="24">Até 24 horas</option></select></Field>
              <Field label="Responsável padrão" hint="Texto de referência para novos cadastros sem dono definido."><input value={generalPrefs.defaultOwner ?? 'Comercial / SDR Enervita'} onChange={event => updateGeneralPref('defaultOwner', event.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white" /></Field>
              <label className="rounded-2xl border border-gray-100 p-4 bg-gray-50/60 flex items-center justify-between gap-3"><span><strong className="block text-sm text-graphite">Exigir motivo de perda</strong><small className="text-xs text-gray-500">Regra administrativa para manter aprendizado comercial.</small></span><input type="checkbox" checked={generalPrefs.requireLostReason ?? true} onChange={event => updateGeneralPref('requireLostReason', event.target.checked)} /></label>
              <label className="rounded-2xl border border-gray-100 p-4 bg-gray-50/60 flex items-center justify-between gap-3"><span><strong className="block text-sm text-graphite">Resumo diário do gestor</strong><small className="text-xs text-gray-500">Deixa a preferência pronta para automação aprovada.</small></span><input type="checkbox" checked={generalPrefs.dailySummary ?? false} onChange={event => updateGeneralPref('dailySummary', event.target.checked)} /></label>
            </div>
            <div className="mt-5 flex items-center gap-3"><Button variant="primary" size="sm" className="gap-2" onClick={saveGeneralPrefs}><Save size={15} /> Salvar Geral</Button>{savedGeneral && <Badge variant="success">Preferências salvas</Badge>}</div>
          </Card>

          <Card className="p-6">
            <SectionTitle icon={Target} title="Padrões comerciais" description="Regras simples para manter o funil limpo e previsível." />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
              <PolicyCard icon={Layers} title="Entrada de novos leads" text="Todo lead novo entra em Novo lead e deve receber origem, cidade, valor de conta e tipo de imóvel quando disponíveis." />
              <PolicyCard icon={BellRing} title="Primeiro contato" text="Gestor deve acompanhar leads sem contato rápido; tarefas vencidas e leads parados aparecem como prioridade." />
              <PolicyCard icon={CheckCircle2} title="Qualificação obrigatória" text="Antes de proposta: telefone, cidade/UF, concessionária, valor de conta e contexto de decisão." />
              <PolicyCard icon={Workflow} title="Governança do funil" text="Mudanças críticas de etapa devem deixar histórico; motivo de perda e próxima ação são regras administrativas." />
            </div>
          </Card>

          <Card className="p-6">
            <SectionTitle icon={BellRing} title="Alertas administrativos" description="O que o administrador deve monitorar diariamente." />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
              <AlertRule title="Lead sem follow-up" status="Ativo" detail="Sinalizar oportunidades sem próxima tarefa ou sem movimentação recente." />
              <AlertRule title="Webhook com falha" status={adminSummary.failedDeliveries > 0 ? `${adminSummary.failedDeliveries} falha(s)` : 'Sem falhas'} detail="Monitorar integrações antes que automações parem em silêncio." danger={adminSummary.failedDeliveries > 0} />
              <AlertRule title="Resumo do gestor" status="Planejado" detail="Resumo diário por e-mail/WhatsApp via automação autorizada." />
            </div>
          </Card>
        </div>

        <aside className="xl:sticky xl:top-6 space-y-4">
          <Card className="p-5">
            <h4 className="text-sm font-black text-graphite mb-2">Atalhos do administrador</h4>
            <p className="text-xs text-gray-500 leading-relaxed mb-4">Só aparece para quem tem acesso à área de Configurações. Cada submenu continua respeitando a permissão própria.</p>
            <div className="space-y-2">
              <AdminShortcut icon={User} title="Usuários e permissões" description="Liberar páginas, funções e etapas por funcionário." onClick={() => onOpenTab('users')} />
              <AdminShortcut icon={Layers} title="Etapas do funil" description="Revisar SLA, dono, entrada e saída por etapa." onClick={() => onOpenTab('pipeline')} />
              <AdminShortcut icon={LinkIcon} title="Integrações" description="Acompanhar webhooks, automações e chaves." onClick={() => onOpenTab('integrations')} />
              <AdminShortcut icon={Monitor} title="Aparência" description="Ajustar leitura, marca e modo executivo." onClick={() => onOpenTab('appearance')} />
            </div>
          </Card>

          <Card className="p-5 border-energy-green/20 bg-energy-green/5">
            <div className="flex items-center gap-3 mb-3"><div className="p-2 rounded-xl bg-energy-green text-white"><ShieldCheck size={17} /></div><div><h4 className="text-sm font-black text-graphite">Regra de acesso aplicada</h4><p className="text-xs text-gray-500">Nada deve aparecer sem permissão.</p></div></div>
            <ul className="space-y-2 text-xs text-gray-600 leading-relaxed">
              <li>• Menu lateral filtra páginas liberadas.</li>
              <li>• Submenus filtram funções administrativas.</li>
              <li>• API continua bloqueando ações sensíveis no servidor.</li>
              <li>• Administração de usuários exige permissão específica.</li>
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function AdminMetric({ label, value, tone }: { label: string; value: string | number; tone: 'solar' | 'green' | 'success' | 'danger' }) {
  const toneClass = tone === 'danger' ? 'text-red-600 bg-red-50' : tone === 'success' ? 'text-energy-green bg-energy-green/10' : tone === 'green' ? 'text-energy-green bg-mint-light/60' : 'text-solar-orange bg-solar-orange/10';
  return <div className={`min-w-0 rounded-2xl p-3 ${toneClass}`}><p className="break-words text-[10px] font-black uppercase tracking-wide opacity-80">{label}</p><p className="break-words text-2xl font-black mt-1">{value}</p></div>;
}
function PolicyCard({ icon: Icon, title, text }: { icon: AnyIcon; title: string; text: string }) { return <div className="rounded-2xl border border-gray-100 p-4 bg-white"><div className="flex items-start gap-3"><div className="p-2 rounded-xl bg-solar-orange/10 text-solar-orange"><Icon size={17} /></div><div><p className="font-bold text-sm text-graphite">{title}</p><p className="text-xs text-gray-500 leading-relaxed mt-1">{text}</p></div></div></div>; }
function AlertRule({ title, status, detail, danger = false }: { title: string; status: string; detail: string; danger?: boolean }) { return <div className={`rounded-2xl border p-4 ${danger ? 'border-red-100 bg-red-50/60' : 'border-gray-100 bg-gray-50/50'}`}><Badge variant={danger ? 'error' : 'success'}>{status}</Badge><p className="font-bold text-sm text-graphite mt-3">{title}</p><p className="text-xs text-gray-500 leading-relaxed mt-1">{detail}</p></div>; }
function AdminShortcut({ icon: Icon, title, description, onClick }: { icon: AnyIcon; title: string; description: string; onClick: () => void }) { return <button aria-label="Abrir atalho administrativo" onClick={onClick} className="w-full text-left rounded-2xl border border-gray-100 p-3 hover:border-solar-orange/30 hover:bg-solar-orange/5 transition-all"><div className="flex items-start gap-3"><div className="p-2 rounded-xl bg-gray-100 text-graphite"><Icon size={16} /></div><div><p className="text-sm font-bold text-graphite">{title}</p><p className="text-xs text-gray-500 leading-relaxed mt-0.5">{description}</p></div></div></button>; }

const presetCards: Array<{ id: AppearancePresetId; name: string; description: string; icon: AnyIcon; badge: string }> = [
  { id: 'enervita', name: 'Enervita Comercial', description: 'Visual oficial: claro, solar, familiar para operação diária.', icon: SunMedium, badge: 'Padrão' },
  { id: 'executive', name: 'Mesa do Gestor', description: 'Mais contraste, menos ruído e leitura rápida para diretoria.', icon: ShieldCheck, badge: 'Gestão' },
  { id: 'focus', name: 'Foco SDR', description: 'Espaçamento maior, dicas visíveis e CTAs mais claros para atendimento.', icon: MousePointer2, badge: 'Equipe' },
  { id: 'night', name: 'Operação Noturna', description: 'Base discreta, alto contraste e movimentos reduzidos para longas sessões.', icon: Moon, badge: 'Conforto' },
];

function AppearanceSettingsPanel() {
  const [settings, setSettings] = useState<AppearanceSettings>(() => loadAppearanceSettings());
  const [saved, setSaved] = useState(false);

  useEffect(() => applyAppearanceSettings(settings), [settings]);

  const completion = useMemo(() => {
    const enabled = [settings.showHints, settings.highContrast, settings.reduceMotion, settings.compactTables, settings.highlightOverdue, settings.executiveMode].filter(Boolean).length;
    return Math.round(((enabled + 7) / 13) * 100);
  }, [settings]);

  function update<K extends keyof AppearanceSettings>(key: K, value: AppearanceSettings[K]) {
    setSaved(false);
    setSettings(prev => ({ ...prev, [key]: value }));
  }

  function selectPreset(id: AppearancePresetId) {
    setSaved(false);
    setSettings(prev => ({ ...prev, ...appearancePresets[id], companyName: prev.companyName }));
  }

  function handleSave() {
    saveAppearanceSettings(settings);
    applyAppearanceSettings(settings);
    setSaved(true);
  }

  function handleReset() {
    setSettings(defaultAppearanceSettings);
    saveAppearanceSettings(defaultAppearanceSettings);
    applyAppearanceSettings(defaultAppearanceSettings);
    setSaved(false);
  }

  return (
    <div className="space-y-6">
      <Card className="relative overflow-hidden border-solar-orange/10 bg-gradient-to-br from-white via-white to-solar-orange/5">
        <div className="absolute -right-20 -top-24 h-56 w-56 rounded-full bg-solar-orange/10 blur-3xl" />
        <div className="absolute right-24 bottom-0 h-32 w-32 rounded-full bg-energy-green/10 blur-2xl" />
        <div className="relative p-6 md:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-3xl min-w-0">
            <div className="flex items-center gap-3 mb-3"><div className="p-2.5 rounded-2xl bg-solar-orange text-white shadow-lg shadow-solar-orange/20"><Palette size={22} /></div><Badge variant="solar">Personalização visual</Badge></div>
            <h3 className="text-2xl md:text-3xl font-black text-graphite tracking-tight">Aparência do CRM</h3>
            <p className="text-sm md:text-base text-gray-600 mt-2 leading-relaxed">Ajuste o visual do Cockpit em camadas: presets rápidos, cores, layout, leitura e recursos avançados sem deixar nada escapar do container.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={handleReset} className="gap-2 bg-white/70"><RotateCcw size={16} /> Restaurar padrão</Button>
            <Button onClick={handleSave} className="gap-2"><Save size={16} /> {saved ? 'Aparência salva' : 'Salvar aparência'}</Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
        <div className="space-y-6 min-w-0">
          <Card className="p-6">
            <SectionTitle icon={Wand2} title="1. Comece por um preset" description="Opções prontas para diferentes formas de usar o CRM." />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-5">
              {presetCards.map(preset => {
                const Icon = preset.icon;
                const presetValues = appearancePresets[preset.id];
                const active = settings.preset === preset.id;
                return (
                  <button key={preset.id} onClick={() => selectPreset(preset.id)} className={`text-left rounded-2xl border p-4 transition-all ${active ? 'border-solar-orange bg-solar-orange/5 shadow-sm' : 'border-gray-100 hover:border-solar-orange/30 hover:bg-gray-50'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3"><div className={`p-2.5 rounded-xl ${active ? 'bg-solar-orange text-white' : 'bg-gray-100 text-gray-500'}`}><Icon size={18} /></div><div><p className="font-bold text-graphite">{preset.name}</p><Badge variant={active ? 'solar' : 'default'}>{preset.badge}</Badge></div></div>
                      <div className="flex -space-x-1 pt-1">{[presetValues.primaryColor, presetValues.secondaryColor, presetValues.graphiteColor].map(color => <span key={color} className="h-5 w-5 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: color }} />)}</div>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed mt-3">{preset.description}</p>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card className="p-6">
            <SectionTitle icon={SlidersHorizontal} title="2. Personalização básica" description="Controles simples que qualquer gestor entende sem mexer em código." />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
              <Field label="Nome exibido no CRM" hint="Aparece em preview, relatórios e cabeçalhos futuros."><input className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-solar-orange/30" value={settings.companyName} onChange={event => update('companyName', event.target.value)} /></Field>
              <Field label="Estilo dos cantos" hint="Altera a sensação visual dos cards e modais."><SegmentedControl value={settings.corners} options={[{ value: 'soft', label: 'Suave' }, { value: 'rounded', label: 'Redondo' }, { value: 'sharp', label: 'Reto' }]} onChange={value => update('corners', value as AppearanceSettings['corners'])} /></Field>
              <ColorField label="Cor principal" value={settings.primaryColor} onChange={value => update('primaryColor', value)} />
              <ColorField label="Cor secundária" value={settings.secondaryColor} onChange={value => update('secondaryColor', value)} />
              <ColorField label="Grafite / texto forte" value={settings.graphiteColor} onChange={value => update('graphiteColor', value)} />
              <ColorField label="Fundo do sistema" value={settings.backgroundColor} onChange={value => update('backgroundColor', value)} />
            </div>
          </Card>

          <Card className="p-6">
            <SectionTitle icon={LayoutDashboard} title="3. Layout e navegação" description="Ajustes intermediários para deixar o CRM confortável por perfil." />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
              <OptionCard icon={PanelLeft} title="Menu lateral" description="Navegação explicativa ou compacta."><SegmentedControl value={settings.navigation} options={[{ value: 'expanded', label: 'Completo' }, { value: 'compact', label: 'Compacto' }, { value: 'icons', label: 'Ícones' }]} onChange={value => update('navigation', value as AppearanceSettings['navigation'])} /></OptionCard>
              <OptionCard icon={TableProperties} title="Densidade" description="Mais espaço ou mais dados por tela."><SegmentedControl value={settings.density} options={[{ value: 'comfortable', label: 'Normal' }, { value: 'compact', label: 'Densa' }, { value: 'spacious', label: 'Ampla' }]} onChange={value => update('density', value as AppearanceSettings['density'])} /></OptionCard>
              <OptionCard icon={Eye} title="Orientação" description="Dicas contextuais para novos usuários."><Toggle checked={settings.showHints} label="Mostrar dicas no CRM" onChange={value => update('showHints', value)} /></OptionCard>
              <OptionCard icon={Type} title="Tamanho do texto" description="Ajuste fino para leitura em notebook, monitor ou TV."><SegmentedControl value={settings.fontScale} options={[{ value: 'normal', label: 'Normal' }, { value: 'large', label: 'Grande' }, { value: 'extra', label: 'Extra' }]} onChange={value => update('fontScale', value as AppearanceSettings['fontScale'])} /></OptionCard>
              <OptionCard icon={LayoutDashboard} title="Largura do conteúdo" description="Use tela cheia ou centralize para foco executivo."><SegmentedControl value={settings.contentWidth} options={[{ value: 'fluid', label: 'Tela cheia' }, { value: 'focused', label: 'Focada' }]} onChange={value => update('contentWidth', value as AppearanceSettings['contentWidth'])} /></OptionCard>
              <OptionCard icon={Sparkles} title="Estilo dos cards" description="Mude a profundidade visual sem quebrar os dados."><SegmentedControl value={settings.cardStyle} options={[{ value: 'flat', label: 'Plano' }, { value: 'soft', label: 'Sombra' }, { value: 'glass', label: 'Vidro' }]} onChange={value => update('cardStyle', value as AppearanceSettings['cardStyle'])} /></OptionCard>
            </div>
          </Card>

          <Card className="p-6">
            <SectionTitle icon={Sparkles} title="4. Recursos avançados" description="Acessibilidade, produtividade e governança visual." />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
              <AdvancedToggle icon={ShieldCheck} title="Alto contraste" description="Aumenta legibilidade para reuniões, projetores e telas ruins." checked={settings.highContrast} onChange={value => update('highContrast', value)} />
              <AdvancedToggle icon={Moon} title="Movimento reduzido" description="Diminui transições para quem usa o CRM por muitas horas." checked={settings.reduceMotion} onChange={value => update('reduceMotion', value)} />
              <AdvancedToggle icon={TableProperties} title="Tabelas compactas" description="Mostra mais leads, propostas e eventos sem rolagem excessiva." checked={settings.compactTables} onChange={value => update('compactTables', value)} />
              <AdvancedToggle icon={BellRing} title="Prioridade para atrasos" description="Destaca leads parados, tarefas vencidas e propostas sem retorno." checked={settings.highlightOverdue} onChange={value => update('highlightOverdue', value)} />
              <AdvancedToggle icon={LayoutDashboard} title="Modo executivo" description="Reduz detalhes técnicos e privilegia KPIs, funil e próximos passos." checked={settings.executiveMode} onChange={value => update('executiveMode', value)} />
              <div className="rounded-2xl border border-dashed border-gray-200 p-4 bg-gray-50/70"><div className="flex items-center gap-3 mb-3"><div className="p-2 rounded-xl bg-white text-gray-500 border border-gray-100"><Lock size={17} /></div><div><p className="font-bold text-sm text-graphite">Governança futura</p><p className="text-xs text-gray-500">Avançado com aprovação do administrador.</p></div></div><ul className="space-y-2 text-xs text-gray-500"><li className="flex gap-2"><ImageIcon size={14} /> Upload de logo por unidade</li><li className="flex gap-2"><Type size={14} /> Biblioteca de fontes da marca</li><li className="flex gap-2"><Palette size={14} /> Temas por perfil de usuário</li></ul></div>
            </div>
          </Card>
        </div>
        <aside className="xl:sticky xl:top-6 space-y-4"><AppearancePreview settings={settings} completion={completion} /><Card className="p-5"><h4 className="text-sm font-black text-graphite mb-3">Leitura operacional</h4><div className="space-y-3 text-xs text-gray-600"><Insight label="Básico" text="Cores, nome, cantos e identidade visual." /><Insight label="Intermediário" text="Densidade, menu, dicas e conforto de navegação." /><Insight label="Avançado" text="Acessibilidade, modo executivo, prioridade de atrasos e regras por perfil." /></div></Card></aside>
      </div>
    </div>
  );
}

function SectionTitle({ icon: Icon, title, description }: { icon: AnyIcon; title: string; description: string }) { return <div className="flex items-start gap-3"><div className="p-2.5 rounded-2xl bg-gray-100 text-graphite"><Icon size={19} /></div><div><h3 className="text-lg font-black text-graphite">{title}</h3><p className="text-sm text-gray-500 mt-1">{description}</p></div></div>; }
function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) { return <label className="space-y-2 block"><span className="text-sm font-bold text-gray-700">{label}</span>{children}{hint && <span className="block text-xs text-gray-400 leading-relaxed">{hint}</span>}</label>; }
function isHexColor(value: string) { return /^#[0-9a-fA-F]{6}$/.test(value); }
function safeHex(value: string) { return isHexColor(value) ? value : '#F58220'; }
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <Field label={label}><div className="flex items-center gap-3 border border-gray-200 rounded-xl p-2 bg-white max-w-full overflow-hidden"><input aria-label={label} type="color" value={safeHex(value)} onChange={event => onChange(event.target.value)} className="h-9 w-11 shrink-0 rounded-lg border-none bg-transparent cursor-pointer" /><input value={value.toUpperCase()} maxLength={7} onChange={event => onChange(event.target.value.startsWith('#') ? event.target.value : `#${event.target.value}`)} onBlur={() => { if (!isHexColor(value)) onChange('#F58220'); }} className="flex-1 min-w-0 text-sm font-mono text-gray-700 focus:outline-none" /></div></Field>; }
function SegmentedControl({ value, options, onChange }: { value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) { return <div className="flex flex-wrap rounded-xl bg-gray-100 p-1 gap-1 max-w-full">{options.map(option => <button key={option.value} onClick={() => onChange(option.value)} className={`flex-1 min-w-[72px] rounded-lg px-2.5 py-2 text-[11px] font-bold transition-all ${value === option.value ? 'bg-white text-solar-orange shadow-sm' : 'text-gray-500 hover:text-graphite'}`}>{option.label}</button>)}</div>; }
function Toggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (value: boolean) => void }) { return <button onClick={() => onChange(!checked)} className="w-full flex items-center justify-between gap-3 text-left"><span className="text-xs font-bold text-gray-600">{label}</span><span className={`relative h-6 w-11 rounded-full transition-all shrink-0 ${checked ? 'bg-solar-orange' : 'bg-gray-200'}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? 'left-6' : 'left-1'}`} /></span></button>; }
function OptionCard({ icon: Icon, title, description, children }: { icon: AnyIcon; title: string; description: string; children: ReactNode }) { return <div className="rounded-2xl border border-gray-100 p-4 bg-gray-50/40 space-y-4"><div className="flex items-start gap-3"><div className="p-2 rounded-xl bg-white text-solar-orange border border-gray-100"><Icon size={17} /></div><div><p className="font-bold text-sm text-graphite">{title}</p><p className="text-xs text-gray-500 leading-relaxed mt-1">{description}</p></div></div>{children}</div>; }
function AdvancedToggle({ icon: Icon, title, description, checked, onChange }: { icon: AnyIcon; title: string; description: string; checked: boolean; onChange: (value: boolean) => void }) { return <div className={`rounded-2xl border p-4 transition-all ${checked ? 'border-solar-orange/30 bg-solar-orange/5' : 'border-gray-100 bg-white'}`}><div className="flex items-start justify-between gap-4"><div className="flex items-start gap-3"><div className={`p-2 rounded-xl ${checked ? 'bg-solar-orange text-white' : 'bg-gray-100 text-gray-500'}`}><Icon size={17} /></div><div><p className="font-bold text-sm text-graphite">{title}</p><p className="text-xs text-gray-500 leading-relaxed mt-1">{description}</p></div></div><div className="w-12"><Toggle checked={checked} label="" onChange={onChange} /></div></div></div>; }
function AppearancePreview({ settings, completion }: { settings: AppearanceSettings; completion: number }) { const radius = settings.corners === 'sharp' ? '10px' : settings.corners === 'rounded' ? '28px' : '18px'; const cardPadding = settings.density === 'compact' ? '12px' : settings.density === 'spacious' ? '22px' : '16px'; const previewCardClass = settings.cardStyle === 'glass' ? 'bg-white/65 backdrop-blur shadow-sm' : settings.cardStyle === 'flat' ? 'bg-white border border-gray-100' : 'bg-white shadow-sm'; return <Card className="p-5 bg-white"><div className="flex items-center justify-between mb-4"><div><h4 className="text-sm font-black text-graphite">Preview ao vivo</h4><p className="text-xs text-gray-500">Como a equipe perceberá o CRM.</p></div><Badge variant="success">{completion}% pronto</Badge></div><div className="rounded-[24px] border border-gray-100 p-3 shadow-inner" style={{ background: settings.backgroundColor }}><div className="grid grid-cols-[70px_1fr] gap-3 min-h-[300px]"><div className="rounded-[18px] p-3 text-white flex flex-col gap-2" style={{ background: settings.graphiteColor }}><div className="h-8 w-8 rounded-xl bg-white/15" />{['Dash', 'Leads', 'Funil', 'Config'].map((item, index) => <div key={item} className={`h-8 rounded-xl ${index === 3 ? 'bg-white/20' : 'bg-white/8'} flex items-center justify-center text-[9px] font-bold`}>{settings.navigation === 'icons' ? item.slice(0, 1) : item}</div>)}</div><div className="space-y-3"><div className="flex items-center justify-between rounded-2xl bg-white/80 p-3"><div><p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{settings.companyName}</p><p className="text-sm font-black" style={{ color: settings.graphiteColor }}>Configurações</p></div><div className="h-9 w-9 rounded-full" style={{ background: settings.primaryColor }} /></div><div className="grid grid-cols-2 gap-2">{['Leads', 'Propostas'].map((item, index) => <div key={item} className={previewCardClass} style={{ borderRadius: radius, padding: cardPadding }}><p className="text-[10px] font-bold text-gray-400">{item}</p><p className="text-xl font-black" style={{ color: index === 0 ? settings.primaryColor : settings.secondaryColor }}>{index === 0 ? '148' : '32'}</p></div>)}</div><div className={previewCardClass} style={{ borderRadius: radius, padding: cardPadding }}><div className="flex items-center justify-between mb-3"><p className="text-xs font-black" style={{ color: settings.graphiteColor }}>Funil visual</p>{settings.fontScale !== 'normal' && <span className="text-[9px] font-black px-2 py-1 rounded-full text-white mr-1" style={{ background: settings.primaryColor }}>{settings.fontScale === 'extra' ? 'TEXTO+' : 'TEXTO'}</span>}{settings.executiveMode && <span className="text-[9px] font-black px-2 py-1 rounded-full text-white" style={{ background: settings.secondaryColor }}>EXEC</span>}</div><div className="space-y-2">{[78, 54, 28].map((width, index) => <div key={width} className="h-3 rounded-full bg-gray-100 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${width}%`, background: index === 2 && settings.highlightOverdue ? settings.primaryColor : settings.secondaryColor }} /></div>)}</div></div>{settings.showHints && <div className="rounded-2xl border border-dashed bg-white/70 p-3" style={{ borderColor: settings.primaryColor }}><p className="text-[10px] font-bold" style={{ color: settings.primaryColor }}>Dica ativa</p><p className="text-[10px] text-gray-500">Use filtros salvos para acompanhar campanhas críticas.</p></div>}</div></div></div></Card>; }
function Insight({ label, text }: { label: string; text: string }) { return <div className="flex gap-3 rounded-xl bg-gray-50 p-3"><span className="min-w-20 text-[10px] font-black text-solar-orange uppercase tracking-wide">{label}</span><span className="leading-relaxed">{text}</span></div>; }



type FunnelStageConfig = {
  key: string;
  name: string;
  promise: string;
  owner: string;
  sla: string;
  entry: string;
  exit: string;
  automation: string;
  webhook: string;
  nextAction: string;
  risk: string;
  tone: string;
};

function PipelineSettings() {
  const { leads, loading: leadsLoading } = useLeads();
  const { tasks, loading: tasksLoading } = useTasks();
  const { automations, loading: automationsLoading } = useAutomations();
  const { webhooks, loading: webhooksLoading } = useWebhooks();
  const [selectedStage, setSelectedStage] = useState('novo_lead');

  const stages: FunnelStageConfig[] = [
    { key: 'novo_lead', name: '1. Entrada do lead', promise: 'Todo contato novo entra rastreável e com origem clara.', owner: 'Marketing / SDR', sla: 'até 15 min', entry: 'Formulário, WhatsApp, indicação, campanha ou importação manual.', exit: 'Lead válido com canal, oferta e responsável definidos.', automation: 'lead.created → notifica SDR e pode iniciar cadência.', webhook: 'n8n - lead criado', nextAction: 'Conferir origem, telefone, campanha e criar primeira tarefa.', risk: 'Perder origem/campanha ou deixar lead sem dono.', tone: 'bg-solar-orange' },
    { key: 'qualificacao', name: '2. Qualificação', promise: 'Separar oportunidade real de curiosidade antes de consumir time técnico.', owner: 'SDR', sla: 'até 2h úteis', entry: 'Lead novo com contato possível.', exit: 'Perfil, cidade, conta média/interesse e timing definidos.', automation: 'Sem follow-up em 12h → cria alerta/tarefa urgente.', webhook: 'lead.no_followup_12h / automation.run', nextAction: 'Validar necessidade, segmento e melhor rota: assinatura, instalação, bateria ou investimento.', risk: 'Avançar lead sem dados mínimos e inflar proposta perdida.', tone: 'bg-energy-green' },
    { key: 'atendimento_iniciado', name: '3. Atendimento iniciado', promise: 'Primeiro contato consultivo, não só resposta rápida.', owner: 'SDR / Consultor', sla: 'mesmo dia', entry: 'Lead qualificado com responsável.', exit: 'Cliente respondeu e aceitou enviar dados/conta.', automation: 'Tarefa de retorno se não houver resposta.', webhook: 'lead.stage_changed', nextAction: 'Registrar resumo do atendimento e combinar envio da fatura.', risk: 'Conversas fora do CRM sem histórico.', tone: 'bg-graphite' },
    { key: 'conta_recebida', name: '4. Conta recebida', promise: 'Transformar fatura em diagnóstico comercial mensurável.', owner: 'Consultor / Pré-vendas', sla: 'até 24h', entry: 'Fatura, consumo ou dados mínimos recebidos.', exit: 'Consumo, concessionária, impostos e potencial calculados.', automation: 'Checklist de análise e lembrete se a conta ficar parada.', webhook: 'lead.stage_changed', nextAction: 'Conferir concessionária/tarifa e preparar diagnóstico.', risk: 'Erro de cálculo ou falta de validação técnica.', tone: 'bg-solar-orange' },
    { key: 'diagnostico', name: '5. Diagnóstico técnico', promise: 'Escolher a solução certa antes de apresentar preço.', owner: 'Técnico / Consultor', sla: '24–48h', entry: 'Conta validada e dados suficientes.', exit: 'Oferta recomendada, economia estimada e objeções previstas.', automation: 'Gera tarefa de proposta quando diagnóstico é concluído.', webhook: 'lead.stage_changed / automation.run', nextAction: 'Definir oferta principal e alternativa caso a primeira não encaixe.', risk: 'Propor produto errado para o perfil do cliente.', tone: 'bg-energy-green' },
    { key: 'proposta_enviada', name: '6. Proposta enviada', promise: 'Proposta com follow-up controlado até decisão.', owner: 'Consultor Comercial', sla: 'follow-up em 48h', entry: 'Diagnóstico aprovado e proposta enviada.', exit: 'Aceite, negociação, perda ou pausa com motivo.', automation: 'proposal.open_48h → tarefa de follow-up e sugestão de mensagem.', webhook: 'proposal.open_48h / automation.run', nextAction: 'Agendar retorno, tratar objeções e registrar status da proposta.', risk: 'Proposta morrer sem retorno ou sem motivo de perda.', tone: 'bg-graphite' },
    { key: 'contrato_enervita', name: '7. Contrato Enervita', promise: 'Fechamento com documentação e passagem limpa para operação.', owner: 'Consultor / Administrativo', sla: 'até 24h após aceite', entry: 'Cliente aceitou proposta.', exit: 'Contrato, documentação e próximos passos confirmados.', automation: 'Checklist de contrato e aviso para implantação.', webhook: 'lead.stage_changed', nextAction: 'Conferir dados, contrato e orientar implantação.', risk: 'Venda fechada sem documentação completa.', tone: 'bg-energy-green' },
    { key: 'perdido', name: '8. Perdido / pausado', promise: 'Nada some: perda vira aprendizado ou nutrição futura.', owner: 'Gestor Comercial', sla: 'registrar na hora', entry: 'Cliente recusou, não respondeu ou pausou decisão.', exit: 'Motivo de perda e próxima janela de reabordagem registrados.', automation: 'Nutrição/reativação futura planejada.', webhook: 'lead.stage_changed', nextAction: 'Registrar motivo real e marcar recontato quando fizer sentido.', risk: 'Perder inteligência comercial para campanhas futuras.', tone: 'bg-alert-red' },
  ];

  const selected = stages.find(stage => stage.key === selectedStage) ?? stages[0];
  const leadCountByStage = stages.reduce<Record<string, number>>((acc, stage) => {
    acc[stage.key] = leads.filter(lead => lead.stage === stage.key).length;
    return acc;
  }, {});
  const overdueTasks = tasks.filter(task => task.status === 'atrasado').length;
  const activeAutomations = automations.filter(automation => automation.active || automation.status === 'active').length;
  const activeWebhooks = webhooks.filter(webhook => webhook.status === 'active').length;
  const matchingAutomations = automations.filter(automation => selected.automation.includes(automation.trigger) || automation.trigger.includes(selected.key.split('_')[0]));
  const matchingWebhooks = webhooks.filter(webhook => webhook.eventTypes.some(event => selected.webhook.includes(event) || selected.automation.includes(event)));

  return (
    <div className="space-y-6">
      <Card className="relative overflow-hidden bg-gradient-to-br from-graphite via-graphite to-energy-green text-white border-0">
        <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-solar-orange/30 blur-3xl" />
        <div className="absolute left-10 bottom-0 h-24 w-24 rounded-full bg-mint-light/10 blur-2xl" />
        <div className="relative p-6 md:p-8">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="max-w-3xl min-w-0">
              <Badge variant="solar">Configurações &gt; Etapas do Funil</Badge>
              <h3 className="text-2xl md:text-4xl font-black tracking-tight mt-4">Funil comercial Enervita, ponta a ponta</h3>
              <p className="text-sm md:text-base text-white/75 mt-3 leading-relaxed">Veja o que entra em cada etapa, quem é responsável, qual SLA seguir, quais automações ajudam e quais eventos/webhooks conectam a operação com n8n e relatórios.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 min-w-[280px]">
              <div className="rounded-2xl bg-white/10 border border-white/10 p-4"><p className="text-xs text-white/60">Leads ativos</p><p className="text-2xl font-black">{leadsLoading ? '...' : leads.length}</p></div>
              <div className="rounded-2xl bg-white/10 border border-white/10 p-4"><p className="text-xs text-white/60">Tarefas atrasadas</p><p className="text-2xl font-black text-solar-orange">{tasksLoading ? '...' : overdueTasks}</p></div>
              <div className="rounded-2xl bg-white/10 border border-white/10 p-4"><p className="text-xs text-white/60">Automações ativas</p><p className="text-2xl font-black text-mint-light">{automationsLoading ? '...' : activeAutomations}</p></div>
              <div className="rounded-2xl bg-white/10 border border-white/10 p-4"><p className="text-xs text-white/60">Webhooks ativos</p><p className="text-2xl font-black text-mint-light">{webhooksLoading ? '...' : activeWebhooks}</p></div>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-5 md:p-6">
        <SectionTitle icon={Layers} title="Linha visual do funil" description="Clique em uma etapa para ver objetivo, entrada, saída, automações e riscos." />
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {stages.map((stage, index) => (
            <button key={stage.key} onClick={() => setSelectedStage(stage.key)} className={`text-left rounded-3xl border p-4 transition-all ${selectedStage === stage.key ? 'border-solar-orange bg-solar-orange/5 shadow-sm scale-[1.01]' : 'border-gray-100 bg-white hover:border-solar-orange/30'}`}>
              <div className="flex items-center justify-between gap-3">
                <span className={`h-9 w-9 rounded-2xl ${stage.tone} text-white flex items-center justify-center text-xs font-black`}>{index + 1}</span>
                <Badge variant={leadCountByStage[stage.key] > 0 ? 'success' : 'default'}>{leadCountByStage[stage.key] ?? 0} lead(s)</Badge>
              </div>
              <h4 className="font-black text-graphite mt-4 leading-tight">{stage.name}</h4>
              <p className="text-xs text-gray-500 mt-2 leading-relaxed">{stage.promise}</p>
              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-[10px] uppercase font-black tracking-wide text-gray-400"><span>{stage.owner}</span><span>{stage.sla}</span></div>
            </button>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="p-6 xl:col-span-2">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <SectionTitle icon={Target} title={selected.name} description={selected.promise} />
            <Badge variant="info">SLA: {selected.sla}</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <FunnelInfoCard label="Entra aqui" text={selected.entry} />
            <FunnelInfoCard label="Sai desta etapa quando" text={selected.exit} />
            <FunnelInfoCard label="Próxima ação da equipe" text={selected.nextAction} />
            <FunnelInfoCard label="Risco se não controlar" text={selected.risk} danger />
          </div>
          <div className="mt-6 rounded-3xl bg-gray-50 p-5">
            <p className="text-xs uppercase tracking-wide font-black text-gray-400 mb-3">Como a automação entra nesta etapa</p>
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-4 items-stretch">
              <div className="rounded-2xl bg-white border border-gray-100 p-4"><p className="text-xs text-gray-400 font-bold mb-1">Evento / gatilho</p><p className="font-black text-graphite">{selected.automation}</p></div>
              <div className="hidden lg:flex items-center justify-center"><ArrowRight className="text-solar-orange" /></div>
              <div className="rounded-2xl bg-white border border-gray-100 p-4"><p className="text-xs text-gray-400 font-bold mb-1">Webhook / integração</p><p className="font-black text-graphite">{selected.webhook}</p></div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <SectionTitle icon={User} title="Dono e controle" description="Quem responde pela etapa e o que acompanhar." />
          <div className="mt-5 space-y-3">
            <div className="rounded-2xl bg-gray-50 p-4"><p className="text-xs text-gray-400 font-black uppercase">Responsável</p><p className="text-lg font-black text-graphite mt-1">{selected.owner}</p></div>
            <div className="rounded-2xl bg-gray-50 p-4"><p className="text-xs text-gray-400 font-black uppercase">Leads nesta etapa</p><p className="text-lg font-black text-energy-green mt-1">{leadCountByStage[selected.key] ?? 0}</p></div>
            <div className="rounded-2xl bg-gray-50 p-4"><p className="text-xs text-gray-400 font-black uppercase">Automações relacionadas</p><p className="text-sm font-bold text-graphite mt-1">{matchingAutomations.length ? matchingAutomations.map(a => a.name).join(', ') : 'Sem regra ativa específica'}</p></div>
            <div className="rounded-2xl bg-gray-50 p-4"><p className="text-xs text-gray-400 font-black uppercase">Webhooks relacionados</p><p className="text-sm font-bold text-graphite mt-1">{matchingWebhooks.length ? matchingWebhooks.map(w => w.name).join(', ') : 'Sem webhook direto'}</p></div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="p-6 xl:col-span-2">
          <SectionTitle icon={Workflow} title="Automações por etapa" description="Onde cada regra atua dentro do funil e qual parte ainda depende de operação humana." />
          <div className="mt-5 space-y-3">
            {automationsLoading ? <p className="text-sm text-gray-500">Carregando automações...</p> : automations.map(automation => (
              <div key={automation.id} className="rounded-2xl border border-gray-100 p-4">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-3"><div><h4 className="font-black text-graphite">{automation.name}</h4><code className="text-[10px] text-gray-400">{automation.trigger}</code></div><Badge variant={(automation.active || automation.status === 'active') ? 'success' : 'info'}>{automation.active || automation.status === 'active' ? 'ativa' : 'planejada'}</Badge></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3"><div className="rounded-xl bg-gray-50 p-3"><p className="text-[10px] uppercase font-black text-gray-400">Condições</p><p className="text-xs text-gray-600 mt-1">{automation.conditions.join(' • ')}</p></div><div className="rounded-xl bg-gray-50 p-3"><p className="text-[10px] uppercase font-black text-gray-400">Ações</p><p className="text-xs text-gray-600 mt-1">{automation.actions.join(' • ')}</p></div></div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-6">
          <SectionTitle icon={BellRing} title="Eventos e webhooks" description="Pontos onde o funil conversa com n8n, fila e logs." />
          <div className="mt-5 space-y-3">
            {webhooksLoading ? <p className="text-sm text-gray-500">Carregando webhooks...</p> : webhooks.map(webhook => (
              <div key={webhook.id} className="rounded-2xl bg-gray-50 p-4"><div className="flex items-start justify-between gap-2"><p className="font-black text-sm text-graphite">{webhook.name}</p><Badge variant={webhook.status === 'active' ? 'success' : 'warning'}>{webhook.status === 'active' ? 'ativo' : webhook.status}</Badge></div><div className="flex flex-wrap gap-1 mt-3">{webhook.eventTypes.map(event => <span key={event} className="text-[9px] bg-white border border-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-mono">{event}</span>)}</div><p className="text-xs text-gray-500 mt-3">Segredo: <b className={webhook.secretConfigured ? 'text-energy-green' : 'text-alert-red'}>{webhook.secretConfigured ? 'configurado' : 'pendente'}</b></p></div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-6 border-energy-green/15 bg-energy-green/5">
        <SectionTitle icon={CheckCircle2} title="Leitura operacional" description="Como usar esta tela no dia a dia." />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5 text-sm text-gray-700">
          <div className="rounded-2xl bg-white/80 p-4"><b className="text-graphite">Gestor</b><p className="mt-2">Confere gargalos por etapa, SLA e se automações estão cobrindo os pontos críticos.</p></div>
          <div className="rounded-2xl bg-white/80 p-4"><b className="text-graphite">SDR/Consultor</b><p className="mt-2">Entende o próximo movimento esperado em cada etapa e evita deixar lead sem ação.</p></div>
          <div className="rounded-2xl bg-white/80 p-4"><b className="text-graphite">Técnico/Automação</b><p className="mt-2">Vê quais eventos e webhooks entram no funil antes de alterar n8n ou regras internas.</p></div>
        </div>
      </Card>
    </div>
  );
}

function FunnelInfoCard({ label, text, danger = false }: { label: string; text: string; danger?: boolean }) {
  return <div className={`rounded-2xl border p-4 ${danger ? 'border-alert-red/15 bg-alert-red/5' : 'border-gray-100 bg-white'}`}><p className={`text-[10px] uppercase tracking-wide font-black ${danger ? 'text-alert-red' : 'text-gray-400'}`}>{label}</p><p className="text-sm text-gray-700 leading-relaxed mt-2">{text}</p></div>;
}

function IntegrationsSettings() {
  const { automations, loading: automationsLoading, runAutomation, lastRun } = useAutomations();
  const { webhooks, deliveries, loading, testWebhook } = useWebhooks();
  const [testingId, setTestingId] = useState<string | null>(null);
  const [runningAutomationId, setRunningAutomationId] = useState<string | null>(null);
  const activeAutomations = automations.filter(automation => automation.active || automation.status === 'active').length;
  const activeWebhooks = webhooks.filter(webhook => webhook.status === 'active').length;
  const failedDeliveries = deliveries.filter(delivery => delivery.status === 'failed').length;
  const queuedDeliveries = deliveries.filter(delivery => delivery.status === 'queued').length;

  async function handleTest(id: string) {
    setTestingId(id);
    try {
      await testWebhook(id);
    } finally {
      setTestingId(null);
    }
  }

  async function handleRunAutomation(id: string) {
    setRunningAutomationId(id);
    try {
      await runAutomation(id);
    } finally {
      setRunningAutomationId(null);
    }
  }

  const eventCatalog = [
    ['lead.created', 'Lead criado no CRM/site'],
    ['lead.stage_changed', 'Mudança de etapa comercial'],
    ['lead.no_followup_12h', 'Lead sem follow-up por 12h'],
    ['proposal.open_48h', 'Proposta aberta sem retorno por 48h'],
    ['automation.run', 'Execução manual/controlada de automação'],
    ['webhook.test', 'Teste controlado de webhook'],
  ];

  const productionChecklist = [
    { label: 'Regras internas cadastradas', done: automations.length > 0 },
    { label: 'Webhooks ativos para n8n', done: activeWebhooks > 0 },
    { label: 'Logs de entrega auditáveis', done: deliveries.length > 0 },
    { label: 'Segredos configurados nos webhooks', done: webhooks.length > 0 && webhooks.every(webhook => webhook.secretConfigured) },
    { label: 'Gerador de API keys externas', done: false },
    { label: 'Dispatcher enviando HTTP externo real', done: false },
  ];

  const integrationLayers = [
    ['Entrada de leads', 'Site, landing pages, formulários e n8n enviando oportunidades para o CRM.'],
    ['Saída de eventos', 'Webhooks para avisar automações quando lead, tarefa ou proposta mudar.'],
    ['Acesso externo seguro', 'API keys por integração, com escopos, expiração, rotação e logs.'],
    ['Conectores de agentes', 'Camada futura para MCP/agentes consultarem contexto sem acesso amplo ao CRM.'],
  ];

  const keyGeneratorRequirements = [
    'Gerar chave por integração, nunca uma chave única global',
    'Exibir o segredo completo somente uma vez, no momento da criação',
    'Salvar apenas hash da chave no backend',
    'Definir escopos como leads:write, leads:read, tasks:write, webhooks:read',
    'Permitir expiração, revogação e rotação manual',
    'Registrar último uso, IP/origem e falhas de autenticação',
  ];

  const connectorCards = [
    { title: 'Site / Landing pages', status: 'Prioridade', scopes: 'leads:write', text: 'Entrada controlada para criar leads vindos de páginas, formulários e campanhas sem depender de sessão de usuário.' },
    { title: 'n8n / Automações', status: 'Em configuração', scopes: 'leads:read/write, tasks:write, webhooks:read', text: 'Orquestra follow-up, alertas, criação de tarefas e envio de eventos operacionais.' },
    { title: 'Agentes / MCP', status: 'Futuro', scopes: 'leads:read, proposals:read, activities:write', text: 'Deve ficar atrás das mesmas chaves e escopos, com tools específicas em vez de acesso irrestrito ao banco.' },
  ];

  return (
    <div className="space-y-6">
      <Card className="relative overflow-hidden border-energy-green/10 bg-gradient-to-br from-white via-white to-mint-light/50">
        <div className="absolute -right-20 -top-24 h-56 w-56 rounded-full bg-energy-green/10 blur-3xl" />
        <div className="relative p-6 md:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-3xl min-w-0">
            <div className="flex items-center gap-3 mb-3"><div className="p-2.5 rounded-2xl bg-energy-green text-white"><LinkIcon size={22} /></div><Badge variant="success">Configurações &gt; Integrações</Badge></div>
            <h3 className="text-2xl md:text-3xl font-black text-graphite tracking-tight">Integrações, Webhooks e Chaves de API</h3>
            <p className="text-sm md:text-base text-gray-600 mt-2 leading-relaxed">Centralize apenas o que faz sentido agora: entrada de leads, webhooks para automações, chaves de API por integração e uma base segura para futuros conectores de agentes.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 min-w-[260px]">
            <div className="rounded-2xl bg-white/80 border border-gray-100 p-4"><p className="text-xs text-gray-500">Automações ativas</p><p className="text-2xl font-black text-energy-green">{activeAutomations}</p></div>
            <div className="rounded-2xl bg-white/80 border border-gray-100 p-4"><p className="text-xs text-gray-500">Webhooks ativos</p><p className="text-2xl font-black text-energy-green">{activeWebhooks}</p></div>
            <div className="rounded-2xl bg-white/80 border border-gray-100 p-4"><p className="text-xs text-gray-500">Falhas / fila</p><p className="text-sm font-black text-graphite mt-2">{failedDeliveries} falha(s) • {queuedDeliveries} fila</p></div>
            <div className="rounded-2xl bg-white/80 border border-gray-100 p-4"><p className="text-xs text-gray-500">Produção</p><p className="text-sm font-black text-alert-red mt-2">Parcial</p></div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="p-6 xl:col-span-2">
          <SectionTitle icon={Database} title="Arquitetura de integrações" description="Separar entrada de dados, saída por eventos e acesso externo reduz risco operacional." />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
            {integrationLayers.map(([title, description]) => (
              <div key={title} className="rounded-2xl border border-gray-100 bg-gray-50/50 p-4">
                <p className="font-black text-sm text-graphite">{title}</p>
                <p className="text-xs text-gray-600 leading-relaxed mt-2">{description}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-2xl bg-graphite text-mint-light p-5 overflow-x-auto">
            <p className="text-xs text-white/50 mb-3">Fluxo recomendado para criação de lead externo</p>
            <pre className="text-xs whitespace-pre-wrap">{`POST /api/leads (autenticado)
Authorization: Bearer <chave-gerada-para-a-integracao>
Content-Type: application/json

{
  "name": "Maria Silva",
  "phone": "+55 11 99999-9999",
  "source": "Landing Page",
  "campaign": "Meta Ads - Maio"
}`}</pre>
          </div>
        </Card>

        <Card className="p-6 border-solar-orange/20 bg-solar-orange/5">
          <SectionTitle icon={ShieldCheck} title="Gerador de chaves de API" description="Sim, precisa ser a próxima peça antes de liberar API externa." />
          <div className="mt-5 space-y-3 text-sm">
            {keyGeneratorRequirements.map(item => <div key={item} className="flex gap-2 text-gray-700"><CheckCircle2 size={16} className="text-energy-green shrink-0 mt-0.5" /> {item}</div>)}
          </div>
          <Button variant="primary" className="w-full mt-6 opacity-60" disabled title="Planejamento técnico pendente">Planejamento técnico pendente</Button>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="p-6 xl:col-span-2">
          <div className="flex items-center justify-between gap-4 mb-5">
            <SectionTitle icon={Workflow} title="Automações internas" description="Regras do CRM com gatilhos, condições, ações e teste controlado antes de produção." />
            {lastRun && <Badge variant={lastRun.status === 'success' ? 'success' : lastRun.status === 'failed' ? 'error' : 'warning'}>Último teste: {lastRun.status}</Badge>}
          </div>
          <div className="space-y-4">
            {automationsLoading ? <div className="py-8 text-center text-gray-500">Carregando automações...</div> : automations.map(automation => {
              const queuedFromLastRun = lastRun?.automationId === automation.id ? Number(lastRun.outputPayload?.queuedWebhookDeliveries ?? 0) : null;
              return (
                <div key={automation.id} className="rounded-2xl border border-gray-100 p-4 hover:border-energy-green/20 transition-all">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm text-graphite">{automation.name}</h4>
                      <code className="text-[10px] text-gray-400 break-all">gatilho: {automation.trigger}</code>
                    </div>
                    <Badge variant={(automation.active || automation.status === 'active') ? 'success' : automation.status === 'paused' ? 'warning' : 'info'}>{automation.active || automation.status === 'active' ? 'ativa' : automation.status === 'paused' ? 'pausada' : 'planejada'}</Badge>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-4">
                    <div className="rounded-xl bg-gray-50 p-3"><p className="text-[10px] uppercase font-black text-gray-400 mb-2">Condições</p><ul className="space-y-1">{automation.conditions.map(item => <li key={item} className="text-xs text-gray-600">• {item}</li>)}</ul></div>
                    <div className="rounded-xl bg-gray-50 p-3"><p className="text-[10px] uppercase font-black text-gray-400 mb-2">Ações</p><ul className="space-y-1">{automation.actions.map(item => <li key={item} className="text-xs text-gray-600">• {item}</li>)}</ul></div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-4 mt-4 border-t border-gray-50">
                    <div className="text-xs text-gray-500">Última execução: <b className="text-graphite">{automation.lastRunAt ? new Date(automation.lastRunAt).toLocaleString('pt-BR') : 'sem execução'}</b>{queuedFromLastRun !== null && <span> • {queuedFromLastRun} entrega(s) enfileirada(s)</span>}</div>
                    <Button aria-label={`Executar teste controlado ${automation.name}`} variant="outline" size="sm" className="gap-2" onClick={() => void handleRunAutomation(automation.id)} disabled={runningAutomationId === automation.id}><RotateCcw size={14} /> Teste controlado</Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-6">
          <SectionTitle icon={BellRing} title="Eventos monitorados" description="Vocabulário operacional que liga automações, webhooks e n8n." />
          <div className="mt-5 space-y-2">
            {eventCatalog.map(([event, description]) => <div key={event} className="rounded-xl bg-gray-50 p-3"><code className="text-xs font-bold text-graphite">{event}</code><p className="text-xs text-gray-500 mt-1">{description}</p></div>)}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="p-6 xl:col-span-2">
          <div className="flex items-center justify-between gap-4 mb-5">
            <SectionTitle icon={Workflow} title="Webhooks para automações" description="Entregas controladas para n8n e outras ferramentas quando eventos comerciais acontecem." />
            <Button variant="outline" size="sm" disabled title="Cadastro técnico em breve" className="opacity-60">Cadastro técnico em breve</Button>
          </div>
          <div className="space-y-4">
            {loading ? <div className="py-8 text-center text-gray-500">Carregando webhooks...</div> : webhooks.map(webhook => (
              <div key={webhook.id} className="p-4 rounded-2xl border border-gray-100 hover:border-solar-orange/20 transition-all">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                  <div className="min-w-0"><h4 className="font-bold text-sm text-graphite">{webhook.name}</h4><code className="text-[10px] text-gray-400 break-all">{webhook.url}</code></div>
                  <Badge variant={webhook.status === 'active' ? 'success' : webhook.status === 'failing' ? 'error' : 'default'}>{webhook.status === 'active' ? 'ativo' : webhook.status === 'failing' ? 'falhando' : webhook.status}</Badge>
                </div>
                <div className="flex flex-wrap gap-1 mt-3">{webhook.eventTypes.map(event => <span key={event} className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-mono">{event}</span>)}</div>
                <div className="mt-3 text-xs text-gray-500">Segredo configurado: <b className={webhook.secretConfigured ? 'text-energy-green' : 'text-alert-red'}>{webhook.secretConfigured ? 'sim' : 'não'}</b> • Teste atual: fila controlada, sem HTTP externo real.</div>
                <div className="flex flex-wrap items-center justify-between gap-3 pt-4 mt-4 border-t border-gray-50">
                  <div className="flex gap-5 text-xs"><span className="text-gray-500">Sucesso: <b className="text-energy-green">{webhook.successRate}%</b></span><span className="text-gray-500">Última entrega: <b className="text-graphite">{webhook.lastDeliveryAt ? new Date(webhook.lastDeliveryAt).toLocaleString('pt-BR') : '-'}</b></span></div>
                  <Button aria-label={`Testar webhook ${webhook.name}`} variant="outline" size="sm" className="gap-2" onClick={() => void handleTest(webhook.id)} disabled={testingId === webhook.id}><RotateCcw size={14} /> Testar</Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <SectionTitle icon={BellRing} title="Logs recentes" description="Últimas entregas da fila de webhooks." />
          <div className="mt-5 space-y-3">
            {deliveries.length === 0 ? <p className="text-sm text-gray-500 py-6">Nenhuma entrega registrada ainda.</p> : deliveries.slice(0, 6).map(delivery => (
              <div key={delivery.id} className="rounded-xl bg-gray-50 p-3 text-xs text-gray-600">
                <div className="flex items-center justify-between gap-2"><span className="font-bold text-graphite">{delivery.eventType}</span><Badge variant={delivery.status === 'sent' ? 'success' : delivery.status === 'failed' ? 'error' : 'warning'}>{delivery.status}</Badge></div>
                <p className="mt-1 text-gray-500">{delivery.webhookName ?? delivery.webhookId} • {delivery.attempts} tentativa(s)</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-6 border-alert-red/15 bg-alert-red/5">
        <SectionTitle icon={ShieldCheck} title="Checklist de prontidão para produção" description="Autoavaliação honesta da função antes de liberar operação real." />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mt-5">
          {productionChecklist.map(item => <div key={item.label} className="rounded-xl bg-white/80 border border-white p-3 flex items-start gap-2 text-sm"><CheckCircle2 size={16} className={`${item.done ? 'text-energy-green' : 'text-alert-red'} shrink-0 mt-0.5`} /><span className="text-gray-700">{item.label}</span></div>)}
        </div>
        <div className="mt-5 rounded-2xl bg-white/80 border border-alert-red/10 p-4 text-sm text-gray-700 leading-relaxed">
          Conclusão: a página fica completa para homologar e operar automações internas controladas. Para produção plena com integrações externas, ainda exige segredos de webhook, dispatcher HTTP real, retry operacional e gerador de API keys.
        </div>
      </Card>

      <Card className="p-6">
        <SectionTitle icon={Sparkles} title="Conectores inteligentes / MCP" description="Futuro: agentes só entram depois de API keys, escopos e auditoria funcionando." />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-5">
          {connectorCards.map(card => (
            <div key={card.title} className="rounded-2xl border border-gray-100 p-5 bg-gray-50/50">
              <div className="flex items-start justify-between gap-3"><h4 className="font-black text-graphite">{card.title}</h4><Badge variant={card.status === 'Ativo' ? 'success' : card.status === 'Disponível' ? 'info' : 'warning'}>{card.status}</Badge></div>
              <p className="text-sm text-gray-600 leading-relaxed mt-3">{card.text}</p>
              <p className="text-[10px] text-gray-400 mt-4 uppercase font-black">Escopos</p>
              <code className="text-xs text-graphite break-all">{card.scopes}</code>
            </div>
          ))}
        </div>
        <div className="mt-5 rounded-2xl bg-solar-orange/5 border border-solar-orange/10 p-4 text-sm text-gray-600 leading-relaxed">
          Nesta etapa, MCP/agentes deve ficar como preparação arquitetural, não como promessa de recurso pronto. O caminho correto é liberar primeiro API keys com escopos, depois criar tools específicas para leitura de leads, propostas, tarefas e registro de atividades.
        </div>
      </Card>
    </div>
  );
}

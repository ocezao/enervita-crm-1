import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BellRing,
  CalendarDays,
  CheckCircle2,
  Clock3,
  DollarSign,
  Filter,
  Flame,
  Gauge,
  Layers3,
  LineChart,
  MousePointer2,
  Radar,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ContextHint, PremiumMetricCard, PremiumSectionTitle, PremiumSurface } from '../components/ui/PremiumDashboard';
import { useDashboardMetrics } from '../hooks/useCrm';
import type { Activity as CrmActivity, LeadStage } from '../lib/api/types';

const stageLabels: Record<LeadStage, string> = {
  novo_lead: 'Novo lead',
  qualificacao: 'Qualificação',
  atendimento_iniciado: 'Atendimento iniciado',
  conta_recebida: 'Conta recebida',
  diagnostico: 'Diagnóstico',
  proposta_enviada: 'Proposta enviada',
  contrato_enervita: 'Contrato Enervita',
  perdido: 'Perdido',
};

const pipelineStageOrder: LeadStage[] = [
  'novo_lead',
  'qualificacao',
  'atendimento_iniciado',
  'conta_recebida',
  'diagnostico',
  'proposta_enviada',
  'contrato_enervita',
  'perdido',
];

const stageColors: Record<LeadStage, string> = {
  novo_lead: '#f97316',
  qualificacao: '#2563eb',
  atendimento_iniciado: '#0891b2',
  conta_recebida: '#16a34a',
  diagnostico: '#7c3aed',
  proposta_enviada: '#eab308',
  contrato_enervita: '#059669',
  perdido: '#ef4444',
};

const stageOptions = pipelineStageOrder.map((stage) => [stage, stageLabels[stage]] as const);

const activityLabels: Record<CrmActivity['activityType'], string> = {
  note: 'Nota',
  call: 'Ligação',
  email: 'E-mail',
  whatsapp: 'WhatsApp',
  meeting: 'Reunião',
  stage_change: 'Etapa alterada',
};

const defaultFilters = {
  startDate: '',
  endDate: '',
  stage: '',
  source: '',
  platform: '',
  activityType: '',
};

type DashboardFilters = typeof defaultFilters;

const quickRanges = [
  { label: '7 dias', days: 7 },
  { label: '30 dias', days: 30 },
  { label: '90 dias', days: 90 },
];

function toInputDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value || 0);

const numberFmt = (value: number) => new Intl.NumberFormat('pt-BR').format(value || 0);

function percentFmt(value: number, total: number): string {
  if (!total) return '0%';
  return `${Math.round((value / total) * 100)}%`;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value?: number; name?: string; color?: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl border border-white/40 bg-bg-surface-2 px-4 py-3 text-xs font-bold text-white shadow-2xl backdrop-blur-xl">
      <p className="mb-1 text-text-secondary">{label}</p>
      {payload.map((item) => <p key={item.name} style={{ color: item.color }}>{item.name}: {numberFmt(Number(item.value ?? 0))}</p>)}
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-2">
      <span className="text-[11px] font-black uppercase tracking-[0.18em] text-text-secondary">{label}</span>
      {children}
    </label>
  );
}

const fieldClass = 'h-11 w-full rounded-2xl border border-white/70 bg-bg-surface-1/75 px-3 text-sm font-bold text-text-primary shadow-inner outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100';

function toApiFilters(filters: DashboardFilters) {
  return {
    startDate: filters.startDate || undefined,
    endDate: filters.endDate || undefined,
    stage: (filters.stage || undefined) as LeadStage | undefined,
    source: filters.source || undefined,
    platform: filters.platform || undefined,
    activityType: (filters.activityType || undefined) as CrmActivity['activityType'] | undefined,
  };
}

export default function DashboardPremium() {
  const [draftFilters, setDraftFilters] = useState<DashboardFilters>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<DashboardFilters>(defaultFilters);
  const { metrics, loading } = useDashboardMetrics(toApiFilters(appliedFilters));

  const activeFilterCount = Object.values(appliedFilters).filter(Boolean).length;

  const stageData = useMemo(() => {
    const counts = new Map((metrics?.leadsByStage ?? []).map((item) => [item.stage, item.count]));
    return pipelineStageOrder.map((stage) => ({
      stage,
      name: stageLabels[stage],
      value: counts.get(stage) ?? 0,
      fill: stageColors[stage],
    }));
  }, [metrics]);

  const totalStageLeads = useMemo(() => stageData.reduce((sum, item) => sum + item.value, 0), [stageData]);
  const donutStageData = useMemo(() => stageData.filter((item) => item.value > 0), [stageData]);

  const sourceData = useMemo(() => (metrics?.leadsBySource ?? []).map((item) => ({
    source: item.source || 'Indefinida',
    leads: item.count,
  })), [metrics]);

  const platformData = useMemo(() => (metrics?.conversionsByPlatform ?? []).map((item) => ({
    platform: item.platform || 'Indefinida',
    conversions: item.count,
  })), [metrics]);

  const eventsByType = useMemo(() => {
    const grouped = new Map<string, number>();
    for (const event of metrics?.recentEvents ?? []) grouped.set(event.activityType, (grouped.get(event.activityType) ?? 0) + 1);
    return Array.from(grouped.entries()).map(([type, count]) => ({ type: activityLabels[type as CrmActivity['activityType']] ?? type, count }));
  }, [metrics]);

  const sourceOptions = useMemo(() => Array.from(new Set((metrics?.leadsBySource ?? []).map((item) => item.source).filter(Boolean))), [metrics]);
  const platformOptions = useMemo(() => Array.from(new Set((metrics?.conversionsByPlatform ?? []).map((item) => item.platform).filter(Boolean))), [metrics]);

  const commercial = metrics?.commercial;
  const openValue = commercial?.openOpportunityValue ?? 0;
  const wonValue = commercial?.wonOpportunityValue ?? 0;
  const acceptedAnnual = commercial?.acceptedProposalAnnualValue ?? 0;
  const totalPipeline = openValue + wonValue;
  const commercialStageData = useMemo(() => {
    const byStage = new Map((commercial?.stageBreakdown ?? []).map((item) => [item.stage, item]));
    return pipelineStageOrder.map((stage) => byStage.get(stage) ?? { stage, count: 0, value: 0 });
  }, [commercial]);
  const commercialStageValue = commercialStageData.reduce((sum, item) => sum + item.value, 0);

  const setQuickRange = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days + 1);
    setDraftFilters((current) => ({ ...current, startDate: toInputDate(start), endDate: toInputDate(end) }));
  };

  const clearFilters = () => {
    setDraftFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
  };

  if (loading && !metrics) {
    return <div className="flex min-h-[60vh] items-center justify-center text-text-secondary">Carregando cockpit premium...</div>;
  }

  if (!metrics) {
    return <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-red-700">Não foi possível carregar os dados do dashboard.</div>;
  }

  return (
    <div className="relative -m-6 min-h-screen overflow-hidden bg-bg-void p-6 text-text-primary lg:p-8">
      <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(#0f172a_1px,transparent_1px),linear-gradient(90deg,#0f172a_1px,transparent_1px)] [background-size:28px_28px]" />

      <div className="relative mx-auto max-w-7xl space-y-6">
        <PremiumSurface dark className="overflow-hidden p-0">
          <div className="relative grid gap-6 p-6 lg:grid-cols-[1.25fr_0.75fr] lg:p-8">
            <div className="relative z-10 space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-bg-surface-1/10 px-3 py-1 text-xs font-black uppercase tracking-[0.24em] text-orange-100 backdrop-blur">
                <Sparkles size={14} /> Enervita CRM · Dashboard principal
              </div>
              <div className="flex items-start gap-3">
                <h1 className="max-w-3xl text-4xl font-black tracking-tight text-white md:text-6xl">Cockpit comercial com dados reais.</h1>
                <ContextHint text="Este dashboard é a tela principal. Os filtros avançados recalculam os indicadores no backend: período por criação do lead, etapa, origem, plataforma e tipo de atividade." />
              </div>
              <p className="max-w-2xl text-base font-semibold leading-8 text-text-secondary md:text-lg">Visão executiva para receita, aquisição, gargalos operacionais e próximos movimentos comerciais.</p>
              <div className="flex flex-wrap gap-3">
                <span className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-4 py-2 text-sm font-black text-emerald-100">{numberFmt(commercial?.openOpportunities ?? 0)} oportunidades abertas</span>
                <span className="rounded-full border border-orange-300/30 bg-orange-400/10 px-4 py-2 text-sm font-black text-orange-100">{formatCurrency(openValue)} em jogo</span>
                {activeFilterCount > 0 && <span className="rounded-full border border-white/15 bg-bg-surface-1/10 px-4 py-2 text-sm font-black text-white">{activeFilterCount} filtros ativos</span>}
              </div>
            </div>
            <div className="relative z-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <div className="rounded-[2rem] border border-white/10 bg-bg-surface-1/10 p-5 backdrop-blur-xl">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-text-secondary">Valor aberto</p>
                <strong className="mt-2 block text-3xl font-black text-white">{formatCurrency(openValue)}</strong>
                <p className="mt-2 text-sm font-semibold text-text-secondary">Pipeline vivo ainda negociável.</p>
              </div>
              <div className="rounded-[2rem] border border-white/10 bg-bg-surface-1/10 p-5 backdrop-blur-xl">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-text-secondary">Valor anual aceito</p>
                <strong className="mt-2 block text-3xl font-black text-emerald-200">{formatCurrency(acceptedAnnual)}</strong>
                <p className="mt-2 text-sm font-semibold text-text-secondary">Propostas aceitas com economia anual projetada.</p>
              </div>
            </div>
          </div>
        </PremiumSurface>

        <PremiumSurface className="p-5 lg:p-6">
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <PremiumSectionTitle eyebrow="Filtros avançados" title="Recorte os dados do cockpit" action={<div className="flex items-center gap-2"><Filter size={18} className="text-orange-400" /><ContextHint text="Use quando precisar investigar um canal, etapa ou período específico. A aplicação recalcula métricas, gráficos e listas com o mesmo recorte." /></div>} />
            <div className="flex flex-wrap gap-2">
              {quickRanges.map((range) => <button key={range.days} type="button" onClick={() => setQuickRange(range.days)} className="rounded-full border border-border-soft bg-bg-surface-1 px-4 py-2 text-xs font-black text-text-primary shadow-sm transition hover:border-orange-200 hover:bg-orange-50">{range.label}</button>)}
              <button type="button" onClick={clearFilters} className="inline-flex items-center gap-2 rounded-full border border-border-soft bg-bg-surface-1 px-4 py-2 text-xs font-black text-text-primary shadow-sm transition hover:border-red-200 hover:bg-red-50"><RotateCcw size={14} /> Limpar</button>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <FilterField label="Início"><input className={fieldClass} type="date" value={draftFilters.startDate} onChange={(event) => setDraftFilters((current) => ({ ...current, startDate: event.target.value }))} /></FilterField>
            <FilterField label="Fim"><input className={fieldClass} type="date" value={draftFilters.endDate} onChange={(event) => setDraftFilters((current) => ({ ...current, endDate: event.target.value }))} /></FilterField>
            <FilterField label="Etapa"><select className={fieldClass} value={draftFilters.stage} onChange={(event) => setDraftFilters((current) => ({ ...current, stage: event.target.value }))}><option value="">Todas</option>{stageOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></FilterField>
            <FilterField label="Origem"><select className={fieldClass} value={draftFilters.source} onChange={(event) => setDraftFilters((current) => ({ ...current, source: event.target.value }))}><option value="">Todas</option>{sourceOptions.map((source) => <option key={source} value={source}>{source}</option>)}</select></FilterField>
            <FilterField label="Plataforma"><select className={fieldClass} value={draftFilters.platform} onChange={(event) => setDraftFilters((current) => ({ ...current, platform: event.target.value }))}><option value="">Todas</option>{platformOptions.map((platform) => <option key={platform} value={platform}>{platform}</option>)}</select></FilterField>
            <FilterField label="Atividade"><select className={fieldClass} value={draftFilters.activityType} onChange={(event) => setDraftFilters((current) => ({ ...current, activityType: event.target.value }))}><option value="">Todas</option>{Object.entries(activityLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></FilterField>
          </div>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-bold text-text-secondary">{activeFilterCount ? `${activeFilterCount} filtro(s) aplicado(s)` : 'Sem filtros: visão geral completa.'}</p>
            <button type="button" onClick={() => setAppliedFilters(draftFilters)} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-bg-surface-2 px-5 py-3 text-sm font-black text-white shadow-xl shadow-bg-surface-2/20 transition hover:-translate-y-0.5 hover:bg-bg-surface-2"><RefreshCw size={16} /> Aplicar filtros</button>
          </div>
        </PremiumSurface>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <PremiumMetricCard title="Leads no período" value={numberFmt(metrics.newLeadsToday)} description="Total do recorte ativo" icon={<Users size={20} />} accent="orange" />
          <PremiumMetricCard title="Sem follow-up" value={numberFmt(metrics.leadsWithoutFollowup)} description="Leads sem próxima ação válida" icon={<BellRing size={20} />} accent="red" />
          <PremiumMetricCard title="Tarefas vencidas" value={numberFmt(metrics.overdueTasks)} description="Pendências já atrasadas" icon={<Clock3 size={20} />} accent="red" />
          <PremiumMetricCard title="Propostas abertas" value={numberFmt(metrics.openProposals)} description="Negociações em proposta" icon={<Target size={20} />} accent="green" />
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <PremiumMetricCard title="Valor aberto" value={formatCurrency(openValue)} description="Oportunidades abertas" icon={<DollarSign size={20} />} accent="orange" />
          <PremiumMetricCard title="Valor ganho" value={formatCurrency(wonValue)} description="Oportunidades ganhas" icon={<CheckCircle2 size={20} />} accent="green" />
          <PremiumMetricCard title="Valor anual aceito" value={formatCurrency(acceptedAnnual)} description="Economia anual em propostas aceitas" icon={<TrendingUp size={20} />} accent="green" />
          <PremiumMetricCard title="Taxa visual" value={totalPipeline ? `${Math.round((wonValue / totalPipeline) * 100)}%` : '0%'} description="Ganho sobre aberto + ganho" icon={<Gauge size={20} />} accent="slate" />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <PremiumSurface className="p-6">
            <PremiumSectionTitle eyebrow="Pipeline vivo" title="Distribuição por etapa" action={<div className="flex items-center gap-2"><Layers3 size={18} className="text-orange-400" /><ContextHint text="Mostra onde os leads estão concentrados. Com filtros, ajuda a ver gargalos por período, origem ou plataforma." /></div>} />
            {totalStageLeads ? (
              <div className="mt-6 h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stageData} margin={{ top: 10, right: 10, left: -20, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 700 }} angle={-18} textAnchor="end" interval={0} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fontWeight: 700 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" name="Leads" radius={[14, 14, 4, 4]}>{stageData.map((entry) => <Cell key={entry.stage} fill={entry.fill} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="mt-6 flex h-[340px] items-center justify-center rounded-3xl border border-dashed border-border-soft bg-bg-surface-1/60 p-6 text-center text-sm font-bold text-text-secondary">Nenhum lead encontrado neste recorte.</div>
            )}
          </PremiumSurface>

          <PremiumSurface className="p-6">
            <PremiumSectionTitle eyebrow="Aquisição" title="Canais de origem" action={<MousePointer2 size={18} className="text-emerald-600" />} />
            <div className="mt-6 space-y-4">
              {sourceData.map((item, index) => {
                const max = Math.max(...sourceData.map((source) => source.leads), 1);
                return <div key={item.source} className="rounded-3xl border border-white/70 bg-bg-surface-1/70 p-4"><div className="flex items-center justify-between text-sm font-black"><span>{item.source}</span><span>{numberFmt(item.leads)}</span></div><div className="mt-3 h-3 overflow-hidden rounded-full bg-bg-surface-2/50"><motion.div initial={{ width: 0 }} animate={{ width: `${Math.max(8, (item.leads / max) * 100)}%` }} transition={{ duration: 0.8, delay: index * 0.05 }} className="h-full rounded-full bg-gradient-to-r from-orange-500 to-emerald-500" /></div></div>;
              })}
              {!sourceData.length && <p className="text-sm font-bold text-text-secondary">Nenhuma origem encontrada neste recorte.</p>}
            </div>
          </PremiumSurface>
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <PremiumSurface className="p-6">
            <PremiumSectionTitle eyebrow="Funil" title="Composição do funil" action={<div className="flex items-center gap-2"><Radar size={18} className="text-text-primary" /><ContextHint text="Distribuição percentual dos leads por etapa do funil. Mostra onde a maioria dos leads está concentrada. Use para identificar gargalos e atrito entre etapas." /></div>} />
            {donutStageData.length ? (
              <div className="mt-6 h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={donutStageData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95} paddingAngle={3}>
                      {donutStageData.map((entry) => <Cell key={entry.stage} fill={entry.fill} />)}
                    </Pie>
                    <Tooltip formatter={(value, name) => [`${numberFmt(Number(value))} leads`, String(name)]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="mt-6 flex h-[260px] items-center justify-center rounded-3xl border border-dashed border-border-soft bg-bg-surface-1/60 p-6 text-center text-sm font-bold text-text-secondary">Nenhum dado de funil para este recorte.</div>
            )}
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {stageData.map((entry) => (
                <span key={entry.stage} data-testid={`funnel-stage-${entry.stage}`} className="inline-flex items-center justify-between gap-3 rounded-2xl border border-border-soft bg-bg-surface-1/60 px-3 py-2 text-xs font-bold text-text-primary">
                  <span className="inline-flex min-w-0 items-center gap-1.5">
                    <span data-testid={`funnel-stage-color-${entry.stage}`} className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: entry.fill }} />
                    <span className="truncate">{entry.name}</span>
                  </span>
                  <span className="shrink-0 text-text-secondary">{numberFmt(entry.value)} · {percentFmt(entry.value, totalStageLeads)}</span>
                </span>
              ))}
            </div>
          </PremiumSurface>

          <PremiumSurface className="p-6">
            <PremiumSectionTitle eyebrow="Atenção comercial" title="Leads que precisam de decisão" action={<div className="flex items-center gap-2"><AlertTriangle size={18} className="text-alert-red" /><ContextHint text="Lista priorizada por tarefa vencida, falta de próxima ação e lead parado. É a fila operacional para o time não perder receita." /></div>} />
            <div className="mt-6 grid gap-3">
              {(commercial?.attentionLeads ?? []).map((lead) => <div key={lead.id} className="group rounded-3xl border border-white/70 bg-bg-surface-1/75 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-black text-text-primary">{lead.name}</p><p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-text-secondary">{stageLabels[lead.stage]}</p></div><span className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-600">{lead.reason}</span></div><div className="mt-3 flex items-center justify-between text-xs font-bold text-text-secondary"><span>Atualizado {new Date(lead.updatedAt).toLocaleDateString('pt-BR')}</span><ArrowRight size={14} className="transition group-hover:translate-x-1" /></div></div>)}
              {!(commercial?.attentionLeads ?? []).length && <p className="rounded-3xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">Nenhum lead crítico neste recorte.</p>}
            </div>
          </PremiumSurface>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <PremiumSurface className="p-6">
            <PremiumSectionTitle eyebrow="Conversão" title="Conversões por plataforma" action={<Flame size={18} className="text-orange-400" />} />
            <div className="mt-6 h-[280px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={platformData} layout="vertical" margin={{ left: 20, right: 20 }}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fontWeight: 700 }} /><YAxis type="category" dataKey="platform" tick={{ fontSize: 12, fontWeight: 800 }} width={90} /><Tooltip content={<CustomTooltip />} /><Bar dataKey="conversions" name="Conversões" radius={[0, 14, 14, 0]} fill="#f97316" /></BarChart></ResponsiveContainer></div>
          </PremiumSurface>

          <PremiumSurface className="p-6">
            <PremiumSectionTitle eyebrow="Atividade recente" title="Eventos por tipo" action={<div className="flex items-center gap-2"><Activity size={18} className="text-orange-400" /><ContextHint text="Agrupa os últimos eventos exibidos. O filtro por tipo de atividade serve para auditar comunicação, propostas e automações." /></div>} />
            <div className="mt-6 h-[280px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={eventsByType} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="type" tick={{ fontSize: 12, fontWeight: 800 }} /><YAxis allowDecimals={false} /><Tooltip content={<CustomTooltip />} /><Bar dataKey="count" name="Eventos" radius={[14, 14, 4, 4]} fill="#16a34a" /></BarChart></ResponsiveContainer></div>
          </PremiumSurface>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <PremiumSurface className="p-6">
            <PremiumSectionTitle eyebrow="Valor por etapa" title="Pipeline financeiro estimado" action={<div className="flex items-center gap-2"><LineChart size={18} className="text-text-primary" /><ContextHint text="Soma o valor esperado das oportunidades abertas por etapa. Use para priorizar onde uma ação comercial mexe mais no dinheiro." /></div>} />
            <div className="mt-6 space-y-4">
              {commercialStageData.map((stage, index) => {
                const share = commercialStageValue ? Math.max(6, Math.round((stage.value / commercialStageValue) * 100)) : 0;
                return <div key={stage.stage} className="rounded-3xl border border-white/70 bg-bg-surface-1/70 p-4" data-testid={`value-stage-${stage.stage}`}><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-black text-text-primary">{stageLabels[stage.stage]}</p><p className="text-xs font-bold text-text-secondary">{numberFmt(stage.count)} leads</p></div><strong className="text-sm text-text-primary">{formatCurrency(stage.value)}</strong></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-bg-surface-2/50"><motion.div initial={{ width: 0 }} animate={{ width: `${share}%` }} transition={{ duration: 0.8, delay: index * 0.05 }} className="h-full rounded-full" style={{ backgroundColor: stageColors[stage.stage] }} /></div></div>;
              })}
              {!commercialStageValue && <p className="rounded-3xl border border-dashed border-border-soft bg-bg-surface-1/60 p-4 text-sm font-bold text-text-secondary">Nenhum valor estimado neste recorte.</p>}
            </div>
          </PremiumSurface>

          <PremiumSurface className="p-6">
            <PremiumSectionTitle eyebrow="Últimos movimentos" title="Últimos movimentos do CRM" action={<CalendarDays size={18} className="text-emerald-600" />} />
            <div className="mt-6 space-y-3">
              {(metrics.recentEvents ?? []).map((event) => <div key={event.id} className="rounded-3xl border border-white/70 bg-bg-surface-1/75 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-black text-text-primary">{activityLabels[event.activityType]}</p><p className="mt-1 line-clamp-2 text-sm font-semibold text-text-secondary">{event.outcome || event.notes || 'Sem descrição'}</p></div><span className="whitespace-nowrap text-xs font-black text-text-secondary">{new Date(event.createdAt).toLocaleDateString('pt-BR')}</span></div></div>)}
              {!metrics.recentEvents.length && <p className="rounded-3xl border border-border-hair bg-bg-surface-1/70 p-4 text-sm font-bold text-text-secondary">Nenhum movimento recente neste recorte.</p>}
            </div>
          </PremiumSurface>
        </div>
      </div>
    </div>
  );
}

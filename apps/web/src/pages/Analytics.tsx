import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
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
import { Activity, AlertTriangle, BarChart3, DatabaseZap, ExternalLink, Filter, Layers3, LineChart, RefreshCw, ShieldCheck, Target, TrendingUp } from 'lucide-react';
import { PageHeader } from '../components/ui/LayoutComponents';
import { Badge, Button, Card } from '../components/ui/Base';
import { DateRangeFilter, rangeForPeriod, type DateRangeState } from '../components/ui/DateRangeFilter';
import { useAnalyticsOverview } from '../hooks/useCrm';
import { formatCurrency } from '../lib/utils';
import type { AnalyticsKpi, LeadStage } from '../lib/api/types';
import { InsightsPanel } from "../components/InsightsPanel";

const COLORS = ['#F58220', '#2EAD5B', '#0E7A3D', '#2A332D', '#F7C948', '#54A3FF'];

const stageOptions: Array<{ value: LeadStage | 'all'; label: string }> = [
  { value: 'all', label: 'Todas as etapas' },
  { value: 'novo_lead', label: 'Novo lead' },
  { value: 'qualificacao', label: 'Qualificação' },
  { value: 'atendimento_iniciado', label: 'Atendimento iniciado' },
  { value: 'conta_recebida', label: 'Conta recebida' },
  { value: 'diagnostico', label: 'Diagnóstico' },
  { value: 'proposta_enviada', label: 'Proposta enviada' },
  { value: 'contrato_enervita', label: 'Contrato Enervita' },
  { value: 'perdido', label: 'Perdido' },
];

type Filters = {
  range: DateRangeState;
  source: string;
  campaign: string;
  stage: LeadStage | 'all';
};

function kpiToneClass(tone: AnalyticsKpi['tone']) {
  const tones = {
    green: 'bg-energy-green/10 text-energy-green',
    orange: 'bg-solar-orange/10 text-solar-orange',
    blue: 'bg-blue-50 text-blue-600',
    red: 'bg-alert-red/10 text-alert-red',
    slate: 'bg-warm-sand/50 text-graphite',
  };
  return tones[tone] ?? tones.slate;
}

function shortDate(value: string) {
  const [, month, day] = value.split('-');
  return `${day}/${month}`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return 'Sem envio';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

export default function Analytics() {
  const [filters, setFilters] = useState<Filters>({ range: rangeForPeriod('30'), source: '', campaign: '', stage: 'all' });
  const query = useMemo(() => ({
    days: Number(filters.range.period) || undefined,
    period: filters.range.period,
    startDate: filters.range.startDate,
    endDate: filters.range.endDate,
    source: filters.source || undefined,
    campaign: filters.campaign || undefined,
    stage: filters.stage === 'all' ? undefined : filters.stage,
  }), [filters]);
  const { overview, loading, error } = useAnalyticsOverview(query);

  const sourceOptions = useMemo(() => overview?.trafficSources.map((item) => item.source).filter(Boolean) ?? [], [overview]);
  const campaignOptions = useMemo(() => overview?.campaigns.map((item) => item.campaign).filter((item) => item && item !== 'sem_campaign') ?? [], [overview]);

  if (loading || !overview) {
    return <div className="animate-pulse text-sm text-graphite-soft">Carregando analytics real do CRM...</div>;
  }

  const pieData = overview.trafficSources.map((item) => ({ name: item.label, value: item.leads }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Analytics comercial"
        description="Leads, campanhas, sinais Meta/Google, propostas e eventos reais do CRM Enervita."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={() => window.location.reload()}>
              <RefreshCw size={14} /> Atualizar
            </Button>
          </div>
        }
      />

      {error && (
        <Card className="p-4 border-alert-red/30 bg-alert-red/5 text-alert-red text-sm flex items-center gap-2">
          <AlertTriangle size={18} /> {error}
        </Card>
      )}

      <Card className="overflow-hidden border-solar-orange/20 bg-gradient-to-r from-solar-orange/10 via-white to-energy-green/10 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-white p-3 text-solar-orange shadow-sm">
              <ExternalLink size={22} />
            </div>
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-black text-graphite">Painel externo de analytics</h3>
                <Badge variant="solar">analytics.enervita.com.br</Badge>
              </div>
              <p className="max-w-3xl text-sm leading-relaxed text-graphite">
                Acesse o ambiente dedicado de analytics da Enervita em uma nova aba para acompanhar relatórios avançados fora do CRM.
              </p>
            </div>
          </div>
          <a href="https://analytics.enervita.com.br/" target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl bg-graphite px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-graphite/90" aria-label="Abrir analytics externo">
            Abrir analytics externo <ExternalLink size={16} />
          </a>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Filter size={18} className="text-solar-orange" />
          <h3 className="font-bold text-graphite">Filtros de análise</h3>
          <Badge variant="solar">Dados do CRM</Badge>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-[1.25fr_1fr_1fr_1fr] gap-4">
          <DateRangeFilter value={filters.range} onChange={(range) => setFilters((prev) => ({ ...prev, range }))} className="xl:grid-cols-3" />
          <label className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-graphite-soft">Origem da campanha</span>
            <input list="analytics-sources" className="w-full rounded-xl border border-warm-sand/70 px-3 py-2 text-sm" placeholder="Todas" value={filters.source} onChange={(event) => setFilters((prev) => ({ ...prev, source: event.target.value }))} />
            <datalist id="analytics-sources">{sourceOptions.map((item) => <option key={item} value={item} />)}</datalist>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-graphite-soft">Campanha</span>
            <input list="analytics-campaigns" className="w-full rounded-xl border border-warm-sand/70 px-3 py-2 text-sm" placeholder="Todas" value={filters.campaign} onChange={(event) => setFilters((prev) => ({ ...prev, campaign: event.target.value }))} />
            <datalist id="analytics-campaigns">{campaignOptions.map((item) => <option key={item} value={item} />)}</datalist>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-graphite-soft">Etapa</span>
            <select className="w-full rounded-xl border border-warm-sand/70 px-3 py-2 text-sm" value={filters.stage} onChange={(event) => setFilters((prev) => ({ ...prev, stage: event.target.value as LeadStage | 'all' }))}>
              {stageOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {overview.kpis.map((kpi) => (
          <Card key={kpi.key} className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold text-graphite-soft uppercase tracking-wider">{kpi.label}</p>
                <h3 className="text-2xl font-display font-bold text-graphite mt-2">{kpi.displayValue}</h3>
                <p className="text-xs text-graphite-soft mt-2 leading-relaxed">{kpi.helper}</p>
              </div>
              <div className={`p-2.5 rounded-xl ${kpiToneClass(kpi.tone)}`}><BarChart3 size={18} /></div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="p-6 xl:col-span-2">
          <h3 className="font-bold text-graphite mb-6 flex items-center gap-2"><LineChart size={20} className="text-solar-orange" /> Volume diário rastreado</h3>
          <div className="h-[330px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={overview.daily.map((item) => ({ ...item, label: shortDate(item.date) }))}>
                <defs>
                  <linearGradient id="analyticsLeads" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#F58220" stopOpacity={0.3}/><stop offset="95%" stopColor="#F58220" stopOpacity={0}/></linearGradient>
                  <linearGradient id="analyticsTracked" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2EAD5B" stopOpacity={0.25}/><stop offset="95%" stopColor="#2EAD5B" stopOpacity={0}/></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0F0F0" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Area type="monotone" dataKey="leads" name="Leads" stroke="#F58220" fill="url(#analyticsLeads)" strokeWidth={2} />
                <Area type="monotone" dataKey="trackedLeads" name="Com rastreio" stroke="#2EAD5B" fill="url(#analyticsTracked)" strokeWidth={2} />
                <Area type="monotone" dataKey="trackingEvents" name="Eventos" stroke="#2A332D" fillOpacity={0} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-bold text-graphite mb-6 flex items-center gap-2"><Target size={20} className="text-energy-green" /> Funil CRM</h3>
          <div className="space-y-3">
            {overview.funnel.map((item, index) => {
              const max = Math.max(...overview.funnel.map((step) => step.value), 1);
              return (
                <div key={item.key}>
                  <div className="flex items-center justify-between text-xs mb-1"><span className="font-bold text-graphite">{item.label}</span><span className="text-graphite-soft">{item.value}</span></div>
                  <div className="h-3 bg-warm-sand/50 rounded-full overflow-hidden"><div className="h-full bg-solar-orange" style={{ width: `${Math.max(4, (item.value / max) * 100)}%` }} /></div>
                  {index > 0 && <p className="text-[10px] text-graphite-soft mt-1">Conv. etapa anterior: {item.rateFromPrevious ?? 0}%</p>}
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="p-6 xl:col-span-2">
          <h3 className="font-bold text-graphite mb-6 flex items-center gap-2"><TrendingUp size={20} className="text-solar-orange" /> Origem, rastreio e conversão</h3>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={overview.trafficSources}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0F0F0" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="leads" name="Leads" fill="#F58220" radius={[4,4,0,0]} />
                <Bar dataKey="trackedLeads" name="Com rastreio" fill="#2EAD5B" radius={[4,4,0,0]} />
                <Bar dataKey="won" name="Contratos" fill="#2A332D" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-6">
          <h3 className="font-bold text-graphite mb-6 flex items-center gap-2"><Layers3 size={20} className="text-energy-green" /> Mix de origens</h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={86} paddingAngle={4}>
                  {pieData.map((_entry, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="font-bold text-graphite mb-4 flex items-center gap-2"><ShieldCheck size={20} className="text-energy-green" /> Qualidade do rastreio</h3>
          <div className="space-y-4">
            {overview.signals.map((signal) => (
              <div key={signal.key}>
                <div className="flex justify-between text-sm mb-1"><span className="font-bold text-graphite">{signal.label}</span><span className="text-graphite-soft">{signal.count} leads • {signal.coverageRate}%</span></div>
                <div className="h-2 bg-warm-sand/50 rounded-full overflow-hidden"><div className="h-full bg-energy-green" style={{ width: `${signal.coverageRate}%` }} /></div>
              </div>
            ))}
          </div>
          <div className="mt-6 space-y-2">
            {overview.notes.map((note) => <p key={note} className="text-xs text-graphite-soft bg-warm-sand/30 rounded-xl px-3 py-2">{note}</p>)}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-bold text-graphite mb-4 flex items-center gap-2"><DatabaseZap size={20} className="text-solar-orange" /> Eventos por plataforma</h3>
          {overview.trackingStatus.length === 0 ? (
            <div className="rounded-2xl bg-alert-red/5 border border-alert-red/10 p-5 text-sm text-graphite">Nenhum evento de campanha para os filtros atuais. A cobertura de origem dos leads já aparece ao lado; novos envios aparecerão aqui assim que forem processados.</div>
          ) : (
            <div className="space-y-3">
              {overview.trackingStatus.map((item) => (
                <div key={item.platform} className="rounded-2xl border border-warm-sand/50 p-4">
                  <div className="flex items-center justify-between"><span className="font-bold text-graphite capitalize">{item.platform}</span><Badge variant={item.failed > 0 ? 'error' : 'success'}>{item.total} eventos</Badge></div>
                  <p className="text-xs text-graphite-soft mt-2">Enviados: {item.sent} • Fila: {item.queued} • Substituídos: {item.discarded} • Falhas: {item.failed} • Último: {formatDateTime(item.lastSentAt)}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="font-bold text-graphite mb-5 flex items-center gap-2"><Activity size={20} className="text-solar-orange" /> Campanhas e leads recentes</h3>
        <div className="md:hidden divide-y divide-gray-100 rounded-2xl border border-warm-sand/50 overflow-hidden">
          {overview.campaigns.map((campaign) => (
            <article key={`${campaign.source}-${campaign.campaign}`} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-bold text-graphite truncate">{campaign.campaign}</p><p className="text-xs text-graphite-soft truncate">{campaign.source}</p></div><Badge variant="success">{campaign.trackedLeads}/{campaign.leads} rastreados</Badge></div>
              <div className="grid grid-cols-2 gap-3 text-xs text-graphite-soft">
                <div><span className="block font-bold text-graphite-soft uppercase">Propostas</span>{campaign.proposals}</div>
                <div><span className="block font-bold text-graphite-soft uppercase">Contratos</span>{campaign.won}</div>
                <div className="col-span-2"><span className="block font-bold text-graphite-soft uppercase">Pipeline</span>{formatCurrency(campaign.estimatedTicket)}</div>
              </div>
            </article>
          ))}
        </div>
        <div className="hidden md:block crm-scroll-panel overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b border-warm-sand/50 text-graphite-soft"><th className="pb-3">Campanha</th><th className="pb-3">Origem</th><th className="pb-3">Leads</th><th className="pb-3">Rastreados</th><th className="pb-3">Propostas</th><th className="pb-3">Contratos</th><th className="pb-3">Pipeline</th></tr></thead>
            <tbody className="divide-y divide-warm-sand/50">
              {overview.campaigns.map((campaign) => (
                <tr key={`${campaign.source}-${campaign.campaign}`} className="hover:bg-warm-sand/30/60"><td className="py-3 font-bold text-graphite">{campaign.campaign}</td><td className="py-3 text-graphite-soft">{campaign.source}</td><td className="py-3 text-graphite-soft">{campaign.leads}</td><td className="py-3 text-energy-green font-bold">{campaign.trackedLeads}</td><td className="py-3 text-graphite-soft">{campaign.proposals}</td><td className="py-3 text-graphite-soft">{campaign.won}</td><td className="py-3 text-graphite-soft">{formatCurrency(campaign.estimatedTicket)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card className="p-6">
        <InsightsPanel />
      </Card>
    </div>
  );
}

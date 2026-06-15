import { useState } from 'react';
import {
  AlertTriangle,
  Clock,
  DollarSign,
  FileText,
  Users,
} from 'lucide-react';
import { useDashboardMetrics } from '../hooks/useCrm';
import { Card } from '../components/ui/Base';
import { InsightsPanel } from '../components/InsightsPanel';
import type { LeadStage, Activity } from '../lib/api/types';

const stageLabels: Record<string, string> = {
  novo_lead: 'Novo lead',
  qualificacao: 'Qualificação',
  atendimento_iniciado: 'Atendimento iniciado',
  conta_recebida: 'Conta recebida',
  diagnostico: 'Diagnóstico',
  proposta_enviada: 'Proposta enviada',
  contrato_enervita: 'Contrato Enervita',
  perdido: 'Perdido',
};

const stageOptions: Array<{ value: LeadStage | ''; label: string }> = [
  { value: '', label: 'Todas as etapas' },
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
  startDate: string;
  endDate: string;
  stage: LeadStage | '';
  source: string;
  platform: string;
  activityType: Activity['activityType'] | '';
};

const defaultFilters: Filters = {
  startDate: '',
  endDate: '',
  stage: '',
  source: '',
  platform: '',
  activityType: '',
};

function formatNumber(value: number) {
  return new Intl.NumberFormat('pt-BR').format(value || 0);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatDate(value?: string | null) {
  if (!value) return 'Sem data';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function stageLabel(stage: string) {
  return stageLabels[stage] ?? stage;
}

export default function DashboardPremium() {
  const [filters, setFilters] = useState<Filters>(defaultFilters);

  const queryFilters = {
    startDate: filters.startDate || undefined,
    endDate: filters.endDate || undefined,
    stage: (filters.stage || undefined) as LeadStage | undefined,
    source: filters.source || undefined,
    platform: filters.platform || undefined,
    activityType: (filters.activityType || undefined) as Activity['activityType'] | undefined,
  };

  const { metrics, loading } = useDashboardMetrics(queryFilters);

  if (loading || !metrics) return <p className="p-8 text-center text-gray-500">Carregando cockpit...</p>;

  const commercial = metrics.commercial;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="relative overflow-hidden rounded-[2rem] bg-graphite p-8 text-white shadow-soft">
        <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-solar-orange/30 blur-3xl" />
        <div className="relative z-10">
          <h1 className="text-3xl font-black">Cockpit Enervita</h1>
          <p className="mt-2 text-white/70">Operação comercial sob controle, do lead ao contrato ganho.</p>
        </div>
      </div>

      {/* Filtros */}
      <Card className="p-5">
        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Filtros</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <label className="space-y-1">
            <span className="text-[10px] font-bold uppercase text-gray-400">Início</span>
            <input type="date" value={filters.startDate} onChange={(e) => setFilters(f => ({ ...f, startDate: e.target.value }))} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] font-bold uppercase text-gray-400">Fim</span>
            <input type="date" value={filters.endDate} onChange={(e) => setFilters(f => ({ ...f, endDate: e.target.value }))} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] font-bold uppercase text-gray-400">Etapa</span>
            <select value={filters.stage} onChange={(e) => setFilters(f => ({ ...f, stage: e.target.value as LeadStage | '' }))} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm">
              {stageOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-[10px] font-bold uppercase text-gray-400">Origem</span>
            <select value={filters.source} onChange={(e) => setFilters(f => ({ ...f, source: e.target.value }))} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm">
              <option value="">Todas</option>
              {(metrics.leadsBySource ?? []).map(s => <option key={s.source} value={s.source}>{s.source}</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-[10px] font-bold uppercase text-gray-400">Plataforma</span>
            <select value={filters.platform} onChange={(e) => setFilters(f => ({ ...f, platform: e.target.value }))} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm">
              <option value="">Todas</option>
              {(metrics.conversionsByPlatform ?? []).map(p => <option key={p.platform} value={p.platform}>{p.platform}</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-[10px] font-bold uppercase text-gray-400">Atividade</span>
            <select value={filters.activityType} onChange={(e) => setFilters(f => ({ ...f, activityType: e.target.value as Activity['activityType'] | '' }))} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm">
              <option value="">Todas</option>
              <option value="call">Ligação</option>
              <option value="email">E-mail</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="meeting">Reunião</option>
              <option value="note">Nota</option>
            </select>
          </label>
        </div>
        <div className="mt-3 flex gap-2">
          <button onClick={() => setFilters(defaultFilters)} className="text-xs text-gray-500 hover:text-gray-700">Limpar filtros</button>
        </div>
      </Card>

      {/* Métricas principais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><div className="p-5"><div className="flex items-center gap-3"><div className="rounded-xl bg-solar-orange/10 p-2 text-solar-orange"><Users size={20} /></div><div><p className="text-xs text-gray-500">Novos hoje</p><p className="text-2xl font-black">{formatNumber(metrics.newLeadsToday)}</p></div></div></div></Card>
        <Card><div className="p-5"><div className="flex items-center gap-3"><div className="rounded-xl bg-red-50 p-2 text-red-500"><Clock size={20} /></div><div><p className="text-xs text-gray-500">Sem follow-up</p><p className="text-2xl font-black">{formatNumber(metrics.leadsWithoutFollowup)}</p></div></div></div></Card>
        <Card><div className="p-5"><div className="flex items-center gap-3"><div className="rounded-xl bg-red-50 p-2 text-red-500"><AlertTriangle size={20} /></div><div><p className="text-xs text-gray-500">Tarefas vencidas</p><p className="text-2xl font-black">{formatNumber(metrics.overdueTasks)}</p></div></div></div></Card>
        <Card><div className="p-5"><div className="flex items-center gap-3"><div className="rounded-xl bg-blue-50 p-2 text-blue-500"><FileText size={20} /></div><div><p className="text-xs text-gray-500">Propostas abertas</p><p className="text-2xl font-black">{formatNumber(metrics.openProposals)}</p></div></div></div></Card>
      </div>

      {/* Gestão comercial */}
      {commercial && (
        <div className="space-y-6">
          <h2 className="text-xl font-black text-graphite">Gestão comercial</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card><div className="p-5"><p className="text-xs text-gray-500">Oportunidades abertas</p><p className="text-xl font-black">{formatCurrency(commercial.openOpportunityValue)}</p><p className="text-xs text-gray-400">{commercial.openOpportunities} em aberto</p></div></Card>
            <Card><div className="p-5"><p className="text-xs text-gray-500">Contratos ganhos</p><p className="text-xl font-black text-energy-green">{formatCurrency(commercial.wonOpportunityValue)}</p><p className="text-xs text-gray-400">{commercial.wonOpportunities} ganhos</p></div></Card>
            <Card><div className="p-5"><p className="text-xs text-gray-500">Propostas abertas</p><p className="text-xl font-black">{formatNumber(commercial.openProposals)}</p></div></Card>
            <Card><div className="p-5"><p className="text-xs text-gray-500">Valor anual aceito</p><p className="text-xl font-black text-energy-green">{formatCurrency(commercial.acceptedProposalAnnualValue)}</p></div></Card>
          </div>

          {/* Leads parados */}
          <Card className="p-5">
            <h3 className="text-sm font-bold text-gray-500 uppercase mb-4">Atenção comercial</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center"><p className="text-2xl font-black text-red-500">{formatNumber(commercial.overdueTasks)}</p><p className="text-xs text-gray-500">Tarefas vencidas</p></div>
              <div className="text-center"><p className="text-2xl font-black text-solar-orange">{formatNumber(commercial.leadsWithoutNextAction)}</p><p className="text-xs text-gray-500">Sem próxima ação</p></div>
              <div className="text-center"><p className="text-2xl font-black">{formatNumber(commercial.staleLeads)}</p><p className="text-xs text-gray-500">Parados 7+ dias</p></div>
            </div>
          </Card>

          {/* Atenção agora */}
          {commercial.attentionLeads.length > 0 && (
            <Card className="p-5">
              <h3 className="text-sm font-bold text-gray-500 uppercase mb-4">Leads que precisam de atenção</h3>
              <div className="space-y-2">
                {commercial.attentionLeads.map(lead => (
                  <a key={lead.id} href={`/leads/${lead.id}`} className="flex items-center justify-between rounded-xl border border-gray-100 p-3 hover:border-solar-orange/40 transition">
                    <div>
                      <p className="font-bold text-sm text-graphite">{lead.name}</p>
                      <p className="text-xs text-gray-500">{stageLabel(lead.stage)} · {lead.reason}</p>
                    </div>
                    <span className="text-xs text-gray-400">{formatDate(lead.updatedAt)}</span>
                  </a>
                ))}
              </div>
            </Card>
          )}

          {/* Funil */}
          {commercial.stageBreakdown.length > 0 && (
            <Card className="p-5">
              <h3 className="text-sm font-bold text-gray-500 uppercase mb-4">Funil por etapa</h3>
              <div className="space-y-2">
                {commercial.stageBreakdown.map(stage => {
                  const max = Math.max(...commercial.stageBreakdown.map(s => s.count), 1);
                  return (
                    <div key={stage.stage}>
                      <div className="flex items-center justify-between text-sm"><span className="font-semibold">{stageLabel(stage.stage)}</span><span className="text-gray-500">{stage.count} · {formatCurrency(stage.value)}</span></div>
                      <div className="mt-1 h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-solar-orange rounded-full" style={{ width: `${Math.max(4, (stage.count / max) * 100)}%` }} /></div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Origem e conversões */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-5">
          <h3 className="text-sm font-bold text-gray-500 uppercase mb-4">Origem dos leads</h3>
          <div className="space-y-2">
            {metrics.leadsBySource.map(s => (
              <div key={s.source} className="flex items-center justify-between">
                <span className="text-sm font-medium">{s.source}</span>
                <span className="font-bold">{s.count}</span>
              </div>
            ))}
            {metrics.leadsBySource.length === 0 && <p className="text-sm text-gray-500">Sem dados.</p>}
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="text-sm font-bold text-gray-500 uppercase mb-4">Conversões por plataforma</h3>
          <div className="space-y-2">
            {metrics.conversionsByPlatform.map(p => (
              <div key={p.platform} className="flex items-center justify-between">
                <span className="text-sm font-medium">{p.platform}</span>
                <span className="font-bold">{p.count}</span>
              </div>
            ))}
            {metrics.conversionsByPlatform.length === 0 && <p className="text-sm text-gray-500">Nenhum evento enviado.</p>}
          </div>
        </Card>
      </div>

      {/* Leads por etapa */}
      <Card className="p-5">
        <h3 className="text-sm font-bold text-gray-500 uppercase mb-4">Leads por etapa</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {metrics.leadsByStage.map(s => (
            <div key={s.stage} className="rounded-xl bg-gray-50 p-3">
              <p className="font-semibold text-sm">{stageLabel(s.stage)}</p>
              <p className="text-xs text-gray-500">{s.count} leads</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Insights */}
      <Card className="p-6">
        <InsightsPanel />
      </Card>
    </div>
  );
}

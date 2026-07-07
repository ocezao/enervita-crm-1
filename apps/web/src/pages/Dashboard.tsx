import {
  AlertTriangle,
  ArrowUpRight,
  Calendar,
  ClipboardCheck,
  Clock,
  DollarSign,
  FileText,
  History,
  Sparkles,
  Target,
  Trophy,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useDashboardMetrics } from '../hooks/useCrm';
import { Badge, Card } from '../components/ui/Base';
import {
  GeometricFunnel,
  VerticalFunnel,
  Gauge,
  ActivityHeatmap,
  MonthComparison,
  SparklineRow,
  AlertBanner,
  Skeleton,
} from '../components/ui';

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

function iconTone(tone: 'blue' | 'orange' | 'green' | 'red') {
  const tones = {
    blue: 'bg-blue-50 text-blue-600',
    orange: 'bg-orange-500/10 text-orange-400',
    green: 'bg-mint-500/10 text-mint-400',
    red: 'bg-red-500/10 text-alert-red',
  };
  return tones[tone];
}

function CommercialMetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: LucideIcon;
  tone: 'blue' | 'orange' | 'green' | 'red';
}) {
  return (
    <Card>
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-text-secondary">{title}</p>
            <p className="mt-2 text-2xl font-black text-text-primary">{value}</p>
            <p className="mt-1 text-xs text-text-secondary">{subtitle}</p>
          </div>
          <div className={`rounded-2xl p-3 ${iconTone(tone)}`}>
            <Icon size={20} />
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function Dashboard() {
  const { metrics, loading } = useDashboardMetrics();

  if (loading || !metrics) return <p>Carregando dashboard...</p>;

  const commercial = metrics.commercial;

  const cards = [
    {
      label: 'Novos leads hoje',
      value: metrics.newLeadsToday,
      icon: Users,
      color: 'from-solar-orange to-solar-yellow',
      helper: 'Entradas capturadas nas últimas 24h.',
    },
    {
      label: 'Sem follow-up',
      value: metrics.leadsWithoutFollowup,
      icon: Clock,
      color: 'from-alert-red to-solar-orange',
      helper: 'Leads sem próxima ação definida.',
    },
    {
      label: 'Tarefas vencidas',
      value: metrics.overdueTasks,
      icon: AlertTriangle,
      color: 'from-red-500 to-pink-500',
      helper: 'Atividades que precisam de atenção.',
    },
    {
      label: 'Propostas abertas',
      value: metrics.openProposals,
      icon: FileText,
      color: 'from-blue-500 to-cyan-500',
      helper: 'Leads em estágio de proposta.',
    },
  ];

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-[2rem] bg-graphite p-8 text-white shadow-soft">
        <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-orange-500/30 blur-3xl" />
        <div className="absolute bottom-0 left-20 h-24 w-24 rounded-full bg-solar-yellow/20 blur-2xl" />
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-8 items-center">
          <div>
            <div className="flex items-center gap-2 text-sm uppercase tracking-[0.3em] text-solar-yellow font-bold">
              <Sparkles size={16} /> Cockpit Enervita
            </div>
            <h1 className="mt-4 text-4xl font-black max-w-2xl">Operação comercial sob controle, do lead ao contrato ganho.</h1>
            <p className="mt-3 text-white/70 max-w-xl">Acompanhe captação, follow-up, oportunidades, propostas e gargalos comerciais em um só lugar.</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl bg-bg-surface-1/10 border border-white/10 p-4">
              <p className="text-xs text-white/50 uppercase font-bold">Leads sem ação</p>
              <p className="text-3xl font-black mt-1">{metrics.leadsWithoutFollowup}</p>
            </div>
            <div className="rounded-2xl bg-bg-surface-1/10 border border-white/10 p-4">
              <p className="text-xs text-white/50 uppercase font-bold">Tarefas vencidas</p>
              <p className="text-3xl font-black mt-1">{metrics.overdueTasks}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {cards.map(({ label, value, icon: Icon, color, helper }) => (
          <Card key={label}>
            <div className="p-0">
              <div className={`h-1 bg-gradient-to-r ${color}`} />
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-text-secondary">{label}</p>
                    <p className="mt-3 text-3xl font-black text-text-primary">{formatNumber(value)}</p>
                  </div>
                  <div className="rounded-2xl bg-warm-sand/50 p-3 text-text-primary">
                    <Icon size={22} />
                  </div>
                </div>
                <p className="mt-4 text-xs text-text-secondary leading-relaxed">{helper}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {commercial && (
        <div className="space-y-6">
          <div>
            <p className="text-sm font-semibold text-orange-400 uppercase tracking-[0.2em]">Gestão comercial</p>
            <h2 className="text-2xl font-bold text-text-primary mt-1">Dinheiro, gargalo e ação de hoje</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <CommercialMetricCard title="Oportunidades abertas" value={formatCurrency(commercial.openOpportunityValue)} subtitle={`${formatNumber(commercial.openOpportunities)} em aberto`} icon={DollarSign} tone="blue" />
            <CommercialMetricCard title="Contratos ganhos" value={formatCurrency(commercial.wonOpportunityValue)} subtitle={`${formatNumber(commercial.wonOpportunities)} ganhos`} icon={Trophy} tone="green" />
            <CommercialMetricCard title="Propostas abertas" value={formatNumber(commercial.openProposals)} subtitle="Rascunhos e enviadas" icon={FileText} tone="orange" />
            <CommercialMetricCard title="Propostas aceitas" value={formatCurrency(commercial.acceptedProposalAnnualValue)} subtitle={`${formatNumber(commercial.acceptedProposals)} aceitas / ano`} icon={ClipboardCheck} tone="green" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <CommercialMetricCard title="Tarefas vencidas" value={formatNumber(commercial.overdueTasks)} subtitle="exigem ação imediata" icon={AlertTriangle} tone="red" />
            <CommercialMetricCard title="Leads sem próxima ação" value={formatNumber(commercial.leadsWithoutNextAction)} subtitle="risco de lead parado" icon={Clock} tone="orange" />
            <CommercialMetricCard title="Leads parados" value={formatNumber(commercial.staleLeads)} subtitle="sem atualização há 7+ dias" icon={Target} tone="blue" />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <Card className="xl:col-span-2">
              <div className="border-b border-border-soft px-6 py-4">
                <h3 className="text-lg font-bold text-text-primary">Atenção agora</h3>
              </div>
              <div className="p-6">
                {commercial.attentionLeads.length === 0 ? (
                  <p className="text-sm text-text-secondary">Nenhum lead crítico no momento.</p>
                ) : (
                  <div className="space-y-3">
                    {commercial.attentionLeads.map((lead) => (
                      <a key={lead.id} href={`/leads/${lead.id}`} className="flex items-center justify-between rounded-xl border border-border-soft bg-bg-surface-1 p-4 transition hover:border-solar-orange/40">
                        <div>
                          <p className="font-bold text-text-primary">{lead.name}</p>
                          <p className="text-xs text-text-secondary">{stageLabel(lead.stage)} · {lead.reason}</p>
                          <p className="text-xs text-text-secondary mt-1">Atualizado em {formatDate(lead.updatedAt)}</p>
                        </div>
                        <ArrowUpRight size={16} className="text-orange-400" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </Card>

            <Card>
              <div className="border-b border-border-soft px-6 py-4">
                <h3 className="text-lg font-bold text-text-primary">Funil por etapa</h3>
              </div>
              <div className="p-6">
                {commercial.stageBreakdown.length === 0 ? (
                  <p className="text-sm text-text-secondary">Sem dados de funil.</p>
                ) : (
                  <VerticalFunnel
                    steps={commercial.stageBreakdown.map((s, i) => ({
                      label: stageLabel(s.stage),
                      value: s.count,
                      sublabel: formatCurrency(s.value),
                      color: ['#FF9640', '#FF7A1A', '#E8620A', '#B84C08', '#3FDDA3', '#2ED9A3', '#1FB584'][i % 7],
                    }))}
                  />
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2">
          <div className="border-b border-border-soft px-6 py-4">
            <h3 className="text-lg font-bold text-text-primary">Leads por etapa</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {metrics.leadsByStage.map((stage) => (
                <div key={stage.stage} className="flex items-center justify-between rounded-2xl bg-warm-sand/50 px-4 py-3">
                  <div>
                    <p className="font-semibold text-text-primary">{stageLabel(stage.stage)}</p>
                    <p className="text-xs text-text-secondary">Distribuição do pipeline</p>
                  </div>
                  <Badge variant="info">{stage.count} leads</Badge>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <div className="border-b border-border-soft px-6 py-4">
            <h3 className="text-lg font-bold text-text-primary">Eventos recentes</h3>
          </div>
          <div className="space-y-4 p-6">
            {metrics.recentEvents.length === 0 && <p className="text-sm text-text-secondary">Nenhuma atividade recente registrada.</p>}
            {metrics.recentEvents.map((event) => (
              <div key={event.id} className="flex gap-3">
                <div className="mt-1 rounded-full bg-orange-500/10 p-2 text-orange-400">
                  {event.activityType === 'call' ? <Calendar size={16} /> : <History size={16} />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary">{event.outcome}</p>
                  <p className="text-xs text-text-secondary">{formatDate(event.occurredAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Nova seção com componentes estendidos */}
      {commercial && (
        <div className="space-y-6">
          <div>
            <p className="text-sm font-semibold text-orange-400 uppercase tracking-[0.2em]">Métricas avançadas</p>
            <h2 className="text-2xl font-bold text-text-primary mt-1">Performance e atividade</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <div className="border-b border-border-soft px-6 py-4">
                <h3 className="text-lg font-bold text-text-primary">Meta de conversão</h3>
              </div>
              <div className="p-6">
                <Gauge value={72} label="Conversão atual" target={80} />
              </div>
            </Card>

            <Card>
              <div className="border-b border-border-soft px-6 py-4">
                <h3 className="text-lg font-bold text-text-primary">Atividade semanal</h3>
              </div>
              <div className="p-6">
                <ActivityHeatmap
                  data={[
                    { day: 'Seg', intensity: 0.8 },
                    { day: 'Ter', intensity: 0.6 },
                    { day: 'Qua', intensity: 0.9 },
                    { day: 'Qui', intensity: 0.4 },
                    { day: 'Sex', intensity: 0.7 },
                    { day: 'Sáb', intensity: 0.2 },
                    { day: 'Dom', intensity: 0.1 },
                  ]}
                />
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <div className="border-b border-border-soft px-6 py-4">
                <h3 className="text-lg font-bold text-text-primary">Comparativo mensal</h3>
              </div>
              <div className="p-6">
                <MonthComparison
                  currentMonth={{ label: 'Este mês', value: 145, delta: 12 }}
                  previousMonth={{ label: 'Mês anterior', value: 129 }}
                />
              </div>
            </Card>

            <Card>
              <div className="border-b border-border-soft px-6 py-4">
                <h3 className="text-lg font-bold text-text-primary">Tendência de leads</h3>
              </div>
              <div className="p-6 space-y-3">
                <SparklineRow label="Novos leads" values={[12, 18, 15, 22, 19, 25, 28]} trend="up" />
                <SparklineRow label="Qualificados" values={[8, 10, 9, 14, 12, 16, 18]} trend="up" />
                <SparklineRow label="Propostas" values={[5, 7, 6, 8, 7, 9, 11]} trend="up" />
              </div>
            </Card>
          </div>

          <AlertBanner variant="info" title="Dica de performance" description="Seu time teve um aumento de 15% na conversão esta semana. Continue acompanhando o funil para identificar gargalos." />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="border-b border-border-soft px-6 py-4">
            <h3 className="text-lg font-bold text-text-primary">Origem dos leads</h3>
          </div>
          <div className="space-y-4 p-6">
            {metrics.leadsBySource.map((source) => (
              <div key={source.source} className="flex items-center justify-between">
                <span className="text-sm font-medium text-text-primary">{source.source}</span>
                <span className="font-bold text-text-primary">{source.count}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="border-b border-border-soft px-6 py-4">
            <h3 className="text-lg font-bold text-text-primary">Conversões enviadas</h3>
          </div>
          <div className="space-y-4 p-6">
            {metrics.conversionsByPlatform.length === 0 && <p className="text-sm text-text-secondary">Nenhum evento enviado ainda.</p>}
            {metrics.conversionsByPlatform.map((item) => (
              <div key={item.platform} className="flex items-center justify-between">
                <span className="text-sm font-medium text-text-primary">{item.platform}</span>
                <span className="font-bold text-text-primary">{item.count}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

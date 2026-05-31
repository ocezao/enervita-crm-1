import { Users, Clock, AlertTriangle, FileText, Calendar, CheckCircle2, TrendingUp, History, ArrowUpRight, Sparkles } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useDashboardMetrics } from '../hooks/useCrm';
import { MetricCard, Card, Button } from '../components/ui/Base';
import { PageHeader } from '../components/ui/LayoutComponents';
import { formatDate } from '../lib/utils';
import { Link } from 'react-router-dom';

const COLORS = ['#F58220', '#2EAD5B', '#0E7A3D', '#2A332D', '#EFE6D4'];

function shortLabel(value: string) {
  if (!value) return 'Origem';
  if (value.length <= 14) return value;
  return `${value.slice(0, 12)}…`;
}

function todayLabel() {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date());
}

export default function Dashboard() {
  const { metrics, loading } = useDashboardMetrics();

  if (loading || !metrics) {
    return <div className="space-y-6"><div className="h-24 rounded-3xl bg-gray-100 animate-pulse" /><div className="grid grid-cols-1 md:grid-cols-4 gap-4">{[1,2,3,4].map(i => <div key={i} className="h-32 rounded-2xl bg-gray-100 animate-pulse" />)}</div></div>;
  }

  const sourceData = metrics.leadsBySource.map((item) => ({ ...item, shortSource: shortLabel(item.source) }));
  const hasSourceData = sourceData.length > 0;
  const hasConversions = metrics.conversionsByPlatform.length > 0;
  const recent = metrics.recentEvents.slice(0, 5);
  const needsAttention = metrics.leadsWithoutFollowup + metrics.overdueTasks;

  return (
    <div className="space-y-8 max-w-[1500px] mx-auto overflow-hidden">
      <PageHeader
        title="Cockpit Comercial"
        description="Resumo executivo da operação Enervita, com gargalos e próximos movimentos comerciais."
        actions={<span className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-500"><Calendar size={18} /><span>Hoje, {todayLabel()}</span></span>}
      />

      <Card className="p-6 bg-gradient-to-br from-graphite via-graphite to-[#1f2f2a] text-white relative overflow-hidden">
        <div className="absolute -right-12 -top-12 h-56 w-56 rounded-full bg-solar-orange/20 blur-3xl" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] font-black text-white/50">Visão do dia</p>
            <h2 className="mt-3 text-3xl font-black">{needsAttention > 0 ? `${needsAttention} ponto(s) pedem ação` : 'Operação sem gargalos críticos'}</h2>
            <p className="mt-2 text-sm text-white/60 max-w-2xl">Use este cockpit para decidir: quem precisa de follow-up, onde os leads chegam e se a máquina de conversão está gerando sinais suficientes.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 min-w-[260px]">
            <div className="rounded-2xl bg-white/10 border border-white/10 p-4"><p className="text-xs text-white/50 uppercase font-bold">Sem follow-up</p><p className="text-3xl font-black mt-1">{metrics.leadsWithoutFollowup}</p></div>
            <div className="rounded-2xl bg-white/10 border border-white/10 p-4"><p className="text-xs text-white/50 uppercase font-bold">Tarefas vencidas</p><p className="text-3xl font-black mt-1">{metrics.overdueTasks}</p></div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard title="Novos Leads Hoje" value={metrics.newLeadsToday} icon={Users} color="solar" />
        <MetricCard title="Sem Follow-up" value={metrics.leadsWithoutFollowup} icon={Clock} color="graphite" />
        <MetricCard title="Tarefas Vencidas" value={metrics.overdueTasks} icon={AlertTriangle} color="graphite" />
        <MetricCard title="Propostas Abertas" value={metrics.openProposals} icon={FileText} color="energy" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 lg:col-span-2 overflow-visible">
          <div className="flex items-center justify-between gap-4 mb-6">
            <h3 className="font-black text-graphite flex items-center gap-2"><TrendingUp size={20} className="text-solar-orange" />Leads por Origem</h3>
            <Link to="/analytics"><Button variant="ghost" size="sm" className="gap-2"><ArrowUpRight size={14} /> Abrir relatório</Button></Link>
          </div>
          {hasSourceData ? (
            <div className="h-[320px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sourceData} margin={{ left: -10, right: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0F0F0" />
                  <XAxis dataKey="shortSource" axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#666'}} interval={0} angle={-18} textAnchor="end" height={55} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#666'}} allowDecimals={false} />
                  <Tooltip cursor={{fill: '#F9F9F9'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                  <Bar dataKey="count" fill="#F58220" radius={[8, 8, 0, 0]} barSize={34} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <div className="h-[320px] rounded-3xl border border-dashed border-gray-200 grid place-items-center text-center text-gray-500 px-6">Sem origem suficiente para montar gráfico ainda.</div>}
        </Card>

        <Card className="p-6">
          <h3 className="font-black text-graphite mb-6 flex items-center gap-2"><CheckCircle2 size={20} className="text-energy-green" />Conversões por Plataforma</h3>
          {hasConversions ? (
            <>
              <div className="h-[240px] w-full"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={metrics.conversionsByPlatform} cx="50%" cy="50%" innerRadius={58} outerRadius={82} paddingAngle={5} dataKey="count" nameKey="platform">{metrics.conversionsByPlatform.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>
              <div className="mt-4 space-y-2">{metrics.conversionsByPlatform.map((item, i) => <div key={item.platform} className="flex items-center justify-between text-sm"><div className="flex items-center gap-2 min-w-0"><div className="w-2 h-2 rounded-full shrink-0" style={{backgroundColor: COLORS[i % COLORS.length]}} /><span className="text-gray-500 truncate">{item.platform}</span></div><span className="font-bold">{item.count}</span></div>)}</div>
            </>
          ) : <div className="h-[240px] rounded-3xl border border-dashed border-gray-200 grid place-items-center text-center text-gray-500 px-6">Sem eventos de conversão enviados ainda.</div>}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="font-black text-graphite mb-6 flex items-center gap-2"><History size={20} className="text-solar-orange" />Atividades Recentes</h3>
          {recent.length > 0 ? <div className="space-y-4">{recent.map((event) => <div key={event.id} className="flex gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors"><div className="w-10 h-10 rounded-full bg-solar-orange/10 flex items-center justify-center text-solar-orange shrink-0"><FileText size={18} /></div><div className="min-w-0"><p className="text-sm font-medium text-graphite break-words">{event.outcome}</p><p className="text-xs text-gray-400 mt-1">{formatDate(event.occurredAt)}</p></div></div>)}</div> : <div className="rounded-3xl border border-dashed border-gray-200 p-8 text-center text-gray-500">Ainda não há atividades recentes registradas.</div>}
          <Link to="/analytics"><Button variant="outline" className="w-full mt-6">Ver todo o histórico</Button></Link>
        </Card>

        <Card className="p-6 bg-graphite text-white overflow-hidden relative">
          <div className="relative z-10"><h3 className="font-black text-lg mb-2 flex items-center gap-2"><Sparkles size={18} className="text-solar-orange" />Próximas ações recomendadas</h3><p className="text-gray-400 text-sm mb-6">Recomendações baseadas nos gargalos reais carregados do CRM.</p>
            <div className="space-y-3">
              <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/10 flex items-center justify-between gap-3"><div><p className="font-bold text-sm">{metrics.leadsWithoutFollowup} lead(s) sem follow-up</p><p className="text-xs text-gray-400">Priorize contato humano e próxima tarefa.</p></div><Link to="/leads"><Button size="sm" variant="secondary" className="h-8 whitespace-nowrap">Ver leads</Button></Link></div>
              <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/10 flex items-center justify-between gap-3"><div><p className="font-bold text-sm">{metrics.overdueTasks} tarefa(s) vencida(s)</p><p className="text-xs text-gray-400">Reorganize a fila comercial antes de novas demandas.</p></div><Link to="/tasks"><Button size="sm" variant="secondary" className="h-8 whitespace-nowrap">Ver tarefas</Button></Link></div>
            </div>
          </div><div className="absolute -right-8 -bottom-8 w-48 h-48 bg-solar-orange/20 rounded-full blur-3xl" />
        </Card>
      </div>
    </div>
  );
}

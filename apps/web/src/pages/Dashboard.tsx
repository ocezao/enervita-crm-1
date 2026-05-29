import { 
  Users, 
  Clock, 
  AlertTriangle, 
  FileText, 
  Calendar,
  CheckCircle2,
  TrendingUp,
  History
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { useDashboardMetrics } from '../hooks/useCrm';
import { MetricCard, Card, Button } from '../components/ui/Base';
import { PageHeader } from '../components/ui/LayoutComponents';
import { formatDate } from '../lib/utils';

const COLORS = ['#F58220', '#2EAD5B', '#0E7A3D', '#2A332D', '#EFE6D4'];

export default function Dashboard() {
  const { metrics, loading } = useDashboardMetrics();

  if (loading || !metrics) {
    return <div className="animate-pulse">Carregando painel...</div>;
  }

  return (
    <div className="space-y-8">
      <PageHeader 
        title="Cockpit Comercial" 
        description="Bem-vindo de volta! Aqui está o resumo da sua operação hoje."
        actions={
          <Button variant="outline" className="gap-2">
            <Calendar size={18} />
            <span>Hoje, 24 Mai</span>
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard 
          title="Novos Leads Hoje" 
          value={metrics.newLeadsToday} 
          icon={Users} 
          trend="+12%" 
          color="solar" 
        />
        <MetricCard 
          title="Sem Follow-up" 
          value={metrics.leadsWithoutFollowup} 
          icon={Clock} 
          trend="-2" 
          color="graphite" 
        />
        <MetricCard 
          title="Tarefas Vencidas" 
          value={metrics.overdueTasks} 
          icon={AlertTriangle} 
          color="graphite" 
        />
        <MetricCard 
          title="Propostas Abertas" 
          value={metrics.openProposals} 
          icon={FileText} 
          trend="+4" 
          color="energy" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-graphite flex items-center gap-2">
              <TrendingUp size={20} className="text-solar-orange" />
              Leads por Origem
            </h3>
            <Button variant="ghost" size="sm">Ver relatório</Button>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.leadsBySource}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0F0F0" />
                <XAxis dataKey="source" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#666'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#666'}} />
                <Tooltip 
                  cursor={{fill: '#F9F9F9'}}
                  contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}}
                />
                <Bar dataKey="count" fill="#F58220" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-bold text-graphite mb-6 flex items-center gap-2">
            <CheckCircle2 size={20} className="text-energy-green" />
            Conversões por Plataforma
          </h3>
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={metrics.conversionsByPlatform}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="count"
                  nameKey="platform"
                >
                  {metrics.conversionsByPlatform.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-2">
            {metrics.conversionsByPlatform.map((item, i) => (
              <div key={item.platform} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{backgroundColor: COLORS[i % COLORS.length]}}></div>
                  <span className="text-gray-500">{item.platform}</span>
                </div>
                <span className="font-bold">{item.count}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="font-bold text-graphite mb-6 flex items-center gap-2">
            <History size={20} className="text-solar-orange" />
            Atividades Recentes
          </h3>
          <div className="space-y-4">
            {metrics.recentEvents.map((event) => (
              <div key={event.id} className="flex gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                <div className="w-10 h-10 rounded-full bg-solar-orange/10 flex items-center justify-center text-solar-orange shrink-0">
                  <FileText size={18} />
                </div>
                <div>
                  <p className="text-sm font-medium text-graphite">{event.outcome}</p>
                  <p className="text-xs text-gray-400 mt-1">{formatDate(event.occurredAt)}</p>
                </div>
              </div>
            ))}
          </div>
          <Button variant="outline" className="w-full mt-6">Ver todo o histórico</Button>
        </Card>

        <Card className="p-6 bg-graphite text-white overflow-hidden relative">
          <div className="relative z-10">
            <h3 className="font-bold text-lg mb-2">Próximas ações recomendadas</h3>
            <p className="text-gray-400 text-sm mb-6">IA identificou 3 leads com alta probabilidade de fechamento que precisam de atenção.</p>
            
            <div className="space-y-3">
              <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/10 flex items-center justify-between">
                <div>
                  <p className="font-bold text-sm">Roberto Almeida</p>
                  <p className="text-xs text-gray-400">Pendente há 2 dias • Proposta UFV</p>
                </div>
                <Button size="sm" variant="secondary" className="h-8">Ligar agora</Button>
              </div>
              <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/10 flex items-center justify-between">
                <div>
                  <p className="font-bold text-sm">Mariana Costa</p>
                  <p className="text-xs text-gray-400">Lead qualificado • Aguardando conta</p>
                </div>
                <Button size="sm" variant="secondary" className="h-8">Enviar WhatsApp</Button>
              </div>
            </div>
          </div>
          <div className="absolute -right-8 -bottom-8 w-48 h-48 bg-solar-orange/20 rounded-full blur-3xl"></div>
        </Card>
      </div>
    </div>
  );
}

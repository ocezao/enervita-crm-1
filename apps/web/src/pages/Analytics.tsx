import { PageHeader } from '../components/ui/LayoutComponents';
import { Card, Button } from '../components/ui/Base';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area
} from 'recharts';
import { TrendingUp, Target } from 'lucide-react';
import { formatCurrency } from '../lib/utils';

const funnelData = [
  { stage: 'Leads Brutos', count: 120, conversion: '100%' },
  { stage: 'Qualificados', count: 45, conversion: '37.5%' },
  { stage: 'Proposta Enviada', count: 20, conversion: '44.4%' },
  { stage: 'Fechados', count: 8, conversion: '40%' },
];

const conversionOverTime = [
  { date: '18/05', leads: 12, sales: 1 },
  { date: '19/05', leads: 18, sales: 2 },
  { date: '20/05', leads: 15, sales: 1 },
  { date: '21/05', leads: 22, sales: 3 },
  { date: '22/05', leads: 25, sales: 0 },
  { date: '23/05', leads: 19, sales: 1 },
  { date: '24/05', leads: 30, sales: 2 },
];

export default function Analytics() {
  return (
    <div className="space-y-8">
      <PageHeader 
        title="Analytics Comercial" 
        description="Analise o desempenho de ponta a ponta da sua operação."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm">Últimos 30 dias</Button>
            <Button variant="primary" size="sm">Baixar Relatório</Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="p-6">
          <p className="text-xs font-bold text-gray-400 uppercase mb-1">Custo por Lead (CPL)</p>
          <h3 className="text-2xl font-bold text-graphite">R$ 18,40</h3>
          <p className="text-xs text-energy-success font-medium mt-2 flex items-center gap-1">
            <TrendingUp size={12} /> -5.2% vs mês anterior
          </p>
        </Card>
        <Card className="p-6">
          <p className="text-xs font-bold text-gray-400 uppercase mb-1">Taxa de Conversão</p>
          <h3 className="text-2xl font-bold text-graphite">6.7%</h3>
          <p className="text-xs text-energy-success font-medium mt-2 flex items-center gap-1">
            <TrendingUp size={12} /> +1.1% vs mês anterior
          </p>
        </Card>
        <Card className="p-6">
          <p className="text-xs font-bold text-gray-400 uppercase mb-1">Tempo Médio 1º Contato</p>
          <h3 className="text-2xl font-bold text-graphite">14 min</h3>
          <p className="text-xs text-alert-red font-medium mt-2 flex items-center gap-1">
            <TrendingUp size={12} className="rotate-180" /> +2 min vs mês anterior
          </p>
        </Card>
        <Card className="p-6">
          <p className="text-xs font-bold text-gray-400 uppercase mb-1">ROAS Estimado</p>
          <h3 className="text-2xl font-bold text-graphite">12.4x</h3>
          <p className="text-xs text-energy-success font-medium mt-2 flex items-center gap-1">
            <TrendingUp size={12} /> +2.1x vs mês anterior
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="font-bold text-graphite mb-6 flex items-center gap-2">
            <Target size={20} className="text-solar-orange" />
            Funil de Vendas (Últimos 30 dias)
          </h3>
          <div className="space-y-4">
            {funnelData.map((item, i) => (
              <div key={item.stage} className="relative">
                <div 
                  className="h-12 bg-solar-orange/10 border-l-4 border-solar-orange rounded-r-lg flex items-center justify-between px-4"
                  style={{ width: `${100 - (i * 15)}%` }}
                >
                  <span className="text-sm font-bold text-graphite">{item.stage}</span>
                  <span className="text-sm font-bold text-solar-orange">{item.count}</span>
                </div>
                {i < funnelData.length - 1 && (
                  <div className="flex justify-center py-1">
                    <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100">
                      Conv: {funnelData[i+1].conversion}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-bold text-graphite mb-6 flex items-center gap-2">
            <TrendingUp size={20} className="text-energy-green" />
            Performance Diária
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={conversionOverTime}>
                <defs>
                  <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F58220" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#F58220" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0F0F0" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                <Tooltip />
                <Area type="monotone" dataKey="leads" stroke="#F58220" fillOpacity={1} fill="url(#colorLeads)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 lg:col-span-1">
          <h3 className="font-bold text-sm uppercase tracking-widest text-gray-400 mb-6">Eficiência por SDR</h3>
          <div className="space-y-6">
            {[
              { name: 'Carlos SDR', deals: 12, rate: '15%' },
              { name: 'Ana SDR', deals: 9, rate: '12%' },
              { name: 'Bruna SDR', deals: 7, rate: '9%' },
            ].map((sdr) => (
              <div key={sdr.name}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-bold text-graphite">{sdr.name}</span>
                  <span className="text-xs font-bold text-energy-green">{sdr.deals} fechamentos</span>
                </div>
                <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-energy-green h-full" style={{ width: sdr.rate }}></div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6 lg:col-span-2">
           <h3 className="font-bold text-sm uppercase tracking-widest text-gray-400 mb-6">Top Campanhas por ROAS</h3>
           <div className="overflow-x-auto">
             <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-400">
                    <th className="pb-3 font-bold">Campanha</th>
                    <th className="pb-3 font-bold">Investimento</th>
                    <th className="pb-3 font-bold">Leads</th>
                    <th className="pb-3 font-bold">Vendas</th>
                    <th className="pb-3 font-bold">ROAS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[
                    { name: 'Solar_SP_Verao', spent: 1500, leads: 82, sales: 4, roas: '18.2x' },
                    { name: 'Assinatura_Comercial_RJ', spent: 2200, leads: 115, sales: 3, roas: '9.4x' },
                    { name: 'Incentivo_Solar_Sul', spent: 800, leads: 34, sales: 2, roas: '14.1x' },
                  ].map((camp, i) => (
                    <tr key={i} className="hover:bg-gray-50/50">
                      <td className="py-4 font-bold text-graphite">{camp.name}</td>
                      <td className="py-4 text-gray-500">{formatCurrency(camp.spent)}</td>
                      <td className="py-4 text-gray-500">{camp.leads}</td>
                      <td className="py-4 text-gray-500">{camp.sales}</td>
                      <td className="py-4 font-bold text-energy-success">{camp.roas}</td>
                    </tr>
                  ))}
                </tbody>
             </table>
           </div>
        </Card>
      </div>
    </div>
  );
}

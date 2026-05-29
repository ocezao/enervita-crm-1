import { useLeads } from '../hooks/useCrm';
import { PageHeader } from '../components/ui/LayoutComponents';
import { Button, Card, Badge } from '../components/ui/Base';
import { StageBadge, PriorityBadge } from '../components/ui/StatusBadges';
import { Search, Filter, MoreHorizontal, Eye, MessageSquare } from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import { Link } from 'react-router-dom';

export default function Leads() {
  const { leads, loading } = useLeads();

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Leads" 
        description="Gerencie todos os seus leads e oportunidades em um só lugar."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-2">
              <Filter size={16} /> Filtros
            </Button>
            <Button variant="primary" size="sm">Exportar CSV</Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 bg-solar-orange/5 border-solar-orange/10">
          <p className="text-xs font-bold text-solar-orange uppercase tracking-wider">Total de Leads</p>
          <h4 className="text-2xl font-bold text-graphite mt-1">{leads.length}</h4>
        </Card>
        <Card className="p-4 bg-energy-green/5 border-energy-green/10">
          <p className="text-xs font-bold text-energy-green uppercase tracking-wider">Qualificados</p>
          <h4 className="text-2xl font-bold text-graphite mt-1">
            {leads.filter(l => l.qualificationStatus === 'Qualificado').length}
          </h4>
        </Card>
        <Card className="p-4 bg-graphite/5 border-graphite/10">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Aguardando Contato</p>
          <h4 className="text-2xl font-bold text-graphite mt-1">
            {leads.filter(l => l.stage === 'novo_lead').length}
          </h4>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              placeholder="Buscar por nome, empresa ou e-mail..." 
              className="w-full bg-white border border-gray-200 rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-solar-orange/30"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                <th className="px-6 py-4 font-bold">Lead</th>
                <th className="px-6 py-4 font-bold">Status / Etapa</th>
                <th className="px-6 py-4 font-bold">Prioridade</th>
                <th className="px-6 py-4 font-bold">Valor Conta</th>
                <th className="px-6 py-4 font-bold">Origem</th>
                <th className="px-6 py-4 font-bold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">Carregando leads...</td></tr>
              ) : leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-solar-orange/10 flex items-center justify-center text-solar-orange font-bold text-sm">
                        {lead.contact?.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-graphite group-hover:text-solar-orange transition-colors">
                          {lead.contact?.name}
                        </p>
                        <p className="text-xs text-gray-400">{lead.contact?.company}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <StageBadge stage={lead.stage} />
                      <span className="text-[10px] text-gray-400 font-medium ml-1">{lead.qualificationStatus}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <PriorityBadge priority={lead.priority} />
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-graphite">{formatCurrency(lead.energyBillValue)}</p>
                    <p className="text-[10px] text-gray-400">Econ. {formatCurrency(lead.projectedSavings)}</p>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant="default" className="bg-gray-100 text-gray-500 lowercase">{lead.leadSource}</Badge>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link to={`/leads/${lead.id}`}>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                          <Eye size={16} className="text-gray-500" />
                        </Button>
                      </Link>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                        <MessageSquare size={16} className="text-gray-500" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                        <MoreHorizontal size={16} className="text-gray-500" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="p-4 border-t border-gray-100 bg-gray-50/30 flex items-center justify-between">
          <p className="text-xs text-gray-500">Mostrando {leads.length} de {leads.length} leads</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled>Anterior</Button>
            <Button variant="outline" size="sm" disabled>Próximo</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

import { useLeads } from '../hooks/useCrm';
import { PageHeader } from '../components/ui/LayoutComponents';
import { LeadStage, Lead } from '../lib/api/types';
import { Card, Button } from '../components/ui/Base';
import { PriorityBadge } from '../components/ui/StatusBadges';
import { formatCurrency } from '../lib/utils';
import { MoreHorizontal, Plus, Clock, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';

const stages: { id: LeadStage; label: string }[] = [
  { id: 'novo_lead', label: 'Novo Lead' },
  { id: 'qualificacao', label: 'Qualificação' },
  { id: 'atendimento_iniciado', label: 'Atendimento' },
  { id: 'conta_recebida', label: 'Conta Recebida' },
  { id: 'diagnostico', label: 'Diagnóstico' },
  { id: 'proposta_enviada', label: 'Proposta' },
  { id: 'contrato_enervita', label: 'Contrato' },
];

export default function Pipeline() {
  const { leads } = useLeads();

  const getLeadsInStage = (stageId: LeadStage) => leads.filter(l => l.stage === stageId);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      <PageHeader 
        title="Pipeline de Vendas" 
        description="Acompanhe o progresso das suas oportunidades."
        actions={
          <Button variant="primary" size="sm" className="gap-2">
            <Plus size={16} /> Novo Lead
          </Button>
        }
      />

      <div className="flex-1 overflow-x-auto pb-4">
        <div className="flex gap-4 h-full min-w-max">
          {stages.map((stage) => (
            <div key={stage.id} className="w-72 flex flex-col gap-3">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-graphite uppercase tracking-wider">{stage.label}</h3>
                  <span className="bg-gray-200 text-gray-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {getLeadsInStage(stage.id).length}
                  </span>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <Plus size={14} className="text-gray-400" />
                </Button>
              </div>

              <div className="flex-1 bg-gray-100/50 rounded-2xl p-2 space-y-3 overflow-y-auto border border-gray-200/50">
                {getLeadsInStage(stage.id).map((lead) => (
                  <KanbanCard key={lead.id} lead={lead} />
                ))}
                {getLeadsInStage(stage.id).length === 0 && (
                  <div className="py-8 text-center border-2 border-dashed border-gray-200 rounded-xl">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Vazio</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function KanbanCard({ lead }: { lead: Lead }) {
  return (
    <Link to={`/leads/${lead.id}`}>
      <Card className="p-4 hover:shadow-md hover:border-solar-orange/30 transition-all group cursor-pointer border-transparent">
        <div className="flex justify-between items-start mb-3">
          <PriorityBadge priority={lead.priority} />
          <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
            <MoreHorizontal size={14} />
          </Button>
        </div>
        
        <h4 className="font-bold text-sm text-graphite mb-1 group-hover:text-solar-orange transition-colors">
          {lead.contact?.name}
        </h4>
        <p className="text-xs text-gray-500 mb-4">{lead.contact?.company}</p>

        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-[10px] text-gray-500 font-medium">
            <Clock size={12} className="text-solar-orange" />
            Parado há 2 dias
          </div>
          <div className="flex items-center gap-2 text-[10px] text-gray-500 font-medium">
            <Phone size={12} className="text-energy-green" />
            Próxima ação: Ligar amanhã
          </div>
        </div>

        <div className="pt-3 border-t border-gray-50 flex items-center justify-between">
          <p className="font-bold text-sm text-energy-green">{formatCurrency(lead.energyBillValue)}</p>
          <div className="flex -space-x-2">
            <div className="w-6 h-6 rounded-full border-2 border-white bg-solar-orange text-[8px] flex items-center justify-center text-white font-bold">
              CS
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}

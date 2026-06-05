import { Link } from 'react-router-dom';
import { FileText, Plus, Send, TrendingUp } from 'lucide-react';
import { PageHeader } from '../components/ui/LayoutComponents';
import { Badge, Button, Card } from '../components/ui/Base';
import { useProposals } from '../hooks/useCrm';
import { formatCurrency } from '../lib/utils';

const statusLabels = {
  draft: 'Rascunho',
  sent: 'Enviada',
  accepted: 'Aceita',
  lost: 'Perdida',
  expired: 'Expirada',
} as const;

const statusVariants = {
  draft: 'warning',
  sent: 'info',
  accepted: 'success',
  lost: 'error',
  expired: 'default',
} as const;

export default function Proposals() {
  const { proposals, loading } = useProposals();

  const openValue = proposals.filter((proposal) => proposal.status === 'draft' || proposal.status === 'sent').reduce((sum, proposal) => sum + proposal.projectedAnnualSavings, 0);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Propostas"
        description="Módulo próprio do CRM custom para acompanhar propostas comerciais da Enervita. A criação começa no detalhe de um lead para evitar proposta solta."
        actions={<Link to="/leads"><Button size="sm"><Plus size={16} className="mr-2" />Criar pelo lead</Button></Link>}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-5">
          <p className="text-xs font-bold text-gray-400 uppercase">Propostas cadastradas</p>
          <h3 className="text-2xl font-bold text-graphite mt-1">{loading ? '...' : proposals.length}</h3>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-bold text-gray-400 uppercase">Economia anual em aberto</p>
          <h3 className="text-2xl font-bold text-energy-success mt-1">{formatCurrency(openValue)}</h3>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-bold text-gray-400 uppercase">Status comercial</p>
          <h3 className="text-2xl font-bold text-solar-orange mt-1">Em acompanhamento</h3>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="md:hidden divide-y divide-gray-100">
          {proposals.map((proposal) => (
            <article key={proposal.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><p className="font-bold text-graphite truncate flex items-center gap-2"><FileText size={16} className="text-solar-orange shrink-0" />{proposal.title}</p><p className="text-xs text-gray-500 truncate">{proposal.leadName ?? proposal.leadId}</p></div>
                <Badge variant={statusVariants[proposal.status]}>{statusLabels[proposal.status]}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs text-gray-500">
                <div><span className="block font-bold text-gray-400 uppercase">Conta</span>{formatCurrency(proposal.monthlyBillValue)}</div>
                <div><span className="block font-bold text-gray-400 uppercase">Desconto</span>{proposal.discountPercentage}%</div>
                <div className="col-span-2"><span className="block font-bold text-gray-400 uppercase">Economia anual</span><span className="font-bold text-energy-success">{formatCurrency(proposal.projectedAnnualSavings)}</span></div>
              </div>
            </article>
          ))}
          {!loading && proposals.length === 0 && <div className="px-6 py-12 text-center text-gray-400"><Send className="mx-auto mb-3" />Nenhuma proposta cadastrada ainda.</div>}
        </div>
        <div className="hidden md:block crm-scroll-panel overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-400 uppercase text-xs font-bold">
            <tr>
              <th className="px-6 py-4">Proposta</th>
              <th className="px-6 py-4">Lead</th>
              <th className="px-6 py-4">Conta</th>
              <th className="px-6 py-4">Desconto</th>
              <th className="px-6 py-4">Economia anual</th>
              <th className="px-6 py-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {proposals.map((proposal) => (
              <tr key={proposal.id} className="hover:bg-gray-50/60">
                <td className="px-6 py-4 font-bold text-graphite flex items-center gap-2"><FileText size={16} className="text-solar-orange" />{proposal.title}</td>
                <td className="px-6 py-4 text-gray-600">{proposal.leadName ?? proposal.leadId}</td>
                <td className="px-6 py-4 text-gray-600">{formatCurrency(proposal.monthlyBillValue)}</td>
                <td className="px-6 py-4 text-gray-600">{proposal.discountPercentage}%</td>
                <td className="px-6 py-4 font-bold text-energy-success flex items-center gap-1"><TrendingUp size={14} />{formatCurrency(proposal.projectedAnnualSavings)}</td>
                <td className="px-6 py-4"><Badge variant={statusVariants[proposal.status]}>{statusLabels[proposal.status]}</Badge></td>
              </tr>
            ))}
            {!loading && proposals.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                  <Send className="mx-auto mb-3" />Nenhuma proposta cadastrada ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </Card>
    </div>
  );
}

import { useState } from 'react';
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
  const { proposals, loading, createProposal } = useProposals();
  const [message, setMessage] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const openValue = proposals.filter((proposal) => proposal.status === 'draft' || proposal.status === 'sent').reduce((sum, proposal) => sum + proposal.projectedAnnualSavings, 0);

  const handleCreateSample = async () => {
    const firstLead = proposals[0]?.leadId;
    if (!firstLead) {
      setMessage('Crie a primeira proposta a partir do detalhe de um lead homologado.');
      return;
    }
    setCreating(true);
    try {
      const proposal = await createProposal({
        leadId: firstLead,
        title: 'Proposta de homologação operacional',
        monthlyBillValue: 2500,
        estimatedKwh: 1800,
        discountPercentage: 20,
        projectedMonthlySavings: 500,
        projectedAnnualSavings: 6000,
        notes: 'Rascunho gerado para validar o módulo próprio de propostas.',
      });
      setMessage(`Proposta ${proposal.title} criada em rascunho.`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Propostas"
        description="Módulo próprio do CRM custom para criar, acompanhar e homologar propostas comerciais da Enervita."
        actions={<Button size="sm" onClick={handleCreateSample} disabled={creating}><Plus size={16} className="mr-2" />Nova proposta</Button>}
      />

      {message && <Card className="p-4 text-sm text-graphite border-solar-orange/20 bg-solar-orange/5">{message}</Card>}

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
          <p className="text-xs font-bold text-gray-400 uppercase">Status operacional</p>
          <h3 className="text-2xl font-bold text-solar-orange mt-1">Homologação</h3>
        </Card>
      </div>

      <Card className="overflow-hidden">
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
      </Card>
    </div>
  );
}

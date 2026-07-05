import { Link } from 'react-router-dom';
import { Copy, FileText, Layers3, Send, TrendingUp, Users } from 'lucide-react';
import { PageHeader } from '../components/ui/LayoutComponents';
import { Badge, Button, Card } from '../components/ui/Base';
import { useProposals } from '../hooks/useCrm';
import { formatCurrency, formatDate } from '../lib/utils';
import type { Proposal } from '../lib/api/types';

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

function ProposalStatusBadge({ proposal }: { proposal: Proposal }) {
  return <Badge variant={statusVariants[proposal.status]}>{statusLabels[proposal.status]}</Badge>;
}

function ProposalMoney({ value }: { value: number | null | undefined }) {
  return <>{formatCurrency(Number(value ?? 0))}</>;
}

function solarNumberText(value: unknown, digits = 2, fallback = '-'): string {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(digits) : fallback;
}

export default function Proposals() {
  const { proposals, templates, loading, error, refresh } = useProposals();

  const usableTemplates = templates.filter((proposal) => proposal.isTemplate);
  const leadProposals = proposals.filter((proposal) => !proposal.isTemplate);
  const leadsWithProposals = new Set(leadProposals.map((proposal) => proposal.leadId).filter(Boolean)).size;
  const openValue = leadProposals
    .filter((proposal) => proposal.status === 'draft' || proposal.status === 'sent')
    .reduce((sum, proposal) => sum + Number(proposal.projectedAnnualSavings ?? 0), 0);
  const sentOrAccepted = leadProposals.filter((proposal) => proposal.status === 'sent' || proposal.status === 'accepted').length;
  const withSolarDimensioning = leadProposals.filter((proposal) => proposal.solarSummary).length;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Propostas"
        description="Modelos reutilizáveis e propostas vinculadas aos leads em um só lugar. Use os modelos para padronizar a oferta e acompanhe quais leads já receberam proposta."
        actions={<Link to="/leads"><Button size="sm"><Users size={16} className="mr-2" />Criar pelo lead</Button></Link>}
      />

      {error && (
        <Card className="border-alert-red/20 bg-alert-red/5 p-4 text-sm font-semibold text-alert-red">
          {error} <button type="button" className="underline" onClick={refresh}>Tentar novamente</button>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-5">
          <p className="text-xs font-bold text-gray-400 uppercase">Modelos utilizáveis</p>
          <h3 className="text-2xl font-bold text-graphite mt-1">{loading ? '...' : usableTemplates.length}</h3>
          <p className="mt-1 text-xs text-gray-500">Templates globais para qualquer lead.</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-bold text-gray-400 uppercase">Leads com proposta</p>
          <h3 className="text-2xl font-bold text-solar-orange mt-1">{loading ? '...' : leadsWithProposals}</h3>
          <p className="mt-1 text-xs text-gray-500">Leads únicos com proposta criada.</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-bold text-gray-400 uppercase">Economia anual em aberto</p>
          <h3 className="text-2xl font-bold text-energy-success mt-1">{formatCurrency(openValue)}</h3>
          <p className="mt-1 text-xs text-gray-500">Rascunhos e enviadas.</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-bold text-gray-400 uppercase">Dimensionadas</p>
          <h3 className="text-2xl font-bold text-graphite mt-1">{loading ? '...' : withSolarDimensioning}</h3>
          <p className="mt-1 text-xs text-gray-500">{sentOrAccepted} enviadas ou aceitas.</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[0.9fr_1.6fr] gap-6 items-start">
        <Card className="overflow-hidden">
          <div className="border-b border-gray-100 bg-gradient-to-r from-solar-orange/10 via-white to-energy-green/10 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-solar-orange">Biblioteca</p>
                <h3 className="text-lg font-black text-graphite">Modelos de proposta</h3>
                <p className="mt-1 text-sm text-gray-500">Usáveis em todos os leads. Base para acelerar propostas recorrentes.</p>
              </div>
              <Layers3 className="text-solar-orange" size={24} />
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            {usableTemplates.map((template) => (
              <article key={template.id} className="p-5 hover:bg-gray-50/70 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 truncate font-black text-graphite"><Copy size={16} className="shrink-0 text-solar-orange" />{template.title}</p>
                    <p className="mt-1 text-xs text-gray-500">{template.templateName || 'Modelo sem nome interno'}</p>
                  </div>
                  <Badge variant="info">Modelo</Badge>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-gray-500">
                  <div><span className="block font-bold uppercase text-gray-400">Desconto</span>{template.discountPercentage}%</div>
                  <div><span className="block font-bold uppercase text-gray-400">Economia anual</span><strong className="text-energy-success"><ProposalMoney value={template.projectedAnnualSavings} /></strong></div>
                </div>
                {template.contentText && <p className="mt-3 line-clamp-2 text-sm text-gray-500">{template.contentText}</p>}
              </article>
            ))}
            {!loading && usableTemplates.length === 0 && (
              <div className="px-6 py-12 text-center text-gray-400">
                <Layers3 className="mx-auto mb-3" />Nenhum modelo cadastrado ainda.
              </div>
            )}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-gray-100 p-5">
            <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-energy-green">Leads</p>
                <h3 className="text-lg font-black text-graphite">Leads com propostas</h3>
                <p className="mt-1 text-sm text-gray-500">Lista operacional para acompanhar proposta por lead e status comercial.</p>
              </div>
              <span className="text-xs font-bold text-gray-400">{leadProposals.length} propostas vinculadas</span>
            </div>
          </div>
          <div className="md:hidden divide-y divide-gray-100">
            {leadProposals.map((proposal) => (
              <article key={proposal.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><p className="font-bold text-graphite truncate flex items-center gap-2"><FileText size={16} className="text-solar-orange shrink-0" />{proposal.title}</p><p className="text-xs text-gray-500 truncate">{proposal.leadName ?? proposal.leadId}</p></div>
                  <ProposalStatusBadge proposal={proposal} />
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs text-gray-500">
                  <div><span className="block font-bold text-gray-400 uppercase">Conta</span><ProposalMoney value={proposal.monthlyBillValue} /></div>
                  <div><span className="block font-bold text-gray-400 uppercase">Desconto</span>{proposal.discountPercentage}%</div>
                  {proposal.solarSummary && <div className="col-span-2"><span className="block font-bold text-gray-400 uppercase">Sistema</span>{proposal.solarSummary.quantidadeSugerida ?? '-'} módulos · {solarNumberText(proposal.solarSummary.potenciaTotalKwp)} kWp · {proposal.solarSummary.cidade}/{proposal.solarSummary.uf}</div>}
                  <div className="col-span-2"><span className="block font-bold text-gray-400 uppercase">Economia anual</span><span className="font-bold text-energy-success"><ProposalMoney value={proposal.projectedAnnualSavings} /></span></div>
                </div>
              </article>
            ))}
            {!loading && leadProposals.length === 0 && <div className="px-6 py-12 text-center text-gray-400"><Send className="mx-auto mb-3" />Nenhum lead com proposta ainda.</div>}
          </div>
          <div className="hidden md:block crm-scroll-panel overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-400 uppercase text-xs font-bold">
                <tr>
                  <th className="px-6 py-4">Proposta</th>
                  <th className="px-6 py-4">Lead</th>
                  <th className="px-6 py-4">Conta</th>
                  <th className="px-6 py-4">Sistema</th>
                  <th className="px-6 py-4">Desconto</th>
                  <th className="px-6 py-4">Economia anual</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Atualizada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {leadProposals.map((proposal) => (
                  <tr key={proposal.id} className="hover:bg-gray-50/60">
                    <td className="px-6 py-4 font-bold text-graphite"><div className="flex items-center gap-2"><FileText size={16} className="text-solar-orange" />{proposal.title}</div></td>
                    <td className="px-6 py-4 text-gray-600">{proposal.leadName ?? proposal.leadId}</td>
                    <td className="px-6 py-4 text-gray-600"><ProposalMoney value={proposal.monthlyBillValue} /></td>
                    <td className="px-6 py-4 text-xs text-gray-600">
                      {proposal.solarSummary ? (
                        <div className="leading-relaxed">
                          <p className="font-bold text-graphite">{proposal.solarSummary.quantidadeSugerida ?? '-'} módulos · {solarNumberText(proposal.solarSummary.potenciaTotalKwp)} kWp</p>
                          <p>{proposal.solarSummary.cidade}/{proposal.solarSummary.uf} · {proposal.solarSummary.inversorSugeridoNome ?? 'inversor a validar'}</p>
                        </div>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4 text-gray-600">{proposal.discountPercentage}%</td>
                    <td className="px-6 py-4 font-bold text-energy-success"><span className="flex items-center gap-1"><TrendingUp size={14} /><ProposalMoney value={proposal.projectedAnnualSavings} /></span></td>
                    <td className="px-6 py-4"><ProposalStatusBadge proposal={proposal} /></td>
                    <td className="px-6 py-4 text-xs text-gray-500">{formatDate(proposal.updatedAt || proposal.createdAt)}</td>
                  </tr>
                ))}
                {!loading && leadProposals.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-400">
                      <Send className="mx-auto mb-3" />Nenhum lead com proposta ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

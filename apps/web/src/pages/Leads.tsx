import { useMemo, useState, type FormEvent } from 'react';
import { useLeads } from '../hooks/useCrm';
import { PageHeader } from '../components/ui/LayoutComponents';
import { Button, Card, Badge } from '../components/ui/Base';
import { StageBadge, PriorityBadge } from '../components/ui/StatusBadges';
import { Search, Filter, MoreHorizontal, Eye, MessageSquare, Download, Users, Flame, Clock, X, Trash2, Tags, UserPlus, Save } from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { userHasPermission } from '../auth/permissions';
import type { Lead, LeadStage } from '../lib/api/types';
import { countAudienceReadyLeads, exportLeadsForAudience } from '../lib/api/leadAudienceExport';
import { api, documentDigits, formatCnpj, formatCpf, isValidCnpj, isValidCpf } from '../lib/api/crmApi';

type ManualLeadForm = {
  name: string;
  phone: string;
  email: string;
  company: string;
  cpf: string;
  cnpj: string;
  city: string;
  state: string;
  serviceInterest: string;
  unitType: string;
  concessionaria: string;
  monthlyBillValue: string;
  averageConsumptionKwh: string;
  leadSource: string;
  priority: Lead['priority'];
  qualificationStatus: string;
  notes: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  utmTerm: string;
};

const emptyManualLeadForm: ManualLeadForm = {
  name: '',
  phone: '',
  email: '',
  company: '',
  cpf: '',
  cnpj: '',
  city: '',
  state: '',
  serviceInterest: 'assinatura_energia',
  unitType: 'residencial',
  concessionaria: '',
  monthlyBillValue: '',
  averageConsumptionKwh: '',
  leadSource: 'crm_manual',
  priority: 'media',
  qualificationStatus: 'aguardando',
  notes: '',
  utmSource: '',
  utmMedium: '',
  utmCampaign: '',
  utmContent: '',
  utmTerm: '',
};

const serviceOptions = [
  { value: 'assinatura_energia', label: 'Assinatura de energia' },
  { value: 'solar_fotovoltaica', label: 'Energia solar' },
  { value: 'bateria_backup', label: 'Baterias e backup' },
  { value: 'usina_investimento', label: 'Usina ou investimento' },
  { value: 'gestao_energia', label: 'Gestão de energia' },
  { value: 'outro', label: 'Outro serviço' },
];

const unitTypeOptions = [
  { value: 'residencial', label: 'Residencial' },
  { value: 'comercial', label: 'Comercial' },
  { value: 'industrial', label: 'Industrial' },
  { value: 'rural', label: 'Rural' },
  { value: 'condominio', label: 'Condomínio' },
  { value: 'poder_publico', label: 'Poder público' },
];

function whatsappUrl(lead: Lead): string | null {
  const digits = String(lead.contact?.phone ?? '').replace(/\D/g, '');
  if (!digits) return null;
  const withCountry = digits.startsWith('55') ? digits : `55${digits}`;
  const text = encodeURIComponent(`Olá ${lead.contact?.name || ''}, aqui é da Enervita. Podemos falar sobre sua economia de energia?`);
  return `https://wa.me/${withCountry}?text=${text}`;
}

const stageFilters: Array<{ id: 'todos' | LeadStage; label: string }> = [
  { id: 'todos', label: 'Todos' },
  { id: 'novo_lead', label: 'Novo lead' },
  { id: 'qualificacao', label: 'Qualificação' },
  { id: 'proposta_enviada', label: 'Proposta' },
  { id: 'contrato_enervita', label: 'Contrato' },
];

function initials(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'LD';
}

export default function Leads() {
  const [tagQuery, setTagQuery] = useState('');
  const [tagMode, setTagMode] = useState<'any' | 'all'>('any');
  const activeTags = useMemo(() => Array.from(new Set(tagQuery.split(',').map((tag) => tag.trim().toLowerCase()).filter(Boolean))), [tagQuery]);
  const { leads, loading, bulkSetTags, bulkDelete, deleteLead, refresh } = useLeads(activeTags.length ? { tags: activeTags, tagMode } : undefined);
  const { user } = useAuth();
  const navigate = useNavigate();
  const canExportCsv = userHasPermission(user, 'csv.export');
  const canEditLead = userHasPermission(user, 'lead.edit');
  const [query, setQuery] = useState('');
  const [stage, setStage] = useState<'todos' | LeadStage>('todos');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkTags, setBulkTags] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const [showCreateLead, setShowCreateLead] = useState(false);
  const [manualLeadForm, setManualLeadForm] = useState<ManualLeadForm>(emptyManualLeadForm);
  const [createBusy, setCreateBusy] = useState(false);
  const [createMessage, setCreateMessage] = useState<string | null>(null);

  const tagCatalog = useMemo(() => Array.from(new Set(leads.flatMap((lead) => (lead.tags ?? []).map((tag) => tag.slug)))).sort(), [leads]);

  const filteredLeads = useMemo(() => {
    const q = query.trim().toLowerCase();
    const queryDigits = documentDigits(query);
    return leads.filter((lead) => {
      const tagValues = (lead.tags ?? []).flatMap((item) => [item.slug, item.name]).map((value) => value.toLowerCase());
      const contactMetadata = lead.contact?.metadata ?? {};
      const documentValues = [
        contactMetadata.cpf,
        contactMetadata.cpfFormatted,
        contactMetadata.cnpj,
        contactMetadata.cnpjFormatted,
      ];
      const matchesDocumentDigits = Boolean(queryDigits) && documentValues.some((value) => documentDigits(value).includes(queryDigits));
      return (stage === 'todos' || lead.stage === stage)
        && (!q || matchesDocumentDigits || [lead.contact?.name, lead.contact?.company, lead.contact?.email, lead.leadSource, lead.qualificationStatus, ...documentValues, ...tagValues].some((value) => String(value ?? '').toLowerCase().includes(q)));
    });
  }, [leads, query, stage]);

  const audienceReadyCount = countAudienceReadyLeads(filteredLeads);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const visibleIds = useMemo(() => filteredLeads.map((lead) => lead.id), [filteredLeads]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedSet.has(id));
  const selectedCount = selectedIds.length;

  const toggleSelected = (leadId: string) => setSelectedIds((current) => current.includes(leadId) ? current.filter((id) => id !== leadId) : [...current, leadId]);
  const toggleAllVisible = () => setSelectedIds((current) => {
    if (allVisibleSelected) return current.filter((id) => !visibleIds.includes(id));
    return Array.from(new Set([...current, ...visibleIds]));
  });
  const applyBulkTags = async () => {
    const tags = bulkTags.split(',').map((tag) => tag.trim()).filter(Boolean);
    if (!selectedCount || !tags.length) return;
    setBulkBusy(true);
    setBulkMessage(null);
    try {
      const updated = await bulkSetTags(selectedIds, tags);
      setBulkMessage(`${updated.length} lead(s) atualizados com tags.`);
      setBulkTags('');
    } catch (error) {
      setBulkMessage(error instanceof Error ? error.message : 'Erro ao aplicar tags em massa.');
    } finally {
      setBulkBusy(false);
    }
  };
  const deleteSelected = async () => {
    if (!selectedCount) return;
    const ok = window.confirm(`Excluir ${selectedCount} lead(s) selecionado(s)? Essa ação não pode ser desfeita.`);
    if (!ok) return;
    setBulkBusy(true);
    setBulkMessage(null);
    try {
      const deleted = await bulkDelete(selectedIds);
      setSelectedIds([]);
      setBulkMessage(`${deleted} lead(s) excluído(s).`);
    } catch (error) {
      setBulkMessage(error instanceof Error ? error.message : 'Erro ao excluir leads em massa.');
    } finally {
      setBulkBusy(false);
    }
  };
  const deleteOne = async (lead: Lead) => {
    const ok = window.confirm(`Excluir o lead ${lead.contact?.name || 'sem nome'}? Essa ação não pode ser desfeita.`);
    if (!ok) return;
    setBulkBusy(true);
    setBulkMessage(null);
    try {
      await deleteLead(lead.id);
      setSelectedIds((current) => current.filter((id) => id !== lead.id));
      setBulkMessage('Lead excluído.');
    } catch (error) {
      setBulkMessage(error instanceof Error ? error.message : 'Erro ao excluir lead.');
    } finally {
      setBulkBusy(false);
    }
  };

  const updateManualLeadField = <K extends keyof ManualLeadForm>(field: K, value: ManualLeadForm[K]) => {
    setManualLeadForm((current) => ({ ...current, [field]: value }));
  };

  const createManualLead = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!manualLeadForm.name.trim()) {
      setCreateMessage('Informe o nome do lead.');
      return;
    }
    if (!manualLeadForm.phone.trim() && !manualLeadForm.email.trim()) {
      setCreateMessage('Informe telefone ou e-mail para o time conseguir contato.');
      return;
    }
    if (manualLeadForm.cpf.trim() && !isValidCpf(manualLeadForm.cpf)) {
      setCreateMessage('CPF inválido. Confira os dígitos antes de salvar.');
      return;
    }
    if (manualLeadForm.cnpj.trim() && !isValidCnpj(manualLeadForm.cnpj)) {
      setCreateMessage('CNPJ inválido. Confira os dígitos antes de salvar.');
      return;
    }
    setCreateBusy(true);
    setCreateMessage(null);
    try {
      const created = await api.createLead({
        ...manualLeadForm,
        createdVia: 'crm_manual',
      });
      setManualLeadForm(emptyManualLeadForm);
      setShowCreateLead(false);
      await refresh();
      setBulkMessage(`Lead ${created.contact?.name || created.id} criado e liberado para o time.`);
      navigate(`/leads/${created.id}`);
    } catch (error) {
      setCreateMessage(error instanceof Error ? error.message : 'Erro ao criar lead.');
    } finally {
      setCreateBusy(false);
    }
  };

  const qualified = leads.filter((lead) => ['qualificado', 'em_andamento', 'concluido'].includes(String(lead.qualificationStatus).toLowerCase())).length;
  const waiting = leads.filter(l => l.stage === 'novo_lead').length;
  const hot = leads.filter(l => l.priority === 'alta' || l.priority === 'urgente').length;

  return (
    <div className="space-y-6 max-w-[1500px] mx-auto overflow-hidden">
      <PageHeader
        title="Leads"
        description="Mesa comercial para localizar, priorizar e abrir oportunidades sem perder contexto."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={() => { setQuery(''); setStage('todos'); setTagQuery(''); setTagMode('any'); }}><X size={16} /> Limpar</Button>
            {canExportCsv && (
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" size="sm" className="gap-2" onClick={() => exportLeadsForAudience(filteredLeads, 'crm')}><Download size={16} /> CSV CRM</Button>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => exportLeadsForAudience(filteredLeads, 'meta_ads')} disabled={audienceReadyCount === 0}><Download size={16} /> Meta Ads</Button>
                <Button variant="outline" size="sm" className="gap-2 opacity-60" disabled title="Exportação Google Ads fica para a fase de conexões Google"><Download size={16} /> Google Ads</Button>
              </div>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        <Card className="p-5 border-solar-orange/20 bg-bg-surface-1">
          <UserPlus className="text-orange-400" size={20} />
          <p className="mt-3 text-xs font-bold text-orange-400 uppercase tracking-wider">Novo lead</p>
          <h4 className="text-lg font-black text-text-primary mt-1">Cadastro manual</h4>
          <Button type="button" variant="primary" size="sm" className="mt-4 w-full gap-2" onClick={() => { setCreateMessage(null); setShowCreateLead(true); }}>
            <UserPlus size={15} /> Criar lead
          </Button>
        </Card>
        <Card className="p-5 bg-orange-500/5 border-solar-orange/10"><Users className="text-orange-400" size={20} /><p className="mt-3 text-xs font-bold text-orange-400 uppercase tracking-wider">Total de Leads</p><h4 className="text-3xl font-black text-text-primary mt-1">{leads.length}</h4></Card>
        <Card className="p-5 bg-mint-500/5 border-energy-green/10"><Flame className="text-mint-400" size={20} /><p className="mt-3 text-xs font-bold text-mint-400 uppercase tracking-wider">Qualificados</p><h4 className="text-3xl font-black text-text-primary mt-1">{qualified}</h4></Card>
        <Card className="p-5 bg-bg-surface-2/5 border-border-soft/10"><Clock className="text-text-primary" size={20} /><p className="mt-3 text-xs font-bold text-text-secondary uppercase tracking-wider">Aguardando Contato</p><h4 className="text-3xl font-black text-text-primary mt-1">{waiting}</h4></Card>
        <Card className="p-5 bg-red-500/5 border-alert-red/10"><Flame className="text-alert-red" size={20} /><p className="mt-3 text-xs font-bold text-alert-red uppercase tracking-wider">Prioridade alta</p><h4 className="text-3xl font-black text-text-primary mt-1">{hot}</h4></Card>
      </div>

      <Card className="overflow-hidden">
        <div className="p-4 border-b border-border-soft bg-bg-surface-2/50/50 space-y-4">
          <div className="flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
            <div className="relative w-full lg:max-w-lg">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
              <label className="sr-only" htmlFor="leads-search">Buscar leads</label>
              <input id="leads-search" aria-label="Buscar leads por nome, empresa, e-mail ou origem" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome, empresa, e-mail ou origem..." className="w-full bg-bg-surface-1 border border-border-strong rounded-2xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-solar-orange/30" />
            </div>
            <div className="flex flex-wrap gap-2">{stageFilters.map((item) => <Button key={item.id} variant={stage === item.id ? 'primary' : 'outline'} size="sm" onClick={() => setStage(item.id)}>{item.label}</Button>)}</div>
          </div>
          <div className="rounded-2xl border border-border-soft bg-bg-surface-1 p-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <label className="flex flex-1 items-center gap-2 text-sm text-text-secondary"><Filter size={14} /> Tags internas
                <input aria-label="Filtrar por tag" value={tagQuery} onChange={(event) => setTagQuery(event.target.value)} placeholder="Ex.: vip, urgente, follow-up" className="min-w-0 flex-1 rounded-xl border border-border-strong px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-solar-orange/30" />
                <select aria-label="Modo do filtro de tags" value={tagMode} onChange={(event) => setTagMode(event.target.value as 'any' | 'all')} className="rounded-xl border border-border-strong bg-bg-surface-1 px-3 py-2 text-xs font-bold text-text-primary"><option value="any">qualquer tag</option><option value="all">todas as tags</option></select>
              </label>
              <div className="flex flex-wrap gap-2">
                {tagCatalog.length === 0 ? <span className="text-xs text-text-secondary">Nenhuma tag cadastrada ainda</span> : tagCatalog.slice(0, 12).map((tag) => <button key={tag} type="button" onClick={() => setTagQuery(tag)} className="rounded-full bg-orange-500/10 px-3 py-1 text-xs font-bold text-orange-400 hover:bg-orange-500/20">#{tag}</button>)}
              </div>
            </div>
          </div>
          {(selectedCount > 0 || bulkMessage) && (
            <div className="rounded-2xl border border-solar-orange/20 bg-orange-500/5 p-3">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-text-primary">
                  <span>{selectedCount} lead(s) selecionado(s)</span>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])} disabled={bulkBusy}>Limpar seleção</Button>
                  {bulkMessage ? <span className="text-xs font-semibold text-text-secondary">{bulkMessage}</span> : null}
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="relative min-w-[240px] flex-1">
                    <Tags className="absolute left-3 top-1/2 -translate-y-1/2 text-orange-400" size={15} />
                    <input aria-label="Tags para aplicar em massa" value={bulkTags} onChange={(event) => setBulkTags(event.target.value)} placeholder="Tags em massa: vip, follow-up" className="w-full rounded-xl border border-solar-orange/20 bg-bg-surface-1 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-solar-orange/30" />
                  </div>
                  <Button variant="primary" size="sm" className="gap-2" disabled={bulkBusy || selectedCount === 0 || !bulkTags.trim()} onClick={applyBulkTags}><Tags size={15} /> Aplicar tags</Button>
                  {canEditLead ? <Button variant="outline" size="sm" className="gap-2 border-alert-red/30 text-alert-red hover:bg-red-500/5" disabled={bulkBusy || selectedCount === 0} onClick={deleteSelected}><Trash2 size={15} /> Excluir selecionados</Button> : null}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="md:hidden divide-y divide-gray-100 crm-scroll-panel min-h-[520px] h-[calc(150vh-220px)] overflow-y-auto">
          {loading ? <div className="px-6 py-10 text-center text-text-secondary">Carregando leads...</div> : filteredLeads.length === 0 ? <div className="px-6 py-12 text-center text-text-secondary">Nenhum lead encontrado com os filtros atuais.</div> : filteredLeads.map((lead) => (
            <article key={lead.id} className="p-4 space-y-3" onClick={() => navigate(`/leads/${lead.id}`)}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><p className="text-sm font-black text-text-primary truncate">{lead.contact?.name || 'Lead sem nome'}</p><p className="text-xs text-text-secondary truncate">{lead.contact?.company || lead.contact?.email || 'Sem empresa'}</p></div>
                <StageBadge stage={lead.stage} />
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs text-text-secondary">
                <div><span className="block font-bold text-text-secondary uppercase">Responsável</span>{lead.sdrOwner || 'Sem responsável'}</div>
                <div><span className="block font-bold text-text-secondary uppercase">Prioridade</span><PriorityBadge priority={lead.priority} /></div>
                <div><span className="block font-bold text-text-secondary uppercase">Conta</span>{formatCurrency(lead.energyBillValue)}</div>
                <div><span className="block font-bold text-text-secondary uppercase">Origem</span>{lead.leadSource}</div>
              </div>
              <div className="flex items-center justify-between gap-2" onClick={(event) => event.stopPropagation()}>
                <input aria-label={`Selecionar ${lead.contact?.name || 'lead sem nome'}`} type="checkbox" checked={selectedSet.has(lead.id)} onChange={() => toggleSelected(lead.id)} className="h-4 w-4 rounded border-border-strong text-orange-400 focus:ring-solar-orange" />
                <Link to={`/leads/${lead.id}`}><Button variant="outline" size="sm">Abrir lead</Button></Link>
              </div>
            </article>
          ))}
        </div>
        <div className="hidden md:block crm-scroll-panel min-h-[520px] h-[calc(150vh-220px)] overflow-auto">
          <table className="w-full min-w-[980px] text-left">
            <thead className="sticky top-0 z-10 bg-bg-surface-1"><tr className="text-xs font-bold text-text-secondary uppercase tracking-wider border-b border-border-soft"><th className="px-4 py-4 w-12"><input aria-label="Selecionar todos os leads visíveis" type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} className="h-4 w-4 rounded border-border-strong text-orange-400 focus:ring-solar-orange" /></th><th className="px-6 py-4">Lead</th><th className="px-6 py-4">Status / Etapa</th><th className="px-6 py-4">Responsável</th><th className="px-6 py-4">Prioridade</th><th className="px-6 py-4">Valor Conta</th><th className="px-6 py-4">Origem</th><th className="px-6 py-4">Tags</th><th className="px-6 py-4 text-right">Ações</th></tr></thead>
            <tbody className="divide-y divide-border-hair">
              {loading ? <tr><td colSpan={9} className="px-6 py-10 text-center text-text-secondary">Carregando leads...</td></tr> : filteredLeads.length === 0 ? <tr><td colSpan={9} className="px-6 py-12 text-center text-text-secondary">Nenhum lead encontrado com os filtros atuais.</td></tr> : filteredLeads.map((lead) => (
                <tr
                  key={lead.id}
                  role="link"
                  tabIndex={0}
                  aria-label={`Abrir perfil de ${lead.contact?.name || 'lead sem nome'}`}
                  onClick={() => navigate(`/leads/${lead.id}`)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      navigate(`/leads/${lead.id}`);
                    }
                  }}
                  className={`hover:bg-bg-surface-2/50/50 transition-colors group cursor-pointer focus:outline-none focus:ring-2 focus:ring-solar-orange/30 ${selectedSet.has(lead.id) ? 'bg-orange-500/5' : ''}`}
                >
                  <td className="px-4 py-4" onClick={(event) => event.stopPropagation()}>
                    <input aria-label={`Selecionar ${lead.contact?.name || 'lead sem nome'}`} type="checkbox" checked={selectedSet.has(lead.id)} onChange={() => toggleSelected(lead.id)} className="h-4 w-4 rounded border-border-strong text-orange-400 focus:ring-solar-orange" />
                  </td>
                  <td className="px-6 py-4 max-w-[300px]"><div className="flex items-center gap-3 min-w-0"><div className="w-11 h-11 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-400 font-black text-sm shrink-0">{initials(lead.contact?.name)}</div><div className="min-w-0"><p className="text-sm font-black text-text-primary group-hover:text-orange-400 transition-colors truncate">{lead.contact?.name || 'Lead sem nome'}</p><p className="text-xs text-text-secondary truncate">{lead.contact?.company || lead.contact?.email || 'Sem empresa'}</p></div></div></td>
                  <td className="px-6 py-4"><div className="flex flex-col gap-1 items-start"><StageBadge stage={lead.stage} /><span className="text-[10px] font-bold uppercase tracking-wide text-text-secondary ml-1">Estágio</span><span className="text-[10px] text-text-secondary font-medium ml-1 truncate max-w-[160px]">{lead.qualificationStatus}</span></div></td>
                  <td className="px-6 py-4"><div className="flex flex-col gap-1"><span className="text-sm font-bold text-text-primary truncate max-w-[170px]">{lead.sdrOwner || 'Sem responsável'}</span><span className="text-[10px] text-text-secondary">Próx. ação {lead.nextActionAt ? new Date(lead.nextActionAt).toLocaleDateString('pt-BR') : 'não definida'}</span></div></td>
                  <td className="px-6 py-4"><PriorityBadge priority={lead.priority} /></td>
                  <td className="px-6 py-4"><p className="text-sm font-black text-text-primary">{formatCurrency(lead.energyBillValue)}</p><p className="text-[10px] text-text-secondary">Econ. {formatCurrency(lead.projectedSavings)}</p></td>
                  <td className="px-6 py-4 max-w-[180px]"><Badge variant="default" className="bg-bg-surface-2/50 text-text-secondary lowercase normal-case max-w-full truncate inline-block">{lead.leadSource}</Badge></td>
                  <td className="px-6 py-4 max-w-[220px]"><div className="flex flex-wrap gap-1">{(lead.tags ?? []).length === 0 ? <span className="text-xs text-text-secondary">Sem tags</span> : lead.tags.map((tag) => <Badge key={tag.slug} variant="default" className="bg-orange-500/10 text-orange-400 lowercase normal-case">#{tag.slug}</Badge>)}</div></td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-1 opacity-100 transition-opacity" onClick={(event) => event.stopPropagation()}>
                      <Link to={`/leads/${lead.id}`}><Button aria-label="Abrir lead" variant="ghost" size="icon" className="h-8 w-8 rounded-lg"><Eye size={16} className="text-text-secondary" /></Button></Link>
                      {whatsappUrl(lead) ? <a aria-label={`Enviar WhatsApp para ${lead.contact?.name || 'lead'}`} href={whatsappUrl(lead) ?? undefined} target="_blank" rel="noreferrer" className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-bg-surface-2/50"><MessageSquare size={16} className="text-text-secondary" /></a> : <Button aria-label="WhatsApp indisponível sem telefone" variant="ghost" size="icon" className="h-8 w-8 rounded-lg opacity-40" disabled><MessageSquare size={16} className="text-text-secondary" /></Button>}
                      {canEditLead ? <Button aria-label={`Excluir ${lead.contact?.name || 'lead'}`} variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-red-500/10" disabled={bulkBusy} onClick={() => void deleteOne(lead)}><Trash2 size={16} className="text-alert-red" /></Button> : null}
                      <Button aria-label="Mais ações" variant="ghost" size="icon" className="h-8 w-8 rounded-lg opacity-50" disabled><MoreHorizontal size={16} className="text-text-secondary" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-border-soft bg-bg-surface-2/50/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3"><p className="text-xs text-text-secondary">Mostrando {filteredLeads.length} de {leads.length} leads{activeTags.length ? ` filtrados por ${activeTags.join(', ')} (${tagMode === 'all' ? 'todas' : 'qualquer'})` : ''}</p><p className="text-xs text-text-secondary">{audienceReadyCount} lead(s) têm e-mail ou telefone para público Meta/Google.</p></div>
      </Card>

      {showCreateLead ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-surface-2/45 p-4">
          <Card className="w-full max-w-5xl max-h-[92vh] overflow-hidden">
            <form onSubmit={createManualLead} className="flex max-h-[92vh] flex-col">
              <div className="flex items-start justify-between gap-4 border-b border-border-soft p-5">
                <div>
                  <h2 className="text-xl font-black text-text-primary">Criar novo lead</h2>
                  <p className="mt-1 text-sm text-text-secondary">Lead manual com acesso para todo o time comercial.</p>
                </div>
                <Button type="button" variant="ghost" size="icon" aria-label="Fechar cadastro de lead" onClick={() => setShowCreateLead(false)}>
                  <X size={18} />
                </Button>
              </div>

              <div className="flex-1 space-y-6 overflow-y-auto p-5">
                <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="md:col-span-2"><h3 className="text-xs font-black uppercase tracking-wider text-orange-400">Contato</h3></div>
                  <label className="space-y-1 text-sm font-bold text-text-primary">Nome *
                    <input required value={manualLeadForm.name} onChange={(event) => updateManualLeadField('name', event.target.value)} className="w-full rounded-xl border border-border-strong px-3 py-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-solar-orange/30" />
                  </label>
                  <label className="space-y-1 text-sm font-bold text-text-primary">Empresa
                    <input value={manualLeadForm.company} onChange={(event) => updateManualLeadField('company', event.target.value)} className="w-full rounded-xl border border-border-strong px-3 py-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-solar-orange/30" />
                  </label>
                  <label className="space-y-1 text-sm font-bold text-text-primary">Telefone
                    <input value={manualLeadForm.phone} onChange={(event) => updateManualLeadField('phone', event.target.value)} placeholder="WhatsApp ou telefone" className="w-full rounded-xl border border-border-strong px-3 py-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-solar-orange/30" />
                  </label>
                  <label className="space-y-1 text-sm font-bold text-text-primary">E-mail
                    <input type="email" value={manualLeadForm.email} onChange={(event) => updateManualLeadField('email', event.target.value)} className="w-full rounded-xl border border-border-strong px-3 py-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-solar-orange/30" />
                  </label>
                  <label className="space-y-1 text-sm font-bold text-text-primary">CPF do contato
                    <input inputMode="numeric" value={manualLeadForm.cpf} onChange={(event) => updateManualLeadField('cpf', formatCpf(event.target.value))} placeholder="000.000.000-00" className="w-full rounded-xl border border-border-strong px-3 py-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-solar-orange/30" />
                  </label>
                  <label className="space-y-1 text-sm font-bold text-text-primary">CNPJ da empresa
                    <input inputMode="numeric" value={manualLeadForm.cnpj} onChange={(event) => updateManualLeadField('cnpj', formatCnpj(event.target.value))} placeholder="00.000.000/0000-00" className="w-full rounded-xl border border-border-strong px-3 py-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-solar-orange/30" />
                  </label>
                  <label className="space-y-1 text-sm font-bold text-text-primary">Cidade
                    <input value={manualLeadForm.city} onChange={(event) => updateManualLeadField('city', event.target.value)} className="w-full rounded-xl border border-border-strong px-3 py-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-solar-orange/30" />
                  </label>
                  <label className="space-y-1 text-sm font-bold text-text-primary">Estado
                    <input value={manualLeadForm.state} onChange={(event) => updateManualLeadField('state', event.target.value.toUpperCase().slice(0, 2))} maxLength={2} className="w-full rounded-xl border border-border-strong px-3 py-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-solar-orange/30" />
                  </label>
                </section>

                <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="md:col-span-3"><h3 className="text-xs font-black uppercase tracking-wider text-orange-400">Necessidade energética</h3></div>
                  <label className="space-y-1 text-sm font-bold text-text-primary">Serviço de interesse
                    <select value={manualLeadForm.serviceInterest} onChange={(event) => updateManualLeadField('serviceInterest', event.target.value)} className="w-full rounded-xl border border-border-strong bg-bg-surface-1 px-3 py-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-solar-orange/30">
                      {serviceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm font-bold text-text-primary">Tipo de unidade
                    <select value={manualLeadForm.unitType} onChange={(event) => updateManualLeadField('unitType', event.target.value)} className="w-full rounded-xl border border-border-strong bg-bg-surface-1 px-3 py-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-solar-orange/30">
                      {unitTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm font-bold text-text-primary">Concessionária
                    <input value={manualLeadForm.concessionaria} onChange={(event) => updateManualLeadField('concessionaria', event.target.value)} className="w-full rounded-xl border border-border-strong px-3 py-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-solar-orange/30" />
                  </label>
                  <label className="space-y-1 text-sm font-bold text-text-primary">Conta média mensal
                    <input inputMode="decimal" value={manualLeadForm.monthlyBillValue} onChange={(event) => updateManualLeadField('monthlyBillValue', event.target.value)} placeholder="R$" className="w-full rounded-xl border border-border-strong px-3 py-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-solar-orange/30" />
                  </label>
                  <label className="space-y-1 text-sm font-bold text-text-primary">Consumo médio kWh
                    <input inputMode="decimal" value={manualLeadForm.averageConsumptionKwh} onChange={(event) => updateManualLeadField('averageConsumptionKwh', event.target.value)} className="w-full rounded-xl border border-border-strong px-3 py-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-solar-orange/30" />
                  </label>
                  <label className="space-y-1 text-sm font-bold text-text-primary">Prioridade
                    <select value={manualLeadForm.priority} onChange={(event) => updateManualLeadField('priority', event.target.value as Lead['priority'])} className="w-full rounded-xl border border-border-strong bg-bg-surface-1 px-3 py-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-solar-orange/30">
                      <option value="baixa">Baixa</option>
                      <option value="media">Média</option>
                      <option value="alta">Alta</option>
                      <option value="urgente">Urgente</option>
                    </select>
                  </label>
                </section>

                <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="md:col-span-3"><h3 className="text-xs font-black uppercase tracking-wider text-orange-400">Origem e tracking</h3></div>
                  <label className="space-y-1 text-sm font-bold text-text-primary">Origem
                    <input value={manualLeadForm.leadSource} onChange={(event) => updateManualLeadField('leadSource', event.target.value)} className="w-full rounded-xl border border-border-strong px-3 py-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-solar-orange/30" />
                  </label>
                  <label className="space-y-1 text-sm font-bold text-text-primary">Status comercial
                    <select value={manualLeadForm.qualificationStatus} onChange={(event) => updateManualLeadField('qualificationStatus', event.target.value)} className="w-full rounded-xl border border-border-strong bg-bg-surface-1 px-3 py-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-solar-orange/30">
                      <option value="aguardando">Aguardando</option>
                      <option value="em_andamento">Em andamento</option>
                      <option value="qualificado">Qualificado</option>
                    </select>
                  </label>
                  <label className="space-y-1 text-sm font-bold text-text-primary">UTM source
                    <input value={manualLeadForm.utmSource} onChange={(event) => updateManualLeadField('utmSource', event.target.value)} placeholder="meta, google, indicacao" className="w-full rounded-xl border border-border-strong px-3 py-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-solar-orange/30" />
                  </label>
                  <label className="space-y-1 text-sm font-bold text-text-primary">UTM medium
                    <input value={manualLeadForm.utmMedium} onChange={(event) => updateManualLeadField('utmMedium', event.target.value)} className="w-full rounded-xl border border-border-strong px-3 py-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-solar-orange/30" />
                  </label>
                  <label className="space-y-1 text-sm font-bold text-text-primary">UTM campaign
                    <input value={manualLeadForm.utmCampaign} onChange={(event) => updateManualLeadField('utmCampaign', event.target.value)} className="w-full rounded-xl border border-border-strong px-3 py-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-solar-orange/30" />
                  </label>
                  <label className="space-y-1 text-sm font-bold text-text-primary">UTM content
                    <input value={manualLeadForm.utmContent} onChange={(event) => updateManualLeadField('utmContent', event.target.value)} className="w-full rounded-xl border border-border-strong px-3 py-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-solar-orange/30" />
                  </label>
                  <label className="space-y-1 text-sm font-bold text-text-primary md:col-span-3">Observações
                    <textarea value={manualLeadForm.notes} onChange={(event) => updateManualLeadField('notes', event.target.value)} rows={3} className="w-full resize-none rounded-xl border border-border-strong px-3 py-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-solar-orange/30" />
                  </label>
                </section>
              </div>

              <div className="flex flex-col gap-3 border-t border-border-soft p-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="min-h-5 text-sm font-semibold text-alert-red">{createMessage}</p>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" disabled={createBusy} onClick={() => setShowCreateLead(false)}>Cancelar</Button>
                  <Button type="submit" variant="primary" className="gap-2" disabled={createBusy}>
                    <Save size={16} /> {createBusy ? 'Salvando...' : 'Salvar lead'}
                  </Button>
                </div>
              </div>
            </form>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

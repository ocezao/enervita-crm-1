import { useNavigate, useParams, Link } from 'react-router-dom';
import { useLeadDetail } from '../hooks/useCrm';
import { Button, Card, Badge } from '../components/ui/Base';
import { StageBadge, PriorityBadge } from '../components/ui/StatusBadges';
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  MessageSquare,
  CheckCircle2,
  Clock,
  FileText,
  Zap,
  Edit3,
  Save,
  Trash2,
  X,
  Plus,
  History,
  Upload,
  Download,
  Copy
} from 'lucide-react';
import { formatCurrency, formatDate } from '../lib/utils';
import { useMemo, useState } from 'react';
import { useAuth } from '../auth/useAuth';
import { userHasPermission } from '../auth/permissions';
import { isAdminUser } from '../auth/permissions';
import type { CreateProposalPayload } from '../lib/api/types';
import type { Proposal } from '../lib/api/types';
import { api } from '../lib/api/crmApi';

type DetailItem = { label: string; value: string };

function textValue(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  return '';
}

function firstMetadataValue(metadata: Record<string, unknown> | undefined, keys: string[], fallback = ''): string {
  if (!metadata) return fallback;
  for (const key of keys) {
    const value = textValue(metadata[key]);
    if (value) return value;
  }
  return fallback;
}

function getObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function metaAttributionItems(lead: NonNullable<ReturnType<typeof useLeadDetail>['lead']>): DetailItem[] {
  const meta = getObject(lead.metadata?.meta);
  const rawLeadDetails = getObject(meta.rawLeadDetails);
  const items: DetailItem[] = [
    { label: 'Campanha', value: textValue(meta.campaignName) || textValue(rawLeadDetails.campaign_name) || lead.utmCampaign || '' },
    { label: 'ID campanha', value: textValue(meta.campaignId) || textValue(rawLeadDetails.campaign_id) },
    { label: 'Conjunto', value: textValue(meta.adsetName) || textValue(rawLeadDetails.adset_name) },
    { label: 'ID conjunto', value: textValue(meta.adsetId) || textValue(rawLeadDetails.adset_id) || textValue(meta.adgroupId) || textValue(rawLeadDetails.adgroup_id) },
    { label: 'Anúncio / criativo', value: textValue(meta.adName) || textValue(rawLeadDetails.ad_name) || lead.utmContent || '' },
    { label: 'ID anúncio', value: textValue(meta.adId) || textValue(rawLeadDetails.ad_id) },
    { label: 'Formulário / proposta', value: textValue(meta.formName) || textValue(rawLeadDetails.form_name) || lead.utmTerm || textValue(meta.formId) },
    { label: 'ID formulário', value: textValue(meta.formId) || textValue(rawLeadDetails.form_id) || lead.utmTerm || '' },
  ];
  return items.filter((item) => item.value && item.value !== 'Invalid Date');
}

function historyValue(value: string | number | boolean | null): string {
  if (value === null) return 'Vazio';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  return String(value);
}

function cadastroItems(lead: NonNullable<ReturnType<typeof useLeadDetail>['lead']>): DetailItem[] {
  const leadMetadata = lead.metadata ?? {};
  const contactMetadata = lead.contact?.metadata ?? {};
  const metadata = { ...contactMetadata, ...leadMetadata };
  const items: DetailItem[] = [
    { label: 'Data do cadastro', value: formatDate(lead.createdAt) },
    { label: 'Última atualização', value: formatDate(lead.updatedAt) },
    { label: 'Formulário', value: firstMetadataValue(metadata, ['formName'], lead.leadSource || 'Não informado') },
    { label: 'Cidade / UF', value: [firstMetadataValue(metadata, ['city']), firstMetadataValue(metadata, ['state'])].filter(Boolean).join(' / ') },
    { label: 'Tipo de unidade', value: firstMetadataValue(metadata, ['unitType']) },
    { label: 'Interesse declarado', value: firstMetadataValue(metadata, ['interest', 'request']) },
    { label: 'Mensagem enviada', value: firstMetadataValue(metadata, ['message']) },
    { label: 'Consentimento LGPD', value: lead.contact?.consent ? 'Sim' : firstMetadataValue(metadata, ['lgpdConsentimento', 'consent', 'privacy'], 'Não informado') },
    { label: 'Página de entrada', value: firstMetadataValue(metadata, ['landingPage']) },
    { label: 'Origem do cadastro', value: firstMetadataValue(metadata, ['importSource', 'source'], lead.leadSource || 'Não informado') },
  ];
  return items.filter((item) => item.value && item.value !== 'Invalid Date');
}

type ProposalDraft = {
  title: string;
  monthlyBillValue: string;
  estimatedKwh: string;
  discountPercentage: string;
  projectedMonthlySavings: string;
  projectedAnnualSavings: string;
  validUntil: string;
  notes: string;
  sourceType: 'editor' | 'file';
  contentText: string;
  templateName: string;
  isTemplate: boolean;
  importedFile?: CreateProposalPayload['importedFile'];
};

const emptyProposalDraft: ProposalDraft = {
  title: '',
  monthlyBillValue: '',
  estimatedKwh: '',
  discountPercentage: '20',
  projectedMonthlySavings: '',
  projectedAnnualSavings: '',
  validUntil: '',
  notes: '',
  sourceType: 'editor',
  contentText: '',
  templateName: '',
  isTemplate: false,
};

const proposalStatusLabels = {
  draft: 'Rascunho',
  sent: 'Enviada',
  accepted: 'Aceita',
  lost: 'Perdida',
  expired: 'Expirada',
} as const;

const proposalStatusVariants = {
  draft: 'warning',
  sent: 'info',
  accepted: 'success',
  lost: 'error',
  expired: 'default',
} as const;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? '').split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error ?? new Error('Falha ao ler arquivo'));
    reader.readAsDataURL(file);
  });
}

function proposalHtmlFromText(text: string) {
  return text.split('\n').map((line) => `<p>${line.replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[char] ?? char)) || '<br />'}</p>`).join('');
}


type EnervitaIntelligence = {
  potential: 'Alto' | 'Médio' | 'Baixo';
  potentialTone: 'success' | 'warning' | 'default';
  readiness: 'Pronto para proposta' | 'Quase pronto' | 'Qualificar antes';
  nextAction: string;
  argument: string;
  missing: string[];
  signals: string[];
  risk: 'Baixo' | 'Médio' | 'Alto';
};

function daysSince(value?: string | null) {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return null;
  return Math.max(0, Math.floor((Date.now() - time) / 86400000));
}

function buildEnervitaIntelligence(
  lead: NonNullable<ReturnType<typeof useLeadDetail>['lead']>,
  tasks: ReturnType<typeof useLeadDetail>['tasks'],
  proposals: ReturnType<typeof useLeadDetail>['proposals'],
): EnervitaIntelligence {
  const bill = Number(lead.energyBillValue || lead.estimatedTicket || 0);
  const consumption = Number(lead.averageConsumptionKwh || 0);
  const savings = Number(lead.projectedSavings || 0);
  const hasPhone = Boolean(lead.contact?.phone);
  const hasCity = Boolean(lead.metadata?.city || lead.metadata?.cidade || lead.metadata?.state || lead.metadata?.uf);
  const hasBill = bill > 0;
  const hasConsumption = consumption > 0;
  const hasOpenTask = tasks.some((task) => task.status !== 'concluido');
  const sentProposal = proposals.find((proposal) => proposal.status === 'sent');
  const acceptedProposal = proposals.find((proposal) => proposal.status === 'accepted');
  const lastContactDays = daysSince(lead.lastContactAt ?? lead.updatedAt);
  const proposalDays = sentProposal ? daysSince(sentProposal.sentAt ?? sentProposal.updatedAt ?? sentProposal.createdAt) : null;

  const missing: string[] = [];
  if (!hasPhone) missing.push('telefone do decisor');
  if (!hasBill && !hasConsumption) missing.push('valor da conta ou consumo médio');
  if (!hasCity) missing.push('cidade/UF do atendimento');
  if (!hasOpenTask && !lead.nextActionAt) missing.push('próxima ação definida');

  const signals: string[] = [];
  if (bill >= 800) signals.push('conta alta: priorizar economia mensal e previsibilidade');
  else if (bill >= 350) signals.push('conta compatível com qualificação comercial');
  else if (bill > 0) signals.push('conta baixa: validar se compensa avançar proposta');
  if (savings > 0) signals.push(`economia projetada registrada: ${formatCurrency(savings)}/mês`);
  if (acceptedProposal) signals.push('proposta aceita: foco em próximo passo de implantação/contrato');
  else if (sentProposal) signals.push('proposta enviada: follow-up deve comparar custo atual e economia estimada');
  if (lastContactDays !== null && lastContactDays >= 5) signals.push(`sem contato recente há ${lastContactDays} dias`);
  if (!hasOpenTask && !lead.nextActionAt) signals.push('sem tarefa/próxima ação ativa');

  let potential: EnervitaIntelligence['potential'] = 'Baixo';
  if (bill >= 800 || savings >= 150 || acceptedProposal) potential = 'Alto';
  else if (bill >= 350 || consumption >= 300 || sentProposal) potential = 'Médio';

  let readiness: EnervitaIntelligence['readiness'] = 'Qualificar antes';
  if ((hasBill || hasConsumption) && hasPhone && hasCity) readiness = 'Pronto para proposta';
  else if ((hasBill || hasConsumption) && hasPhone) readiness = 'Quase pronto';

  let risk: EnervitaIntelligence['risk'] = 'Baixo';
  if ((proposalDays !== null && proposalDays >= 3) || (lastContactDays !== null && lastContactDays >= 7 && potential !== 'Baixo')) risk = 'Alto';
  else if (lastContactDays !== null && lastContactDays >= 3) risk = 'Médio';

  const nextAction = acceptedProposal
    ? 'Confirmar próximo passo de contrato/implantação.'
    : sentProposal
      ? 'Retomar proposta destacando economia mensal e removendo objeções.'
      : readiness === 'Pronto para proposta'
        ? 'Montar proposta com foco em economia e previsibilidade.'
        : missing.length
          ? `Completar qualificação: ${missing.slice(0, 2).join(' e ')}.`
          : 'Criar próxima tarefa comercial.';

  const argument = bill >= 800
    ? 'Pelo valor da conta, conduza a conversa por economia recorrente e previsibilidade, não por desconto isolado.'
    : bill >= 350
      ? 'Use abordagem consultiva: validar consumo, perfil do imóvel e mostrar economia potencial com baixo atrito.'
      : 'Antes de proposta, confirme se o consumo justifica avanço comercial para evitar esforço em lead de baixo potencial.';

  return {
    potential,
    potentialTone: potential === 'Alto' ? 'success' : potential === 'Médio' ? 'warning' : 'default',
    readiness,
    nextAction,
    argument,
    missing,
    signals: signals.length ? signals : ['dados comerciais ainda insuficientes para diagnóstico forte'],
    risk,
  };
}

export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { lead, activities, tasks, history, proposals, loading, addActivity, addTask, completeTask, addProposal, updateProposal, deleteProposal, updateLead, convertToOpportunity, deleteLead, setTags } = useLeadDetail(id);
  const { user } = useAuth();
  const canCreateActivity = userHasPermission(user, 'activity.create');
  const canCreateTask = userHasPermission(user, 'task.create');
  const canCompleteTask = userHasPermission(user, 'task.complete');
  const canEditLead = userHasPermission(user, 'lead.edit');
  const [activeTab, setActiveTab] = useState('timeline');
  const [activityNote, setActivityNote] = useState('');
  const [whatsappConfirmOpen, setWhatsappConfirmOpen] = useState(false);
  const [whatsappDoNotAskAgain, setWhatsappDoNotAskAgain] = useState(false);
  const [whatsappStatus, setWhatsappStatus] = useState<string | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskPriority, setTaskPriority] = useState<'baixa' | 'media' | 'alta' | 'urgente'>('media');
  const [taskDueDate, setTaskDueDate] = useState('');
  const nextOpenTask = tasks
    .filter((task) => task.status !== 'concluido')
    .sort((a, b) => {
      const left = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
      const right = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
      return left - right;
    })[0];
  const [tagDraft, setTagDraft] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [savingLead, setSavingLead] = useState(false);
  const [convertingOpportunity, setConvertingOpportunity] = useState(false);
  const [leadMessage, setLeadMessage] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    leadSource: '',
    qualificationStatus: '',
    priority: 'media' as 'baixa' | 'media' | 'alta' | 'urgente',
    energyBillValue: '',
    averageConsumptionKwh: '',
    concessionaria: '',
    offer: '',
    projectedSavings: '',
    notes: '',
  });
  const [proposalDraft, setProposalDraft] = useState<ProposalDraft>(emptyProposalDraft);
  const [savingProposal, setSavingProposal] = useState(false);
  const [proposalMessage, setProposalMessage] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Proposal[]>([]);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [editingProposalId, setEditingProposalId] = useState<string | null>(null);
  const cadastro = useMemo(() => lead ? cadastroItems(lead) : [], [lead]);
  const metaAttribution = useMemo(() => lead ? metaAttributionItems(lead) : [], [lead]);
  const sortedProposals = useMemo(() => [...proposals].sort((a, b) => new Date(b.createdAt || b.updatedAt).getTime() - new Date(a.createdAt || a.updatedAt).getTime()), [proposals]);
  const enervitaIntelligence = useMemo(() => lead ? buildEnervitaIntelligence(lead, tasks, proposals) : null, [lead, tasks, proposals]);

  function startEditing() {
    if (!lead) return;
    setEditDraft({
      name: lead.contact?.name ?? '',
      email: lead.contact?.email ?? '',
      phone: lead.contact?.phone ?? '',
      company: lead.contact?.company ?? '',
      leadSource: lead.leadSource ?? '',
      qualificationStatus: lead.qualificationStatus ?? '',
      priority: lead.priority ?? 'media',
      energyBillValue: lead.energyBillValue ? String(lead.energyBillValue) : '',
      averageConsumptionKwh: lead.averageConsumptionKwh ? String(lead.averageConsumptionKwh) : '',
      concessionaria: lead.concessionaria === 'Não informada' ? '' : lead.concessionaria,
      offer: lead.offer ?? '',
      projectedSavings: lead.projectedSavings ? String(lead.projectedSavings) : '',
      notes: lead.notes ?? '',
    });
    setLeadMessage(null);
    setEditing(true);
  }

  function numberOrUndefined(value: string): number | undefined {
    const trimmed = value.trim().replace(/\./g, '').replace(',', '.');
    if (!trimmed) return undefined;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  async function handleSaveLead() {
    if (!lead || !canEditLead) return;
    const energyBillValue = numberOrUndefined(editDraft.energyBillValue);
    const averageConsumptionKwh = numberOrUndefined(editDraft.averageConsumptionKwh);
    const projectedSavings = numberOrUndefined(editDraft.projectedSavings);
    const metadata = {
      ...(lead.metadata ?? {}),
      ...(energyBillValue !== undefined ? { energyBillValue } : {}),
      ...(averageConsumptionKwh !== undefined ? { averageConsumptionKwh } : {}),
      ...(editDraft.concessionaria.trim() ? { concessionaria: editDraft.concessionaria.trim() } : {}),
      ...(editDraft.offer.trim() ? { offer: editDraft.offer.trim() } : {}),
      ...(projectedSavings !== undefined ? { projectedSavings } : {}),
    };
    setSavingLead(true);
    setLeadMessage(null);
    try {
      await updateLead({
        contact: {
          name: editDraft.name.trim(),
          email: editDraft.email.trim() || null,
          phone: editDraft.phone.trim() || null,
          company: editDraft.company.trim() || null,
          source: editDraft.leadSource.trim() || null,
        },
        leadSource: editDraft.leadSource.trim() || null,
        qualificationStatus: editDraft.qualificationStatus.trim() || null,
        priority: editDraft.priority,
        notes: editDraft.notes.trim() || null,
        estimatedTicket: energyBillValue ?? null,
        metadata,
      });
      setEditing(false);
      setLeadMessage('Lead atualizado.');
    } catch (error) {
      setLeadMessage(error instanceof Error ? error.message : 'Erro ao atualizar lead.');
    } finally {
      setSavingLead(false);
    }
  }

  async function handleDeleteLead() {
    if (!lead || !canEditLead) return;
    const ok = window.confirm(`Excluir o lead ${lead.contact?.name || 'sem nome'}? Essa ação não pode ser desfeita.`);
    if (!ok) return;
    setSavingLead(true);
    setLeadMessage(null);
    try {
      await deleteLead();
      navigate('/leads');
    } catch (error) {
      setLeadMessage(error instanceof Error ? error.message : 'Erro ao excluir lead.');
      setSavingLead(false);
    }
  }

  async function handleCreateActivity() {
    const outcome = activityNote.trim();
    if (!outcome) return;
    await addActivity({ activityType: 'note', outcome, notes: outcome });
    setActivityNote('');
  }

  async function openWhatsapp(registerActivity: boolean) {
    if (!whatsappHref) return;
    if (registerActivity && canCreateActivity) {
      try {
        await addActivity({ activityType: 'whatsapp', outcome: 'WhatsApp aberto pelo CRM', notes: 'Usuário confirmou abertura do WhatsApp pelo botão do lead.' });
      } catch {
        setWhatsappStatus('WhatsApp será aberto, mas não consegui registrar a atividade.');
      }
    }
    window.open(whatsappHref, '_blank', 'noopener,noreferrer');
  }

  async function handleWhatsappClick() {
    setWhatsappStatus(null);
    if (localStorage.getItem('enervita-crm.skipWhatsappConfirm') === 'true') {
      await openWhatsapp(true);
      return;
    }
    setWhatsappConfirmOpen(true);
  }

  async function confirmWhatsappOpen() {
    if (whatsappDoNotAskAgain) localStorage.setItem('enervita-crm.skipWhatsappConfirm', 'true');
    setWhatsappConfirmOpen(false);
    await openWhatsapp(true);
  }

  async function handleCreateTask() {
    const title = taskTitle.trim();
    if (!title) return;
    await addTask({ title, priority: taskPriority, dueDate: taskDueDate || undefined });
    setTaskTitle('');
    setTaskPriority('media');
    setTaskDueDate('');
  }

  async function handleCreateRecommendedTask() {
    if (!enervitaIntelligence || !canCreateTask) return;
    const dueDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const priority = enervitaIntelligence.risk === 'Alto' ? 'urgente' : enervitaIntelligence.potential === 'Alto' ? 'alta' : 'media';
    await addTask({
      title: `${enervitaIntelligence.nextAction} — ${enervitaIntelligence.argument}`,
      priority,
      dueDate,
    });
    setActiveTab('tasks');
  }

  function handleStartIntelligentProposal() {
    if (!lead || !enervitaIntelligence) return;
    const monthlyBillValue = lead.energyBillValue || lead.estimatedTicket || 0;
    const estimatedKwh = lead.averageConsumptionKwh || 0;
    const projectedMonthlySavings = lead.projectedSavings || (monthlyBillValue ? Math.round(monthlyBillValue * 0.2) : 0);
    const projectedAnnualSavings = projectedMonthlySavings * 12;
    const contactName = lead.contact?.name || 'cliente';
    setProposalDraft({
      ...emptyProposalDraft,
      title: `Proposta Enervita — ${contactName}`,
      monthlyBillValue: monthlyBillValue ? String(monthlyBillValue) : '',
      estimatedKwh: estimatedKwh ? String(estimatedKwh) : '',
      discountPercentage: '20',
      projectedMonthlySavings: projectedMonthlySavings ? String(projectedMonthlySavings) : '',
      projectedAnnualSavings: projectedAnnualSavings ? String(projectedAnnualSavings) : '',
      notes: `Gerada a partir da Inteligência Enervita. Potencial ${enervitaIntelligence.potential}; risco ${enervitaIntelligence.risk}.`,
      sourceType: 'editor',
      contentText: [
        `Olá ${contactName},`,
        '',
        'Com base nas informações levantadas, preparei uma proposta para reduzir o custo mensal de energia com mais previsibilidade.',
        monthlyBillValue ? `Conta atual estimada: ${formatCurrency(monthlyBillValue)} por mês.` : '',
        estimatedKwh ? `Consumo médio informado: ${estimatedKwh} kWh.` : '',
        projectedMonthlySavings ? `Economia mensal estimada: ${formatCurrency(projectedMonthlySavings)}.` : '',
        projectedAnnualSavings ? `Economia anual estimada: ${formatCurrency(projectedAnnualSavings)}.` : '',
        '',
        `Ponto principal: ${enervitaIntelligence.argument}`,
        '',
        'Próximo passo: validar os dados da conta de energia e confirmar o melhor modelo para avançarmos com segurança.',
      ].filter(Boolean).join('\n'),
    });
    setEditingProposalId(null);
    setProposalMessage('Rascunho iniciado pela Inteligência Enervita. Revise antes de salvar ou enviar.');
    setActiveTab('proposals');
  }

  async function handleProposalFile(file?: File | null) {
    if (!file) return;
    const dataBase64 = await fileToBase64(file);
    setProposalDraft((current) => ({
      ...current,
      sourceType: 'file',
      importedFile: { name: file.name, mimeType: file.type || 'application/octet-stream', size: file.size, dataBase64 },
      title: current.title || file.name.replace(/\.[^.]+$/, ''),
    }));
  }

  async function handleCreateProposal() {
    if (!lead || savingProposal) return;
    const monthlyBillValue = numberOrUndefined(proposalDraft.monthlyBillValue) ?? 0;
    const estimatedKwh = numberOrUndefined(proposalDraft.estimatedKwh);
    const discountPercentage = numberOrUndefined(proposalDraft.discountPercentage) ?? 0;
    const projectedMonthlySavings = numberOrUndefined(proposalDraft.projectedMonthlySavings) ?? Math.round(monthlyBillValue * (discountPercentage / 100));
    const projectedAnnualSavings = numberOrUndefined(proposalDraft.projectedAnnualSavings) ?? projectedMonthlySavings * 12;
    const title = proposalDraft.title.trim();
    const contentText = proposalDraft.contentText.trim();
    if (!title) { setProposalMessage('Informe o título da proposta.'); return; }
    if (proposalDraft.sourceType === 'editor' && !contentText) { setProposalMessage('Escreva o conteúdo da proposta ou importe um arquivo.'); return; }
    if (proposalDraft.sourceType === 'file' && !proposalDraft.importedFile) { setProposalMessage('Selecione o arquivo da proposta.'); return; }
    setSavingProposal(true);
    setProposalMessage(null);
    try {
      await addProposal({
        leadId: lead.id,
        title,
        monthlyBillValue,
        estimatedKwh,
        discountPercentage,
        projectedMonthlySavings,
        projectedAnnualSavings,
        validUntil: proposalDraft.validUntil ? new Date(proposalDraft.validUntil).toISOString() : undefined,
        notes: proposalDraft.notes.trim() || undefined,
        sourceType: proposalDraft.sourceType,
        contentText: proposalDraft.sourceType === 'editor' ? contentText : undefined,
        contentHtml: proposalDraft.sourceType === 'editor' ? proposalHtmlFromText(contentText) : undefined,
        templateName: proposalDraft.templateName.trim() || undefined,
        isTemplate: proposalDraft.isTemplate,
        importedFile: proposalDraft.sourceType === 'file' ? proposalDraft.importedFile : undefined,
      });
      setProposalDraft(emptyProposalDraft);
      setProposalMessage('Proposta salva no lead.');
    } catch (error) {
      setProposalMessage(error instanceof Error ? error.message : 'Erro ao salvar proposta.');
    } finally {
      setSavingProposal(false);
    }
  }

  async function handleLoadTemplates() {
    setLoadingTemplates(true);
    try {
      const data = await api.listTemplates();
      setTemplates(data);
      setShowTemplateSelector(true);
    } catch {
      setProposalMessage('Erro ao carregar modelos.');
    } finally {
      setLoadingTemplates(false);
    }
  }

  function handleSelectTemplate(template: Proposal) {
    setProposalDraft({
      title: template.title || '',
      monthlyBillValue: template.monthlyBillValue ? String(template.monthlyBillValue) : '',
      estimatedKwh: template.estimatedKwh ? String(template.estimatedKwh) : '',
      discountPercentage: template.discountPercentage ? String(template.discountPercentage) : '20',
      projectedMonthlySavings: template.projectedMonthlySavings ? String(template.projectedMonthlySavings) : '',
      projectedAnnualSavings: template.projectedAnnualSavings ? String(template.projectedAnnualSavings) : '',
      validUntil: template.validUntil ? template.validUntil.split('T')[0] : '',
      notes: template.notes || '',
      sourceType: template.sourceType || 'editor',
      contentText: template.contentText || '',
      templateName: template.templateName || '',
      isTemplate: false,
      importedFile: undefined,
    });
    setShowTemplateSelector(false);
    setEditingProposalId(null);
    setProposalMessage(`Modelo "${template.templateName || template.title}" carregado. Preencha e salve.`);
  }

  function handleEditProposal(proposal: Proposal) {
    setProposalDraft({
      title: proposal.title || '',
      monthlyBillValue: proposal.monthlyBillValue ? String(proposal.monthlyBillValue) : '',
      estimatedKwh: proposal.estimatedKwh ? String(proposal.estimatedKwh) : '',
      discountPercentage: proposal.discountPercentage ? String(proposal.discountPercentage) : '20',
      projectedMonthlySavings: proposal.projectedMonthlySavings ? String(proposal.projectedMonthlySavings) : '',
      projectedAnnualSavings: proposal.projectedAnnualSavings ? String(proposal.projectedAnnualSavings) : '',
      validUntil: proposal.validUntil ? proposal.validUntil.split('T')[0] : '',
      notes: proposal.notes || '',
      sourceType: proposal.sourceType || 'editor',
      contentText: proposal.contentText || '',
      templateName: proposal.templateName || '',
      isTemplate: proposal.isTemplate,
      importedFile: undefined,
    });
    setEditingProposalId(proposal.id);
    setProposalMessage(null);
  }

  async function handleUpdateProposal() {
    if (!editingProposalId || savingProposal) return;
    const monthlyBillValue = numberOrUndefined(proposalDraft.monthlyBillValue) ?? 0;
    const estimatedKwh = numberOrUndefined(proposalDraft.estimatedKwh);
    const discountPercentage = numberOrUndefined(proposalDraft.discountPercentage) ?? 0;
    const projectedMonthlySavings = numberOrUndefined(proposalDraft.projectedMonthlySavings) ?? Math.round(monthlyBillValue * (discountPercentage / 100));
    const projectedAnnualSavings = numberOrUndefined(proposalDraft.projectedAnnualSavings) ?? projectedMonthlySavings * 12;
    const title = proposalDraft.title.trim();
    const contentText = proposalDraft.contentText.trim();
    if (!title) { setProposalMessage('Informe o título da proposta.'); return; }
    setSavingProposal(true);
    setProposalMessage(null);
    try {
      await updateProposal(editingProposalId, {
        title,
        monthlyBillValue,
        estimatedKwh,
        discountPercentage,
        projectedMonthlySavings,
        projectedAnnualSavings,
        validUntil: proposalDraft.validUntil ? new Date(proposalDraft.validUntil).toISOString() : undefined,
        notes: proposalDraft.notes.trim() || undefined,
        sourceType: proposalDraft.sourceType,
        contentText: proposalDraft.sourceType === 'editor' ? contentText : undefined,
        contentHtml: proposalDraft.sourceType === 'editor' ? proposalHtmlFromText(contentText) : undefined,
        templateName: proposalDraft.templateName.trim() || undefined,
        isTemplate: proposalDraft.isTemplate,
      });
      setProposalDraft(emptyProposalDraft);
      setEditingProposalId(null);
      setProposalMessage('Proposta atualizada.');
    } catch (error) {
      setProposalMessage(error instanceof Error ? error.message : 'Erro ao atualizar proposta.');
    } finally {
      setSavingProposal(false);
    }
  }

  async function handleAcceptProposal(proposalId: string) {
    setProposalMessage(null);
    try {
      await updateProposal(proposalId, { status: 'accepted' });
      setProposalMessage('Proposta aceita e oportunidade marcada como contrato ganho.');
    } catch {
      setProposalMessage('Não foi possível marcar a proposta como aceita.');
    }
  }

  async function handleDeleteProposal(proposalId: string) {
    const ok = window.confirm('Excluir esta proposta? Essa ação não pode ser desfeita.');
    if (!ok) return;
    try {
      await deleteProposal(proposalId);
      if (editingProposalId === proposalId) {
        setEditingProposalId(null);
        setProposalDraft(emptyProposalDraft);
      }
      setProposalMessage('Proposta excluída.');
    } catch (error) {
      setProposalMessage(error instanceof Error ? error.message : 'Erro ao excluir proposta.');
    }
  }

  function handleCancelEdit() {
    setEditingProposalId(null);
    setProposalDraft(emptyProposalDraft);
    setProposalMessage(null);
  }

  async function handleSaveTags() {
    const tags = (tagDraft ?? currentTagsText).split(',').map((tag) => tag.trim()).filter(Boolean);
    await setTags(tags);
    setTagDraft(null);
  }

  if (loading) return <div className="p-8">Carregando detalhes...</div>;
  if (!lead) return <div className="p-8">Lead não encontrado.</div>;

  const currentTagsText = (lead.tags ?? []).map((tag) => tag.slug).join(', ');
  const phoneDigits = String(lead.contact?.phone ?? '').replace(/\D/g, '');
  const phoneHref = phoneDigits ? `tel:${lead.contact?.phone}` : undefined;
  const whatsappHref = phoneDigits ? `https://wa.me/${phoneDigits.startsWith('55') ? phoneDigits : `55${phoneDigits}`}?text=${encodeURIComponent(`Olá ${lead.contact?.name || ''}, aqui é da Enervita. Podemos falar sobre sua economia de energia?`)}` : undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-2">
        <Link to="/leads">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ArrowLeft size={20} />
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-graphite">{lead.contact?.name}</h1>
          <StageBadge stage={lead.stage} />
          <PriorityBadge priority={lead.priority} />
        </div>
      </div>

      {enervitaIntelligence && (
        <Card className="p-5 border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-orange-50">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-energy-success font-black">Inteligência Enervita</p>
              <h2 className="mt-1 text-xl font-black text-graphite">Diagnóstico comercial do lead</h2>
              <p className="mt-1 text-sm font-semibold text-gray-500">Leitura personalizada para priorizar economia, proposta e próximo contato.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={enervitaIntelligence.potentialTone}>Potencial {enervitaIntelligence.potential}</Badge>
              <Badge variant={enervitaIntelligence.risk === 'Alto' ? 'warning' : 'default'}>Risco {enervitaIntelligence.risk}</Badge>
              <Badge variant="info">{enervitaIntelligence.readiness}</Badge>
              <Button size="sm" variant="ghost" onClick={() => void navigator.clipboard?.writeText(enervitaIntelligence.argument)}>Copiar argumento</Button>
              {canCreateTask ? <Button size="sm" variant="secondary" onClick={() => void handleCreateRecommendedTask()}>Criar tarefa recomendada</Button> : null}
              <Button size="sm" variant="primary" onClick={handleStartIntelligentProposal}>Iniciar proposta</Button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-white/80 bg-white/80 p-4">
              <p className="text-[10px] uppercase tracking-widest font-black text-gray-400 flex items-center gap-1"><Zap size={12} /> Próxima melhor ação</p>
              <p className="mt-2 text-sm font-black text-graphite">{enervitaIntelligence.nextAction}</p>
            </div>
            <div className="rounded-2xl border border-white/80 bg-white/80 p-4">
              <p className="text-[10px] uppercase tracking-widest font-black text-gray-400 flex items-center gap-1"><MessageSquare size={12} /> Argumento recomendado</p>
              <p className="mt-2 text-sm font-semibold text-gray-600">{enervitaIntelligence.argument}</p>
            </div>
            <div className="rounded-2xl border border-white/80 bg-white/80 p-4">
              <p className="text-[10px] uppercase tracking-widest font-black text-gray-400 flex items-center gap-1"><CheckCircle2 size={12} /> Dados críticos</p>
              {enervitaIntelligence.missing.length ? (
                <ul className="mt-2 space-y-1 text-sm font-semibold text-gray-600">
                  {enervitaIntelligence.missing.map((item) => <li key={item}>• Falta {item}</li>)}
                </ul>
              ) : (
                <p className="mt-2 text-sm font-black text-energy-success">Base suficiente para avançar comercialmente.</p>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {enervitaIntelligence.signals.map((signal) => (
              <span key={signal} className="rounded-full bg-white/85 px-3 py-1 text-xs font-bold text-gray-500 border border-white">{signal}</span>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Info Card */}
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-graphite">Informações do Contato</h3>
              <div className="flex items-center gap-2">
                {canEditLead && !editing ? <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Editar lead" onClick={startEditing}><Edit3 size={16} /></Button> : null}
                {canEditLead ? <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-alert-red/10" aria-label="Excluir lead" disabled={savingLead} onClick={handleDeleteLead}><Trash2 size={16} className="text-alert-red" /></Button> : null}
              </div>
            </div>

            {leadMessage ? <p className="mb-4 rounded-xl bg-solar-orange/10 px-3 py-2 text-xs font-semibold text-solar-orange">{leadMessage}</p> : null}
            {editing ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3">
                  <label className="text-xs font-bold uppercase tracking-wide text-gray-400">Nome<input value={editDraft.name} onChange={(event) => setEditDraft((current) => ({ ...current, name: event.target.value }))} className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-2 text-sm normal-case text-graphite" /></label>
                  <label className="text-xs font-bold uppercase tracking-wide text-gray-400">Telefone<input value={editDraft.phone} onChange={(event) => setEditDraft((current) => ({ ...current, phone: event.target.value }))} className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-2 text-sm normal-case text-graphite" /></label>
                  <label className="text-xs font-bold uppercase tracking-wide text-gray-400">E-mail<input value={editDraft.email} onChange={(event) => setEditDraft((current) => ({ ...current, email: event.target.value }))} className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-2 text-sm normal-case text-graphite" /></label>
                  <label className="text-xs font-bold uppercase tracking-wide text-gray-400">Empresa / Unidade<input value={editDraft.company} onChange={(event) => setEditDraft((current) => ({ ...current, company: event.target.value }))} className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-2 text-sm normal-case text-graphite" /></label>
                  <label className="text-xs font-bold uppercase tracking-wide text-gray-400">Origem<input value={editDraft.leadSource} onChange={(event) => setEditDraft((current) => ({ ...current, leadSource: event.target.value }))} className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-2 text-sm normal-case text-graphite" /></label>
                  <label className="text-xs font-bold uppercase tracking-wide text-gray-400">Status de qualificação<input value={editDraft.qualificationStatus} onChange={(event) => setEditDraft((current) => ({ ...current, qualificationStatus: event.target.value }))} className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-2 text-sm normal-case text-graphite" /></label>
                  <label className="text-xs font-bold uppercase tracking-wide text-gray-400">Prioridade<select value={editDraft.priority} onChange={(event) => setEditDraft((current) => ({ ...current, priority: event.target.value as typeof editDraft.priority }))} className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-2 text-sm normal-case text-graphite"><option value="baixa">Baixa</option><option value="media">Média</option><option value="alta">Alta</option><option value="urgente">Urgente</option></select></label>
                  <label className="text-xs font-bold uppercase tracking-wide text-gray-400">Observações<textarea value={editDraft.notes} onChange={(event) => setEditDraft((current) => ({ ...current, notes: event.target.value }))} className="mt-1 min-h-[80px] w-full rounded-xl border border-gray-200 bg-white p-2 text-sm normal-case text-graphite" /></label>
                </div>
                <div className="flex flex-wrap gap-2"><Button variant="primary" size="sm" className="gap-2" disabled={savingLead || !editDraft.name.trim()} onClick={handleSaveLead}><Save size={15} /> Salvar alterações</Button><Button variant="outline" size="sm" className="gap-2" disabled={savingLead} onClick={() => setEditing(false)}><X size={15} /> Cancelar</Button></div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start gap-3"><div className="p-2 bg-gray-100 rounded-lg"><Phone size={16} className="text-gray-500" /></div><div><p className="text-xs text-gray-400">Telefone</p><p className="text-sm font-medium text-graphite">{lead.contact?.phone || 'Não informado'}</p></div></div>
                <div className="flex items-start gap-3"><div className="p-2 bg-gray-100 rounded-lg"><Mail size={16} className="text-gray-500" /></div><div><p className="text-xs text-gray-400">E-mail</p><p className="text-sm font-medium text-graphite">{lead.contact?.email || 'Não informado'}</p></div></div>
                <div className="flex items-start gap-3"><div className="p-2 bg-gray-100 rounded-lg"><MapPin size={16} className="text-gray-500" /></div><div><p className="text-xs text-gray-400">Empresa / Unidade</p><p className="text-sm font-medium text-graphite">{lead.contact?.company || 'Não informado'}</p></div></div>
              </div>
            )}

            <div className="mt-8 grid grid-cols-2 gap-2">
              {phoneHref ? <a href={phoneHref} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gray-100 px-4 py-2 text-sm font-bold text-graphite hover:bg-gray-200"><Phone size={16} /> Ligar</a> : <Button variant="secondary" className="gap-2 w-full opacity-50" disabled><Phone size={16} /> Sem telefone</Button>}
              {whatsappHref ? <button type="button" onClick={handleWhatsappClick} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-graphite hover:bg-gray-50"><MessageSquare size={16} /> WhatsApp</button> : <Button variant="outline" className="gap-2 w-full opacity-50" disabled><MessageSquare size={16} /> Sem WhatsApp</Button>}
            </div>
            <div className="mt-4 rounded-2xl border border-solar-orange/15 bg-solar-orange/5 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-solar-orange">Próxima ação</p>
              {nextOpenTask ? (
                <div className="mt-2 space-y-1">
                  <p className="text-sm font-black text-graphite">{nextOpenTask.title}</p>
                  <p className="text-xs font-semibold text-gray-500">Prioridade: {nextOpenTask.priority} · Vence em {formatDate(nextOpenTask.dueDate)}</p>
                </div>
              ) : (
                <p className="mt-2 text-sm font-semibold text-gray-500">Nenhuma próxima ação cadastrada. Crie uma tarefa para evitar lead parado.</p>
              )}
            </div>
          </Card>

            <div className="rounded-2xl border border-solar-orange/20 bg-solar-orange/5 p-4 mb-4">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-solar-orange">Oportunidade</p>
              {lead.opportunity ? (
                <div className="mt-2 space-y-1">
                  <p className="font-bold text-graphite">{lead.opportunity.title}</p>
                  <p className="text-xs text-gray-500">Status: {lead.opportunity.status} · Probabilidade: {lead.opportunity.probability}% · Convertida em {formatDate(lead.opportunity.convertedAt)}</p>
                  {lead.opportunity.acceptedProposalId && <p className="text-xs font-semibold text-green-700">Contrato ganho via proposta aceita em {(lead.opportunity.acceptedAt ? formatDate(lead.opportunity.acceptedAt) : 'data não informada')}</p>}
                </div>
              ) : (
                <div className="mt-2 space-y-3">
                  <p className="text-sm text-gray-600">Lead ainda não virou oportunidade. Converta quando houver intenção comercial clara e próximo passo de venda.</p>
                  <Button size="sm" onClick={() => void convertToOpportunity()} disabled={convertingOpportunity}>
                    {convertingOpportunity ? 'Convertendo...' : 'Converter em oportunidade'}
                  </Button>
                </div>
              )}
            </div>

          <Card className="p-6">
            <h3 className="font-bold text-graphite mb-4">Tags internas</h3>
            <div className="flex flex-wrap gap-2 mb-4">
              {(lead.tags ?? []).length === 0 ? <span className="text-sm text-gray-400">Nenhuma tag interna ainda.</span> : lead.tags.map((tag) => <Badge key={tag.slug} variant="default" className="bg-solar-orange/10 text-solar-orange lowercase normal-case">#{tag.slug}</Badge>)}
            </div>
            <label className="text-xs font-bold uppercase tracking-wide text-gray-400">Editar tags separadas por vírgula
              <input aria-label="Editar tags internas" value={tagDraft ?? currentTagsText} onChange={(event) => setTagDraft(event.target.value)} className="mt-2 w-full rounded-xl border border-gray-200 bg-white p-2 text-sm normal-case tracking-normal text-graphite" placeholder="vip, urgente, conta-recebida" />
            </label>
            {userHasPermission(user, 'lead.edit') ? <Button variant="primary" size="sm" className="mt-3" onClick={handleSaveTags}>Salvar tags</Button> : <p className="mt-3 text-xs text-gray-400">Sem permissão para editar tags.</p>}
          </Card>

          <Card className="p-6">
            <h3 className="font-bold text-graphite mb-4">Informações de cadastro</h3>
            <div className="space-y-3">
              {cadastro.map((item) => (
                <div key={item.label} className="rounded-xl bg-gray-50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{item.label}</p>
                  <p className="mt-1 break-words text-sm font-semibold text-graphite">{item.value}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <div className="mb-6 flex items-center justify-between gap-3"><h3 className="font-bold text-graphite">Dados Técnicos</h3>{canEditLead && !editing ? <Button variant="ghost" size="sm" className="gap-2" onClick={startEditing}><Edit3 size={15} /> Editar</Button> : null}</div>
            {editing ? (
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wide text-gray-400">Valor da conta<input value={editDraft.energyBillValue} onChange={(event) => setEditDraft((current) => ({ ...current, energyBillValue: event.target.value }))} className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-2 text-sm normal-case text-graphite" /></label>
                <label className="text-xs font-bold uppercase tracking-wide text-gray-400">Consumo médio kWh<input value={editDraft.averageConsumptionKwh} onChange={(event) => setEditDraft((current) => ({ ...current, averageConsumptionKwh: event.target.value }))} className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-2 text-sm normal-case text-graphite" /></label>
                <label className="text-xs font-bold uppercase tracking-wide text-gray-400">Concessionária<input value={editDraft.concessionaria} onChange={(event) => setEditDraft((current) => ({ ...current, concessionaria: event.target.value }))} className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-2 text-sm normal-case text-graphite" /></label>
                <label className="text-xs font-bold uppercase tracking-wide text-gray-400">Oferta<input value={editDraft.offer} onChange={(event) => setEditDraft((current) => ({ ...current, offer: event.target.value }))} className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-2 text-sm normal-case text-graphite" /></label>
                <label className="text-xs font-bold uppercase tracking-wide text-gray-400">Economia estimada<input value={editDraft.projectedSavings} onChange={(event) => setEditDraft((current) => ({ ...current, projectedSavings: event.target.value }))} className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-2 text-sm normal-case text-graphite" /></label>
              </div>
            ) : <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-gray-50">
                <span className="text-sm text-gray-500">Valor da Conta</span>
                <span className="text-sm font-bold text-energy-green">{formatCurrency(lead.energyBillValue)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-50">
                <span className="text-sm text-gray-500">Consumo Médio</span>
                <span className="text-sm font-bold text-graphite">{lead.averageConsumptionKwh} kWh</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-50">
                <span className="text-sm text-gray-500">Concessionária</span>
                <span className="text-sm font-bold text-graphite">{lead.concessionaria}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-50">
                <span className="text-sm text-gray-500">Oferta</span>
                <Badge variant="solar">{lead.offer}</Badge>
              </div>
              <div className="bg-energy-green/5 p-4 rounded-xl mt-4">
                <p className="text-xs text-energy-green font-bold uppercase mb-1">Economia Estimada</p>
                <p className="text-xl font-bold text-energy-deep">{formatCurrency(lead.projectedSavings)}/mês</p>
              </div>
            </div>}
          </Card>
        </div>

        {/* Right Column: Activities/Timeline */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex gap-2 p-1 bg-gray-100 rounded-xl w-fit">
            {[
              { id: 'timeline', label: 'Timeline', icon: Clock },
              { id: 'tasks', label: 'Tarefas', icon: CheckCircle2 },
              { id: 'events', label: 'Tracking', icon: Zap },
              { id: 'history', label: 'Histórico', icon: History },
              { id: 'proposals', label: 'Propostas', icon: FileText },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.id ? 'bg-white text-solar-orange shadow-sm' : 'text-gray-500 hover:text-graphite'
                }`}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
            ))}
          </div>

          <Card className="min-h-[500px]">
            {activeTab === 'timeline' && (
              <div className="p-6">
                <div className="flex gap-4 mb-8">
                  <div className="flex-1">
                    <textarea
                      placeholder={canCreateActivity ? 'Registrar uma nota ou resultado de contato...' : 'Sem permissão para registrar atividade'}
                      value={activityNote}
                      onChange={(event) => setActivityNote(event.target.value)}
                      disabled={!canCreateActivity}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-solar-orange/30 min-h-[100px] disabled:opacity-60"
                    />
                    <div className="flex justify-end mt-2">
                      {canCreateActivity && <Button variant="primary" size="sm" onClick={handleCreateActivity}>Registrar Atividade</Button>}
                    </div>
                  </div>
                </div>

                <div className="relative space-y-8 before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-gray-200 before:via-gray-200 before:to-transparent">
                  {activities.map((activity) => (
                    <div key={activity.id} className="relative flex items-start gap-4 pl-12">
                      <div className="absolute left-0 w-10 h-10 rounded-full bg-white border-2 border-gray-100 flex items-center justify-center text-gray-500 shadow-sm">
                        {activity.activityType === 'call' ? <Phone size={16} /> : <FileText size={16} />}
                      </div>
                      <div className="flex-1 bg-gray-50 rounded-2xl p-4 border border-gray-100">
                        <div className="flex justify-between items-start mb-2">
                          <p className="text-sm font-bold text-graphite">
                            {activity.activityType === 'call' ? 'Contato Telefônico' : 'Nota'}
                          </p>
                          <span className="text-[10px] text-gray-400 font-medium">{formatDate(activity.occurredAt)}</span>
                        </div>
                        <p className="text-sm text-gray-600 leading-relaxed">{activity.outcome}</p>
                      </div>
                    </div>
                  ))}
                  <div className="relative flex items-start gap-4 pl-12">
                    <div className="absolute left-0 w-10 h-10 rounded-full bg-solar-orange/10 border-2 border-solar-orange/20 flex items-center justify-center text-solar-orange shadow-sm">
                      <Plus size={16} />
                    </div>
                    <div className="flex-1 py-2">
                      <p className="text-sm font-bold text-graphite">Lead Criado via {lead.leadSource}</p>
                      <p className="text-xs text-gray-400">{formatDate(lead.createdAt)}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'tasks' && (
              <div className="p-6 space-y-6">
                {canCreateTask && (
                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-4">
                    <h4 className="font-bold text-graphite">Nova tarefa para este lead</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <label className="text-xs font-bold text-gray-500 uppercase">Título da tarefa
                        <input aria-label="Título da tarefa" value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-2 text-sm" />
                      </label>
                      <label className="text-xs font-bold text-gray-500 uppercase">Prioridade
                        <select aria-label="Prioridade" value={taskPriority} onChange={(event) => setTaskPriority(event.target.value as typeof taskPriority)} className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-2 text-sm">
                          <option value="baixa">Baixa</option><option value="media">Média</option><option value="alta">Alta</option><option value="urgente">Urgente</option>
                        </select>
                      </label>
                      <label className="text-xs font-bold text-gray-500 uppercase">Vencimento
                        <input aria-label="Vencimento" type="datetime-local" value={taskDueDate} onChange={(event) => setTaskDueDate(event.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-2 text-sm" />
                      </label>
                    </div>
                    <Button variant="primary" size="sm" className="gap-2" onClick={handleCreateTask}><Plus size={16} /> Criar tarefa</Button>
                  </div>
                )}
                {tasks.length === 0 ? (
                  <div className="p-12 text-center"><CheckCircle2 size={48} className="mx-auto text-gray-200 mb-4" /><h4 className="font-bold text-graphite">Nenhuma tarefa pendente</h4><p className="text-sm text-gray-500 mt-2">Tudo em dia com este lead.</p></div>
                ) : (
                  <div className="space-y-3">{tasks.map((task) => (<div key={task.id} className="rounded-xl border border-gray-100 bg-white p-4 flex items-start justify-between gap-4"><div><p className="font-bold text-graphite">{task.title}</p><p className="text-xs text-gray-500">Status: {task.status} · Prioridade: {task.priority} · Vence em {formatDate(task.dueDate)}</p></div>{canCompleteTask && task.status !== 'concluido' && <Button variant="outline" size="sm" onClick={() => completeTask(task.id)}>Concluir tarefa</Button>}</div>))}</div>
                )}
              </div>
            )}

            {activeTab === 'events' && (
              <div className="p-6 space-y-6">
                <div className="space-y-2">
                  <h4 className="font-bold text-graphite">Resumo de tracking do lead</h4>
                  <p className="text-sm text-gray-500">Identificação da origem comercial capturada pelo tracking e pelo Lead Form da Meta.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-gray-50 p-4"><span className="text-gray-400">Origem</span><p className="font-bold text-graphite">{lead.leadSource || 'Não informada'}</p></div>
                  <div className="rounded-xl bg-gray-50 p-4"><span className="text-gray-400">Origem / mídia</span><p className="font-bold text-graphite">{lead.utmSource || 'sem origem'} / {lead.utmMedium || 'sem medium'}</p></div>
                </div>
                {metaAttribution.length > 0 ? (
                  <div className="rounded-2xl border border-gray-100 bg-white p-5">
                    <h5 className="font-bold text-graphite">Meta Ads: campanha, conjunto, anúncio e proposta</h5>
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      {metaAttribution.map((item) => (
                        <div key={item.label} className="rounded-xl bg-gray-50 p-4">
                          <span className="text-xs font-bold uppercase tracking-wide text-gray-400">{item.label}</span>
                          <p className="mt-1 break-words font-semibold text-graphite">{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-5 text-sm text-gray-500">Este lead ainda não tem campanha/conjunto/anúncio do Meta registrados.</div>
                )}
                <p className="text-xs text-gray-500">IDs técnicos são exibidos para permitir conferência direta no Gerenciador de Anúncios.</p>
              </div>
            )}

            {activeTab === 'history' && (
              <div className="p-6 space-y-4" role="region" aria-label="Histórico do lead">
                <div>
                  <h4 className="font-bold text-graphite">Histórico do lead</h4>
                  <p className="text-sm text-gray-500">Auditoria de alterações registradas para este lead.</p>
                </div>
                {history.length === 0 ? (
                  <div className="p-12 text-center">
                    <History size={48} className="mx-auto text-gray-200 mb-4" />
                    <h4 className="font-bold text-graphite">Nenhum histórico registrado</h4>
                    <p className="text-sm text-gray-500 mt-2">As alterações deste lead aparecerão aqui quando forem registradas.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {history.map((entry) => (
                      <article key={entry.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wide text-solar-orange">{entry.action}</p>
                            <h5 className="mt-1 font-bold text-graphite">{entry.summary}</h5>
                            <p className="mt-1 text-xs text-gray-500">{entry.actor.name} · {entry.actor.email}</p>
                          </div>
                          <span className="rounded-full bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-500">{formatDate(entry.occurredAt)}</span>
                        </div>
                        {entry.changes.length > 0 ? (
                          <div className="mt-4 space-y-2">
                            {entry.changes.map((change) => (
                              <div key={`${entry.id}-${change.field}`} className="rounded-xl bg-gray-50 p-3 text-sm">
                                <p className="text-xs font-bold uppercase tracking-wide text-gray-400">{change.label}</p>
                                <p className="mt-1 text-gray-600"><span className="font-semibold text-graphite">{historyValue(change.before)}</span> → <span className="font-semibold text-graphite">{historyValue(change.after)}</span></p>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'proposals' && (
              <div className="p-6 space-y-6">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h4 className="font-bold text-graphite">Propostas vinculadas ao lead</h4>
                    <p className="text-sm text-gray-500">Crie do zero pelo editor, salve como modelo reutilizável ou importe PDF/arquivo externo.</p>
                  </div>
                  <Badge variant="solar">{sortedProposals.length} proposta(s)</Badge>
                </div>

                {proposalMessage && <div className="rounded-2xl border border-solar-orange/20 bg-solar-orange/5 p-3 text-sm font-semibold text-solar-orange">{proposalMessage}</div>}

                {showTemplateSelector && (
                  <div className="rounded-2xl border border-solar-orange/30 bg-white p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h5 className="font-bold text-graphite">Selecionar Modelo</h5>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowTemplateSelector(false)}><X size={16} /></Button>
                    </div>
                    {templates.length === 0 ? (
                      <p className="text-sm text-gray-500">Nenhum modelo encontrado. Crie uma proposta com "Salvar como modelo" marcado.</p>
                    ) : (
                      <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {templates.map((template) => (
                          <button key={template.id} type="button" onClick={() => handleSelectTemplate(template)} className="w-full text-left rounded-xl border border-gray-100 bg-gray-50 p-3 hover:border-solar-orange/40 hover:bg-solar-orange/5 transition-colors">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-bold text-graphite text-sm">{template.templateName || template.title}</p>
                                <p className="text-xs text-gray-500 mt-1">{template.sourceType === 'file' ? `Arquivo: ${template.importedFileName ?? 'importado'}` : 'Editor'}{template.discountPercentage ? ` · ${template.discountPercentage}% desconto` : ''}</p>
                              </div>
                              <Badge variant="info">Modelo</Badge>
                            </div>
                            {template.contentText && <p className="mt-2 text-xs text-gray-400 line-clamp-2">{template.contentText}</p>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" className="gap-2" onClick={handleLoadTemplates} disabled={loadingTemplates}>
                      <Copy size={14} /> {loadingTemplates ? 'Carregando...' : 'Carregar Modelo'}
                    </Button>
                    {editingProposalId && (
                      <Button type="button" size="sm" variant="ghost" className="gap-2" onClick={handleCancelEdit}>
                        <X size={14} /> Cancelar edição
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <label className="text-xs font-bold text-gray-500 uppercase">Título da proposta
                      <input aria-label="Título da proposta" value={proposalDraft.title} onChange={(event) => setProposalDraft((current) => ({ ...current, title: event.target.value }))} className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-2 text-sm normal-case" placeholder="Ex.: Proposta Enervita - Mercado Solar" />
                    </label>
                    <label className="text-xs font-bold text-gray-500 uppercase">Modelo editável
                      <input aria-label="Nome do modelo" value={proposalDraft.templateName} onChange={(event) => setProposalDraft((current) => ({ ...current, templateName: event.target.value }))} className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-2 text-sm normal-case" placeholder="Opcional: Modelo B2B conta alta" />
                    </label>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <label className="text-xs font-bold text-gray-500 uppercase">Conta R$<input aria-label="Valor mensal da conta" value={proposalDraft.monthlyBillValue} onChange={(event) => setProposalDraft((current) => ({ ...current, monthlyBillValue: event.target.value }))} className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-2 text-sm normal-case" /></label>
                    <label className="text-xs font-bold text-gray-500 uppercase">kWh<input aria-label="Consumo estimado" value={proposalDraft.estimatedKwh} onChange={(event) => setProposalDraft((current) => ({ ...current, estimatedKwh: event.target.value }))} className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-2 text-sm normal-case" /></label>
                    <label className="text-xs font-bold text-gray-500 uppercase">Desconto %<input aria-label="Percentual de desconto" value={proposalDraft.discountPercentage} onChange={(event) => setProposalDraft((current) => ({ ...current, discountPercentage: event.target.value }))} className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-2 text-sm normal-case" /></label>
                    <label className="text-xs font-bold text-gray-500 uppercase">Economia/mês<input aria-label="Economia mensal projetada" value={proposalDraft.projectedMonthlySavings} onChange={(event) => setProposalDraft((current) => ({ ...current, projectedMonthlySavings: event.target.value }))} className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-2 text-sm normal-case" placeholder="auto" /></label>
                    <label className="text-xs font-bold text-gray-500 uppercase">Validade<input aria-label="Validade da proposta" type="date" value={proposalDraft.validUntil} onChange={(event) => setProposalDraft((current) => ({ ...current, validUntil: event.target.value }))} className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-2 text-sm normal-case" /></label>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant={proposalDraft.sourceType === 'editor' ? 'primary' : 'outline'} onClick={() => setProposalDraft((current) => ({ ...current, sourceType: 'editor' }))}><Copy size={14} className="mr-2" /> Criar no editor</Button>
                    <label className="inline-flex cursor-pointer items-center rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-graphite hover:border-solar-orange/40">
                      <Upload size={14} className="mr-2 text-solar-orange" /> Importar arquivo
                      <input type="file" className="hidden" onChange={(event) => void handleProposalFile(event.target.files?.[0])} />
                    </label>
                    <label className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-bold text-gray-600"><input type="checkbox" checked={proposalDraft.isTemplate} onChange={(event) => setProposalDraft((current) => ({ ...current, isTemplate: event.target.checked }))} /> Salvar como modelo</label>
                    {proposalDraft.importedFile && <span className="inline-flex items-center rounded-xl bg-energy-green/10 px-3 py-2 text-xs font-bold text-energy-green">{proposalDraft.importedFile.name}</span>}
                  </div>

                  {proposalDraft.sourceType === 'editor' ? (
                    <textarea aria-label="Conteúdo editável da proposta" value={proposalDraft.contentText} onChange={(event) => setProposalDraft((current) => ({ ...current, contentText: event.target.value }))} className="min-h-[190px] w-full rounded-2xl border border-gray-200 bg-white p-4 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-solar-orange/30" placeholder="Escreva a proposta: diagnóstico, economia estimada, condições comerciais, validade e próximos passos..." />
                  ) : (
                    <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-500">{proposalDraft.importedFile ? 'Arquivo pronto para salvar junto ao lead.' : 'Selecione um arquivo para importar a proposta existente.'}</div>
                  )}

                  <textarea aria-label="Observações da proposta" value={proposalDraft.notes} onChange={(event) => setProposalDraft((current) => ({ ...current, notes: event.target.value }))} className="w-full rounded-xl border border-gray-200 bg-white p-2 text-sm" placeholder="Observações internas opcionais..." />
                  {editingProposalId ? (
                    <Button variant="primary" size="sm" className="gap-2" onClick={handleUpdateProposal} disabled={savingProposal}><Save size={16} /> {savingProposal ? 'Salvando...' : 'Atualizar proposta'}</Button>
                  ) : (
                    <Button variant="primary" size="sm" className="gap-2" onClick={handleCreateProposal} disabled={savingProposal}><Save size={16} /> {savingProposal ? 'Salvando...' : 'Salvar proposta no lead'}</Button>
                  )}
                </div>

                {sortedProposals.length === 0 ? (
                  <div className="p-10 text-center text-gray-400"><FileText className="mx-auto mb-3" />Nenhuma proposta salva para este lead.</div>
                ) : (
                  <div className="space-y-3">
                    {sortedProposals.map((proposal) => (
                      <article key={proposal.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2"><h5 className="font-bold text-graphite">{proposal.title}</h5><Badge variant={proposalStatusVariants[proposal.status]}>{proposalStatusLabels[proposal.status]}</Badge>{proposal.isTemplate && <Badge variant="info">Modelo</Badge>}</div>
                            <p className="mt-1 text-xs text-gray-500">Criada em {formatDate(proposal.createdAt)} · {proposal.sourceType === 'file' ? `Arquivo: ${proposal.importedFileName ?? 'importado'}` : `Editor${proposal.templateName ? ` · ${proposal.templateName}` : ''}`}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-right text-sm"><p className="font-black text-energy-success">{formatCurrency(proposal.projectedAnnualSavings)}/ano</p><p className="text-xs text-gray-500">{proposal.discountPercentage}% desconto</p></div>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Editar proposta" onClick={() => handleEditProposal(proposal)}><Edit3 size={14} /></Button>
                              {proposal.status !== 'accepted' && <Button size="sm" onClick={() => handleAcceptProposal(proposal.id)}>Marcar aceita</Button>}
                              {isAdminUser(user) && <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-alert-red/10" aria-label="Excluir proposta" onClick={() => void handleDeleteProposal(proposal.id)}><Trash2 size={14} className="text-alert-red" /></Button>}
                            </div>
                          </div>
                        </div>
                        {proposal.contentText && <p className="mt-3 line-clamp-3 whitespace-pre-wrap rounded-xl bg-gray-50 p-3 text-sm text-gray-600">{proposal.contentText}</p>}
                        {proposal.importedFileDataBase64 && proposal.importedFileName && <a className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-solar-orange hover:underline" download={proposal.importedFileName} href={`data:${proposal.importedFileMimeType || 'application/octet-stream'};base64,${proposal.importedFileDataBase64}`}><Download size={14} /> Baixar arquivo</a>}
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>

      {whatsappConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="whatsapp-confirm-title">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 id="whatsapp-confirm-title" className="text-lg font-black text-graphite">Confirmar abertura do WhatsApp</h3>
                <p className="mt-1 text-sm text-gray-500">Vou registrar esta ação na timeline do lead e abrir o WhatsApp em uma nova aba.</p>
              </div>
              <button type="button" className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-graphite" onClick={() => setWhatsappConfirmOpen(false)} aria-label="Fechar confirmação"><X size={18} /></button>
            </div>
            {whatsappStatus && <p className="mb-3 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-700">{whatsappStatus}</p>}
            <label className="mb-5 flex items-center gap-3 rounded-2xl bg-gray-50 p-3 text-sm font-semibold text-graphite">
              <input type="checkbox" checked={whatsappDoNotAskAgain} onChange={(event) => setWhatsappDoNotAskAgain(event.target.checked)} className="h-4 w-4 rounded border-gray-300 text-solar-orange focus:ring-solar-orange" />
              Não mostrar novamente neste navegador
            </label>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setWhatsappConfirmOpen(false)}>Cancelar</Button>
              <Button onClick={confirmWhatsappOpen} className="gap-2"><MessageSquare size={16} /> Abrir WhatsApp</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

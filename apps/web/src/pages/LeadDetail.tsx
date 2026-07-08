import { useNavigate, useParams, Link } from 'react-router-dom';
import { useLeadDetail } from '../hooks/useCrm';
import { Button, Card, Badge } from '../components/ui/Base';
import { StageBadge, PriorityBadge } from '../components/ui/StatusBadges';
import {
  ArrowLeft,
  User,
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
  Copy,
  Eye,
  ExternalLink
} from 'lucide-react';
import { formatCurrency, formatDate } from '../lib/utils';
import { useEffect, useMemo, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../auth/useAuth';
import { userHasPermission } from '../auth/permissions';
import { isAdminUser } from '../auth/permissions';
import type {
  LeadDocument,
  ProposalImportedFilePayload,
  SolarCustosCalculados,
  SolarDimensionamento,
  SolarIrradiacaoCidade,
  SolarModeloInversor,
  SolarModeloPlaca,
  SolarTipoTelhado,
  TrackingEvent,
  UpdateProposalPayload,
} from '../lib/api/types';
import type { Proposal } from '../lib/api/types';
import { api, formatCnpj, formatCpf, isValidCnpj, isValidCpf } from '../lib/api/crmApi';

type DetailItem = { label: string; value: string };

const MAX_PROPOSAL_FILE_SIZE_BYTES = 20 * 1024 * 1024;
const MAX_DOCUMENT_FILE_SIZE_BYTES = 20 * 1024 * 1024;

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

function firstTextValue(...values: unknown[]): string {
  for (const value of values) {
    const text = textValue(value);
    if (text) return text;
  }
  return '';
}

function nestedText(value: unknown, path: string[]): string {
  let current = value;
  for (const key of path) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return '';
    current = (current as Record<string, unknown>)[key];
  }
  return textValue(current);
}

function trackingPayloadValue(events: TrackingEvent[], paths: string[][]): string {
  for (const event of events) {
    for (const path of paths) {
      const value = nestedText(event.payload, path);
      if (value) return value;
    }
  }
  return '';
}

function trackingDetailItems(lead: NonNullable<ReturnType<typeof useLeadDetail>['lead']>, events: TrackingEvent[]): DetailItem[] {
  const metadata = getObject(lead.metadata);
  const contactMetadata = getObject(lead.contact?.metadata);
  const meta = getObject(metadata.meta);
  const rawLeadDetails = getObject(meta.rawLeadDetails);
  const allMetadata = { ...contactMetadata, ...metadata };
  const attribution = lead.attribution;
  const items: DetailItem[] = [
    {
      label: 'Origem do lead',
      value: firstTextValue(attribution?.sourceChannel, attribution?.sourceSystem, lead.leadSource, allMetadata.source, allMetadata.importSource, trackingPayloadValue(events, [['source'], ['leadEventSource']])),
    },
    {
      label: 'Campanha',
      value: firstTextValue(attribution?.campaignName, lead.utmCampaign, attribution?.utmCampaign, meta.campaignName, rawLeadDetails.campaign_name, trackingPayloadValue(events, [['utm', 'campaign'], ['campaignName'], ['campaign', 'name']])),
    },
    {
      label: 'Conjunto',
      value: firstTextValue(attribution?.adsetName, attribution?.utmTerm, meta.adsetName, rawLeadDetails.adset_name, trackingPayloadValue(events, [['adsetName'], ['adset', 'name']])),
    },
    {
      label: 'Anuncio / criativo',
      value: firstTextValue(attribution?.adName, lead.utmContent, attribution?.utmContent, meta.adName, rawLeadDetails.ad_name, trackingPayloadValue(events, [['adName'], ['ad', 'name'], ['creative', 'name']])),
    },
    {
      label: 'Formulario / pagina',
      value: firstTextValue(attribution?.formName, meta.formName, rawLeadDetails.form_name, allMetadata.formName, allMetadata.landingPage, trackingPayloadValue(events, [['formName'], ['page', 'title'], ['landingPage']])),
    },
    {
      label: 'Pagina de entrada',
      value: firstTextValue(allMetadata.landingPage, allMetadata.pageUrl, allMetadata.url, trackingPayloadValue(events, [['page', 'url'], ['location', 'url'], ['landingPage']])),
    },
    {
      label: 'UTM source / medium',
      value: [attribution?.utmSource || lead.utmSource || trackingPayloadValue(events, [['utm', 'source']]), attribution?.utmMedium || lead.utmMedium || trackingPayloadValue(events, [['utm', 'medium']])].filter(Boolean).join(' / '),
    },
    {
      label: 'UTM content / term',
      value: [attribution?.utmContent || lead.utmContent || trackingPayloadValue(events, [['utm', 'content']]), attribution?.utmTerm || lead.utmTerm || trackingPayloadValue(events, [['utm', 'term']])].filter(Boolean).join(' / '),
    },
    {
      label: 'IDs Meta',
      value: [
        firstTextValue(attribution?.campaignId, meta.campaignId, rawLeadDetails.campaign_id) && `Campanha ${firstTextValue(attribution?.campaignId, meta.campaignId, rawLeadDetails.campaign_id)}`,
        firstTextValue(attribution?.adsetId, meta.adsetId, rawLeadDetails.adset_id, meta.adgroupId, rawLeadDetails.adgroup_id) && `Conjunto ${firstTextValue(attribution?.adsetId, meta.adsetId, rawLeadDetails.adset_id, meta.adgroupId, rawLeadDetails.adgroup_id)}`,
        firstTextValue(attribution?.adId, meta.adId, rawLeadDetails.ad_id) && `Anuncio ${firstTextValue(attribution?.adId, meta.adId, rawLeadDetails.ad_id)}`,
        firstTextValue(attribution?.formId, meta.formId, rawLeadDetails.form_id) && `Formulario ${firstTextValue(attribution?.formId, meta.formId, rawLeadDetails.form_id)}`,
      ].filter(Boolean).join(' | '),
    },
    {
      label: 'Qualidade da atribuição',
      value: attribution ? (attribution.confidence === 'complete' ? 'Completa' : 'Parcial - exibindo IDs técnicos quando nomes não estiverem disponíveis') : '',
    },
    {
      label: 'Sinais de clique/browser',
      value: [
        lead.fbclid ? 'fbclid' : '',
        lead.fbp ? 'fbp' : '',
        lead.fbc ? 'fbc' : '',
        lead.gclid ? 'gclid' : '',
      ].filter(Boolean).join(', '),
    },
  ];
  return items.filter((item) => item.value && item.value !== 'Invalid Date');
}

function documentPreviewType(document: LeadDocument): 'image' | 'pdf' | 'video' | 'text' | 'download' {
  const mimeType = (document.mimeType ?? '').toLowerCase();
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.includes('pdf')) return 'pdf';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('text/') || mimeType.includes('json') || mimeType.includes('xml')) return 'text';
  return 'download';
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
    { label: 'CPF', value: firstMetadataValue(contactMetadata, ['cpfFormatted', 'cpf']) },
    { label: 'CNPJ', value: firstMetadataValue(contactMetadata, ['cnpjFormatted', 'cnpj']) },
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
  importedFile?: ProposalImportedFilePayload;
  removeImportedFile?: boolean;
};

type ProposalUploadState = 'idle' | 'reading' | 'sending';

type ProposalFileAttachment = {
  name: string;
  mimeType: string;
  size: number;
  dataBase64?: string;
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
  removeImportedFile: false,
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

function decodeBase64ToText(dataBase64: string): string | null {
  try {
    const binary = atob(dataBase64);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

function isTextualDocument(mimeType: string): boolean {
  return (
    mimeType === 'text/plain'
    || mimeType === 'text/csv'
    || mimeType === 'text/markdown'
    || mimeType.includes('json')
    || mimeType.includes('xml')
    || mimeType.includes('javascript')
    || mimeType.includes('javascript.')
    || mimeType.includes('x-www-form-urlencoded')
  );
}

function fileSizeLabel(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function proposalFileDataUrl(file: { mimeType?: string | null; dataBase64?: string | null }): string | null {
  if (!file.dataBase64) return null;
  const mimeType = file.mimeType ? file.mimeType : 'application/octet-stream';
  return `data:${mimeType};base64,${file.dataBase64}`;
}

function renderProposalFilePreview(file: ProposalFileAttachment) {
  const dataUrl = proposalFileDataUrl(file);
  if (!dataUrl) return <p className="text-xs text-text-secondary">Arquivo sem prévia (sem conteúdo). Baixe para revisar.</p>;
  const mimeType = file.mimeType.toLowerCase();

  if (mimeType.startsWith('image/')) {
    return <img src={dataUrl} alt={file.name} className="max-h-64 w-full rounded-xl border border-border-strong object-contain bg-bg-surface-1" />;
  }

  if (isTextualDocument(mimeType)) {
    const previewText = decodeBase64ToText(file.dataBase64 || '');
    return previewText
      ? <pre className="max-h-64 overflow-auto rounded-xl border border-border-strong bg-bg-surface-2/50 p-3 text-xs whitespace-pre-wrap">{previewText}</pre>
      : <p className="text-xs text-text-secondary">Previa textual indisponivel para este arquivo.</p>;
  }

  if (mimeType === 'application/pdf' || mimeType.includes('pdf')) {
    return <iframe src={dataUrl} title={`preview-${file.name}`} className="h-64 w-full rounded-xl border border-border-strong" />;
  }

  if (mimeType.startsWith('video/')) {
    return (
      <video controls className="h-64 w-full rounded-xl border border-border-strong bg-black">
        <source src={dataUrl} type={mimeType} />
      </video>
    );
  }

  if (mimeType.startsWith('audio/')) {
    return <audio controls className="w-full" src={dataUrl} />;
  }

  if (mimeType.startsWith('application/')) {
    return (
      <object
        data={dataUrl}
        type={mimeType}
        className="h-64 w-full rounded-xl border border-border-strong bg-bg-surface-2/50"
        aria-label={`preview ${file.name}`}
      >
        <p className="p-3 text-xs text-text-secondary">Previa do documento indisponivel. Baixe para abrir.</p>
      </object>
    );
  }

  return <p className="text-xs text-text-secondary">Prévia não disponível para este tipo de arquivo. Baixe para abrir.</p>;
}

function getProposalAttachment(proposal: Proposal): ProposalFileAttachment | null {
  if (!proposal.importedFileName || !proposal.importedFileDataBase64) return null;
  return {
    name: proposal.importedFileName,
    mimeType: proposal.importedFileMimeType || 'application/octet-stream',
    size: proposal.importedFileSize ?? 0,
    dataBase64: proposal.importedFileDataBase64,
  };
}

function proposalHtmlFromText(text: string) {
  return text.split('\n').map((line) => `<p>${line.replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[char] ?? char)) || '<br />'}</p>`).join('');
}

function percentInputToDecimal(value: string, fallbackPercent: number): number {
  const parsed = Number(value.trim().replace(',', '.'));
  if (!Number.isFinite(parsed)) return fallbackPercent / 100;
  return Math.max(0, parsed) / 100;
}

function solarNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function solarNumberText(value: unknown, digits = 2, fallback = '-'): string {
  const parsed = solarNumber(value);
  return parsed === null ? fallback : parsed.toFixed(digits);
}

function solarProposalText(leadName: string, dimensionamento: SolarDimensionamento, custos?: SolarCustosCalculados | null): string {
  const moduleCount = Number(dimensionamento.quantidade_sugerida ?? 0);
  const totalKwp = Number(dimensionamento.potencia_total_sugerida_kwp ?? 0);
  const production = Number(dimensionamento.producao_mensal_real_placa ?? 0);
  const total = Number(custos?.total_geral ?? custos?.total_final ?? 0);
  return [
    `Olá ${leadName},`,
    '',
    'Segue o dimensionamento inicial do sistema solar com base nos dados informados.',
    `Cidade/base de irradiação: ${dimensionamento.cidade}/${dimensionamento.uf} (${solarNumberText(dimensionamento.irradiacao_kwh_m2_dia)} kWh/m².dia).`,
    `Consumo médio considerado: ${Math.round(dimensionamento.consumo_medio_mensal_kwh)} kWh/mês.`,
    moduleCount ? `Quantidade sugerida de módulos: ${moduleCount}.` : '',
    totalKwp ? `Potência total estimada: ${totalKwp.toFixed(2)} kWp.` : '',
    dimensionamento.modelo_inversor_nome ? `Inversor sugerido: ${dimensionamento.modelo_inversor_nome}.` : '',
    production ? `Produção mensal estimada por módulo: ${production.toFixed(1)} kWh.` : '',
    total ? `Custo operacional estimado: ${formatCurrency(total)}.` : '',
    '',
    'Próximo passo: validar telhado, modelo comercial final e disponibilidade dos equipamentos antes da proposta definitiva.',
  ].filter(Boolean).join('\n');
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
  const { lead, activities, tasks, history, proposals, trackingEvents, documents, loading, addActivity, addTask, completeTask, addProposal, updateProposal, deleteProposal, uploadDocument, deleteDocument, updateLead, convertToOpportunity, deleteLead, setTags } = useLeadDetail(id);
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
  const [ownerDropdownOpen, setOwnerDropdownOpen] = useState(false);
  const ownerBtnRef = useRef<HTMLButtonElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; right: number } | null>(null);
  const [assigningOwner, setAssigningOwner] = useState(false);
  const [ownerUsers, setOwnerUsers] = useState<Array<{ id: string; name: string; roles: string[] }>>([]);
  const [ownerMessage, setOwnerMessage] = useState<string | null>(null);
  const [ownerSearch, setOwnerSearch] = useState('');
  const [confirmChange, setConfirmChange] = useState<{ userId: string | null; userName: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [savingLead, setSavingLead] = useState(false);
  const [convertingOpportunity, setConvertingOpportunity] = useState(false);
  const [leadMessage, setLeadMessage] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    cpf: '',
    cnpj: '',
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
  const [proposalUploadState, setProposalUploadState] = useState<ProposalUploadState>('idle');
  const [proposalMessage, setProposalMessage] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Proposal[]>([]);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [editingProposalId, setEditingProposalId] = useState<string | null>(null);
  const [solarCities, setSolarCities] = useState<SolarIrradiacaoCidade[]>([]);
  const [solarPlacas, setSolarPlacas] = useState<SolarModeloPlaca[]>([]);
  const [solarInversores, setSolarInversores] = useState<SolarModeloInversor[]>([]);
  const [solarTelhados, setSolarTelhados] = useState<SolarTipoTelhado[]>([]);
  const [solarCidadeQuery, setSolarCidadeQuery] = useState('');
  const [solarCidade, setSolarCidade] = useState<SolarIrradiacaoCidade | null>(null);
  const [solarConsumo, setSolarConsumo] = useState('');
  const [solarTelhado, setSolarTelhado] = useState('');
  const [solarPerda, setSolarPerda] = useState('25');
  const [solarSobra, setSolarSobra] = useState('30');
  const [solarPlacaId, setSolarPlacaId] = useState('');
  const [solarDistancia, setSolarDistancia] = useState('0');
  const [solarLoadingRefs, setSolarLoadingRefs] = useState(false);
  const [solarCalculating, setSolarCalculating] = useState(false);
  const [solarMessage, setSolarMessage] = useState<string | null>(null);
  const [solarDimensionamento, setSolarDimensionamento] = useState<SolarDimensionamento | null>(null);
  const [solarCustos, setSolarCustos] = useState<SolarCustosCalculados | null>(null);
  const [documentMessage, setDocumentMessage] = useState<string | null>(null);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [documentsUploading, setDocumentsUploading] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<LeadDocument | null>(null);
  const isProposalBusy = savingProposal || proposalUploadState === 'reading' || proposalUploadState === 'sending';
  const cadastro = useMemo(() => lead ? cadastroItems(lead) : [], [lead]);
  const trackingDetails = useMemo(() => lead ? trackingDetailItems(lead, trackingEvents) : [], [lead, trackingEvents]);
  const sortedProposals = useMemo(() => [...proposals].sort((a, b) => new Date(b.createdAt || b.updatedAt).getTime() - new Date(a.createdAt || a.updatedAt).getTime()), [proposals]);
  const enervitaIntelligence = useMemo(() => lead ? buildEnervitaIntelligence(lead, tasks, proposals) : null, [lead, tasks, proposals]);

    // Carregar usuarios para dropdown de responsavel
  // Carregar usuarios para dropdown de responsavel
  useEffect(() => {
    if (!user) return;
    fetch('/api/users', { credentials: 'include' })
      .then(r => {
        if (!r.ok) throw new Error('Erro ao carregar usuarios');
        return r.json();
      })
      .then(data => {
        const allUsers = data.users || [];
        const commercial = allUsers.filter((u: any) =>
          u.roles?.some((r: string) => ['vendedor','sdr','consultor','gerente','admin'].includes(r))
        );
        setOwnerUsers(commercial);
      })
      .catch(() => {
        setOwnerUsers([]);
      });
  }, [user]);

  // Fechar dropdown com Escape
  useEffect(() => {
    if (!ownerDropdownOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOwnerDropdownOpen(false);
        setDropdownPos(null);
        setConfirmChange(null);
        setOwnerSearch('');
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [ownerDropdownOpen]);


useEffect(() => {
    if (!lead) return;
    const metadata = getObject(lead.metadata);
    const contactMetadata = getObject(lead.contact?.metadata);
    const city = firstTextValue(metadata.city, contactMetadata.city, metadata.cidade, contactMetadata.cidade);
    const state = firstTextValue(metadata.state, contactMetadata.state, metadata.uf, contactMetadata.uf);
    if (!solarConsumo && lead.averageConsumptionKwh) setSolarConsumo(String(Math.round(lead.averageConsumptionKwh)));
    if (!solarCidadeQuery && city) setSolarCidadeQuery(state ? `${city}/${state}` : city);
  }, [lead, solarCidadeQuery, solarConsumo]);

  useEffect(() => {
    let cancelled = false;
    async function loadSolarRefs() {
      setSolarLoadingRefs(true);
      setSolarMessage(null);
      try {
        const [placas, inversores, telhados] = await Promise.all([
          api.listSolarPlacas(),
          api.listSolarInversores(),
          api.listSolarTelhados(),
        ]);
        if (cancelled) return;
        setSolarPlacas(placas);
        setSolarInversores(inversores);
        setSolarTelhados(telhados);
        setSolarPlacaId((current) => current || placas.find((placa) => placa.padrao)?.id || placas[0]?.id || '');
        setSolarTelhado((current) => current || telhados[0]?.nome || '');
      } catch (error) {
        if (!cancelled) setSolarMessage(error instanceof Error ? error.message : 'Não foi possível carregar modelos solares.');
      } finally {
        if (!cancelled) setSolarLoadingRefs(false);
      }
    }
    void loadSolarRefs();
    return () => { cancelled = true; };
  }, []);

  function startEditing() {
    if (!lead) return;
    setEditDraft({
      name: lead.contact?.name ?? '',
      email: lead.contact?.email ?? '',
      phone: lead.contact?.phone ?? '',
      company: lead.contact?.company ?? '',
      cpf: firstMetadataValue(lead.contact?.metadata, ['cpfFormatted', 'cpf']),
      cnpj: firstMetadataValue(lead.contact?.metadata, ['cnpjFormatted', 'cnpj']),
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
    if (editDraft.cpf.trim() && !isValidCpf(editDraft.cpf)) {
      setLeadMessage('CPF inválido. Confira os dígitos antes de salvar.');
      return;
    }
    if (editDraft.cnpj.trim() && !isValidCnpj(editDraft.cnpj)) {
      setLeadMessage('CNPJ inválido. Confira os dígitos antes de salvar.');
      return;
    }
    const cpf = editDraft.cpf.trim();
    const cnpj = editDraft.cnpj.trim();
    const contactMetadata = {
      ...(lead.contact?.metadata ?? {}),
      cpf: cpf ? cpf.replace(/\D/g, '') : null,
      cpfFormatted: cpf ? formatCpf(cpf) : null,
      cnpj: cnpj ? cnpj.replace(/\D/g, '') : null,
      cnpjFormatted: cnpj ? formatCnpj(cnpj) : null,
    };
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
          cpf: cpf || null,
          cnpj: cnpj || null,
          metadata: contactMetadata,
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

    async function handleAssignOwner(newOwnerId: string | null) {
    if (!lead) return;
    setAssigningOwner(true);
    setOwnerMessage(null);
    setConfirmChange(null);
    try {
      const updated = await api.assignLead(lead.id, newOwnerId);
      // Atualizar campos locais do lead sem reload
      if (updated) {
        (lead as any).sdrOwnerId = newOwnerId;
        (lead as any).sdrOwner = updated.sdrOwner || 'Sem responsavel';
      }
      setOwnerMessage(newOwnerId ? 'Responsavel alterado com sucesso' : 'Responsavel removido');
    } catch (err: any) {
      setOwnerMessage(err?.message || 'Erro ao alterar responsavel');
    } finally {
      setAssigningOwner(false);
      setOwnerDropdownOpen(false);
      setDropdownPos(null);
      setOwnerSearch('');
      setTimeout(() => setOwnerMessage(null), 4000);
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

  async function handleDocumentFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    if (!files.length) return;
    const oversized = files.find((file) => file.size > MAX_DOCUMENT_FILE_SIZE_BYTES);
    if (oversized) {
      setDocumentError(`${oversized.name} ultrapassa o limite de 20 MB.`);
      return;
    }
    setDocumentsUploading(true);
    setDocumentError(null);
    setDocumentMessage(null);
    try {
      for (const file of files) {
        await uploadDocument(file);
      }
      setDocumentMessage(`${files.length} arquivo(s) enviado(s).`);
    } catch (error) {
      setDocumentError(error instanceof Error ? error.message : 'Erro ao enviar documento.');
    } finally {
      setDocumentsUploading(false);
    }
  }

  async function handleDeleteDocument(document: LeadDocument) {
    if (!canEditLead) return;
    const ok = window.confirm(`Excluir o documento ${document.fileName}?`);
    if (!ok) return;
    setDocumentError(null);
    setDocumentMessage(null);
    try {
      await deleteDocument(document.id);
      if (previewDocument?.id === document.id) setPreviewDocument(null);
      setDocumentMessage('Documento excluído.');
    } catch (error) {
      setDocumentError(error instanceof Error ? error.message : 'Erro ao excluir documento.');
    }
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
    if (proposalUploadState === 'sending') return;
    setProposalUploadState('reading');
    if (file.size > MAX_PROPOSAL_FILE_SIZE_BYTES) {
      setProposalMessage(`Arquivo acima do limite de ${fileSizeLabel(MAX_PROPOSAL_FILE_SIZE_BYTES)}. Selecione um arquivo menor ou compacte antes do envio.`);
      setProposalUploadState('idle');
      return;
    }
    try {
      setProposalMessage('Lendo arquivo...');
      const dataBase64 = await fileToBase64(file);
      setProposalDraft((current) => ({
        ...current,
        sourceType: 'file',
        importedFile: { name: file.name, mimeType: file.type || 'application/octet-stream', size: file.size, dataBase64 },
        removeImportedFile: false,
        title: current.title || file.name.replace(/\.[^.]+$/, ''),
      }));
      setProposalMessage(null);
    } catch {
      setProposalMessage('Não foi possível ler o arquivo selecionado.');
    } finally {
      setProposalUploadState('idle');
    }
  }

  async function handleSearchSolarCity() {
    const query = solarCidadeQuery.trim().replace(/\/[A-Za-z]{2}$/, '').trim();
    if (query.length < 2) {
      setSolarMessage('Digite pelo menos 2 caracteres da cidade.');
      return;
    }
    setSolarLoadingRefs(true);
    setSolarMessage(null);
    try {
      const cities = await api.listSolarIrradiacao({ q: query, limit: 25 });
      setSolarCities(cities);
      if (cities.length === 1) {
        setSolarCidade(cities[0]);
        setSolarCidadeQuery(`${cities[0].cidade}/${cities[0].uf}`);
      }
      if (cities.length === 0) setSolarMessage('Cidade não encontrada na base de irradiação. Tente outro nome ou UF.');
    } catch (error) {
      setSolarMessage(error instanceof Error ? error.message : 'Erro ao buscar cidade.');
    } finally {
      setSolarLoadingRefs(false);
    }
  }

  async function handleCalcularSolar() {
    if (!lead || solarCalculating) return;
    const consumo = numberOrUndefined(solarConsumo);
    if (!solarCidade) { setSolarMessage('Selecione a cidade de irradiação antes de calcular.'); return; }
    if (!consumo || consumo <= 0) { setSolarMessage('Informe o consumo médio mensal em kWh.'); return; }
    if (!solarPlacaId) { setSolarMessage('Selecione o modelo de placa padrão.'); return; }
    setSolarCalculating(true);
    setSolarMessage(null);
    try {
      const dimensionamentoResponse = await api.calcularDimensionamentoSolar({
        lead_id: lead.id,
        cidade: solarCidade.cidade,
        uf: solarCidade.uf,
        consumo_medio_mensal_kwh: consumo,
        tipo_telhado: solarTelhado || null,
        perda_decimal: percentInputToDecimal(solarPerda, 25),
        sobra_decimal: percentInputToDecimal(solarSobra, 30),
        modelo_placa_id: solarPlacaId,
      });
      const dimensionamento = dimensionamentoResponse.dimensionamento;
      const custos = await api.calcularCustosSolar({
        dimensionamento_id: dimensionamento.id,
        quantidade_modulos: dimensionamento.quantidade_sugerida ?? undefined,
        distancia_km: numberOrUndefined(solarDistancia) ?? 0,
      });
      setSolarDimensionamento(dimensionamento);
      setSolarCustos(custos);
      const leadName = lead.contact?.name || 'cliente';
      const contentText = solarProposalText(leadName, dimensionamento, custos);
      setProposalDraft((current) => ({
        ...current,
        title: current.title || `Proposta Enervita — ${leadName}`,
        estimatedKwh: String(Math.round(consumo)),
        sourceType: 'editor',
        contentText,
        notes: [
          current.notes,
          `Dimensionamento solar ${dimensionamento.id}: ${dimensionamento.quantidade_sugerida ?? '-'} módulos, ${solarNumberText(dimensionamento.potencia_total_sugerida_kwp)} kWp, ${dimensionamento.cidade}/${dimensionamento.uf}.`,
        ].filter(Boolean).join('\n'),
      }));
      setEditingProposalId(null);
      setProposalMessage('Dimensionamento aplicado ao rascunho. Revise a proposta antes de salvar.');
      setSolarMessage('Dimensionamento calculado e aplicado ao editor da proposta.');
    } catch (error) {
      setSolarMessage(error instanceof Error ? error.message : 'Erro ao calcular dimensionamento.');
    } finally {
      setSolarCalculating(false);
    }
  }

  async function handleCreateProposal() {
    if (!lead || savingProposal || proposalUploadState === 'sending') return;
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
    if (proposalDraft.sourceType === 'file' && proposalDraft.importedFile && proposalDraft.importedFile.size > MAX_PROPOSAL_FILE_SIZE_BYTES) {
      setProposalMessage(`Arquivo acima do limite de ${fileSizeLabel(MAX_PROPOSAL_FILE_SIZE_BYTES)}.`);
      return;
    }
    setProposalUploadState('sending');
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
      setProposalUploadState('idle');
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
      removeImportedFile: false,
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
      removeImportedFile: false,
    });
    setEditingProposalId(proposal.id);
    setProposalMessage(null);
  }

  async function handleUpdateProposal() {
    if (!editingProposalId || savingProposal || proposalUploadState === 'sending') return;
    const monthlyBillValue = numberOrUndefined(proposalDraft.monthlyBillValue) ?? 0;
    const estimatedKwh = numberOrUndefined(proposalDraft.estimatedKwh);
    const discountPercentage = numberOrUndefined(proposalDraft.discountPercentage) ?? 0;
    const projectedMonthlySavings = numberOrUndefined(proposalDraft.projectedMonthlySavings) ?? Math.round(monthlyBillValue * (discountPercentage / 100));
    const projectedAnnualSavings = numberOrUndefined(proposalDraft.projectedAnnualSavings) ?? projectedMonthlySavings * 12;
    const title = proposalDraft.title.trim();
    const contentText = proposalDraft.contentText.trim();
    if (!title) { setProposalMessage('Informe o título da proposta.'); return; }
    setProposalUploadState('sending');
    setSavingProposal(true);
    setProposalMessage(null);
    try {
      const payload: UpdateProposalPayload = {
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
      };
      if (proposalDraft.removeImportedFile) payload.importedFile = null;
      if (!proposalDraft.removeImportedFile && proposalDraft.sourceType === 'file' && proposalDraft.importedFile) payload.importedFile = proposalDraft.importedFile;
      await updateProposal(editingProposalId, payload);
      setProposalDraft(emptyProposalDraft);
      setEditingProposalId(null);
      setProposalMessage('Proposta atualizada.');
    } catch (error) {
      setProposalMessage(error instanceof Error ? error.message : 'Erro ao atualizar proposta.');
    } finally {
      setProposalUploadState('idle');
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

  async function handleDeleteProposalFile(proposalId: string) {
    const ok = window.confirm('Excluir o arquivo desta proposta? O registro da proposta continuará no lead.');
    if (!ok) return;
    try {
      await updateProposal(proposalId, { importedFile: null });
      if (editingProposalId === proposalId) {
        setProposalDraft((current) => ({ ...current, importedFile: undefined, removeImportedFile: true }));
      }
      setProposalMessage('Arquivo da proposta removido.');
    } catch (error) {
      setProposalMessage(error instanceof Error ? error.message : 'Erro ao remover arquivo da proposta.');
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

  async function handleConvertToOpportunity() {
    setConvertingOpportunity(true);
    try {
      await convertToOpportunity();
    } finally {
      setConvertingOpportunity(false);
    }
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
          <h1 className="text-2xl font-bold text-text-primary">{lead.contact?.name}</h1>
          <StageBadge stage={lead.stage} />
          <PriorityBadge priority={lead.priority} />
        </div>
      </div>

      {enervitaIntelligence && (
        <Card className="p-5 border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-orange-50">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-energy-success font-black">Inteligência Enervita</p>
              <h2 className="mt-1 text-xl font-black text-text-primary">Diagnóstico comercial do lead</h2>
              <p className="mt-1 text-sm font-semibold text-text-secondary">Leitura personalizada para priorizar economia, proposta e próximo contato.</p>
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
            <div className="rounded-2xl border border-white/80 bg-bg-surface-1/80 p-4">
              <p className="text-[10px] uppercase tracking-widest font-black text-text-secondary flex items-center gap-1"><Zap size={12} /> Próxima melhor ação</p>
              <p className="mt-2 text-sm font-black text-text-primary">{enervitaIntelligence.nextAction}</p>
            </div>
            <div className="rounded-2xl border border-white/80 bg-bg-surface-1/80 p-4">
              <p className="text-[10px] uppercase tracking-widest font-black text-text-secondary flex items-center gap-1"><MessageSquare size={12} /> Argumento recomendado</p>
              <p className="mt-2 text-sm font-semibold text-text-primary">{enervitaIntelligence.argument}</p>
            </div>
            <div className="rounded-2xl border border-white/80 bg-bg-surface-1/80 p-4">
              <p className="text-[10px] uppercase tracking-widest font-black text-text-secondary flex items-center gap-1"><CheckCircle2 size={12} /> Dados críticos</p>
              {enervitaIntelligence.missing.length ? (
                <ul className="mt-2 space-y-1 text-sm font-semibold text-text-primary">
                  {enervitaIntelligence.missing.map((item) => <li key={item}>• Falta {item}</li>)}
                </ul>
              ) : (
                <p className="mt-2 text-sm font-black text-energy-success">Base suficiente para avançar comercialmente.</p>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {enervitaIntelligence.signals.map((signal) => (
              <span key={signal} className="rounded-full bg-bg-surface-1/85 px-3 py-1 text-xs font-bold text-text-secondary border border-white">{signal}</span>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Info Card */}
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-text-primary">Informações do Contato</h3>
              <div className="flex items-center gap-2">
                {canEditLead && !editing ? <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Editar lead" onClick={startEditing}><Edit3 size={16} /></Button> : null}
                {canEditLead ? <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-red-500/10" aria-label="Excluir lead" disabled={savingLead} onClick={handleDeleteLead}><Trash2 size={16} className="text-alert-red" /></Button> : null}
              </div>
            </div>

            {leadMessage ? <p className="mb-4 rounded-xl bg-orange-500/10 px-3 py-2 text-xs font-semibold text-orange-400">{leadMessage}</p> : null}
            {editing ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3">
                  <label className="text-xs font-bold uppercase tracking-wide text-text-secondary">Nome<input value={editDraft.name} onChange={(event) => setEditDraft((current) => ({ ...current, name: event.target.value }))} className="mt-1 w-full rounded-xl border border-border-strong bg-bg-surface-1 p-2 text-sm normal-case text-text-primary" /></label>
                  <label className="text-xs font-bold uppercase tracking-wide text-text-secondary">Telefone<input value={editDraft.phone} onChange={(event) => setEditDraft((current) => ({ ...current, phone: event.target.value }))} className="mt-1 w-full rounded-xl border border-border-strong bg-bg-surface-1 p-2 text-sm normal-case text-text-primary" /></label>
                  <label className="text-xs font-bold uppercase tracking-wide text-text-secondary">E-mail<input value={editDraft.email} onChange={(event) => setEditDraft((current) => ({ ...current, email: event.target.value }))} className="mt-1 w-full rounded-xl border border-border-strong bg-bg-surface-1 p-2 text-sm normal-case text-text-primary" /></label>
                  <label className="text-xs font-bold uppercase tracking-wide text-text-secondary">Empresa / Unidade<input value={editDraft.company} onChange={(event) => setEditDraft((current) => ({ ...current, company: event.target.value }))} className="mt-1 w-full rounded-xl border border-border-strong bg-bg-surface-1 p-2 text-sm normal-case text-text-primary" /></label>
                  <label className="text-xs font-bold uppercase tracking-wide text-text-secondary">Origem<input value={editDraft.leadSource} onChange={(event) => setEditDraft((current) => ({ ...current, leadSource: event.target.value }))} className="mt-1 w-full rounded-xl border border-border-strong bg-bg-surface-1 p-2 text-sm normal-case text-text-primary" /></label>
                  <label className="text-xs font-bold uppercase tracking-wide text-text-secondary">Status de qualificação<input value={editDraft.qualificationStatus} onChange={(event) => setEditDraft((current) => ({ ...current, qualificationStatus: event.target.value }))} className="mt-1 w-full rounded-xl border border-border-strong bg-bg-surface-1 p-2 text-sm normal-case text-text-primary" /></label>
                  <label className="text-xs font-bold uppercase tracking-wide text-text-secondary">Prioridade<select value={editDraft.priority} onChange={(event) => setEditDraft((current) => ({ ...current, priority: event.target.value as typeof editDraft.priority }))} className="mt-1 w-full rounded-xl border border-border-strong bg-bg-surface-1 p-2 text-sm normal-case text-text-primary"><option value="baixa">Baixa</option><option value="media">Média</option><option value="alta">Alta</option><option value="urgente">Urgente</option></select></label>
                  <label className="text-xs font-bold uppercase tracking-wide text-text-secondary">Observações<textarea value={editDraft.notes} onChange={(event) => setEditDraft((current) => ({ ...current, notes: event.target.value }))} className="mt-1 min-h-[80px] w-full rounded-xl border border-border-strong bg-bg-surface-1 p-2 text-sm normal-case text-text-primary" /></label>
                </div>
                <div className="flex flex-wrap gap-2"><Button variant="primary" size="sm" className="gap-2" disabled={savingLead || !editDraft.name.trim()} onClick={handleSaveLead}><Save size={15} /> Salvar alterações</Button><Button variant="outline" size="sm" className="gap-2" disabled={savingLead} onClick={() => setEditing(false)}><X size={15} /> Cancelar</Button></div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start gap-3"><div className="p-2 bg-bg-surface-2/50 rounded-lg"><Phone size={16} className="text-text-secondary" /></div><div><p className="text-xs text-text-secondary">Telefone</p><p className="text-sm font-medium text-text-primary">{lead.contact?.phone || 'Não informado'}</p></div></div>
                <div className="flex items-start gap-3"><div className="p-2 bg-bg-surface-2/50 rounded-lg"><Mail size={16} className="text-text-secondary" /></div><div><p className="text-xs text-text-secondary">E-mail</p><p className="text-sm font-medium text-text-primary">{lead.contact?.email || 'Não informado'}</p></div></div>
                <div className="flex items-start gap-3"><div className="p-2 bg-bg-surface-2/50 rounded-lg"><MapPin size={16} className="text-text-secondary" /></div><div><p className="text-xs text-text-secondary">Empresa / Unidade</p><p className="text-sm font-medium text-text-primary">{lead.contact?.company || 'Não informado'}</p></div></div>
              </div>
            )}

            <div className="mt-8 grid grid-cols-2 gap-2">
              {phoneHref ? <a href={phoneHref} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-bg-surface-2/50 px-4 py-2 text-sm font-bold text-text-primary hover:bg-bg-surface-2/70"><Phone size={16} /> Ligar</a> : <Button variant="secondary" className="gap-2 w-full opacity-50" disabled><Phone size={16} /> Sem telefone</Button>}
              {whatsappHref ? <button type="button" onClick={handleWhatsappClick} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border-strong px-4 py-2 text-sm font-bold text-text-primary hover:bg-bg-surface-2/50"><MessageSquare size={16} /> WhatsApp</button> : <Button variant="outline" className="gap-2 w-full opacity-50" disabled><MessageSquare size={16} /> Sem WhatsApp</Button>}
            </div>
            <div className="mt-4 rounded-2xl border border-orange-500/15 bg-orange-500/5 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-orange-400">Próxima ação</p>
              {nextOpenTask ? (
                <div className="mt-2 space-y-1">
                  <p className="text-sm font-black text-text-primary">{nextOpenTask.title}</p>
                  <p className="text-xs font-semibold text-text-secondary">Prioridade: {nextOpenTask.priority} · Vence em {formatDate(nextOpenTask.dueDate)}</p>
                </div>
              ) : (
                <p className="mt-2 text-sm font-semibold text-text-secondary">Nenhuma próxima ação cadastrada. Crie uma tarefa para evitar lead parado.</p>
              )}
            </div>
          </Card>

            <div className="rounded-2xl border border-orange-500/20 bg-orange-500/5 p-4 mb-4">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-400">Oportunidade</p>
              {lead.opportunity ? (
                <div className="mt-2 space-y-1">
                  <p className="font-bold text-text-primary">{lead.opportunity.title}</p>
                  <p className="text-xs text-text-secondary">Status: {lead.opportunity.status} · Probabilidade: {lead.opportunity.probability}% · Convertida em {formatDate(lead.opportunity.convertedAt)}</p>
                  {lead.opportunity.acceptedProposalId && <p className="text-xs font-semibold text-green-700">Contrato ganho via proposta aceita em {(lead.opportunity.acceptedAt ? formatDate(lead.opportunity.acceptedAt) : 'data não informada')}</p>}
                </div>
              ) : (
                <div className="mt-2 space-y-3">
                  <p className="text-sm text-text-primary">Lead ainda não virou oportunidade. Converta quando houver intenção comercial clara e próximo passo de venda.</p>
                  <Button size="sm" onClick={() => void handleConvertToOpportunity()} disabled={convertingOpportunity}>
                    {convertingOpportunity ? 'Convertendo...' : 'Converter em oportunidade'}
                  </Button>
                </div>
              )}
            </div>


          {/* Card do Responsavel */}
          <Card className="p-6">
            <h3 className="font-bold text-text-primary mb-4">Responsavel</h3>
            {ownerMessage && (
              <p className={`mb-3 rounded-xl px-3 py-2 text-xs font-semibold ${ownerMessage.includes('sucesso') ? 'bg-mint-500/10 text-mint-400' : 'bg-red-500/10 text-alert-red'}`}>
                {ownerMessage}
              </p>
            )}
            <div className="flex items-center gap-3">
              <div className="p-2 bg-bg-surface-2/50 rounded-lg">
                <User size={16} className="text-text-secondary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">{lead.sdrOwner || 'Sem responsavel'}</p>
              </div>
              {isAdminUser(user) && (
                <div className="relative">
                  <Button
                    ref={ownerBtnRef}
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (ownerDropdownOpen) {
                        setOwnerDropdownOpen(false);
                        setDropdownPos(null);
                      } else {
                        const rect = ownerBtnRef.current?.getBoundingClientRect();
                        if (rect) {
                          setDropdownPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                        }
                        setOwnerDropdownOpen(true);
                      }
                    }}
                    disabled={assigningOwner}
                    className="gap-1"
                  >
                    {assigningOwner ? 'Salvando...' : 'Trocar'}
                  </Button>
                  {ownerDropdownOpen && dropdownPos && createPortal(
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => { setOwnerDropdownOpen(false); setDropdownPos(null); setConfirmChange(null); setOwnerSearch(''); }} />
                      <div
                        className="fixed w-72 bg-bg-surface-1 border border-border-strong rounded-xl shadow-lg z-50 flex flex-col"
                        style={{ top: dropdownPos.top, right: dropdownPos.right, maxHeight: '320px' }}
                      >
                        {/* Campo de busca */}
                        <div className="p-2 border-b border-border-soft">
                          <input
                            placeholder="Buscar usuario..."
                            value={ownerSearch}
                            onChange={(e) => setOwnerSearch(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-border-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-solar-orange/30"
                            autoFocus
                          />
                        </div>

                        {/* Lista de usuarios */}
                        <div className="overflow-y-auto flex-1 p-1">
                          <button
                            className="w-full text-left px-3 py-2 text-sm text-text-secondary hover:bg-bg-surface-2/50 rounded-lg transition-colors"
                            onClick={() => setConfirmChange({ userId: null, userName: 'Sem responsavel' })}
                          >
                            Sem responsavel
                          </button>
                          {ownerUsers.length === 0 && (
                            <p className="px-3 py-2 text-xs text-text-secondary">Carregando...</p>
                          )}
                          {ownerUsers
                            .filter(u => u.name.toLowerCase().includes(ownerSearch.toLowerCase()))
                            .map(u => (
                              <button
                                key={u.id}
                                className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${
                                  lead.sdrOwnerId === u.id
                                    ? 'bg-orange-500/10 text-orange-400 font-semibold'
                                    : 'text-text-primary hover:bg-bg-surface-2/50'
                                }`}
                                onClick={() => setConfirmChange({ userId: u.id, userName: u.name })}
                              >
                                {u.name}
                                <span className="text-xs text-text-secondary ml-1">({u.roles?.[0] || ''})</span>
                              </button>
                            ))
                          }
                          {ownerUsers.filter(u => u.name.toLowerCase().includes(ownerSearch.toLowerCase())).length === 0 && ownerSearch && (
                            <p className="px-3 py-2 text-xs text-text-secondary">Nenhum usuario encontrado</p>
                          )}
                        </div>

                        {/* Confirmacao inline */}
                        {confirmChange && (
                          <div className="p-3 bg-amber-50 border-t border-amber-200 rounded-b-xl">
                            <p className="text-sm font-semibold text-text-primary">
                              Atribuir para <strong>{confirmChange.userName}</strong>?
                            </p>
                            <div className="flex gap-2 mt-2">
                              <button
                                className="px-3 py-1.5 text-xs font-bold bg-orange-500 text-white rounded-lg hover:bg-orange-500/90 transition-colors"
                                onClick={() => handleAssignOwner(confirmChange.userId)}
                                disabled={assigningOwner}
                              >
                                {assigningOwner ? 'Salvando...' : 'Confirmar'}
                              </button>
                              <button
                                className="px-3 py-1.5 text-xs font-bold text-text-secondary hover:bg-bg-surface-2/50 rounded-lg transition-colors"
                                onClick={() => setConfirmChange(null)}
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </>,
                    document.body
                  )}
                </div>
              )}
            </div>
          </Card>


          <Card className="p-6">
            <h3 className="font-bold text-text-primary mb-4">Tags internas</h3>
            <div className="flex flex-wrap gap-2 mb-4">
              {(lead.tags ?? []).length === 0 ? <span className="text-sm text-text-secondary">Nenhuma tag interna ainda.</span> : lead.tags.map((tag) => <Badge key={tag.slug} variant="default" className="bg-orange-500/10 text-orange-400 lowercase normal-case">#{tag.slug}</Badge>)}
            </div>
            <label className="text-xs font-bold uppercase tracking-wide text-text-secondary">Editar tags separadas por vírgula
              <input aria-label="Editar tags internas" value={tagDraft ?? currentTagsText} onChange={(event) => setTagDraft(event.target.value)} className="mt-2 w-full rounded-xl border border-border-strong bg-bg-surface-1 p-2 text-sm normal-case tracking-normal text-text-primary" placeholder="vip, urgente, conta-recebida" />
            </label>
            {userHasPermission(user, 'lead.edit') ? <Button variant="primary" size="sm" className="mt-3" onClick={handleSaveTags}>Salvar tags</Button> : <p className="mt-3 text-xs text-text-secondary">Sem permissão para editar tags.</p>}
          </Card>

          <Card className="p-6">
            <h3 className="font-bold text-text-primary mb-4">Informações de cadastro</h3>
            <div className="space-y-3">
              {cadastro.map((item) => (
                <div key={item.label} className="rounded-xl bg-bg-surface-2/50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-text-secondary">{item.label}</p>
                  <p className="mt-1 break-words text-sm font-semibold text-text-primary">{item.value}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <div className="mb-6 flex items-center justify-between gap-3"><h3 className="font-bold text-text-primary">Dados Técnicos</h3>{canEditLead && !editing ? <Button variant="ghost" size="sm" className="gap-2" onClick={startEditing}><Edit3 size={15} /> Editar</Button> : null}</div>
            {editing ? (
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wide text-text-secondary">Valor da conta<input value={editDraft.energyBillValue} onChange={(event) => setEditDraft((current) => ({ ...current, energyBillValue: event.target.value }))} className="mt-1 w-full rounded-xl border border-border-strong bg-bg-surface-1 p-2 text-sm normal-case text-text-primary" /></label>
                <label className="text-xs font-bold uppercase tracking-wide text-text-secondary">Consumo médio kWh<input value={editDraft.averageConsumptionKwh} onChange={(event) => setEditDraft((current) => ({ ...current, averageConsumptionKwh: event.target.value }))} className="mt-1 w-full rounded-xl border border-border-strong bg-bg-surface-1 p-2 text-sm normal-case text-text-primary" /></label>
                <label className="text-xs font-bold uppercase tracking-wide text-text-secondary">Concessionária<input value={editDraft.concessionaria} onChange={(event) => setEditDraft((current) => ({ ...current, concessionaria: event.target.value }))} className="mt-1 w-full rounded-xl border border-border-strong bg-bg-surface-1 p-2 text-sm normal-case text-text-primary" /></label>
                <label className="text-xs font-bold uppercase tracking-wide text-text-secondary">CPF<input inputMode="numeric" value={editDraft.cpf} onChange={(event) => setEditDraft((current) => ({ ...current, cpf: formatCpf(event.target.value) }))} className="mt-1 w-full rounded-xl border border-border-strong bg-bg-surface-1 p-2 text-sm normal-case text-text-primary" /></label>
                <label className="text-xs font-bold uppercase tracking-wide text-text-secondary">CNPJ<input inputMode="numeric" value={editDraft.cnpj} onChange={(event) => setEditDraft((current) => ({ ...current, cnpj: formatCnpj(event.target.value) }))} className="mt-1 w-full rounded-xl border border-border-strong bg-bg-surface-1 p-2 text-sm normal-case text-text-primary" /></label>
                <label className="text-xs font-bold uppercase tracking-wide text-text-secondary">Oferta<input value={editDraft.offer} onChange={(event) => setEditDraft((current) => ({ ...current, offer: event.target.value }))} className="mt-1 w-full rounded-xl border border-border-strong bg-bg-surface-1 p-2 text-sm normal-case text-text-primary" /></label>
                <label className="text-xs font-bold uppercase tracking-wide text-text-secondary">Economia estimada<input value={editDraft.projectedSavings} onChange={(event) => setEditDraft((current) => ({ ...current, projectedSavings: event.target.value }))} className="mt-1 w-full rounded-xl border border-border-strong bg-bg-surface-1 p-2 text-sm normal-case text-text-primary" /></label>
              </div>
            ) : <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-border-hair">
                <span className="text-sm text-text-secondary">Valor da Conta</span>
                <span className="text-sm font-bold text-mint-400">{formatCurrency(lead.energyBillValue)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border-hair">
                <span className="text-sm text-text-secondary">Consumo Médio</span>
                <span className="text-sm font-bold text-text-primary">{lead.averageConsumptionKwh} kWh</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border-hair">
                <span className="text-sm text-text-secondary">Concessionária</span>
                <span className="text-sm font-bold text-text-primary">{lead.concessionaria}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border-hair">
                <span className="text-sm text-text-secondary">Oferta</span>
                <Badge variant="solar">{lead.offer}</Badge>
              </div>
              <div className="bg-mint-500/5 p-4 rounded-xl mt-4">
                <p className="text-xs text-mint-400 font-bold uppercase mb-1">Economia Estimada</p>
                <p className="text-xl font-bold text-energy-deep">{formatCurrency(lead.projectedSavings)}/mês</p>
              </div>
            </div>}
          </Card>
        </div>

        {/* Right Column: Activities/Timeline */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex gap-2 p-1 bg-bg-surface-2/50 rounded-xl w-fit">
            {[
              { id: 'timeline', label: 'Timeline', icon: Clock },
              { id: 'tasks', label: 'Tarefas', icon: CheckCircle2 },
              { id: 'events', label: 'Tracking', icon: Zap },
              { id: 'history', label: 'Histórico', icon: History },
              { id: 'documents', label: 'Documentos', icon: Upload },
              { id: 'proposals', label: 'Propostas', icon: FileText },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.id ? 'bg-bg-surface-1 text-orange-400 shadow-sm' : 'text-text-secondary hover:text-text-primary'
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
                      className="w-full bg-bg-surface-2/50 border border-border-strong rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-solar-orange/30 min-h-[100px] disabled:opacity-60"
                    />
                    <div className="flex justify-end mt-2">
                      {canCreateActivity && <Button variant="primary" size="sm" onClick={handleCreateActivity}>Registrar Atividade</Button>}
                    </div>
                  </div>
                </div>

                <div className="relative space-y-8 before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-gray-200 before:via-gray-200 before:to-transparent">
                  {activities.map((activity) => (
                    <div key={activity.id} className="relative flex items-start gap-4 pl-12">
                      <div className="absolute left-0 w-10 h-10 rounded-full bg-bg-surface-1 border-2 border-border-soft flex items-center justify-center text-text-secondary shadow-sm">
                        {activity.activityType === 'call' ? <Phone size={16} /> : <FileText size={16} />}
                      </div>
                      <div className="flex-1 bg-bg-surface-2/50 rounded-2xl p-4 border border-border-soft">
                        <div className="flex justify-between items-start mb-2">
                          <p className="text-sm font-bold text-text-primary">
                            {activity.activityType === 'call' ? 'Contato Telefônico' : 'Nota'}
                          </p>
                          <span className="text-[10px] text-text-secondary font-medium">{formatDate(activity.occurredAt)}</span>
                        </div>
                        <p className="text-sm text-text-primary leading-relaxed">{activity.outcome}</p>
                      </div>
                    </div>
                  ))}
                  <div className="relative flex items-start gap-4 pl-12">
                    <div className="absolute left-0 w-10 h-10 rounded-full bg-orange-500/10 border-2 border-orange-500/20 flex items-center justify-center text-orange-400 shadow-sm">
                      <Plus size={16} />
                    </div>
                    <div className="flex-1 py-2">
                      <p className="text-sm font-bold text-text-primary">Lead Criado via {lead.leadSource}</p>
                      <p className="text-xs text-text-secondary">{formatDate(lead.createdAt)}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'tasks' && (
              <div className="p-6 space-y-6">
                {canCreateTask && (
                  <div className="rounded-2xl border border-border-soft bg-bg-surface-2/50 p-4 space-y-4">
                    <h4 className="font-bold text-text-primary">Nova tarefa para este lead</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <label className="text-xs font-bold text-text-secondary uppercase">Título da tarefa
                        <input aria-label="Título da tarefa" value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} className="mt-1 w-full rounded-xl border border-border-strong bg-bg-surface-1 p-2 text-sm" />
                      </label>
                      <label className="text-xs font-bold text-text-secondary uppercase">Prioridade
                        <select aria-label="Prioridade" value={taskPriority} onChange={(event) => setTaskPriority(event.target.value as typeof taskPriority)} className="mt-1 w-full rounded-xl border border-border-strong bg-bg-surface-1 p-2 text-sm">
                          <option value="baixa">Baixa</option><option value="media">Média</option><option value="alta">Alta</option><option value="urgente">Urgente</option>
                        </select>
                      </label>
                      <label className="text-xs font-bold text-text-secondary uppercase">Vencimento
                        <input aria-label="Vencimento" type="datetime-local" value={taskDueDate} onChange={(event) => setTaskDueDate(event.target.value)} className="mt-1 w-full rounded-xl border border-border-strong bg-bg-surface-1 p-2 text-sm" />
                      </label>
                    </div>
                    <Button variant="primary" size="sm" className="gap-2" onClick={handleCreateTask}><Plus size={16} /> Criar tarefa</Button>
                  </div>
                )}
                {tasks.length === 0 ? (
                  <div className="p-12 text-center"><CheckCircle2 size={48} className="mx-auto text-text-secondary mb-4" /><h4 className="font-bold text-text-primary">Nenhuma tarefa pendente</h4><p className="text-sm text-text-secondary mt-2">Tudo em dia com este lead.</p></div>
                ) : (
                  <div className="space-y-3">{tasks.map((task) => (<div key={task.id} className="rounded-xl border border-border-soft bg-bg-surface-1 p-4 flex items-start justify-between gap-4"><div><p className="font-bold text-text-primary">{task.title}</p><p className="text-xs text-text-secondary">Status: {task.status} · Prioridade: {task.priority} · Vence em {formatDate(task.dueDate)}</p></div>{canCompleteTask && task.status !== 'concluido' && <Button variant="outline" size="sm" onClick={() => completeTask(task.id)}>Concluir tarefa</Button>}</div>))}</div>
                )}
              </div>
            )}

            {activeTab === 'events' && (
              <div className="p-6 space-y-6">
                <div className="space-y-2">
                  <h4 className="font-bold text-text-primary">Resumo de tracking do lead</h4>
                  <p className="text-sm text-text-secondary">Origem comercial, campanha, conjunto, anúncio, página e eventos capturados para este lead.</p>
                </div>
                {trackingDetails.length > 0 ? (
                  <div className="rounded-2xl border border-border-soft bg-bg-surface-1 p-5">
                    <h5 className="font-bold text-text-primary">Atribuição e origem</h5>
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      {trackingDetails.map((item) => (
                        <div key={item.label} className="rounded-xl bg-bg-surface-2/50 p-4">
                          <span className="text-xs font-bold uppercase tracking-wide text-text-secondary">{item.label}</span>
                          <p className="mt-1 break-words font-semibold text-text-primary">{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border-strong bg-bg-surface-2/50 p-5 text-sm text-text-secondary">Este lead ainda não tem origem, campanha, conjunto, anúncio ou página registrados.</div>
                )}
                <div className="rounded-2xl border border-border-soft bg-bg-surface-1 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h5 className="font-bold text-text-primary">Eventos enviados</h5>
                    <Badge variant="default">{trackingEvents.length} evento(s)</Badge>
                  </div>
                  {trackingEvents.length === 0 ? (
                    <div className="mt-4 rounded-xl border border-dashed border-border-strong bg-bg-surface-2/50 p-4 text-sm text-text-secondary">Nenhum evento de tracking encontrado para este lead.</div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {trackingEvents.map((event) => (
                        <article key={event.id} className="rounded-xl border border-border-soft bg-bg-surface-2/50 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-bold text-text-primary">{event.eventName}</p>
                              <p className="text-xs text-text-secondary">{event.platform} | {event.status} | tentativas: {event.attempts}</p>
                            </div>
                            <span className="rounded-full bg-bg-surface-1 px-3 py-1 text-xs font-semibold text-text-secondary">{event.sentAt ? formatDate(event.sentAt) : event.nextRetryAt ? `Fila: ${formatDate(event.nextRetryAt)}` : 'Sem envio'}</span>
                          </div>
                          {event.errorMessage && <p className="mt-3 rounded-lg bg-red-50 p-2 text-xs font-semibold text-red-700">{event.errorMessage}</p>}
                        </article>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-xs text-text-secondary">IDs técnicos e sinais de clique aparecem quando foram capturados no lead, metadata ou payload dos eventos.</p>
              </div>
            )}

            {activeTab === 'history' && (
              <div className="p-6 space-y-4" role="region" aria-label="Histórico do lead">
                <div>
                  <h4 className="font-bold text-text-primary">Histórico do lead</h4>
                  <p className="text-sm text-text-secondary">Auditoria de alterações registradas para este lead.</p>
                </div>
                {history.length === 0 ? (
                  <div className="p-12 text-center">
                    <History size={48} className="mx-auto text-text-secondary mb-4" />
                    <h4 className="font-bold text-text-primary">Nenhum histórico registrado</h4>
                    <p className="text-sm text-text-secondary mt-2">As alterações deste lead aparecerão aqui quando forem registradas.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {history.map((entry) => (
                      <article key={entry.id} className="rounded-2xl border border-border-soft bg-bg-surface-1 p-4 shadow-sm">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wide text-orange-400">{entry.action}</p>
                            <h5 className="mt-1 font-bold text-text-primary">{entry.summary}</h5>
                            <p className="mt-1 text-xs text-text-secondary">{entry.actor.name} · {entry.actor.email}</p>
                          </div>
                          <span className="rounded-full bg-bg-surface-2/50 px-3 py-1 text-xs font-semibold text-text-secondary">{formatDate(entry.occurredAt)}</span>
                        </div>
                        {entry.changes.length > 0 ? (
                          <div className="mt-4 space-y-2">
                            {entry.changes.map((change) => (
                              <div key={`${entry.id}-${change.field}`} className="rounded-xl bg-bg-surface-2/50 p-3 text-sm">
                                <p className="text-xs font-bold uppercase tracking-wide text-text-secondary">{change.label}</p>
                                <p className="mt-1 text-text-primary"><span className="font-semibold text-text-primary">{historyValue(change.before)}</span>{' '}{String.fromCharCode(8594)}{' '}<span className="font-semibold text-text-primary">{historyValue(change.after)}</span></p>
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

            {activeTab === 'documents' && (
              <div className="p-6 space-y-6">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h4 className="font-bold text-text-primary">Documentos do lead</h4>
                    <p className="text-sm text-text-secondary">Arquivos, imagens e comprovantes vinculados somente a este lead.</p>
                  </div>
                  <Badge variant="default">{documents.length} arquivo(s)</Badge>
                </div>

                {documentMessage && <div className="rounded-2xl border border-green-100 bg-green-50 p-3 text-sm font-semibold text-green-700">{documentMessage}</div>}
                {documentError && <div className="rounded-2xl border border-red-100 bg-red-50 p-3 text-sm font-semibold text-red-700">{documentError}</div>}

                <label className={`block rounded-2xl border border-dashed p-6 text-center transition ${canEditLead ? 'cursor-pointer border-orange-500/40 bg-orange-500/5 hover:bg-orange-500/10' : 'border-border-strong bg-bg-surface-2/50 opacity-70'}`}>
                  <Upload size={28} className="mx-auto mb-3 text-orange-400" />
                  <span className="block text-sm font-bold text-text-primary">{documentsUploading ? 'Enviando arquivos...' : 'Enviar documentos'}</span>
                  <span className="mt-1 block text-xs text-text-secondary">PDF, imagens, planilhas, textos, videos e arquivos ate 20 MB.</span>
                  <input
                    type="file"
                    multiple
                    disabled={!canEditLead || documentsUploading}
                    className="sr-only"
                    onChange={(event) => {
                      if (event.target.files) void handleDocumentFiles(event.target.files);
                      event.currentTarget.value = '';
                    }}
                  />
                </label>

                {documents.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border-strong bg-bg-surface-2/50 p-10 text-center">
                    <FileText size={42} className="mx-auto mb-3 text-text-secondary" />
                    <h5 className="font-bold text-text-primary">Nenhum documento anexado</h5>
                    <p className="mt-1 text-sm text-text-secondary">Os arquivos enviados para este lead aparecem aqui.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {documents.map((document) => (
                      <article key={document.id} className="rounded-2xl border border-border-soft bg-bg-surface-1 p-4 shadow-sm">
                        <div className="flex items-start gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-bg-surface-2/50 text-orange-400">
                            <FileText size={20} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h5 className="truncate font-bold text-text-primary" title={document.fileName}>{document.fileName}</h5>
                            <p className="mt-1 text-xs text-text-secondary">{document.mimeType || 'application/octet-stream'} | {fileSizeLabel(document.fileSize ?? 0)} | {formatDate(document.createdAt)}</p>
                          </div>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button variant="outline" size="sm" className="gap-2" onClick={() => setPreviewDocument(document)}><Eye size={15} /> Preview</Button>
                          <a href={document.downloadUrl || document.fileUrl || '#'} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-border-strong px-3 py-2 text-sm font-semibold text-text-primary hover:bg-bg-surface-2/50"><Download size={15} /> Baixar</a>
                          {canEditLead && <Button variant="ghost" size="sm" className="gap-2 text-red-600" onClick={() => void handleDeleteDocument(document)}><Trash2 size={15} /> Excluir</Button>}
                        </div>
                      </article>
                    ))}
                  </div>
                )}

                {previewDocument && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
                    <div className="flex max-h-[90vh] w-full max-w-5xl flex-col rounded-2xl bg-bg-surface-1 shadow-2xl">
                      <div className="flex items-start justify-between gap-4 border-b border-border-soft p-4">
                        <div className="min-w-0">
                          <h5 className="truncate font-bold text-text-primary">{previewDocument.fileName}</h5>
                          <p className="text-xs text-text-secondary">{previewDocument.mimeType || 'application/octet-stream'} | {fileSizeLabel(previewDocument.fileSize ?? 0)}</p>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <a href={previewDocument.downloadUrl || previewDocument.fileUrl || '#'} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-xl border border-border-strong px-3 text-sm font-semibold text-text-primary hover:bg-bg-surface-2/50"><Download size={15} /> Baixar</a>
                          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setPreviewDocument(null)}><X size={16} /></Button>
                        </div>
                      </div>
                      <div className="min-h-[360px] overflow-auto bg-bg-surface-2/50 p-4">
                        {documentPreviewType(previewDocument) === 'image' && <img src={previewDocument.previewUrl || previewDocument.fileUrl || ''} alt={previewDocument.fileName} className="mx-auto max-h-[72vh] max-w-full rounded-xl bg-bg-surface-1 object-contain" />}
                        {documentPreviewType(previewDocument) === 'pdf' && <iframe src={previewDocument.previewUrl || previewDocument.fileUrl || ''} title={previewDocument.fileName} className="h-[72vh] w-full rounded-xl border border-border-strong bg-bg-surface-1" />}
                        {documentPreviewType(previewDocument) === 'video' && <video src={previewDocument.previewUrl || previewDocument.fileUrl || ''} controls className="mx-auto max-h-[72vh] max-w-full rounded-xl bg-black" />}
                        {documentPreviewType(previewDocument) === 'text' && <iframe src={previewDocument.previewUrl || previewDocument.fileUrl || ''} title={previewDocument.fileName} className="h-[72vh] w-full rounded-xl border border-border-strong bg-bg-surface-1" />}
                        {documentPreviewType(previewDocument) === 'download' && (
                          <div className="flex min-h-[360px] flex-col items-center justify-center rounded-xl border border-dashed border-border-strong bg-bg-surface-1 p-8 text-center">
                            <FileText size={48} className="mb-4 text-text-secondary" />
                            <h5 className="font-bold text-text-primary">Preview indisponível para este tipo de arquivo</h5>
                            <p className="mt-2 max-w-md text-sm text-text-secondary">Use o botao de download para abrir o arquivo no aplicativo adequado.</p>
                            <a href={previewDocument.downloadUrl || previewDocument.fileUrl || '#'} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white"><ExternalLink size={16} /> Abrir / baixar</a>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'proposals' && (
              <div className="p-6 space-y-6">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h4 className="font-bold text-text-primary">Propostas vinculadas ao lead</h4>
                    <p className="text-sm text-text-secondary">Crie do zero pelo editor, salve como modelo reutilizável ou importe PDF/arquivo externo.</p>
                  </div>
                  <Badge variant="solar">{sortedProposals.length} proposta(s)</Badge>
                </div>

                {proposalMessage && <div className="rounded-2xl border border-orange-500/20 bg-orange-500/5 p-3 text-sm font-semibold text-orange-400">{proposalMessage}</div>}
                {solarMessage && <div className="rounded-2xl border border-energy-green/20 bg-mint-500/5 p-3 text-sm font-semibold text-mint-400">{solarMessage}</div>}

                <div className="rounded-2xl border border-orange-500/20 bg-bg-surface-1 p-5 shadow-sm">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Zap size={18} className="text-orange-400" />
                        <h5 className="font-black text-text-primary">Dimensionamento solar</h5>
                      </div>
                      <p className="mt-1 text-sm text-text-secondary">Pré-cálculo manual com cidade, consumo, perda, sobra e placa padrão.</p>
                    </div>
                    <Badge variant="solar">{solarDimensionamento ? 'Calculado' : 'Pré-proposta'}</Badge>
                  </div>

                  <div className="mt-5 space-y-5">
                    <section className="rounded-2xl border border-border-soft bg-bg-surface-2/50/70 p-4">
                      <label className="block text-xs font-bold uppercase text-text-secondary">Cidade de irradiação</label>
                      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_120px]">
                        <input aria-label="Buscar cidade de irradiação" value={solarCidadeQuery} onChange={(event) => { setSolarCidadeQuery(event.target.value); setSolarCidade(null); }} className="h-11 min-w-0 rounded-xl border border-border-strong bg-bg-surface-1 px-3 text-sm outline-none focus:border-orange-500/50 focus:ring-2 focus:ring-solar-orange/20" placeholder="Ex.: Franca/SP" />
                        <Button type="button" size="sm" variant="outline" className="h-11 justify-center" onClick={handleSearchSolarCity} disabled={solarLoadingRefs}>Buscar</Button>
                      </div>
                      {solarCities.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {solarCities.slice(0, 8).map((city) => (
                            <button key={city.id} type="button" onClick={() => { setSolarCidade(city); setSolarCidadeQuery(`${city.cidade}/${city.uf}`); }} className={`max-w-full rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${solarCidade?.id === city.id ? 'border-orange-500 bg-orange-500/10 text-orange-400' : 'border-border-strong bg-bg-surface-1 text-text-primary hover:border-orange-500/40'}`}>
                              <span className="inline-block max-w-[260px] truncate align-bottom">{city.cidade}/{city.uf}</span> · {solarNumberText(city.irradiacao_kwh_m2_dia)}
                            </button>
                          ))}
                        </div>
                      )}
                    </section>

                    <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr]">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <label className="block text-xs font-bold uppercase text-text-secondary">Consumo kWh/mês
                          <input aria-label="Consumo médio mensal para dimensionamento" value={solarConsumo} onChange={(event) => setSolarConsumo(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-border-strong bg-bg-surface-1 px-3 text-sm normal-case outline-none focus:border-orange-500/50 focus:ring-2 focus:ring-solar-orange/20" placeholder="Ex.: 1800" />
                        </label>
                        <label className="block text-xs font-bold uppercase text-text-secondary">Tipo de telhado
                          <select aria-label="Tipo de telhado" value={solarTelhado} onChange={(event) => setSolarTelhado(event.target.value)} className="mt-1 h-11 w-full min-w-0 rounded-xl border border-border-strong bg-bg-surface-1 px-3 text-sm normal-case outline-none focus:border-orange-500/50 focus:ring-2 focus:ring-solar-orange/20">
                            {solarTelhados.map((telhado) => <option key={telhado.id} value={telhado.nome}>{telhado.nome}</option>)}
                          </select>
                        </label>
                      </div>
                      <label className="block text-xs font-bold uppercase text-text-secondary">Placa padrão
                        <select aria-label="Modelo de placa" value={solarPlacaId} onChange={(event) => setSolarPlacaId(event.target.value)} className="mt-1 h-11 w-full min-w-0 rounded-xl border border-border-strong bg-bg-surface-1 px-3 text-sm normal-case outline-none focus:border-orange-500/50 focus:ring-2 focus:ring-solar-orange/20">
                          {solarPlacas.map((placa) => <option key={placa.id} value={placa.id}>{placa.nome} · {placa.potencia_wp}Wp</option>)}
                        </select>
                      </label>
                    </section>

                    <section className="grid grid-cols-1 gap-3 md:grid-cols-[repeat(3,minmax(0,1fr))_150px]">
                      <label className="block text-xs font-bold uppercase text-text-secondary">Perda %
                        <input aria-label="Perda percentual do sistema" value={solarPerda} onChange={(event) => setSolarPerda(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-border-strong bg-bg-surface-1 px-3 text-sm normal-case outline-none focus:border-orange-500/50 focus:ring-2 focus:ring-solar-orange/20" />
                      </label>
                      <label className="block text-xs font-bold uppercase text-text-secondary">Sobra %
                        <input aria-label="Sobra percentual de energia" value={solarSobra} onChange={(event) => setSolarSobra(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-border-strong bg-bg-surface-1 px-3 text-sm normal-case outline-none focus:border-orange-500/50 focus:ring-2 focus:ring-solar-orange/20" />
                      </label>
                      <label className="block text-xs font-bold uppercase text-text-secondary">Distância km
                        <input aria-label="Distância em quilômetros" value={solarDistancia} onChange={(event) => setSolarDistancia(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-border-strong bg-bg-surface-1 px-3 text-sm normal-case outline-none focus:border-orange-500/50 focus:ring-2 focus:ring-solar-orange/20" />
                      </label>
                      <div className="flex items-end">
                        <Button type="button" size="sm" className="h-11 w-full justify-center gap-2" onClick={handleCalcularSolar} disabled={solarCalculating || solarLoadingRefs || solarPlacas.length === 0}>
                          <Zap size={15} /> {solarCalculating ? 'Calculando...' : 'Calcular'}
                        </Button>
                      </div>
                    </section>

                    {solarDimensionamento && (
                      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                        <div className="min-h-20 rounded-xl bg-bg-surface-2/50 p-3"><p className="text-xs font-bold uppercase text-text-secondary">Módulos</p><p className="mt-1 text-lg font-black text-text-primary">{solarDimensionamento.quantidade_sugerida ?? '-'}</p></div>
                        <div className="min-h-20 rounded-xl bg-bg-surface-2/50 p-3"><p className="text-xs font-bold uppercase text-text-secondary">Potência</p><p className="mt-1 text-lg font-black text-text-primary">{solarNumberText(solarDimensionamento.potencia_total_sugerida_kwp)} kWp</p></div>
                        <div className="min-h-20 rounded-xl bg-bg-surface-2/50 p-3"><p className="text-xs font-bold uppercase text-text-secondary">Inversor</p><p className="mt-1 truncate text-sm font-black text-text-primary">{solarDimensionamento.modelo_inversor_nome ?? 'A validar'}</p></div>
                        <div className="min-h-20 rounded-xl bg-bg-surface-2/50 p-3"><p className="text-xs font-bold uppercase text-text-secondary">Irradiação</p><p className="mt-1 text-lg font-black text-text-primary">{solarNumberText(solarDimensionamento.irradiacao_kwh_m2_dia)}</p></div>
                        <div className="min-h-20 rounded-xl bg-bg-surface-2/50 p-3"><p className="text-xs font-bold uppercase text-text-secondary">Custo base</p><p className="mt-1 text-lg font-black text-energy-success">{formatCurrency(solarCustos?.total_geral ?? solarCustos?.total_final ?? 0)}</p></div>
                      </section>
                    )}
                  </div>
                </div>

                {showTemplateSelector && (
                  <div className="rounded-2xl border border-orange-500/30 bg-bg-surface-1 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h5 className="font-bold text-text-primary">Selecionar Modelo</h5>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowTemplateSelector(false)}><X size={16} /></Button>
                    </div>
                    {templates.length === 0 ? (
                      <p className="text-sm text-text-secondary">Nenhum modelo encontrado. Crie uma proposta com "Salvar como modelo" marcado.</p>
                    ) : (
                      <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {templates.map((template) => (
                          <button key={template.id} type="button" onClick={() => handleSelectTemplate(template)} className="w-full text-left rounded-xl border border-border-soft bg-bg-surface-2/50 p-3 hover:border-orange-500/40 hover:bg-orange-500/5 transition-colors">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-bold text-text-primary text-sm">{template.templateName || template.title}</p>
                                <p className="text-xs text-text-secondary mt-1">{template.sourceType === 'file' ? `Arquivo: ${template.importedFileName ?? 'importado'}` : 'Editor'}{template.discountPercentage ? ` · ${template.discountPercentage}% desconto` : ''}</p>
                              </div>
                              <Badge variant="info">Modelo</Badge>
                            </div>
                            {template.contentText && <p className="mt-2 text-xs text-text-secondary line-clamp-2">{template.contentText}</p>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="rounded-2xl border border-border-soft bg-bg-surface-2/50 p-4 space-y-4">
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
                    <label className="text-xs font-bold text-text-secondary uppercase">Título da proposta
                      <input aria-label="Título da proposta" value={proposalDraft.title} onChange={(event) => setProposalDraft((current) => ({ ...current, title: event.target.value }))} className="mt-1 w-full rounded-xl border border-border-strong bg-bg-surface-1 p-2 text-sm normal-case" placeholder="Ex.: Proposta Enervita - Mercado Solar" />
                    </label>
                    <label className="text-xs font-bold text-text-secondary uppercase">Modelo editável
                      <input aria-label="Nome do modelo" value={proposalDraft.templateName} onChange={(event) => setProposalDraft((current) => ({ ...current, templateName: event.target.value }))} className="mt-1 w-full rounded-xl border border-border-strong bg-bg-surface-1 p-2 text-sm normal-case" placeholder="Opcional: Modelo B2B conta alta" />
                    </label>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <label className="text-xs font-bold text-text-secondary uppercase">Conta R$<input aria-label="Valor mensal da conta" value={proposalDraft.monthlyBillValue} onChange={(event) => setProposalDraft((current) => ({ ...current, monthlyBillValue: event.target.value }))} className="mt-1 w-full rounded-xl border border-border-strong bg-bg-surface-1 p-2 text-sm normal-case" /></label>
                    <label className="text-xs font-bold text-text-secondary uppercase">kWh<input aria-label="Consumo estimado" value={proposalDraft.estimatedKwh} onChange={(event) => setProposalDraft((current) => ({ ...current, estimatedKwh: event.target.value }))} className="mt-1 w-full rounded-xl border border-border-strong bg-bg-surface-1 p-2 text-sm normal-case" /></label>
                    <label className="text-xs font-bold text-text-secondary uppercase">Desconto %<input aria-label="Percentual de desconto" value={proposalDraft.discountPercentage} onChange={(event) => setProposalDraft((current) => ({ ...current, discountPercentage: event.target.value }))} className="mt-1 w-full rounded-xl border border-border-strong bg-bg-surface-1 p-2 text-sm normal-case" /></label>
                    <label className="text-xs font-bold text-text-secondary uppercase">Economia/mês<input aria-label="Economia mensal projetada" value={proposalDraft.projectedMonthlySavings} onChange={(event) => setProposalDraft((current) => ({ ...current, projectedMonthlySavings: event.target.value }))} className="mt-1 w-full rounded-xl border border-border-strong bg-bg-surface-1 p-2 text-sm normal-case" placeholder="auto" /></label>
                    <label className="text-xs font-bold text-text-secondary uppercase">Validade<input aria-label="Validade da proposta" type="date" value={proposalDraft.validUntil} onChange={(event) => setProposalDraft((current) => ({ ...current, validUntil: event.target.value }))} className="mt-1 w-full rounded-xl border border-border-strong bg-bg-surface-1 p-2 text-sm normal-case" /></label>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant={proposalDraft.sourceType === 'editor' ? 'primary' : 'outline'} onClick={() => setProposalDraft((current) => ({ ...current, sourceType: 'editor', importedFile: undefined, removeImportedFile: false }))}><Copy size={14} className="mr-2" /> Criar no editor</Button>
                    <label className="inline-flex cursor-pointer items-center rounded-xl border border-border-strong bg-bg-surface-1 px-3 py-2 text-sm font-bold text-text-primary hover:border-orange-500/40">
                      <Upload size={14} className="mr-2 text-orange-400" /> Importar arquivo
                      <input type="file" className="hidden" onChange={(event) => void handleProposalFile(event.target.files?.[0])} disabled={isProposalBusy} />
                    </label>
                    <label className="inline-flex items-center gap-2 rounded-xl bg-bg-surface-1 px-3 py-2 text-sm font-bold text-text-primary"><input type="checkbox" checked={proposalDraft.isTemplate} onChange={(event) => setProposalDraft((current) => ({ ...current, isTemplate: event.target.checked }))} /> Salvar como modelo</label>
                  </div>
                  {proposalDraft.importedFile && (
                    <div className="rounded-2xl border border-border-strong bg-bg-surface-1 p-3 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-text-secondary">
                        <span>{proposalDraft.importedFile.name}</span>
                        <span>{fileSizeLabel(proposalDraft.importedFile.size)}</span>
                      </div>
                      {renderProposalFilePreview(proposalDraft.importedFile)}
                    </div>
                  )}

                  {proposalDraft.sourceType === 'editor' ? (
                    <textarea aria-label="Conteúdo editável da proposta" value={proposalDraft.contentText} onChange={(event) => setProposalDraft((current) => ({ ...current, contentText: event.target.value }))} className="min-h-[190px] w-full rounded-2xl border border-border-strong bg-bg-surface-1 p-4 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-solar-orange/30" placeholder="Escreva a proposta: diagnóstico, economia estimada, condições comerciais, validade e próximos passos..." />
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border-strong bg-bg-surface-1 p-6 text-center text-sm text-text-secondary">{proposalDraft.importedFile ? 'Arquivo pronto para salvar junto ao lead.' : 'Selecione um arquivo para importar a proposta existente.'}</div>
                  )}

                  <textarea aria-label="Observações da proposta" value={proposalDraft.notes} onChange={(event) => setProposalDraft((current) => ({ ...current, notes: event.target.value }))} className="w-full rounded-xl border border-border-strong bg-bg-surface-1 p-2 text-sm" placeholder="Observações internas opcionais..." />
                  {editingProposalId ? (
                    <Button variant="primary" size="sm" className="gap-2" onClick={handleUpdateProposal} disabled={isProposalBusy}><Save size={16} /> {isProposalBusy ? 'Enviando...' : 'Atualizar proposta'}</Button>
                  ) : (
                    <Button variant="primary" size="sm" className="gap-2" onClick={handleCreateProposal} disabled={isProposalBusy}><Save size={16} /> {isProposalBusy ? 'Enviando...' : 'Salvar proposta no lead'}</Button>
                  )}
                </div>

                {sortedProposals.length === 0 ? (
                  <div className="p-10 text-center text-text-secondary"><FileText className="mx-auto mb-3" />Nenhuma proposta salva para este lead.</div>
                ) : (
                  <div className="space-y-3">
                    {sortedProposals.map((proposal) => (
                      <article key={proposal.id} className="rounded-2xl border border-border-soft bg-bg-surface-1 p-4 shadow-sm">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2"><h5 className="font-bold text-text-primary">{proposal.title}</h5><Badge variant={proposalStatusVariants[proposal.status]}>{proposalStatusLabels[proposal.status]}</Badge>{proposal.isTemplate && <Badge variant="info">Modelo</Badge>}</div>
                            <p className="mt-1 text-xs text-text-secondary">Criada em {formatDate(proposal.createdAt)} · {proposal.sourceType === 'file' ? `Arquivo: ${proposal.importedFileName ?? 'importado'}` : `Editor${proposal.templateName ? ` · ${proposal.templateName}` : ''}`}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-right text-sm"><p className="font-black text-energy-success">{formatCurrency(proposal.projectedAnnualSavings)}/ano</p><p className="text-xs text-text-secondary">{proposal.discountPercentage}% desconto</p></div>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Editar proposta" onClick={() => handleEditProposal(proposal)}><Edit3 size={14} /></Button>
                              {proposal.status !== 'accepted' && <Button size="sm" onClick={() => handleAcceptProposal(proposal.id)}>Marcar aceita</Button>}
                              {isAdminUser(user) && <Button variant="ghost" size="sm" className="h-8 hover:bg-red-500/10" aria-label="Excluir" onClick={() => void handleDeleteProposal(proposal.id)}>Excluir</Button>}
                            </div>
                          </div>
                        </div>
                        {proposal.solarSummary && (
                          <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-energy-green/10 bg-mint-500/5 p-3 text-xs text-text-primary md:grid-cols-4">
                            <div><span className="block font-bold uppercase text-text-secondary">Módulos</span>{proposal.solarSummary.quantidadeSugerida ?? '-'}</div>
                            <div><span className="block font-bold uppercase text-text-secondary">Potência</span>{solarNumberText(proposal.solarSummary.potenciaTotalKwp)} kWp</div>
                            <div><span className="block font-bold uppercase text-text-secondary">Inversor</span>{proposal.solarSummary.inversorSugeridoNome ?? '-'}</div>
                            <div><span className="block font-bold uppercase text-text-secondary">Cidade</span>{proposal.solarSummary.cidade}/{proposal.solarSummary.uf}</div>
                          </div>
                        )}
                        {proposal.contentText && <p className="mt-3 line-clamp-3 whitespace-pre-wrap rounded-xl bg-bg-surface-2/50 p-3 text-sm text-text-primary">{proposal.contentText}</p>}
                        {getProposalAttachment(proposal) && (
                          <div className="mt-3 space-y-2">
                            <p className="text-xs font-bold text-text-secondary">Arquivo: {proposal.importedFileName}</p>
                            {renderProposalFilePreview(getProposalAttachment(proposal)!)}
                            <div className="flex flex-wrap items-center gap-2">
                              <a className="inline-flex items-center gap-2 text-sm font-bold text-orange-400 hover:underline" download={proposal.importedFileName} href={proposalFileDataUrl(getProposalAttachment(proposal)!) ?? ''}>
                                <Download size={14} /> Baixar arquivo
                              </a>
                              <Button variant="ghost" size="sm" onClick={() => void handleDeleteProposalFile(proposal.id)}>Excluir</Button>
                            </div>
                          </div>
                        )}
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
          <div className="w-full max-w-md rounded-3xl bg-bg-surface-1 p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 id="whatsapp-confirm-title" className="text-lg font-black text-text-primary">Confirmar abertura do WhatsApp</h3>
                <p className="mt-1 text-sm text-text-secondary">Vou registrar esta ação na timeline do lead e abrir o WhatsApp em uma nova aba.</p>
              </div>
              <button type="button" className="rounded-full p-1 text-text-secondary hover:bg-bg-surface-2/50 hover:text-text-primary" onClick={() => setWhatsappConfirmOpen(false)} aria-label="Fechar confirmação"><X size={18} /></button>
            </div>
            {whatsappStatus && <p className="mb-3 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-700">{whatsappStatus}</p>}
            <label className="mb-5 flex items-center gap-3 rounded-2xl bg-bg-surface-2/50 p-3 text-sm font-semibold text-text-primary">
              <input type="checkbox" checked={whatsappDoNotAskAgain} onChange={(event) => setWhatsappDoNotAskAgain(event.target.checked)} className="h-4 w-4 rounded border-border-strong text-orange-400 focus:ring-solar-orange" />
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

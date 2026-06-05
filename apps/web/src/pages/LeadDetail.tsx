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
  History
} from 'lucide-react';
import { formatCurrency, formatDate } from '../lib/utils';
import { useMemo, useState } from 'react';
import { useAuth } from '../auth/useAuth';
import { userHasPermission } from '../auth/permissions';

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

export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { lead, activities, tasks, history, loading, addActivity, addTask, completeTask, updateLead, deleteLead, setTags } = useLeadDetail(id);
  const { user } = useAuth();
  const canCreateActivity = userHasPermission(user, 'activity.create');
  const canCreateTask = userHasPermission(user, 'task.create');
  const canCompleteTask = userHasPermission(user, 'task.complete');
  const canEditLead = userHasPermission(user, 'lead.edit');
  const [activeTab, setActiveTab] = useState('timeline');
  const [activityNote, setActivityNote] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskPriority, setTaskPriority] = useState<'baixa' | 'media' | 'alta' | 'urgente'>('media');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [tagDraft, setTagDraft] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [savingLead, setSavingLead] = useState(false);
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
  const cadastro = useMemo(() => lead ? cadastroItems(lead) : [], [lead]);

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

  async function handleCreateTask() {
    const title = taskTitle.trim();
    if (!title) return;
    await addTask({ title, priority: taskPriority, dueDate: taskDueDate || undefined });
    setTaskTitle('');
    setTaskPriority('media');
    setTaskDueDate('');
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
              {whatsappHref ? <a href={whatsappHref} target="_blank" rel="noreferrer" className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-graphite hover:bg-gray-50"><MessageSquare size={16} /> WhatsApp</a> : <Button variant="outline" className="gap-2 w-full opacity-50" disabled><MessageSquare size={16} /> Sem WhatsApp</Button>}
            </div>
          </Card>

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
              <div className="p-6 space-y-4">
                <h4 className="font-bold text-graphite">Resumo de tracking do lead</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-gray-50 p-4"><span className="text-gray-400">Origem</span><p className="font-bold text-graphite">{lead.leadSource || 'Não informada'}</p></div>
                  <div className="rounded-xl bg-gray-50 p-4"><span className="text-gray-400">Origem / mídia da campanha</span><p className="font-bold text-graphite">{lead.utmSource || 'sem origem'} / {lead.utmMedium || 'sem medium'}</p></div>
                  <div className="rounded-xl bg-gray-50 p-4 md:col-span-2"><span className="text-gray-400">Campanha</span><p className="font-bold text-graphite">{lead.utmCampaign || 'Sem campanha registrada'}</p></div>
                </div>
                <p className="text-xs text-gray-500">Eventos detalhados por lead ainda dependem da decisão de integrar a fila operacional de tracking ao painel.</p>
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
              <div className="p-12 text-center text-gray-400">
                Propostas reais ainda pendentes de decisão de origem: importar do banco operacional/Twenty ou criar módulo próprio no CRM custom.
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

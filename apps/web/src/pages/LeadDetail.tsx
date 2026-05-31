import { useParams, Link } from 'react-router-dom';
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
  MoreVertical,
  Plus
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
  const { lead, activities, tasks, loading, addActivity, addTask, completeTask, setTags } = useLeadDetail(id);
  const { user } = useAuth();
  const canCreateActivity = userHasPermission(user, 'activity.create');
  const canCreateTask = userHasPermission(user, 'task.create');
  const canCompleteTask = userHasPermission(user, 'task.complete');
  const [activeTab, setActiveTab] = useState('timeline');
  const [activityNote, setActivityNote] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskPriority, setTaskPriority] = useState<'baixa' | 'media' | 'alta' | 'urgente'>('media');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [tagDraft, setTagDraft] = useState<string | null>(null);
  const cadastro = useMemo(() => lead ? cadastroItems(lead) : [], [lead]);

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
              <Button variant="ghost" size="icon" className="h-8 w-8 opacity-40" aria-label="Mais ações em breve" disabled title="Mais ações em breve"><MoreVertical size={16} /></Button>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-gray-100 rounded-lg"><Phone size={16} className="text-gray-500" /></div>
                <div>
                  <p className="text-xs text-gray-400">Telefone</p>
                  <p className="text-sm font-medium text-graphite">{lead.contact?.phone}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 bg-gray-100 rounded-lg"><Mail size={16} className="text-gray-500" /></div>
                <div>
                  <p className="text-xs text-gray-400">E-mail</p>
                  <p className="text-sm font-medium text-graphite">{lead.contact?.email}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 bg-gray-100 rounded-lg"><MapPin size={16} className="text-gray-500" /></div>
                <div>
                  <p className="text-xs text-gray-400">Empresa / Unidade</p>
                  <p className="text-sm font-medium text-graphite">{lead.contact?.company}</p>
                </div>
              </div>
            </div>

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
            <h3 className="font-bold text-graphite mb-6">Dados Técnicos</h3>
            <div className="space-y-4">
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
            </div>
          </Card>
        </div>

        {/* Right Column: Activities/Timeline */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex gap-2 p-1 bg-gray-100 rounded-xl w-fit">
            {[
              { id: 'timeline', label: 'Timeline', icon: Clock },
              { id: 'tasks', label: 'Tarefas', icon: CheckCircle2 },
              { id: 'events', label: 'Tracking', icon: Zap },
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
                  <div className="rounded-xl bg-gray-50 p-4"><span className="text-gray-400">UTM source/medium</span><p className="font-bold text-graphite">{lead.utmSource || 'sem utm'} / {lead.utmMedium || 'sem medium'}</p></div>
                  <div className="rounded-xl bg-gray-50 p-4 md:col-span-2"><span className="text-gray-400">Campanha</span><p className="font-bold text-graphite">{lead.utmCampaign || 'Sem campanha registrada'}</p></div>
                </div>
                <p className="text-xs text-gray-500">Eventos técnicos detalhados por lead ainda dependem da decisão de integrar a fila operacional de tracking ao preview.</p>
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

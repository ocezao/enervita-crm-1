import { useEffect, useMemo, useState } from 'react';
import type { DragEvent, MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, CalendarClock, Clock, ExternalLink, Filter, Flame, GripVertical, MessageCircle, Phone, Plus, RotateCcw, Search, TimerReset, Users, X } from 'lucide-react';
import { useLeads } from '../hooks/useCrm';
import { useAuth } from '../auth/useAuth';
import { isAdminUser, userHasPermission } from '../auth/permissions';
import { PageHeader } from '../components/ui/LayoutComponents';
import { Badge, Button, Card } from '../components/ui/Base';
import { PriorityBadge, StageBadge } from '../components/ui/StatusBadges';
import type { Lead, LeadStage, Priority } from '../lib/api/types';
import { cn, formatCurrency } from '../lib/utils';

const stages: Array<{ id: LeadStage; label: string; limit: number; helper: string }> = [
  { id: 'novo_lead', label: 'Novo lead', limit: 15, helper: 'Entrada e triagem rápida' },
  { id: 'qualificacao', label: 'Qualificação', limit: 10, helper: 'Confirmar perfil e interesse' },
  { id: 'atendimento_iniciado', label: 'Atendimento iniciado', limit: 8, helper: 'Primeiro contato em andamento' },
  { id: 'conta_recebida', label: 'Conta recebida', limit: 8, helper: 'Fatura recebida para análise' },
  { id: 'diagnostico', label: 'Diagnóstico', limit: 6, helper: 'Dimensionamento e recomendação' },
  { id: 'proposta_enviada', label: 'Proposta enviada', limit: 6, helper: 'Follow-up de fechamento' },
  { id: 'contrato_enervita', label: 'Contrato Enervita', limit: 99, helper: 'Ganho / implantação' },
  { id: 'perdido', label: 'Perdido', limit: 99, helper: 'Motivos e aprendizado' },
];

const priorities: Array<'todas' | Priority> = ['todas', 'urgente', 'alta', 'media', 'baixa'];
type AgingFilter = 'todos' | 'sem_proxima_acao' | 'parados_3d' | 'parados_7d';
type SortKey = 'oldest_stage' | 'updated_desc' | 'bill_desc' | 'priority_desc' | 'created_asc';
type KanbanContextState = { lead: Lead; nextStage?: { id: LeadStage; label: string }; lostStage?: { id: LeadStage; label: string }; x: number; y: number } | null;

function visibleStagesForUser(user: ReturnType<typeof useAuth>['user']) {
  if (isAdminUser(user)) return stages;
  const allowed = new Set(user?.allowedStages ?? []);
  return stages.filter((stage) => allowed.has(stage.id));
}

function daysSince(date?: string) {
  if (!date) return 0;
  const time = new Date(date).getTime();
  if (!Number.isFinite(time)) return 0;
  return Math.max(0, Math.floor((Date.now() - time) / 86400000));
}

function daysUntil(date?: string | null) {
  if (!date) return undefined;
  const time = new Date(date).getTime();
  if (!Number.isFinite(time)) return undefined;
  return Math.ceil((time - Date.now()) / 86400000);
}

function normalize(value?: string | number | null) {
  return String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function priorityWeight(priority: Priority) {
  return { urgente: 4, alta: 3, media: 2, baixa: 1 }[priority] ?? 0;
}

function nextActionLabel(lead: Lead) {
  const diff = daysUntil(lead.nextActionAt);
  if (diff === undefined) return 'Sem próxima ação';
  if (diff < 0) return `Atrasada há ${Math.abs(diff)}d`;
  if (diff === 0) return 'Vence hoje';
  if (diff === 1) return 'Amanhã';
  return `Em ${diff} dias`;
}

function matchesAging(lead: Lead, filter: AgingFilter) {
  const stalled = daysSince(lead.updatedAt || lead.createdAt);
  if (filter === 'sem_proxima_acao') return !lead.nextActionAt;
  if (filter === 'parados_3d') return stalled >= 3;
  if (filter === 'parados_7d') return stalled >= 7;
  return true;
}

function sortLeads(leads: Lead[], sort: SortKey) {
  return [...leads].sort((a, b) => {
    if (sort === 'bill_desc') return (b.energyBillValue || b.estimatedTicket || 0) - (a.energyBillValue || a.estimatedTicket || 0);
    if (sort === 'priority_desc') return priorityWeight(b.priority) - priorityWeight(a.priority) || daysSince(b.updatedAt) - daysSince(a.updatedAt);
    if (sort === 'oldest_stage') return daysSince(b.updatedAt || b.createdAt) - daysSince(a.updatedAt || a.createdAt);
    if (sort === 'created_asc') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime();
  });
}

export default function Pipeline() {
  const { leads, updateStage } = useLeads();
  const { user } = useAuth();
  const visibleStages = visibleStagesForUser(user);
  const canMoveStage = userHasPermission(user, 'lead.stage_change');
  const canCreate = userHasPermission(user, 'lead.create');
  const [query, setQuery] = useState('');
  const [priority, setPriority] = useState<'todas' | Priority>('todas');
  const [source, setSource] = useState('todas');
  const [aging, setAging] = useState<AgingFilter>('todos');
  const [sort, setSort] = useState<SortKey>('oldest_stage');
  const [minBill, setMinBill] = useState('');
  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<KanbanContextState>(null);
  const stageIds = useMemo(() => new Set(visibleStages.map((stage) => stage.id)), [visibleStages]);
  const sources = useMemo(() => Array.from(new Set(leads.map((lead) => lead.leadSource || lead.contact?.source || 'desconhecido'))).sort(), [leads]);
  const visibleRawLeads = useMemo(() => leads.filter((lead) => stageIds.has(lead.stage)), [leads, stageIds]);

  const filteredLeads = useMemo(() => {
    const q = normalize(query.trim());
    const min = Number(minBill.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
    return sortLeads(visibleRawLeads.filter((lead) => {
      const searchable = [lead.contact?.name, lead.contact?.company, lead.contact?.email, lead.contact?.phone, lead.leadSource, lead.utmSource, lead.utmCampaign, lead.qualificationStatus].map(normalize).join(' ');
      const leadSource = lead.leadSource || lead.contact?.source || 'desconhecido';
      return (!q || searchable.includes(q)) &&
        (priority === 'todas' || lead.priority === priority) &&
        (source === 'todas' || leadSource === source) &&
        matchesAging(lead, aging) &&
        ((lead.energyBillValue || lead.estimatedTicket || 0) >= min);
    }), sort);
  }, [visibleRawLeads, query, priority, source, aging, minBill, sort]);

  const totalPipeline = filteredLeads.reduce((sum, lead) => sum + (lead.energyBillValue || lead.estimatedTicket || 0), 0);
  const staleCount = filteredLeads.filter((lead) => daysSince(lead.updatedAt || lead.createdAt) >= 3).length;
  const missingNextAction = filteredLeads.filter((lead) => !lead.nextActionAt).length;
  const urgentCount = filteredLeads.filter((lead) => lead.priority === 'urgente' || lead.priority === 'alta').length;

  function leadsInStage(stageId: LeadStage) {
    return filteredLeads.filter((lead) => lead.stage === stageId);
  }

  function nextVisibleStage(currentStage: LeadStage) {
    const index = visibleStages.findIndex((stage) => stage.id === currentStage);
    return index >= 0 ? visibleStages[index + 1] : undefined;
  }

  const lostStage = useMemo(() => visibleStages.find((stage) => stage.id === 'perdido'), [visibleStages]);

  function resetFilters() {
    setQuery(''); setPriority('todas'); setSource('todas'); setAging('todos'); setMinBill(''); setSort('oldest_stage');
  }

  function moveLead(lead: Lead, targetStage: LeadStage, notes: string) {
    if (!canMoveStage || lead.stage === targetStage) return;
    updateStage(lead.id, targetStage, { notes });
  }

  function handleDrop(event: DragEvent<HTMLDivElement>, targetStage: LeadStage) {
    event.preventDefault();
    const leadId = event.dataTransfer.getData('text/plain') || draggingLeadId;
    const lead = filteredLeads.find((item) => item.id === leadId);
    setDraggingLeadId(null);
    if (lead) moveLead(lead, targetStage, `Movido pelo kanban para ${stages.find((stage) => stage.id === targetStage)?.label ?? targetStage}`);
  }

  function openCardMenu(event: MouseEvent<HTMLDivElement>, lead: Lead, nextStage?: { id: LeadStage; label: string }) {
    event.preventDefault();
    event.stopPropagation();
    const menuWidth = 270;
    const menuHeight = 300;
    setContextMenu({
      lead,
      nextStage,
      lostStage: lead.stage !== 'perdido' ? lostStage : undefined,
      x: Math.min(event.clientX, window.innerWidth - menuWidth - 12),
      y: Math.min(event.clientY, window.innerHeight - menuHeight - 12),
    });
  }

  useEffect(() => {
    if (!contextMenu) return undefined;
    const close = () => setContextMenu(null);
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    window.addEventListener('click', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [contextMenu]);

  return (
    <div className="min-h-[calc(100vh-88px)] flex flex-col gap-4 pb-6">
      <PageHeader title="Pipeline de Vendas" description="Kanban comercial com drag-and-drop, filtros de operação e alertas de gargalo." actions={canCreate && (<Button variant="primary" size="sm" className="gap-2 opacity-60" disabled title="Criação manual de lead em revisão"><Plus size={16} /> Novo Lead</Button>)} />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card className="p-4 bg-solar-orange/5 border-solar-orange/10"><Users size={18} className="text-solar-orange" /><p className="mt-2 text-[10px] uppercase font-black text-solar-orange tracking-wider">Leads filtrados</p><strong className="text-2xl text-graphite">{filteredLeads.length}</strong></Card>
        <Card className="p-4 bg-energy-green/5 border-energy-green/10"><Flame size={18} className="text-energy-green" /><p className="mt-2 text-[10px] uppercase font-black text-energy-green tracking-wider">Pipeline estimado</p><strong className="text-2xl text-graphite">{formatCurrency(totalPipeline)}</strong></Card>
        <Card className="p-4 bg-alert-amber/5 border-alert-amber/10"><TimerReset size={18} className="text-alert-amber" /><p className="mt-2 text-[10px] uppercase font-black text-alert-amber tracking-wider">Parados 3d+</p><strong className="text-2xl text-graphite">{staleCount}</strong></Card>
        <Card className="p-4 bg-alert-red/5 border-alert-red/10"><CalendarClock size={18} className="text-alert-red" /><p className="mt-2 text-[10px] uppercase font-black text-alert-red tracking-wider">Sem próxima ação</p><strong className="text-2xl text-graphite">{missingNextAction}</strong></Card>
      </div>

      <Card className="p-4 overflow-visible">
        <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_1fr_1fr_1fr_1fr_auto] gap-3 items-center">
          <label className="relative block"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar lead, empresa, telefone, origem ou campanha..." className="w-full bg-white border border-gray-200 rounded-2xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-solar-orange/30" /></label>
          <select value={priority} onChange={(event) => setPriority(event.target.value as 'todas' | Priority)} className="bg-white border border-gray-200 rounded-2xl px-3 py-3 text-sm">{priorities.map((item) => <option key={item} value={item}>{item === 'todas' ? 'Todas prioridades' : item}</option>)}</select>
          <select value={source} onChange={(event) => setSource(event.target.value)} className="bg-white border border-gray-200 rounded-2xl px-3 py-3 text-sm"><option value="todas">Todas origens</option>{sources.map((item) => <option key={item} value={item}>{item}</option>)}</select>
          <select value={aging} onChange={(event) => setAging(event.target.value as AgingFilter)} className="bg-white border border-gray-200 rounded-2xl px-3 py-3 text-sm"><option value="todos">Todos tempos</option><option value="sem_proxima_acao">Sem próxima ação</option><option value="parados_3d">Parados há 3+ dias</option><option value="parados_7d">Parados há 7+ dias</option></select>
          <input value={minBill} onChange={(event) => setMinBill(event.target.value)} inputMode="numeric" placeholder="Conta mínima R$" className="bg-white border border-gray-200 rounded-2xl px-3 py-3 text-sm" />
          <Button variant="outline" size="sm" className="h-11 gap-2" onClick={resetFilters}><RotateCcw size={14} /> Limpar</Button>
        </div>
        <div className="mt-3 flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs text-gray-500"><span className="flex items-center gap-2"><Filter size={14} /> {filteredLeads.length} de {visibleRawLeads.length} leads visíveis · {urgentCount} alta/urgente</span><label className="font-bold">Ordenar <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)} className="border border-gray-200 rounded-xl px-2 py-1 bg-white font-medium"><option value="oldest_stage">Mais parados primeiro</option><option value="updated_desc">Atualizados recentemente</option><option value="bill_desc">Maior conta primeiro</option><option value="priority_desc">Prioridade comercial</option><option value="created_asc">Rotação (distribuição)</option></select></label></div>
      </Card>

      <div className="shrink-0 crm-scroll-panel overflow-x-auto pb-8 -mx-2 px-2" style={{ height: 'calc(150vh - 220px)', maxHeight: 'calc(150vh - 220px)', minHeight: 720 }}><div className="flex gap-5 h-full min-w-max">
        {visibleStages.map((stage) => {
          const columnLeads = leadsInStage(stage.id);
          const columnValue = columnLeads.reduce((sum, lead) => sum + (lead.energyBillValue || lead.estimatedTicket || 0), 0);
          const overLimit = columnLeads.length > stage.limit;
          return (
            <div key={stage.id} className="w-[23rem] 2xl:w-[25rem] h-full min-h-0 flex flex-col gap-3" data-testid={`pipeline-column-${stage.id}`}>
              <div className="px-1"><div className="flex items-start justify-between gap-2"><div><div className="flex items-center gap-2"><h3 className="font-black text-sm text-graphite uppercase tracking-wider">{stage.label}</h3><span className={cn('text-[10px] font-black px-1.5 py-0.5 rounded-full', overLimit ? 'bg-alert-red/10 text-alert-red' : 'bg-gray-200 text-gray-600')}>{columnLeads.length}</span></div><p className="text-[10px] text-gray-400 mt-1">{stage.helper}</p></div>{canCreate && <Button variant="ghost" size="icon" className="h-7 w-7 opacity-40" aria-label={`Criar lead em ${stage.label}`} disabled title="Criação manual de lead em revisão"><Plus size={14} /></Button>}</div><div className="mt-2 flex items-center justify-between text-[10px] text-gray-400"><span>{formatCurrency(columnValue)}</span><span>WIP {stage.limit >= 90 ? 'livre' : stage.limit}</span></div>{overLimit && <Badge variant="error" className="mt-2">Gargalo</Badge>}</div>
              <motion.div layout className={cn('flex-1 h-full min-h-0 rounded-[1.65rem] p-3 space-y-3 crm-scroll-panel overflow-y-auto overscroll-contain border-2 border-dashed transition-colors', draggingLeadId ? 'bg-solar-orange/5 border-solar-orange/30 shadow-inner' : 'bg-gray-100/60 border-gray-200/60')} onDragOver={(event) => canMoveStage && event.preventDefault()} onDrop={(event) => handleDrop(event, stage.id)}>
                <AnimatePresence initial={false}>
                  {columnLeads.map((lead) => <KanbanCard key={lead.id} lead={lead} nextStage={nextVisibleStage(lead.stage)} canMoveStage={canMoveStage} onMove={(target) => moveLead(lead, target, 'Movido pelo pipeline visual')} onDragStart={() => setDraggingLeadId(lead.id)} onDragEnd={() => setDraggingLeadId(null)} onContextMenu={(event) => openCardMenu(event, lead, nextVisibleStage(lead.stage))} />)}
                </AnimatePresence>
                {columnLeads.length === 0 && <div className="py-10 text-center border-2 border-dashed border-gray-200 rounded-xl bg-white/60"><p className="text-[10px] font-black text-gray-400 uppercase">{canMoveStage ? 'Solte cards aqui' : 'Sem leads nesta etapa'}</p></div>}
              </motion.div>
            </div>
          );
        })}
      </div></div>
      <KanbanCardContextMenu menu={contextMenu} canMoveStage={canMoveStage} onClose={() => setContextMenu(null)} onMove={(lead, target) => moveLead(lead, target, 'Movido pelo menu contextual do card')} />
    </div>
  );
}

function KanbanCard({ lead, nextStage, canMoveStage, onMove, onDragStart, onDragEnd, onContextMenu }: { lead: Lead; nextStage?: { id: LeadStage; label: string }; canMoveStage: boolean; onMove: (stage: LeadStage) => void; onDragStart: () => void; onDragEnd: () => void; onContextMenu: (event: MouseEvent<HTMLDivElement>) => void }) {
  const stalledDays = daysSince(lead.updatedAt || lead.createdAt);
  const phone = lead.contact?.phone?.replace(/\D/g, '');
  const whatsapp = phone ? `https://wa.me/${phone.startsWith('55') ? phone : `55${phone}`}` : undefined;
  return (
    <motion.div layout initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.98 }} whileHover={{ y: -4, scale: 1.012 }} whileTap={{ scale: 0.985 }} transition={{ type: 'spring', stiffness: 430, damping: 34 }} className="bg-white rounded-2xl border border-transparent shadow-sm overflow-hidden p-4 hover:shadow-xl hover:shadow-solar-orange/10 hover:border-solar-orange/30 transition-colors group cursor-grab active:cursor-grabbing select-none" draggable={canMoveStage} onDragStart={() => { onDragStart(); }} onDragEnd={onDragEnd} onContextMenu={onContextMenu}>
      <div className="flex justify-between items-start mb-3"><div className="flex items-center gap-2"><GripVertical size={14} className="text-gray-300" /><PriorityBadge priority={lead.priority} /></div><StageBadge stage={lead.stage} /></div>
      <Link to={`/leads/${lead.id}`} className="block"><h4 className="font-black text-sm text-graphite mb-1 group-hover:text-solar-orange transition-colors">{lead.contact?.name || 'Lead sem nome'}</h4><p className="text-xs text-gray-500 mb-3 truncate">{lead.contact?.company || lead.contact?.email || 'Sem empresa'}</p><div className="grid grid-cols-2 gap-2 mb-4"><div className={cn('rounded-xl p-2 text-[10px] font-bold', stalledDays >= 3 ? 'bg-alert-amber/10 text-alert-amber' : 'bg-gray-50 text-gray-500')}><Clock size={12} className="inline mr-1" />{stalledDays === 0 ? 'Atual hoje' : `Parado ${stalledDays}d`}</div><div className={cn('rounded-xl p-2 text-[10px] font-bold', !lead.nextActionAt || (daysUntil(lead.nextActionAt) ?? 1) <= 0 ? 'bg-alert-red/10 text-alert-red' : 'bg-energy-green/10 text-energy-green')}><Phone size={12} className="inline mr-1" />{nextActionLabel(lead)}</div></div><div className="pt-3 border-t border-gray-50 flex items-center justify-between gap-2"><div><p className="font-black text-sm text-energy-green">{formatCurrency(lead.energyBillValue || lead.estimatedTicket)}</p><p className="text-[10px] text-gray-400 truncate max-w-[150px]">{lead.leadSource || 'origem indefinida'}</p><p className="text-[10px] text-gray-400 mt-1">{new Date(lead.submittedAt || lead.createdAt).toLocaleDateString('pt-BR')}</p></div><div className="text-right"><p className="text-[10px] font-bold text-graphite truncate max-w-[90px]">{lead.sdrOwner || 'SD'}</p><p className="text-[9px] text-gray-400">vendedor</p></div></div></Link>
      <div className="mt-3 grid grid-cols-2 gap-2">{whatsapp ? <a href={whatsapp} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center rounded-lg border border-gray-200 px-2 py-1.5 text-xs font-bold text-graphite hover:bg-gray-50">WhatsApp</a> : <span className="inline-flex items-center justify-center rounded-lg border border-gray-100 px-2 py-1.5 text-xs font-bold text-gray-300">Sem telefone</span>}{canMoveStage && nextStage ? <Button variant="outline" size="sm" className="gap-1" onClick={() => onMove(nextStage.id)} aria-label={`Mover ${lead.contact?.name ?? 'lead'} para ${nextStage.label}`}><ArrowRight size={14} /> Mover</Button> : <Button variant="ghost" size="sm" disabled>Final</Button>}</div>
    </motion.div>
  );
}


function KanbanCardContextMenu({ menu, canMoveStage, onClose, onMove }: { menu: KanbanContextState; canMoveStage: boolean; onClose: () => void; onMove: (lead: Lead, target: LeadStage) => void }) {
  if (!menu) return null;
  const phone = menu.lead.contact?.phone?.replace(/\D/g, '');
  const whatsapp = phone ? `https://wa.me/${phone.startsWith('55') ? phone : `55${phone}`}` : undefined;
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: -6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: -4 }}
        transition={{ type: 'spring', stiffness: 520, damping: 36 }}
        className="fixed z-50 w-[270px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl shadow-graphite/20"
        style={{ left: menu.x, top: menu.y }}
        onClick={(event) => event.stopPropagation()}
        role="menu"
        aria-label={`Menu do lead ${menu.lead.contact?.name ?? 'sem nome'}`}
      >
        <div className="bg-gradient-to-r from-solar-orange/10 via-white to-energy-green/10 p-3 border-b border-gray-100">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-wider text-solar-orange">Card selecionado</p>
              <strong className="block truncate text-sm text-graphite">{menu.lead.contact?.name || 'Lead sem nome'}</strong>
              <span className="text-[11px] text-gray-500">{formatCurrency(menu.lead.energyBillValue || menu.lead.estimatedTicket)}</span>
            </div>
            <button type="button" onClick={onClose} className="rounded-full p-1 text-gray-400 hover:bg-white hover:text-graphite" aria-label="Fechar menu"><X size={14} /></button>
          </div>
        </div>
        <div className="p-2">
          <Link to={`/leads/${menu.lead.id}`} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-graphite hover:bg-gray-50" role="menuitem"><ExternalLink size={15} /> Abrir detalhes do lead</Link>
          {whatsapp ? <a href={whatsapp} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-graphite hover:bg-gray-50" role="menuitem"><MessageCircle size={15} /> Chamar no WhatsApp</a> : <span className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-gray-300"><MessageCircle size={15} /> Sem telefone</span>}
          {canMoveStage && menu.nextStage ? <button type="button" onClick={() => { onMove(menu.lead, menu.nextStage!.id); onClose(); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-bold text-graphite hover:bg-solar-orange/10" role="menuitem"><ArrowRight size={15} /> Mover para {menu.nextStage.label}</button> : <span className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-gray-300"><ArrowRight size={15} /> Sem próxima etapa</span>}
          {canMoveStage && menu.lostStage ? <button type="button" onClick={() => { onMove(menu.lead, menu.lostStage!.id); onClose(); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-black text-alert-red hover:bg-alert-red/10" role="menuitem"><X size={15} /> Marcar como perdido</button> : null}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

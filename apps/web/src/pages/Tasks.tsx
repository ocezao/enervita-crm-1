import { useEffect, useMemo, useState } from 'react';
import { useTasks } from '../hooks/useCrm';
import { PageHeader } from '../components/ui/LayoutComponents';
import { Card, Button, Badge } from '../components/ui/Base';
import { PriorityBadge } from '../components/ui/StatusBadges';
import { CheckCircle2, Plus, Calendar, Filter, User, Search, Clock3, AlertTriangle, Target, LayoutGrid, ListChecks, ArrowUpRight, Sparkles, PhoneCall, MessageSquare, CheckCheck } from 'lucide-react';
import { formatDate } from '../lib/utils';
import { DateRangeFilter, isWithinDateRange, rangeForPeriod } from '../components/ui/DateRangeFilter';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { isAdminUser, userHasPermission } from '../auth/permissions';
import { usersApi, type AdminUser } from '../lib/api/usersApi';
import type { Task } from '../lib/api/types';

type TaskView = 'pipeline' | 'list';
type TaskFilter = 'todas' | 'pendente' | 'atrasado' | 'concluido' | 'urgente';

const filterLabels: Record<TaskFilter, string> = {
  todas: 'Todas',
  pendente: 'Pendentes',
  atrasado: 'Atrasadas',
  concluido: 'Concluídas',
  urgente: 'Urgentes',
};

function isDueToday(task: Task) {
  const due = new Date(task.dueDate);
  const now = new Date();
  return due.toDateString() === now.toDateString();
}

function taskScore(task: Task) {
  if (task.status === 'atrasado') return 100;
  if (task.priority === 'urgente') return 90;
  if (task.priority === 'alta') return 70;
  if (isDueToday(task)) return 60;
  return 30;
}

function TaskCard({ task, canCompleteTask, onComplete }: { task: Task; canCompleteTask: boolean; onComplete: (id: string) => void }) {
  const completed = task.status === 'concluido';
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm hover:shadow-md transition-all min-w-0">
      <div className="flex items-start justify-between gap-3">
        <button
          onClick={() => canCompleteTask && !completed && onComplete(task.id)}
          disabled={!canCompleteTask || completed}
          aria-label={canCompleteTask ? 'Concluir tarefa' : 'Sem permissão para concluir tarefa'}
          className={`mt-0.5 h-7 w-7 rounded-xl border-2 flex items-center justify-center shrink-0 transition-all ${completed ? 'bg-energy-success border-energy-success text-white' : canCompleteTask ? 'border-gray-200 hover:border-solar-orange hover:bg-solar-orange/5' : 'border-gray-100 cursor-not-allowed opacity-60'}`}
        >
          {completed && <CheckCircle2 size={15} />}
        </button>
        <div className="min-w-0 flex-1">
          <h3 className={`font-black text-sm leading-snug break-words ${completed ? 'text-gray-400 line-through' : 'text-graphite'}`}>{task.title}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
            {task.leadId ? (
              <Link to={`/leads/${task.leadId}`} className="font-semibold text-solar-orange hover:underline max-w-full truncate">{task.leadName || 'Abrir lead'}</Link>
            ) : <span>Sem lead vinculado</span>}
            <span className="text-gray-300">•</span>
            <span className="inline-flex items-center gap-1"><Calendar size={12} /> {formatDate(task.dueDate)}</span>
          </div>
        </div>
        <PriorityBadge priority={task.priority} />
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <Badge variant={task.status === 'atrasado' ? 'error' : task.status === 'concluido' ? 'success' : 'info'}>{task.status}</Badge>
        <div className="flex items-center gap-2 text-xs text-gray-400 min-w-0">
          <div className="h-7 w-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 shrink-0"><User size={13} /></div>
          <span className="truncate">{task.owner}</span>
        </div>
      </div>
    </div>
  );
}

export default function Tasks() {
  const { tasks, loading, createTask, completeTask } = useTasks();
  const { user } = useAuth();
  const canCreateTask = userHasPermission(user, 'task.create');
  const canAssignTask = isAdminUser(user) || canCreateTask;
  const canCompleteTask = userHasPermission(user, 'task.complete');
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<TaskFilter>('todas');
  const [view, setView] = useState<TaskView>('pipeline');
  const [dateRange, setDateRange] = useState(() => rangeForPeriod('30'));
  const [message, setMessage] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [newTask, setNewTask] = useState({ title: '', ownerId: user?.id ?? '', priority: 'media', dueDate: '', notes: '' });

  useEffect(() => {
    if (!canAssignTask) return;
    usersApi.list().then(setUsers).catch(() => setUsers([]));
  }, [canAssignTask]);

  const filteredTasks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks
      .filter((task) => {
        if (activeFilter === 'pendente') return task.status === 'pendente';
        if (activeFilter === 'atrasado') return task.status === 'atrasado';
        if (activeFilter === 'concluido') return task.status === 'concluido';
        if (activeFilter === 'urgente') return task.priority === 'urgente' || task.priority === 'alta';
        return true;
      })
      .filter((task) => isWithinDateRange(task.dueDate || task.createdAt, dateRange))
      .filter((task) => !q || [task.title, task.leadName, task.owner, task.priority, task.status].some((value) => String(value ?? '').toLowerCase().includes(q)))
      .sort((a, b) => taskScore(b) - taskScore(a));
  }, [tasks, activeFilter, query, dateRange]);

  const pending = tasks.filter(t => t.status === 'pendente').length;
  const overdue = tasks.filter(t => t.status === 'atrasado').length;
  const done = tasks.filter(t => t.status === 'concluido').length;
  const dueToday = tasks.filter(t => t.status !== 'concluido' && isDueToday(t)).length;
  const urgentQueue = filteredTasks.filter(t => t.status !== 'concluido' && (t.status === 'atrasado' || t.priority === 'urgente' || t.priority === 'alta')).slice(0, 4);
  const assignmentUsers = users.length ? users : [{ id: user?.id ?? '', name: user?.name ?? 'Eu', email: user?.email ?? '', status: 'active' as const, roles: [], permissions: [], allowedStages: [], profile: null }];

  const kanban = [
    { id: 'atrasado', title: 'Atenção agora', icon: AlertTriangle, tasks: filteredTasks.filter(t => t.status === 'atrasado') },
    { id: 'pendente', title: 'Próximas ações', icon: Clock3, tasks: filteredTasks.filter(t => t.status === 'pendente') },
    { id: 'concluido', title: 'Concluídas', icon: CheckCheck, tasks: filteredTasks.filter(t => t.status === 'concluido') },
  ];

  const handleCreateTask = async () => {
    if (!newTask.title.trim()) { setMessage('Informe o título da tarefa.'); return; }
    try {
      await createTask({ title: newTask.title.trim(), ownerId: newTask.ownerId || user?.id, priority: newTask.priority as Task['priority'], dueDate: newTask.dueDate ? new Date(newTask.dueDate).toISOString() : undefined, notes: newTask.notes || undefined });
      setMessage('Tarefa criada e atribuída com sucesso.');
      setNewTask({ title: '', ownerId: user?.id ?? '', priority: 'media', dueDate: '', notes: '' });
      setShowCreate(false);
    } catch {
      setMessage('Não foi possível criar a tarefa agora.');
    }
  };

  const handleComplete = async (id: string) => {
    try {
      await completeTask(id);
      setMessage('Tarefa concluída e fila atualizada.');
    } catch {
      setMessage('Não foi possível concluir a tarefa agora. Tente novamente.');
    }
  };

  return (
    <div className="space-y-6 max-w-[1500px] mx-auto overflow-hidden">
      <PageHeader
        title="Central de Tarefas"
        description="Priorize follow-ups, tarefas vencidas e ações comerciais do dia em uma visão operacional."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setView(view === 'pipeline' ? 'list' : 'pipeline')}>
              {view === 'pipeline' ? <ListChecks size={16} /> : <LayoutGrid size={16} />}
              {view === 'pipeline' ? 'Lista compacta' : 'Pipeline'}
            </Button>
            {canCreateTask && <Button variant="primary" size="sm" className="gap-2" onClick={() => setShowCreate(true)}><Plus size={16} /> Nova Tarefa</Button>}
          </div>
        }
      />

      {message && <Card className="p-4 bg-energy-success/5 border-energy-success/20 text-energy-success text-sm font-semibold">{message}</Card>}

      {showCreate && (
        <Card className="p-5 border-solar-orange/20 bg-solar-orange/5">
          <div className="flex flex-col lg:flex-row lg:items-end gap-3">
            <label className="flex-1 space-y-1"><span className="text-xs font-bold text-gray-500 uppercase">Tarefa</span><input value={newTask.title} onChange={(event) => setNewTask(prev => ({ ...prev, title: event.target.value }))} placeholder="Ex.: Ligar para lead de conta alta" className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm" /></label>
            <label className="space-y-1"><span className="text-xs font-bold text-gray-500 uppercase">Atribuir para</span><select value={newTask.ownerId || user?.id || ''} onChange={(event) => setNewTask(prev => ({ ...prev, ownerId: event.target.value }))} className="w-full lg:w-56 bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm">{assignmentUsers.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className="space-y-1"><span className="text-xs font-bold text-gray-500 uppercase">Prioridade</span><select value={newTask.priority} onChange={(event) => setNewTask(prev => ({ ...prev, priority: event.target.value }))} className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm"><option value="baixa">Baixa</option><option value="media">Média</option><option value="alta">Alta</option><option value="urgente">Urgente</option></select></label>
            <label className="space-y-1"><span className="text-xs font-bold text-gray-500 uppercase">Vencimento</span><input type="datetime-local" value={newTask.dueDate} onChange={(event) => setNewTask(prev => ({ ...prev, dueDate: event.target.value }))} className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm" /></label>
            <Button variant="primary" size="sm" onClick={handleCreateTask}>Criar e atribuir</Button>
            <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>Cancelar</Button>
          </div>
          <textarea value={newTask.notes} onChange={(event) => setNewTask(prev => ({ ...prev, notes: event.target.value }))} placeholder="Observação opcional para quem vai executar a tarefa..." className="mt-3 w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm" />
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1.25fr_0.75fr] gap-6">
        <Card className="p-6 bg-gradient-to-br from-white to-solar-orange/5 border-solar-orange/10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.28em] font-black text-solar-orange">Fila inteligente</p>
              <h2 className="mt-2 text-2xl font-black text-graphite">{overdue > 0 ? `${overdue} tarefa(s) pedem atenção` : 'Operação comercial em dia'}</h2>
              <p className="mt-1 text-sm text-gray-500">A prioridade considera atraso, urgência, data de vencimento e vínculo com lead.</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
              {[['Pendentes', pending, 'text-solar-orange'], ['Atrasadas', overdue, 'text-alert-red'], ['Hoje', dueToday, 'text-blue-600'], ['Concluídas', done, 'text-energy-success']].map(([label, value, color]) => (
                <div key={label} className="rounded-2xl bg-white border border-gray-100 px-4 py-3 text-center shadow-sm">
                  <p className={`text-2xl font-black ${color}`}>{value}</p>
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card className="p-5 bg-graphite text-white relative overflow-hidden">
          <div className="absolute -right-8 -bottom-8 h-32 w-32 rounded-full bg-solar-orange/20 blur-3xl" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 text-solar-orange"><Sparkles size={18} /><span className="text-xs uppercase tracking-widest font-bold">Próxima melhor ação</span></div>
            {urgentQueue[0] ? (
              <div className="mt-4">
                <h3 className="font-black text-lg break-words">{urgentQueue[0].title}</h3>
                <p className="mt-1 text-sm text-white/60">{urgentQueue[0].leadName || 'Sem lead vinculado'} · {formatDate(urgentQueue[0].dueDate)}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {urgentQueue[0].leadId && <Link to={`/leads/${urgentQueue[0].leadId}`}><Button size="sm" variant="secondary" className="gap-2"><ArrowUpRight size={14} /> Abrir lead</Button></Link>}
                  <Button size="sm" variant="outline" className="gap-2 bg-white/10 border-white/20 text-white opacity-50" disabled title="Abra o lead para ver telefone"><PhoneCall size={14} /> Ligar</Button>
                  <Button size="sm" variant="outline" className="gap-2 bg-white/10 border-white/20 text-white opacity-50" disabled title="Abra o lead para WhatsApp"><MessageSquare size={14} /> WhatsApp</Button>
                </div>
              </div>
            ) : <p className="mt-4 text-sm text-white/60">Nenhuma tarefa urgente no momento.</p>}
          </div>
        </Card>
      </div>

      <Card className="p-4 overflow-visible">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por tarefa, lead, responsável ou prioridade..." className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-solar-orange/30" />
          </div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(filterLabels) as TaskFilter[]).map((filter) => (
              <Button key={filter} size="sm" variant={activeFilter === filter ? 'primary' : 'outline'} onClick={() => setActiveFilter(filter)}>{filterLabels[filter]}</Button>
            ))}
            <Button size="sm" variant="ghost" className="gap-2" onClick={() => { setQuery(''); setActiveFilter('todas'); setDateRange(rangeForPeriod('30')); }}><Filter size={14} /> Limpar</Button>
          </div>
          <div className="lg:col-span-2 border-t border-gray-100 pt-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">Tarefas com vencimento no período</p>
            <DateRangeFilter value={dateRange} onChange={setDateRange} />
          </div>
        </div>
      </Card>

      {loading ? (
        <Card className="p-10 text-center text-gray-500">Carregando tarefas...</Card>
      ) : filteredTasks.length === 0 ? (
        <Card className="p-12 text-center">
          <CheckCircle2 size={52} className="mx-auto text-energy-success/40 mb-4" />
          <h4 className="font-black text-graphite">Nenhuma tarefa nessa visão</h4>
          <p className="text-sm text-gray-500 mt-1">Ajuste filtros ou crie uma tarefa vinculada ao próximo follow-up comercial.</p>
        </Card>
      ) : view === 'pipeline' ? (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          {kanban.map((column) => {
            const Icon = column.icon;
            return (
              <Card key={column.id} className="p-4 bg-gray-50/60 overflow-visible">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-black text-graphite flex items-center gap-2"><Icon size={18} className="text-solar-orange" /> {column.title}</h3>
                  <Badge variant="default">{column.tasks.length}</Badge>
                </div>
                <div className="space-y-3">{column.tasks.map((task) => <TaskCard key={task.id} task={task} canCompleteTask={canCompleteTask} onComplete={handleComplete} />)}</div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="divide-y divide-gray-50 overflow-hidden">
          {filteredTasks.map((task) => <TaskCard key={task.id} task={task} canCompleteTask={canCompleteTask} onComplete={handleComplete} />)}
        </Card>
      )}

      <Card className="p-5 border-dashed bg-white/70">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-black text-graphite flex items-center gap-2"><Target size={18} className="text-energy-success" /> Rotina recomendada</h3>
            <p className="text-sm text-gray-500 mt-1">Comece pelas atrasadas/urgentes, registre contato no lead e conclua apenas quando houver próximo passo definido.</p>
          </div>
          <Badge variant="solar">{filteredTasks.length} tarefa(s) na visão atual</Badge>
        </div>
      </Card>
    </div>
  );
}

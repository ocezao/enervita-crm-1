import { useTasks } from '../hooks/useCrm';
import { PageHeader } from '../components/ui/LayoutComponents';
import { Card, Button, Badge } from '../components/ui/Base';
import { PriorityBadge } from '../components/ui/StatusBadges';
import { CheckCircle2, Plus, Calendar, Filter, User } from 'lucide-react';
import { formatDate } from '../lib/utils';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { userHasPermission } from '../auth/permissions';

export default function Tasks() {
  const { tasks, loading, completeTask } = useTasks();
  const { user } = useAuth();
  const canCreateTask = userHasPermission(user, 'task.create');
  const canCompleteTask = userHasPermission(user, 'task.complete');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Minhas Tarefas"
        description="Gerencie seu follow-up e compromissos do dia."
        actions={
          canCreateTask ? (
            <Button variant="primary" size="sm" className="gap-2">
              <Plus size={16} /> Nova Tarefa
            </Button>
          ) : null
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 border-l-4 border-l-solar-orange">
          <p className="text-[10px] font-bold text-gray-400 uppercase">Pendente</p>
          <h4 className="text-2xl font-bold text-graphite">
            {tasks.filter(t => t.status === 'pendente').length}
          </h4>
        </Card>
        <Card className="p-4 border-l-4 border-l-alert-red">
          <p className="text-[10px] font-bold text-gray-400 uppercase">Atrasada</p>
          <h4 className="text-2xl font-bold text-graphite">
            {tasks.filter(t => t.status === 'atrasado').length}
          </h4>
        </Card>
        <Card className="p-4 border-l-4 border-l-energy-success">
          <p className="text-[10px] font-bold text-gray-400 uppercase">Concluída hoje</p>
          <h4 className="text-2xl font-bold text-graphite">
            {tasks.filter(t => t.status === 'concluido').length}
          </h4>
        </Card>
        <Card className="p-4 bg-gray-50 flex items-center justify-center border-dashed">
          <Button variant="ghost" size="sm" className="text-gray-400 gap-2">
            <Filter size={14} /> Filtros avançados
          </Button>
        </Card>
      </div>

      <Card className="divide-y divide-gray-50">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Carregando tarefas...</div>
        ) : tasks.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle2 size={48} className="mx-auto text-gray-200 mb-4" />
            <h4 className="font-bold text-graphite">Nenhuma tarefa encontrada</h4>
            <p className="text-sm text-gray-500">Você está em dia com suas atividades.</p>
          </div>
        ) : tasks.map((task) => (
          <div key={task.id} className="p-4 hover:bg-gray-50/50 transition-colors flex items-center justify-between group">
            <div className="flex items-start gap-4">
              <button
                onClick={() => canCompleteTask && completeTask(task.id)}
                disabled={!canCompleteTask || task.status === 'concluido'}
                aria-label={canCompleteTask ? 'Concluir tarefa' : 'Sem permissão para concluir tarefa'}
                className={`mt-1 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all ${
                  task.status === 'concluido'
                    ? 'bg-energy-success border-energy-success text-white'
                    : canCompleteTask ? 'border-gray-200 hover:border-solar-orange' : 'border-gray-100 cursor-not-allowed opacity-60'
                }`}
              >
                {task.status === 'concluido' && <CheckCircle2 size={12} />}
              </button>

              <div>
                <h5 className={`font-bold text-sm ${task.status === 'concluido' ? 'text-gray-400 line-through' : 'text-graphite'}`}>
                  {task.title}
                </h5>
                <div className="flex items-center gap-3 mt-1">
                  <Link to={`/leads/${task.leadId}`} className="text-xs text-solar-orange hover:underline font-medium">
                    {task.leadName}
                  </Link>
                  <span className="text-gray-300">•</span>
                  <div className="flex items-center gap-1 text-[10px] text-gray-400 font-medium">
                    <Calendar size={12} />
                    {formatDate(task.dueDate)}
                  </div>
                  {task.status === 'atrasado' && (
                    <Badge variant="error" className="py-0">Atrasado</Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <PriorityBadge priority={task.priority} />
              <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                <User size={14} />
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                <Plus size={16} className="rotate-45 text-gray-400" />
              </Button>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

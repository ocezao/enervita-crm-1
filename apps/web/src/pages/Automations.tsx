import { useMemo } from 'react';
import { useAutomations } from '../hooks/useCrm';
import { PageHeader } from '../components/ui/LayoutComponents';
import { Card, Button, Badge, BadgeVariant } from '../components/ui/Base';
import { Zap, Play, Power, Clock, ArrowRight, Workflow, Activity, Link2, ShieldCheck, PauseCircle, RotateCcw, AlertTriangle, ServerCog } from 'lucide-react';
import { formatDate } from '../lib/utils';

function statusLabel(status: string | undefined, active: boolean) {
  if (status === 'planned') return 'Planejada';
  if (status === 'paused') return 'Pausada';
  return active ? 'Ativa' : 'Inativa';
}

function workflowStatusLabel(status: string) {
  if (status === 'active') return 'Ativo';
  if (status === 'paused') return 'Pausado';
  return 'Arquivado';
}

function workflowBadgeVariant(status: string): BadgeVariant {
  if (status === 'active') return 'success';
  if (status === 'paused') return 'warning';
  return 'default';
}

export default function Automations() {
  const { automations, n8nWorkflows, loading, error, runAutomation, lastRun, toggleN8nWorkflow, togglingWorkflowId, n8nMessage } = useAutomations();
  const activeWorkflows = useMemo(() => n8nWorkflows.filter((workflow) => workflow.active).length, [n8nWorkflows]);
  const webhookCount = useMemo(() => n8nWorkflows.reduce((total, workflow) => total + workflow.webhookPaths.length, 0), [n8nWorkflows]);
  const integrationMessage = n8nMessage?.replace(/n8n/gi, 'integração operacional');

  return (
    <div className="space-y-6 max-w-[1500px] mx-auto overflow-hidden">
      <PageHeader
        title="Automações"
        description="Central de automações da Enervita: veja fluxos ativos, entenda o que cada um faz e pause/despause com segurança."
        actions={
          <div className="flex items-center gap-2 rounded-2xl border border-energy-success/20 bg-energy-success/10 px-4 py-2 text-sm font-semibold text-energy-success">
            <ServerCog size={16} /> Automações conectadas
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_0.8fr] gap-6">
        <Card className="p-6 bg-gradient-to-br from-graphite via-graphite to-[#1f2f2a] text-white relative overflow-hidden">
          <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-solar-orange/20 blur-3xl" />
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <p className="text-xs uppercase tracking-[0.3em] text-white/50 font-bold">Automações</p>
              <h3 className="mt-3 text-2xl font-bold">Fluxos da Enervita</h3>
              <p className="mt-2 text-sm text-white/60">Status atualizado automaticamente para apoiar a operação comercial.</p>
            </div>
            <div className="rounded-2xl bg-white/10 border border-white/10 p-4">
              <p className="text-xs text-white/50 uppercase font-bold">Fluxos ativos</p>
              <p className="mt-2 text-3xl font-black">{activeWorkflows}/{n8nWorkflows.length}</p>
            </div>
            <div className="rounded-2xl bg-white/10 border border-white/10 p-4">
              <p className="text-xs text-white/50 uppercase font-bold">Entradas integradas</p>
              <p className="mt-2 text-3xl font-black">{webhookCount}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 border-solar-orange/20 bg-solar-orange/5">
          <div className="flex items-start gap-3">
            <ShieldCheck className="text-solar-orange shrink-0" size={22} />
            <div>
              <h3 className="font-bold text-graphite">Controle seguro</h3>
              <p className="mt-1 text-sm text-gray-600">Pausar interrompe novas execuções automáticas. Despausar reativa o fluxo conforme a configuração atual.</p>
              {integrationMessage && <p className="mt-3 text-xs font-semibold text-energy-success">{integrationMessage}</p>}
            </div>
          </div>
        </Card>
      </div>

      {error && (
        <Card className="p-4 border-alert-red/20 bg-alert-red/5 text-alert-red flex gap-3 items-start">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Não foi possível carregar uma parte das automações.</p>
            <p className="text-sm">{error}</p>
          </div>
        </Card>
      )}

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-graphite">Fluxos integrados</h2>
            <p className="text-sm text-gray-500">Lista operacional dos fluxos publicados ou pausados para a Enervita.</p>
          </div>
          <Badge variant="info">{n8nWorkflows.length} fluxos</Badge>
        </div>

        {loading ? (
          <Card className="p-10 text-center text-gray-500">Carregando automações e fluxos...</Card>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {n8nWorkflows.map((workflow) => (
              <Card key={workflow.id} className="p-5 hover:shadow-lg transition-all border-gray-100 overflow-hidden">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={workflowBadgeVariant(workflow.status)}>{workflowStatusLabel(workflow.status)}</Badge>
                      <span className="text-[11px] font-semibold text-gray-400 truncate">Fluxo comercial</span>
                    </div>
                    <h3 className="mt-3 text-base font-black text-graphite leading-snug break-words">{workflow.name}</h3>
                    <p className="mt-2 text-sm text-gray-600 leading-relaxed">{workflow.description}</p>
                  </div>
                  <div className={`h-11 w-11 rounded-2xl shrink-0 grid place-items-center ${workflow.active ? 'bg-energy-success/10 text-energy-success' : 'bg-alert-amber/10 text-alert-amber'}`}>
                    <Workflow size={22} />
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl bg-gray-50 p-3 min-w-0">
                    <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400">Gatilhos</p>
                    <p className="mt-1 font-semibold text-graphite break-words">{workflow.triggerSummary}</p>
                  </div>
                  <div className="rounded-2xl bg-gray-50 p-3 min-w-0">
                    <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400">Atualizado</p>
                    <p className="mt-1 font-semibold text-graphite">{workflow.updatedAt ? formatDate(workflow.updatedAt) : 'Sem data'}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {workflow.nodeSummary.map((node) => <Badge key={node} variant="default" className="normal-case">{node}</Badge>)}
                </div>

                {workflow.webhookPaths.length > 0 && (
                  <div className="mt-4 rounded-2xl border border-gray-100 bg-white p-3">
                    <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mb-2 flex items-center gap-1"><Link2 size={12} /> Entradas</p>
                    <div className="space-y-1">
                      {workflow.webhookPaths.map((path, index) => <span key={path} className="block text-[11px] text-gray-600 bg-gray-50 rounded-lg px-2 py-1">Entrada {index + 1} configurada</span>)}
                    </div>
                  </div>
                )}

                <div className="mt-5 pt-4 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <p className="text-xs text-gray-400">Status operacional: {workflow.active ? 'recebendo/executando' : 'sem execução automática'}</p>
                  <Button
                    variant={workflow.active ? 'outline' : 'success'}
                    size="sm"
                    className="gap-2 whitespace-nowrap"
                    disabled={togglingWorkflowId === workflow.id || workflow.status === 'archived'}
                    onClick={() => void toggleN8nWorkflow(workflow.id, !workflow.active)}
                  >
                    {workflow.active ? <PauseCircle size={14} /> : <Power size={14} />}
                    {togglingWorkflowId === workflow.id ? 'Aplicando...' : workflow.active ? 'Pausar fluxo' : 'Despausar fluxo'}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-graphite">Regras internas do CRM</h2>
          <p className="text-sm text-gray-500">Regras comerciais registradas no CRM para alertas, tarefas e próximos passos.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {automations.map((rule) => (
            <Card key={rule.id} className="p-5 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4 gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`p-2 rounded-lg ${rule.active ? 'bg-solar-orange/10 text-solar-orange' : 'bg-gray-100 text-gray-400'}`}><Zap size={20} /></div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-graphite break-words">{rule.name}</h3>
                    <p className="text-xs text-gray-400 break-all">Gatilho: {rule.trigger}</p>
                    <Badge variant={rule.active ? 'success' : 'default'} className="mt-2 text-[10px]">{statusLabel(rule.status, rule.active)}</Badge>
                  </div>
                </div>
                <RotateCcw size={18} className="text-gray-300 shrink-0" />
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Condições</p>
                  <div className="flex flex-wrap gap-2">{rule.conditions.map((c, i) => <Badge key={i} variant="default" className="normal-case font-medium">{c}</Badge>)}</div>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Ações</p>
                  <div className="space-y-2">{rule.actions.map((a, i) => <div key={i} className="flex items-center gap-2 text-sm text-gray-600"><ArrowRight size={14} className="text-solar-orange shrink-0" />{a}</div>)}</div>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-50 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[10px] text-gray-400"><Clock size={12} />Executado em {rule.lastRunAt ? formatDate(rule.lastRunAt) : 'Nunca'}</div>
                <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => void runAutomation(rule.id)}><Play size={12} /> Executar agora</Button>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {lastRun && (
        <Card className="p-4 bg-energy-success/5 border-energy-success/20">
            <p className="text-sm text-energy-success font-semibold flex items-center gap-2"><Activity size={16} /> Última execução: {lastRun.status} · entregas geradas: {String(lastRun.outputPayload.queuedWebhookDeliveries ?? 0)}</p>
        </Card>
      )}
    </div>
  );
}

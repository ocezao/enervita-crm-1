import { useMemo, useState } from 'react';
import { useAutomations, useFollowUps } from '../hooks/useCrm';
import { PageHeader } from '../components/ui/LayoutComponents';
import { Card, Button, Badge, BadgeVariant } from '../components/ui/Base';
import { Zap, Play, Power, Clock, ArrowRight, Workflow, Activity, Link2, ShieldCheck, PauseCircle, RotateCcw, AlertTriangle, ServerCog, Send } from 'lucide-react';
import { formatDate } from '../lib/utils';
import type { FollowUpStatus } from '../lib/api/types';

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

const AUTOMATIONS_ERROR_DISMISSED_KEY = 'enervita:automations-error-dismissed';

export default function Automations() {
  const { automations, n8nWorkflows, loading, error, runAutomation, lastRun, toggleN8nWorkflow, togglingWorkflowId, n8nMessage } = useAutomations();
  const { followUps, counts: followUpCounts, status: followUpStatus, ruleKey: followUpRuleKey, loading: followUpsLoading, lastRun: followUpRun, runRules, skip, markSent, setStatus: setFollowUpStatus, setRuleKey: setFollowUpRuleKey } = useFollowUps('pending');
  const activeWorkflows = useMemo(() => n8nWorkflows.filter((workflow) => workflow.active).length, [n8nWorkflows]);
  const webhookCount = useMemo(() => n8nWorkflows.reduce((total, workflow) => total + workflow.webhookPaths.length, 0), [n8nWorkflows]);
  const integrationMessage = n8nMessage?.replace(/n8n/gi, 'integração operacional');
  const [isErrorDismissed, setIsErrorDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.sessionStorage.getItem(AUTOMATIONS_ERROR_DISMISSED_KEY) === 'true';
  });

  const followUpRuleLabels: Record<string, string> = {
    task_overdue: 'Tarefa vencida',
    lead_without_next_action: 'Lead sem próximo passo',
    proposal_no_response: 'Proposta sem resposta',
    opportunity_stale: 'Oportunidade parada',
  };
  const followUpStatusLabels: Record<FollowUpStatus, string> = {
    pending: 'Pendente',
    sent: 'Tratado',
    skipped: 'Pulado',
    failed: 'Falhou',
    cancelled: 'Cancelado',
  };
  const followUpStatusOptions: Array<{ label: string; value?: FollowUpStatus }> = [
    { label: 'Todos' },
    { label: 'Pendentes', value: 'pending' },
    { label: 'Tratados', value: 'sent' },
    { label: 'Pulados', value: 'skipped' },
    { label: 'Falhas', value: 'failed' },
  ];
  const followUpRuleOptions: Array<{ label: string; value?: string }> = [
    { label: 'Todas as regras' },
    ...Object.entries(followUpRuleLabels).map(([value, label]) => ({ value, label })),
  ];

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


      <Card className="border border-amber-200/70 bg-amber-50/60 p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.18em] text-amber-700 font-black">Follow-up operacional</p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-black text-text-primary">Fila de follow-up</h2>
              <Badge variant="warning">{followUpCounts.total} visíveis</Badge>
            </div>
            <p className="mt-1 text-xs font-semibold text-text-primary">Revisão manual dos próximos contatos. Não dispara WhatsApp/e-mail automaticamente.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {followUpStatusOptions.map((option) => (
              <Button
                key={option.label}
                size="sm"
                variant={followUpStatus === option.value ? 'secondary' : 'ghost'}
                onClick={() => setFollowUpStatus(option.value)}
              >
                {option.label}
              </Button>
            ))}
            <select
              value={followUpRuleKey ?? ''}
              onChange={(event) => setFollowUpRuleKey(event.target.value || undefined)}
              className="h-9 rounded-xl border border-border-soft bg-bg-surface-1 px-3 text-xs font-bold text-text-primary outline-none focus:border-amber-500"
              aria-label="Filtrar fila por regra"
            >
              {followUpRuleOptions.map((option) => (
                <option key={option.label} value={option.value ?? ''}>{option.label}</option>
              ))}
            </select>
            <Button size="sm" onClick={() => runRules()} disabled={followUpsLoading}>
              <RotateCcw size={14} /> {followUpsLoading ? 'Atualizando...' : 'Gerar fila'}
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {Object.entries(followUpRuleLabels).map(([key, label]) => (
            <span key={key} className="rounded-full border border-white/80 bg-bg-surface-1/80 px-3 py-1 text-[11px] font-black text-text-secondary">
              {label}: <strong className="text-text-primary">{followUpCounts.byRule[key] ?? 0}</strong>
            </span>
          ))}
        </div>

        {followUpRun ? (
          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">
            Criados: {Object.values(followUpRun.created).reduce((sum, value) => sum + value, 0)} · Já existentes: {Object.values(followUpRun.existing).reduce((sum, value) => sum + value, 0)}
          </div>
        ) : null}
        <div className="mt-4 space-y-2">
          {followUpsLoading ? <p className="text-sm font-semibold text-text-secondary">Carregando fila...</p> : null}
          {!followUpsLoading && followUps.length === 0 ? (
            <div className="rounded-xl border border-border-soft bg-bg-surface-1/70 px-4 py-3">
              <p className="text-sm font-black text-text-primary">Nenhum follow-up encontrado para este filtro.</p>
              <p className="mt-1 text-xs font-semibold text-text-secondary">Gere a fila ou altere os filtros para revisar itens tratados, pulados ou falhos.</p>
            </div>
          ) : null}
          {followUps.map((item) => {
            const audit = item.metadata?.followUpAudit as { actor?: { name?: string | null; email?: string | null }; at?: string; reason?: string | null; error?: string | null } | undefined;
            return (
              <div key={item.id} className="rounded-xl border border-border-soft bg-bg-surface-1/85 px-4 py-3 shadow-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-black text-text-primary">
                      <Send size={15} className="text-amber-700" /> {item.reason}
                      <Badge variant={item.status === 'pending' ? 'warning' : item.status === 'sent' ? 'success' : 'default'}>{followUpStatusLabels[item.status]}</Badge>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-text-secondary">Regra: {followUpRuleLabels[item.ruleKey] ?? item.ruleKey} · Canal: {item.channel} · Agendado: {formatDate(item.scheduledAt)}</p>
                    <p className="mt-2 rounded-lg  bg-bg-surface-2/30 px-3 py-2 text-xs font-semibold text-text-primary">Sugestão: {item.suggestedMessage}</p>
                    {audit ? <p className="mt-1 text-[11px] font-bold text-text-secondary">Última ação: {audit.actor?.name ?? audit.actor?.email ?? 'usuário'} em {audit.at ? formatDate(audit.at) : 'data não registrada'}</p> : null}
                    {item.lastError ? <p className="mt-1 text-xs font-bold text-alert-red">Último erro: {item.lastError}</p> : null}
                  </div>
                  {item.status === 'pending' ? (
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="ghost" onClick={() => void navigator.clipboard?.writeText(item.suggestedMessage)}>Copiar mensagem</Button>
                      {item.contactPhone ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => window.open(`https://wa.me/${item.contactPhone?.replace(/\D/g, '')}?text=${encodeURIComponent(item.suggestedMessage)}`, '_blank', 'noopener,noreferrer')}
                        >
                          Abrir WhatsApp
                        </Button>
                      ) : null}
                      <Button size="sm" variant="secondary" onClick={() => markSent(item.id)}>Marcar tratado</Button>
                      <Button size="sm" variant="ghost" onClick={() => skip(item.id, 'Ignorado pela operação')}>Pular</Button>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_0.8fr] gap-6">
        <Card className="p-6 bg-gradient-to-br from-graphite via-graphite to-[#1f2f2a] text-white relative overflow-hidden">
          <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-orange-500/20 blur-3xl" />
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <p className="text-xs uppercase tracking-[0.3em] text-white/50 font-bold">Automações</p>
              <h3 className="mt-3 text-2xl font-bold">Fluxos da Enervita</h3>
              <p className="mt-2 text-sm text-white/60">Status atualizado automaticamente para apoiar a operação comercial.</p>
            </div>
            <div className="rounded-2xl bg-bg-surface-1/10 border border-white/10 p-4">
              <p className="text-xs text-white/50 uppercase font-bold">Fluxos ativos</p>
              <p className="mt-2 text-3xl font-black">{activeWorkflows}/{n8nWorkflows.length}</p>
            </div>
            <div className="rounded-2xl bg-bg-surface-1/10 border border-white/10 p-4">
              <p className="text-xs text-white/50 uppercase font-bold">Entradas integradas</p>
              <p className="mt-2 text-3xl font-black">{webhookCount}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 border-solar-orange/20 bg-orange-500/5">
          <div className="flex items-start gap-3">
            <ShieldCheck className="text-orange-400 shrink-0" size={22} />
            <div>
              <h3 className="font-bold text-text-primary">Controle seguro</h3>
              <p className="mt-1 text-sm text-text-primary">Pausar interrompe novas execuções automáticas. Despausar reativa o fluxo conforme a configuração atual.</p>
              {integrationMessage && <p className="mt-3 text-xs font-semibold text-energy-success">{integrationMessage}</p>}
            </div>
          </div>
        </Card>
      </div>

      {error && !isErrorDismissed && (
        <Card className="p-4 border-alert-red/20 bg-red-500/5 text-alert-red flex gap-3 items-start">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="font-bold">Não foi possível carregar uma parte das automações.</p>
            <p className="text-sm">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              window.sessionStorage.setItem(AUTOMATIONS_ERROR_DISMISSED_KEY, 'true');
              setIsErrorDismissed(true);
            }}
            className="shrink-0 rounded-full p-1 text-alert-red/70 transition hover:bg-red-500/10 hover:text-alert-red focus:outline-none focus:ring-2 focus:ring-alert-red/30"
            aria-label="Fechar alerta de automações"
          >
            <span aria-hidden="true" className="text-xl leading-none">×</span>
          </button>
        </Card>
      )}

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-text-primary">Fluxos integrados</h2>
            <p className="text-sm text-text-secondary">Lista operacional dos fluxos publicados ou pausados para a Enervita.</p>
          </div>
          <Badge variant="info">{n8nWorkflows.length} fluxos</Badge>
        </div>

        {loading ? (
          <Card className="p-10 text-center text-text-secondary">Carregando automações e fluxos...</Card>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {n8nWorkflows.map((workflow) => (
              <Card key={workflow.id} className="p-5 hover:shadow-lg transition-all border-border-soft overflow-hidden">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={workflowBadgeVariant(workflow.status)}>{workflowStatusLabel(workflow.status)}</Badge>
                      <span className="text-[11px] font-semibold text-text-secondary truncate">Fluxo comercial</span>
                    </div>
                    <h3 className="mt-3 text-base font-black text-text-primary leading-snug break-words">{workflow.name}</h3>
                    <p className="mt-2 text-sm text-text-primary leading-relaxed">{workflow.description}</p>
                  </div>
                  <div className={`h-11 w-11 rounded-2xl shrink-0 grid place-items-center ${workflow.active ? 'bg-energy-success/10 text-energy-success' : 'bg-amber-500/10 text-alert-amber'}`}>
                    <Workflow size={22} />
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl bg-bg-surface-2/50 p-3 min-w-0">
                    <p className="text-[10px] uppercase tracking-widest font-bold text-text-secondary">Gatilhos</p>
                    <p className="mt-1 font-semibold text-text-primary break-words">{workflow.triggerSummary}</p>
                  </div>
                  <div className="rounded-2xl bg-bg-surface-2/50 p-3 min-w-0">
                    <p className="text-[10px] uppercase tracking-widest font-bold text-text-secondary">Atualizado</p>
                    <p className="mt-1 font-semibold text-text-primary">{workflow.updatedAt ? formatDate(workflow.updatedAt) : 'Sem data'}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {workflow.nodeSummary.map((node) => <Badge key={node} variant="default" className="normal-case">{node}</Badge>)}
                </div>

                {workflow.webhookPaths.length > 0 && (
                  <div className="mt-4 rounded-2xl border border-border-soft bg-bg-surface-1 p-3">
                    <p className="text-[10px] uppercase tracking-widest font-bold text-text-secondary mb-2 flex items-center gap-1"><Link2 size={12} /> Entradas</p>
                    <div className="space-y-1">
                      {workflow.webhookPaths.map((path, index) => <span key={path} className="block text-[11px] text-text-primary bg-bg-surface-2/50 rounded-lg px-2 py-1">Entrada {index + 1} configurada</span>)}
                    </div>
                  </div>
                )}

                <div className="mt-5 pt-4 border-t border-border-soft flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <p className="text-xs text-text-secondary">Status operacional: {workflow.active ? 'recebendo/executando' : 'sem execução automática'}</p>
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
          <h2 className="text-lg font-bold text-text-primary">Regras internas do CRM</h2>
          <p className="text-sm text-text-secondary">Regras comerciais registradas no CRM para alertas, tarefas e próximos passos.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {automations.map((rule) => (
            <Card key={rule.id} className="p-5 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4 gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`p-2 rounded-lg ${rule.active ? 'bg-orange-500/10 text-orange-400' : 'bg-bg-surface-2/50 text-text-secondary'}`}><Zap size={20} /></div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-text-primary break-words">{rule.name}</h3>
                    <p className="text-xs text-text-secondary break-all">Gatilho: {rule.trigger}</p>
                    <Badge variant={rule.active ? 'success' : 'default'} className="mt-2 text-[10px]">{statusLabel(rule.status, rule.active)}</Badge>
                  </div>
                </div>
                <RotateCcw size={18} className="text-text-secondary shrink-0" />
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-2">Condições</p>
                  <div className="flex flex-wrap gap-2">{rule.conditions.map((c, i) => <Badge key={i} variant="default" className="normal-case font-medium">{c}</Badge>)}</div>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-2">Ações</p>
                  <div className="space-y-2">{rule.actions.map((a, i) => <div key={i} className="flex items-center gap-2 text-sm text-text-primary"><ArrowRight size={14} className="text-orange-400 shrink-0" />{a}</div>)}</div>
                </div>
              </div>

              <div className="pt-4 border-t border-border-hair flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[10px] text-text-secondary"><Clock size={12} />Executado em {rule.lastRunAt ? formatDate(rule.lastRunAt) : 'Nunca'}</div>
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

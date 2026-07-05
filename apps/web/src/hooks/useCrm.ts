import { useEffect, useState } from 'react';
import { api, type UpdateLeadPayload } from '../lib/api/crmApi';
import type {
  Activity,
  AdsOverview,
  AutomationRule,
  AutomationRun,
  CreateProposalPayload,
  UpdateProposalPayload,
  CrmAnalyticsOverview,
  DashboardMetrics,
  FollowUpQueueItem,
  FollowUpRuleRunResult,
  FollowUpStatus,
  Lead,
  LeadDocument,
  LeadHistoryEntry,
  LeadStage,
  N8nWorkflow,
  N8nWorkflowToggleResult,
  Proposal,
  Task,
  TrackingEvent,
  Webhook,
  WebhookDelivery,
  WebhookTestResult,
} from '../lib/api/types';

export function useLeads(filters?: { tags?: string[]; tagMode?: 'any' | 'all' }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const tagsKey = (filters?.tags ?? []).join(',');
  const tagMode = filters?.tagMode ?? 'any';

  const loadLeads = async () => {
    setLoading(true);
    const tags = tagsKey ? tagsKey.split(',').filter(Boolean) : [];
    const data = await api.listLeads({ tags, tagMode });
    setLeads(data);
    setLoading(false);
    return data;
  };

  useEffect(() => {
    let active = true;
    const tags = tagsKey ? tagsKey.split(',').filter(Boolean) : [];
    void Promise.resolve()
      .then(() => {
        if (active) setLoading(true);
        return api.listLeads({ tags, tagMode });
      })
      .then(data => {
        if (!active) return;
        setLeads(data);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => { active = false; };
  }, [tagsKey, tagMode]);

  const updateStage = async (id: string, stage: LeadStage, options?: { notes?: string; lostReason?: string; pipelineKey?: string; pipelineStageKey?: string }) => {
    const updated = await api.updateLeadStage(id, stage, options);
    setLeads(prev => prev.map(l => l.id === id ? updated : l));
    return updated;
  };

  const bulkSetTags = async (leadIds: string[], tags: string[]) => {
    const updated = await api.bulkSetLeadTags(leadIds, tags);
    const updatedById = new Map(updated.map((lead) => [lead.id, lead]));
    setLeads(prev => prev.map(lead => updatedById.get(lead.id) ?? lead));
    return updated;
  };

  const deleteLead = async (id: string) => {
    await api.deleteLead(id);
    setLeads(prev => prev.filter(lead => lead.id !== id));
  };

  const bulkDelete = async (leadIds: string[]) => {
    const deleted = await api.bulkDeleteLeads(leadIds);
    const ids = new Set(leadIds);
    setLeads(prev => prev.filter(lead => !ids.has(lead.id)));
    return deleted;
  };

  return { leads, loading, updateStage, bulkSetTags, deleteLead, bulkDelete, refresh: loadLeads };
}

export function useLeadDetail(id: string | undefined) {
  const [lead, setLead] = useState<Lead | undefined>();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [history, setHistory] = useState<LeadHistoryEntry[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [trackingEvents, setTrackingEvents] = useState<TrackingEvent[]>([]);
  const [documents, setDocuments] = useState<LeadDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.resolve()
      .then(() => {
            return Promise.all([
          api.getLead(id),
          api.listActivities(id),
          api.listTasksForLead(id),
          api.listLeadHistory(id),
          api.listProposalsForLead(id).catch(() => []),
          api.listTrackingEventsForLead(id).catch(() => []),
          api.listLeadDocuments(id).catch(() => [])
        ]);
      })
      .then(([l, a, t, h, p, te, d]) => {
        setLead(l);
        setActivities(a);
        setTasks(t);
        setHistory(h);
        setProposals(p);
        setTrackingEvents(te);
        setDocuments(d);
        setLoading(false);
      });
  }, [id]);

  const addActivity = async (payload: Partial<Activity>) => {
    const fresh = await api.createActivity({ ...payload, leadId: id });
    setActivities(prev => [fresh, ...prev]);
    return fresh;
  };

  const addTask = async (payload: Partial<Task>) => {
    const fresh = await api.createTask({ ...payload, leadId: id });
    setTasks(prev => [fresh, ...prev]);
    return fresh;
  };

  const completeTask = async (taskId: string) => {
    const updated = await api.completeTask(taskId);
    setTasks(prev => prev.map(task => task.id === taskId ? updated : task));
    return updated;
  };

  const addProposal = async (payload: CreateProposalPayload) => {
    const fresh = await api.createProposal({ ...payload, leadId: id ?? payload.leadId });
    setProposals(prev => [fresh, ...prev]);
    return fresh;
  };

  const updateProposalItem = async (proposalId: string, payload: UpdateProposalPayload) => {
    const updated = await api.updateProposal(proposalId, payload);
    setProposals(prev => prev.map(p => p.id === proposalId ? updated : p));
    if (id && payload.status === 'accepted') {
      setLead(await api.getLead(id));
    }
    return updated;
  };

  const deleteProposalItem = async (proposalId: string) => {
    await api.deleteProposal(proposalId);
    setProposals(prev => prev.filter(p => p.id !== proposalId));
  };

  const uploadDocument = async (file: File) => {
    if (!id) return undefined;
    const document = await api.uploadLeadDocument(id, file);
    setDocuments(prev => [document, ...prev]);
    return document;
  };

  const deleteDocument = async (documentId: string) => {
    if (!id) return;
    await api.deleteLeadDocument(id, documentId);
    setDocuments(prev => prev.filter(document => document.id !== documentId));
  };

  const refreshDocuments = async () => {
    if (!id) return [];
    const fresh = await api.listLeadDocuments(id);
    setDocuments(fresh);
    return fresh;
  };

  const updateLead = async (payload: UpdateLeadPayload) => {
    if (!id) return undefined;
    const updated = await api.updateLead(id, payload);
    setLead(updated);
    return updated;
  };

  const convertToOpportunity = async () => {
    if (!id) return undefined;
    const updated = await api.updateLeadStage(id, 'atendimento_iniciado', { notes: 'Lead convertido em oportunidade pelo CRM.', createOpportunity: true });
    setLead(updated);
    setHistory(await api.listLeadHistory(id));
    return updated;
  };

  const deleteLead = async () => {
    if (!id) return;
    await api.deleteLead(id);
    setLead(undefined);
  };

  const setTags = async (tags: string[]) => {
    if (!id) return undefined;
    const updated = await api.setLeadTags(id, tags);
    setLead(updated);
    return updated;
  };

  return { lead, activities, tasks, history, proposals, trackingEvents, documents, loading, addActivity, addTask, completeTask, addProposal, updateProposal: updateProposalItem, deleteProposal: deleteProposalItem, uploadDocument, deleteDocument, refreshDocuments, updateLead, convertToOpportunity, deleteLead, setTags };
}

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listTasks().then(data => {
      setTasks(data);
      setLoading(false);
    });
  }, []);

  const createTask = async (payload: Partial<Task>) => {
    const fresh = await api.createTask(payload);
    setTasks(prev => [fresh, ...prev]);
    return fresh;
  };

  const completeTask = async (id: string) => {
    const updated = await api.completeTask(id);
    setTasks(prev => prev.map(t => t.id === id ? updated : t));
    return updated;
  };

  return { tasks, loading, createTask, completeTask };
}

export function useDashboardMetrics(filters: Parameters<typeof api.listDashboardMetrics>[0] = {}) {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const filtersKey = JSON.stringify(filters);

  useEffect(() => {
    setLoading(true);
    api.listDashboardMetrics(filters).then(data => {
      setMetrics(data);
      setLoading(false);
    });
  }, [filtersKey]);

  return { metrics, loading };
}


export function useAnalyticsOverview(filters: { days?: number; period?: string; startDate?: string; endDate?: string; source?: string; campaign?: string; stage?: LeadStage }) {
  const [overview, setOverview] = useState<CrmAnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { days, period, startDate, endDate, source, campaign, stage } = filters;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
        try {
        const data = await api.getAnalyticsOverview({ days, period, startDate, endDate, source, campaign, stage });
        if (!cancelled) {
          setOverview(data);
          setError(null);
        }
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erro ao carregar analytics');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [days, period, startDate, endDate, source, campaign, stage]);

  return { overview, loading, error };
}

export function useFollowUps(initialStatus: FollowUpStatus = 'pending') {
  const [status, setStatus] = useState<FollowUpStatus | undefined>(initialStatus);
  const [ruleKey, setRuleKey] = useState<string | undefined>();
  const [followUps, setFollowUps] = useState<FollowUpQueueItem[]>([]);
  const [lastRun, setLastRun] = useState<FollowUpRuleRunResult | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async (overrides: { status?: FollowUpStatus; ruleKey?: string } = {}) => {
    setLoading(true);
    const nextStatus = overrides.status ?? status;
    const nextRuleKey = overrides.ruleKey ?? ruleKey;
    const queue = await api.listFollowUps({ status: nextStatus, ruleKey: nextRuleKey, limit: 50 });
    setFollowUps(queue);
    setLoading(false);
  };

  useEffect(() => {
    void refresh();
  }, [status, ruleKey]);

  const updateStatus = (nextStatus?: FollowUpStatus) => setStatus(nextStatus);
  const updateRuleKey = (nextRuleKey?: string) => setRuleKey(nextRuleKey);

  const runRules = async () => {
    const result = await api.runFollowUpRules();
    setLastRun(result);
    await refresh();
    return result;
  };

  const skip = async (id: string, reason?: string) => {
    await api.skipFollowUp(id, reason);
    await refresh();
  };

  const markSent = async (id: string) => {
    await api.markFollowUpSent(id);
    await refresh();
  };

  const markFailed = async (id: string, error: string) => {
    await api.markFollowUpFailed(id, error);
    await refresh();
  };

  const counts = followUps.reduce(
    (acc, item) => {
      acc.total += 1;
      acc.byStatus[item.status] = (acc.byStatus[item.status] ?? 0) + 1;
      acc.byRule[item.ruleKey] = (acc.byRule[item.ruleKey] ?? 0) + 1;
      return acc;
    },
    { total: 0, byStatus: {} as Record<FollowUpStatus, number>, byRule: {} as Record<string, number> },
  );

  return { followUps, counts, status, ruleKey, loading, lastRun, refresh, runRules, skip, markSent, markFailed, setStatus: updateStatus, setRuleKey: updateRuleKey };
}

export function useAutomations() {
  const [automations, setAutomations] = useState<AutomationRule[]>([]);
  const [lastRun, setLastRun] = useState<AutomationRun | null>(null);
  const [n8nWorkflows, setN8nWorkflows] = useState<N8nWorkflow[]>([]);
  const [n8nMessage, setN8nMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [togglingWorkflowId, setTogglingWorkflowId] = useState<string | null>(null);

  const [refreshing, setRefreshing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const refreshAutomations = async (options: { silent?: boolean } = {}) => {
    if (!options.silent) setRefreshing(true);
    const [automationResult, workflowResult] = await Promise.allSettled([api.listAutomations(), api.listN8nWorkflows()]);
    if (automationResult.status === 'fulfilled') setAutomations(automationResult.value);
    else setError(automationResult.reason instanceof Error ? automationResult.reason.message : 'Erro ao carregar automações');
    if (workflowResult.status === 'fulfilled') {
      setN8nWorkflows(workflowResult.value);
      setLastSyncedAt(new Date().toISOString());
      setError(null);
    } else {
      setError('Fluxos integrados indisponíveis no momento; regras internas carregadas.');
    }
    if (!options.silent) setRefreshing(false);
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
        await refreshAutomations({ silent: true });
      if (!cancelled) setLoading(false);
    };
    void load();
    const interval = window.setInterval(() => { void refreshAutomations({ silent: true }); }, 60000);
    const onFocus = () => { void refreshAutomations({ silent: true }); };
    window.addEventListener('focus', onFocus);
    return () => { cancelled = true; window.clearInterval(interval); window.removeEventListener('focus', onFocus); };
  }, []);

  const runAutomation = async (id: string) => {
    const run = await api.runAutomation(id, { reason: 'crm-ui-validation' });
    setLastRun(run);
    setAutomations(prev => prev.map(rule => rule.id === id ? { ...rule, lastRunAt: run.finishedAt ?? run.startedAt } : rule));
    return run;
  };

  const toggleN8nWorkflow = async (id: string, active: boolean): Promise<N8nWorkflowToggleResult> => {
    setTogglingWorkflowId(id);
    try {
      const result = await api.setN8nWorkflowActive(id, active);
      setN8nMessage(result.message);
      setN8nWorkflows(prev => prev.map(workflow => workflow.id === id ? result.workflow : workflow));
      return result;
    } finally {
      setTogglingWorkflowId(null);
    }
  };

  return { automations, n8nWorkflows, loading, error, runAutomation, lastRun, toggleN8nWorkflow, togglingWorkflowId, n8nMessage, refreshAutomations, refreshing, lastSyncedAt };
}

export function useWebhooks() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.listWebhooks(), api.listWebhookDeliveries()]).then(([webhookData, deliveryData]) => {
      setWebhooks(webhookData);
      setDeliveries(deliveryData);
      setLoading(false);
    });
  }, []);

  const testWebhook = async (id: string): Promise<WebhookTestResult> => {
    const result = await api.testWebhook(id);
    setDeliveries(prev => [result.delivery, ...prev]);
    setWebhooks(prev => prev.map(webhook => webhook.id === id ? { ...webhook, lastDeliveryAt: result.delivery.createdAt } : webhook));
    return result;
  };

  return { webhooks, deliveries, loading, testWebhook };
}

export function useProposals() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [templates, setTemplates] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const [proposalData, templateData] = await Promise.all([
        api.listProposals(),
        api.listTemplates().catch(() => []),
      ]);
      setProposals(proposalData);
      setTemplates(templateData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar propostas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const createProposal = async (payload: CreateProposalPayload) => {
    const fresh = await api.createProposal(payload);
    setProposals(prev => [fresh, ...prev]);
    if (fresh.isTemplate) setTemplates(prev => [fresh, ...prev]);
    return fresh;
  };

  return { proposals, templates, loading, error, refresh, createProposal };
}

export function useLeadTrackingEvents(id: string | undefined) {
  const [events, setEvents] = useState<TrackingEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    api.listTrackingEventsForLead(id).then(data => {
      setEvents(data);
      setLoading(false);
    });
  }, [id]);

  return { events, loading };
}

export function useAdsOverview() {
  const [overview, setOverview] = useState<AdsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const data = await api.getAdsOverview();
      setOverview(data);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar mídia paga');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
        try {
        const data = await api.getAdsOverview();
        if (!cancelled) {
          setOverview(data);
          setError(null);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erro ao carregar mídia paga');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const syncMetaAds = async () => {
    setSyncing(true);
    setError(null);
    setSyncMessage(null);
    try {
      const { result, overview } = await api.syncMetaAds();
      setOverview(overview);
      setSyncMessage(`Meta sincronizado: ${result.campaigns} campanhas, ${result.adSets} conjuntos, ${result.ads} anúncios.`);
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao sincronizar Meta Ads';
      setError(message);
      throw err;
    } finally {
      setSyncing(false);
    }
  };

  return { overview, loading, syncing, error, syncMessage, refresh, syncMetaAds };
}

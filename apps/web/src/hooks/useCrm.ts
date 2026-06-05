import { useState, useEffect } from 'react';
import { api, type UpdateLeadPayload } from '../lib/api/crmApi';
import { Lead, LeadStage, Task, DashboardMetrics, AutomationRule, AutomationRun, N8nWorkflow, N8nWorkflowToggleResult, Webhook, WebhookDelivery, WebhookTestResult, Activity, Proposal, CreateProposalPayload, TrackingEvent, AdsOverview, CrmAnalyticsOverview, LeadHistoryEntry } from '../lib/api/types';

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

  const updateStage = async (id: string, stage: LeadStage, options?: { notes?: string; lostReason?: string }) => {
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.resolve()
      .then(() => {
            return Promise.all([
          api.getLead(id),
          api.listActivities(id),
          api.listTasksForLead(id),
          api.listLeadHistory(id)
        ]);
      })
      .then(([l, a, t, h]) => {
        setLead(l);
        setActivities(a);
        setTasks(t);
        setHistory(h);
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

  const updateLead = async (payload: UpdateLeadPayload) => {
    if (!id) return undefined;
    const updated = await api.updateLead(id, payload);
    setLead(updated);
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

  return { lead, activities, tasks, history, loading, addActivity, addTask, completeTask, updateLead, deleteLead, setTags };
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

export function useDashboardMetrics() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listDashboardMetrics().then(data => {
      setMetrics(data);
      setLoading(false);
    });
  }, []);

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listProposals().then(data => {
      setProposals(data);
      setLoading(false);
    });
  }, []);

  const createProposal = async (payload: CreateProposalPayload) => {
    const fresh = await api.createProposal(payload);
    setProposals(prev => [fresh, ...prev]);
    return fresh;
  };

  return { proposals, loading, createProposal };
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

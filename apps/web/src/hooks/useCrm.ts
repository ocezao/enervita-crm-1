import { useState, useEffect } from 'react';
import { api } from '../lib/api/crmApi';
import { Lead, LeadStage, Task, DashboardMetrics, AutomationRule, AutomationRun, Webhook, WebhookDelivery, WebhookTestResult, Activity, Proposal, CreateProposalPayload, TrackingEvent } from '../lib/api/types';

export function useLeads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listLeads().then(data => {
      setLeads(data);
      setLoading(false);
    });
  }, []);

  const updateStage = async (id: string, stage: LeadStage, options?: { notes?: string; lostReason?: string }) => {
    const updated = await api.updateLeadStage(id, stage, options);
    setLeads(prev => prev.map(l => l.id === id ? updated : l));
    return updated;
  };

  return { leads, loading, updateStage };
}

export function useLeadDetail(id: string | undefined) {
  const [lead, setLead] = useState<Lead | undefined>();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.resolve()
      .then(() => {
        setLoading(true);
        return Promise.all([
          api.getLead(id),
          api.listActivities(id),
          api.listTasksForLead(id)
        ]);
      })
      .then(([l, a, t]) => {
        setLead(l);
        setActivities(a);
        setTasks(t);
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

  return { lead, activities, tasks, loading, addActivity, addTask, completeTask };
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

  const completeTask = async (id: string) => {
    const updated = await api.completeTask(id);
    setTasks(prev => prev.map(t => t.id === id ? updated : t));
    return updated;
  };

  return { tasks, loading, completeTask };
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

export function useAutomations() {
  const [automations, setAutomations] = useState<AutomationRule[]>([]);
  const [lastRun, setLastRun] = useState<AutomationRun | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listAutomations().then(data => {
      setAutomations(data);
      setLoading(false);
    });
  }, []);

  const runAutomation = async (id: string) => {
    const run = await api.runAutomation(id, { reason: 'homologacao-controlada-ui' });
    setLastRun(run);
    setAutomations(prev => prev.map(rule => rule.id === id ? { ...rule, lastRunAt: run.finishedAt ?? run.startedAt } : rule));
    return run;
  };

  return { automations, loading, runAutomation, lastRun };
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

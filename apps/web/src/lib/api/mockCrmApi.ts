import { CrmApi } from './crmApi';
import { 
  Lead, 
  Task, 
  Activity, 
  AutomationRule, 
  Webhook, 
  DashboardMetrics,
  LeadStage
} from './types';
import { 
  mockLeads, 
  mockTasks, 
  mockActivities, 
  mockAutomations, 
  mockWebhooks 
} from '../../data/mockData';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export class MockCrmApi implements CrmApi {
  async listLeads(): Promise<Lead[]> {
    await delay(500);
    return [...mockLeads];
  }

  async getLead(id: string): Promise<Lead | undefined> {
    await delay(300);
    return mockLeads.find(l => l.id === id);
  }

  async updateLeadStage(id: string, stage: LeadStage): Promise<Lead> {
    await delay(400);
    const lead = mockLeads.find(l => l.id === id);
    if (!lead) throw new Error('Lead not found');
    lead.stage = stage;
    lead.updatedAt = new Date().toISOString();
    return { ...lead };
  }

  async listTasks(): Promise<Task[]> {
    await delay(400);
    return [...mockTasks];
  }

  async createTask(payload: Partial<Task>): Promise<Task> {
    await delay(300);
    const newTask: Task = {
      id: Math.random().toString(36).substr(2, 9),
      leadId: payload.leadId || '',
      title: payload.title || 'Nova Tarefa',
      status: 'pendente',
      priority: payload.priority || 'media',
      owner: payload.owner || 'Usuário',
      dueDate: payload.dueDate || new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      leadName: payload.leadName
    };
    mockTasks.push(newTask);
    return newTask;
  }

  async completeTask(id: string): Promise<Task> {
    await delay(300);
    const task = mockTasks.find(t => t.id === id);
    if (!task) throw new Error('Task not found');
    task.status = 'concluido';
    task.updatedAt = new Date().toISOString();
    return { ...task };
  }

  async listActivities(leadId: string): Promise<Activity[]> {
    await delay(300);
    return mockActivities.filter(a => a.leadId === leadId);
  }

  async createActivity(payload: Partial<Activity>): Promise<Activity> {
    await delay(300);
    const newActivity: Activity = {
      id: Math.random().toString(36).substr(2, 9),
      leadId: payload.leadId || '',
      contactId: payload.contactId || '',
      activityType: payload.activityType || 'note',
      outcome: payload.outcome || '',
      occurredAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      notes: payload.notes
    };
    mockActivities.push(newActivity);
    return newActivity;
  }

  async listDashboardMetrics(): Promise<DashboardMetrics> {
    await delay(600);
    return {
      newLeadsToday: 3,
      leadsWithoutFollowup: 2,
      overdueTasks: 1,
      openProposals: 4,
      leadsBySource: [
        { source: 'Meta Ads', count: 12 },
        { source: 'Google Ads', count: 8 },
        { source: 'Indicação', count: 5 },
        { source: 'Orgânico', count: 7 },
      ],
      leadsByStage: [
        { stage: 'novo_lead', count: 10 },
        { stage: 'qualificacao', count: 5 },
        { stage: 'atendimento_iniciado', count: 8 },
        { stage: 'proposta_enviada', count: 4 },
        { stage: 'contrato_enervita', count: 2 },
      ],
      conversionsByPlatform: [
        { platform: 'Meta CAPI', count: 45 },
        { platform: 'GA4', count: 32 },
        { platform: 'Google Ads', count: 18 },
      ],
      recentEvents: mockActivities.slice(0, 5)
    };
  }

  async listAutomations(): Promise<AutomationRule[]> {
    await delay(400);
    return [...mockAutomations];
  }

  async listWebhooks(): Promise<Webhook[]> {
    await delay(400);
    return [...mockWebhooks];
  }

  async testWebhook(): Promise<{ success: boolean; message: string }> {
    await delay(1000);
    return { success: true, message: 'Webhook entregue com sucesso (Mock)' };
  }
}

export const api = new MockCrmApi();

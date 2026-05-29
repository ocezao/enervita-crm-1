import { 
  Lead, 
  Task, 
  Activity, 
  AutomationRule, 
  Webhook, 
  DashboardMetrics,
  LeadStage
} from './types';

export interface CrmApi {
  listLeads(): Promise<Lead[]>;
  getLead(id: string): Promise<Lead | undefined>;
  updateLeadStage(id: string, stage: LeadStage): Promise<Lead>;
  
  listTasks(): Promise<Task[]>;
  createTask(payload: Partial<Task>): Promise<Task>;
  completeTask(id: string): Promise<Task>;
  
  listActivities(leadId: string): Promise<Activity[]>;
  createActivity(payload: Partial<Activity>): Promise<Activity>;
  
  listDashboardMetrics(): Promise<DashboardMetrics>;
  
  listAutomations(): Promise<AutomationRule[]>;
  
  listWebhooks(): Promise<Webhook[]>;
  testWebhook(id: string): Promise<{ success: boolean; message: string }>;
}

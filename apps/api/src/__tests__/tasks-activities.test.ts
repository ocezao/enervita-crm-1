import assert from 'node:assert/strict';
import { test } from 'node:test';
import bcrypt from 'bcryptjs';
import { createApp } from '../app.ts';
import type { AuthUser, UserRepository } from '../modules/auth/userRepository.ts';
import type { EngagementRepository, Task, Activity } from '../modules/engagement/repository.ts';
import type { Notification, NotificationsRepository, CreateNotificationInput } from '../modules/notifications/repository.ts';

const SESSION_SECRET = 'test-secret-with-enough-characters';
const TENANT_ID = '22222222-2222-4222-8222-222222222222';
const LEAD_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CONTACT_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

type TestUser = AuthUser & { status: 'active' | 'inactive' };

function makeAuthUser(overrides: Partial<TestUser> = {}): TestUser {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    tenantId: TENANT_ID,
    name: 'Admin Enervita',
    email: 'admin@enervita.com.br',
    passwordHash: bcrypt.hashSync('SenhaSegura123!', 4),
    status: 'active',
    roles: ['admin'],
    permissions: [],
    allowedStages: [],
    ...overrides,
  };
}

function makeUserRepository(user: TestUser | null): UserRepository {
  return {
    async findActiveUserByEmail(email: string) {
      return user && user.status === 'active' && user.email.toLowerCase() === email.toLowerCase() ? user : null;
    },
    async findActiveUserById(id: string) {
      return user && user.status === 'active' && user.id === id ? user : null;
    },
    async recordLogin() {},
  };
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    tenantId: TENANT_ID,
    leadId: LEAD_ID,
    title: 'Ligar para lead',
    description: null,
    status: 'pendente',
    priority: 'alta',
    ownerId: '11111111-1111-4111-8111-111111111111',
    ownerName: 'Admin Enervita',
    dueDate: '2026-05-30T12:00:00.000Z',
    notes: null,
    completedAt: null,
    createdAt: '2026-05-29T10:00:00.000Z',
    updatedAt: '2026-05-29T10:00:00.000Z',
    leadName: 'Lead Teste',
    leadStage: 'novo_lead',
    ...overrides,
  };
}

function makeActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    tenantId: TENANT_ID,
    leadId: LEAD_ID,
    contactId: CONTACT_ID,
    userId: null,
    activityType: 'note',
    outcome: 'Primeiro contato registrado',
    responseTimeSeconds: null,
    notes: 'Cliente pediu retorno amanhã',
    occurredAt: '2026-05-29T11:00:00.000Z',
    createdAt: '2026-05-29T11:00:00.000Z',
    leadStage: 'novo_lead',
    ...overrides,
  };
}

function makeEngagementRepository(): EngagementRepository {
  const tasks = [makeTask()];
  const activities = [makeActivity()];
  return {
    async listTasks(tenantId, allowedStages) {
      return tasks.filter((task) => task.tenantId === tenantId && (allowedStages === null || !task.leadStage || allowedStages.includes(task.leadStage)));
    },
    async listTasksForLead(tenantId, leadId, allowedStages) {
      const visible = tasks.filter((task) => task.tenantId === tenantId && task.leadId === leadId && (allowedStages === null || !task.leadStage || allowedStages.includes(task.leadStage)));
      return visible.length > 0 ? visible : null;
    },
    async createTask(context, input) {
      const task = makeTask({ id: 'ffffffff-ffff-4fff-8fff-ffffffffffff', tenantId: context.tenantId, leadId: input.leadId ?? null, title: input.title, priority: input.priority ?? 'media', dueDate: input.dueDate ?? null, notes: input.notes ?? null });
      tasks.unshift(task);
      return task;
    },
    async completeTask(context, taskId, allowedStages) {
      const task = tasks.find((item) => item.id === taskId && item.tenantId === context.tenantId && (allowedStages === null || !item.leadStage || allowedStages.includes(item.leadStage)));
      if (!task) return null;
      task.status = 'concluido';
      task.completedAt = '2026-05-29T12:00:00.000Z';
      return task;
    },
    async listActivities(tenantId, leadId, allowedStages) {
      return activities.filter((activity) => activity.tenantId === tenantId && activity.leadId === leadId && (allowedStages === null || !activity.leadStage || allowedStages.includes(activity.leadStage)));
    },
    async createActivity(context, input, allowedStages) {
      if (allowedStages !== null && input.leadId === LEAD_ID && !allowedStages.includes('novo_lead')) return null;
      const activity = makeActivity({ id: '99999999-9999-4999-8999-999999999999', tenantId: context.tenantId, leadId: input.leadId, activityType: input.activityType, outcome: input.outcome, notes: input.notes ?? null, userId: context.actorUserId });
      activities.unshift(activity);
      return activity;
    },
  };
}

function makeNotificationsRepository(seed: Notification[] = []): NotificationsRepository & { created: CreateNotificationInput[] } {
  const notifications = [...seed];
  const created: CreateNotificationInput[] = [];
  return {
    created,
    async create(input) {
      created.push(input);
      const notification: Notification = {
        id: 'abababab-abab-4bab-8bab-abababababab',
        tenantId: input.tenantId,
        userId: input.userId,
        taskId: input.taskId ?? null,
        leadId: input.leadId ?? null,
        type: input.type,
        severity: input.severity ?? 'info',
        title: input.title,
        body: input.body ?? null,
        href: input.href ?? null,
        metadata: input.metadata ?? {},
        readAt: null,
        createdAt: '2026-05-29T12:00:00.000Z',
      };
      notifications.unshift(notification);
      return notification;
    },
    async listForUser(tenantId, userId) {
      const items = notifications.filter((item) => item.tenantId === tenantId && item.userId === userId);
      return { notifications: items, unreadCount: items.filter((item) => item.readAt === null).length };
    },
    async markAsRead(tenantId, userId, id) {
      const notification = notifications.find((item) => item.tenantId === tenantId && item.userId === userId && item.id === id) ?? null;
      if (notification) notification.readAt = '2026-05-29T12:05:00.000Z';
      return notification;
    },
    async markAllAsRead(tenantId, userId) {
      let updated = 0;
      for (const notification of notifications) {
        if (notification.tenantId === tenantId && notification.userId === userId && notification.readAt === null) {
          notification.readAt = '2026-05-29T12:05:00.000Z';
          updated += 1;
        }
      }
      return updated;
    },
  };
}

async function loginAndGetCookie(app: ReturnType<typeof createApp>): Promise<string> {
  const login = await app.inject({ method: 'POST', url: '/api/auth/login', headers: { 'content-type': 'application/json' }, payload: { email: 'admin@enervita.com.br', password: 'SenhaSegura123!' } });
  assert.equal(login.statusCode, 200);
  return String(login.headers['set-cookie']).split(';')[0];
}

test('GET /api/notifications returns current user notifications', async (t) => {
  const actor = makeAuthUser();
  const notificationsRepository = makeNotificationsRepository([
    { id: 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd', tenantId: TENANT_ID, userId: actor.id, taskId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', leadId: LEAD_ID, type: 'task_assigned', severity: 'warning', title: 'Nova tarefa atribuída', body: 'Enviar proposta — Maria Silva', href: `/leads/${LEAD_ID}`, metadata: {}, readAt: null, createdAt: '2026-05-29T12:00:00.000Z' },
  ]);
  const app = createApp({ userRepository: makeUserRepository(actor), engagementRepository: makeEngagementRepository(), notificationsRepository, sessionSecret: SESSION_SECRET });
  t.after(async () => app.close());
  const cookie = await loginAndGetCookie(app);

  const response = await app.inject({ method: 'GET', url: '/api/notifications', headers: { cookie } });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().unreadCount, 1);
  assert.equal(response.json().notifications[0].type, 'task_assigned');
});

test('POST /api/notifications/:id/read marks current user notification as read', async (t) => {
  const actor = makeAuthUser();
  const notificationId = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd';
  const notificationsRepository = makeNotificationsRepository([
    { id: notificationId, tenantId: TENANT_ID, userId: actor.id, taskId: null, leadId: null, type: 'task_assigned', severity: 'info', title: 'Nova tarefa atribuída', body: null, href: null, metadata: {}, readAt: null, createdAt: '2026-05-29T12:00:00.000Z' },
  ]);
  const app = createApp({ userRepository: makeUserRepository(actor), engagementRepository: makeEngagementRepository(), notificationsRepository, sessionSecret: SESSION_SECRET });
  t.after(async () => app.close());
  const cookie = await loginAndGetCookie(app);

  const response = await app.inject({ method: 'POST', url: `/api/notifications/${notificationId}/read`, headers: { cookie } });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().notification.readAt, '2026-05-29T12:05:00.000Z');
});

test('POST /api/notifications/read-all marks all current user notifications as read', async (t) => {
  const actor = makeAuthUser();
  const otherUserId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  const notificationsRepository = makeNotificationsRepository([
    { id: '11111111-1111-4111-8111-111111111111', tenantId: TENANT_ID, userId: actor.id, taskId: null, leadId: null, type: 'task_assigned', severity: 'info', title: 'Primeira', body: null, href: null, metadata: {}, readAt: null, createdAt: '2026-05-29T12:00:00.000Z' },
    { id: '22222222-2222-4222-8222-222222222222', tenantId: TENANT_ID, userId: actor.id, taskId: null, leadId: null, type: 'task_assigned', severity: 'warning', title: 'Segunda', body: null, href: null, metadata: {}, readAt: null, createdAt: '2026-05-29T12:01:00.000Z' },
    { id: '33333333-3333-4333-8333-333333333333', tenantId: TENANT_ID, userId: otherUserId, taskId: null, leadId: null, type: 'task_assigned', severity: 'warning', title: 'Outro usuário', body: null, href: null, metadata: {}, readAt: null, createdAt: '2026-05-29T12:02:00.000Z' },
  ]);
  const app = createApp({ userRepository: makeUserRepository(actor), engagementRepository: makeEngagementRepository(), notificationsRepository, sessionSecret: SESSION_SECRET });
  t.after(async () => app.close());
  const cookie = await loginAndGetCookie(app);

  const response = await app.inject({ method: 'POST', url: '/api/notifications/read-all', headers: { cookie } });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().count, 2);

  const list = await app.inject({ method: 'GET', url: '/api/notifications', headers: { cookie } });
  assert.equal(list.statusCode, 200);
  assert.equal(list.json().unreadCount, 0);
});

test('GET /api/tasks lists tasks for authenticated users with page.tasks', async (t) => {
  const actor = makeAuthUser({ roles: ['sdr'], permissions: ['page.tasks'], allowedStages: ['novo_lead'] });
  const app = createApp({ userRepository: makeUserRepository(actor), engagementRepository: makeEngagementRepository(), sessionSecret: SESSION_SECRET });
  t.after(async () => app.close());
  const cookie = await loginAndGetCookie(app);

  const response = await app.inject({ method: 'GET', url: '/api/tasks', headers: { cookie } });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().tasks[0].title, 'Ligar para lead');
});

test('POST /api/tasks requires task.create and creates a task', async (t) => {
  const actor = makeAuthUser({ roles: ['sdr'], permissions: ['task.create'], allowedStages: ['novo_lead'] });
  const app = createApp({ userRepository: makeUserRepository(actor), engagementRepository: makeEngagementRepository(), sessionSecret: SESSION_SECRET });
  t.after(async () => app.close());
  const cookie = await loginAndGetCookie(app);

  const response = await app.inject({ method: 'POST', url: '/api/tasks', headers: { cookie, 'content-type': 'application/json' }, payload: { leadId: LEAD_ID, title: 'Enviar proposta', priority: 'alta', dueDate: '2026-05-31T10:00:00.000Z' } });

  assert.equal(response.statusCode, 201);
  assert.equal(response.json().task.title, 'Enviar proposta');
});

test('PATCH /api/tasks/:id/complete requires task.complete and completes the task', async (t) => {
  const actor = makeAuthUser({ roles: ['sdr'], permissions: ['task.complete'], allowedStages: ['novo_lead'] });
  const app = createApp({ userRepository: makeUserRepository(actor), engagementRepository: makeEngagementRepository(), sessionSecret: SESSION_SECRET });
  t.after(async () => app.close());
  const cookie = await loginAndGetCookie(app);

  const response = await app.inject({ method: 'PATCH', url: '/api/tasks/dddddddd-dddd-4ddd-8ddd-dddddddddddd/complete', headers: { cookie } });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().task.status, 'concluido');
});

test('GET /api/leads/:id/activities lists timeline activities', async (t) => {
  const actor = makeAuthUser({ roles: ['sdr'], permissions: ['lead.view'], allowedStages: ['novo_lead'] });
  const app = createApp({ userRepository: makeUserRepository(actor), engagementRepository: makeEngagementRepository(), sessionSecret: SESSION_SECRET });
  t.after(async () => app.close());
  const cookie = await loginAndGetCookie(app);

  const response = await app.inject({ method: 'GET', url: `/api/leads/${LEAD_ID}/activities`, headers: { cookie } });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().activities[0].outcome, 'Primeiro contato registrado');
});

test('POST /api/leads/:id/activities requires activity.create and records an activity', async (t) => {
  const actor = makeAuthUser({ roles: ['sdr'], permissions: ['activity.create'], allowedStages: ['novo_lead'] });
  const app = createApp({ userRepository: makeUserRepository(actor), engagementRepository: makeEngagementRepository(), sessionSecret: SESSION_SECRET });
  t.after(async () => app.close());
  const cookie = await loginAndGetCookie(app);

  const response = await app.inject({ method: 'POST', url: `/api/leads/${LEAD_ID}/activities`, headers: { cookie, 'content-type': 'application/json' }, payload: { activityType: 'whatsapp', outcome: 'Cliente respondeu no WhatsApp', notes: 'Pediu simulação' } });

  assert.equal(response.statusCode, 201);
  assert.equal(response.json().activity.activityType, 'whatsapp');
});



test('GET /api/leads/:id/tasks lists historical tasks for a visible lead', async (t) => {
  const actor = makeAuthUser({ roles: ['sdr'], permissions: ['lead.view'], allowedStages: ['novo_lead'] });
  const app = createApp({ userRepository: makeUserRepository(actor), engagementRepository: makeEngagementRepository(), sessionSecret: SESSION_SECRET });
  t.after(async () => app.close());
  const cookie = await loginAndGetCookie(app);

  const response = await app.inject({ method: 'GET', url: `/api/leads/${LEAD_ID}/tasks`, headers: { cookie } });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().tasks[0].title, 'Ligar para lead');
});

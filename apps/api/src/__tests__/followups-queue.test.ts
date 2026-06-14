import test from 'node:test';
import assert from 'node:assert/strict';
import { createStaticFollowUpsRepository } from '../modules/followups/repository.ts';

test('follow-up queue createPending is idempotent by tenant and key', async () => {
  const repository = createStaticFollowUpsRepository();
  const input = {
    tenantId: 'tenant-1',
    leadId: 'lead-1',
    ruleKey: 'lead_without_next_action',
    reason: 'Lead sem próxima ação',
    idempotencyKey: 'lead_without_next_action:lead-1:2026-06-13',
    metadata: { updatedAt: '2026-06-01T00:00:00.000Z' },
  };

  const first = await repository.createPending(input);
  const second = await repository.createPending(input);
  const queue = await repository.listQueue('tenant-1', { status: 'pending' });

  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(first.item.id, second.item.id);
  assert.equal(queue.length, 1);
  assert.equal(queue[0].ruleKey, 'lead_without_next_action');
});

test('follow-up queue status transitions only process pending items', async () => {
  const repository = createStaticFollowUpsRepository();
  const created = await repository.createPending({
    tenantId: 'tenant-1',
    leadId: 'lead-1',
    ruleKey: 'task_overdue',
    reason: 'Tarefa vencida',
    idempotencyKey: 'task_overdue:lead-1:2026-06-13',
  });

  const sent = await repository.markSent('tenant-1', created.item.id);
  const skippedAfterSent = await repository.markSkipped('tenant-1', created.item.id, 'Tratado manualmente');

  assert.equal(sent?.status, 'sent');
  assert.equal(sent?.attempts, 1);
  assert.equal(skippedAfterSent, null);
});

test('follow-up queue can mark pending item as failed', async () => {
  const repository = createStaticFollowUpsRepository();
  const created = await repository.createPending({
    tenantId: 'tenant-1',
    leadId: 'lead-1',
    ruleKey: 'proposal_no_response',
    reason: 'Proposta sem resposta',
    idempotencyKey: 'proposal_no_response:lead-1:2026-06-13',
  });

  const failed = await repository.markFailed('tenant-1', created.item.id, 'Falha controlada');

  assert.equal(failed?.status, 'failed');
  assert.equal(failed?.attempts, 1);
  assert.equal(failed?.lastError, 'Falha controlada');
});

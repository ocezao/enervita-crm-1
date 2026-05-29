import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ACTION_PERMISSION_KEYS,
  PAGE_PERMISSION_KEYS,
  PIPELINE_STAGE_KEYS,
  PERMISSION_DEFINITIONS,
  PIPELINE_STAGE_DEFINITIONS,
  type PipelineStageKey,
} from './index.ts';

const expectedPagePermissions = [
  'page.dashboard',
  'page.leads',
  'page.pipeline',
  'page.lead_detail',
  'page.tasks',
  'page.automations',
  'page.webhooks',
  'page.analytics',
  'page.settings',
  'page.users',
] as const;

const expectedActionPermissions = [
  'lead.view',
  'lead.create',
  'lead.edit',
  'lead.archive',
  'lead.stage_change',
  'lead.mark_lost',
  'task.create',
  'task.complete',
  'task.reschedule',
  'activity.create',
  'csv.export',
  'tracking.view',
  'analytics.view',
  'automation.manage',
  'webhook.test',
  'webhook.manage',
  'settings.manage',
  'user.manage',
] as const;

const expectedStages: PipelineStageKey[] = [
  'novo_lead',
  'qualificacao',
  'atendimento_iniciado',
  'conta_recebida',
  'diagnostico',
  'proposta_enviada',
  'contrato_enervita',
  'perdido',
];

describe('catálogo compartilhado de permissões e etapas', () => {
  it('não contém chaves de permissão duplicadas', () => {
    const keys = PERMISSION_DEFINITIONS.map((permission) => permission.key);
    assert.equal(new Set(keys).size, keys.length);
  });

  it('define label e categoria para todas as permissões', () => {
    for (const permission of PERMISSION_DEFINITIONS) {
      assert.ok(permission.label, `missing label for ${permission.key}`);
      assert.ok(permission.category, `missing category for ${permission.key}`);
    }
  });

  it('mantém as chaves de permissões alinhadas ao contrato', () => {
    assert.deepEqual(PAGE_PERMISSION_KEYS, expectedPagePermissions);
    assert.deepEqual(ACTION_PERMISSION_KEYS, expectedActionPermissions);
  });

  it('inclui permissões administrativas essenciais', () => {
    assert.ok(PERMISSION_DEFINITIONS.some((permission) => permission.key === 'user.manage'));
    assert.ok(PAGE_PERMISSION_KEYS.includes('page.users'));
  });

  it('mantém as etapas do funil alinhadas ao contrato', () => {
    assert.deepEqual(PIPELINE_STAGE_KEYS, expectedStages);
    assert.deepEqual(
      PIPELINE_STAGE_DEFINITIONS.map((stage) => stage.key),
      expectedStages,
    );
  });
});

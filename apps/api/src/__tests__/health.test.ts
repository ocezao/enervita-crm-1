import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApp } from '../app.ts';

test('GET /health returns ok', async (t) => {
  const app = createApp();
  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({ method: 'GET', url: '/health' });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { ok: true });
});

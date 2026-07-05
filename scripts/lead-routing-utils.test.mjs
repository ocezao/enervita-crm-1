import assert from 'node:assert/strict';
import { test } from 'node:test';
import { detectLeadRoutingServiceKey, normalizeRoutingText } from './lead-routing-utils.mjs';

const services = [
  { key: 'assinatura', label: 'Assinatura', keywords: ['assinatura', 'solar por assinatura'] },
  { key: 'solar_proprio', label: 'Sistema proprio / painel solar', keywords: ['painel', 'energia solar'] },
  { key: 'usina', label: 'Usina solar', keywords: ['usina'] },
];

test('normalizes case, accents and punctuation', () => {
  assert.equal(normalizeRoutingText('  Indicação / ASSINATURA!  '), 'indicacao assinatura');
});

test('detects assinatura in adset/tracking text', () => {
  assert.equal(detectLeadRoutingServiceKey(services, { adsetName: 'B2B - Energia por ASSINATURA' }), 'assinatura');
});

test('detects solar painel aliases', () => {
  assert.equal(detectLeadRoutingServiceKey(services, { utmTerm: 'Painel Solar Residencial' }), 'solar_proprio');
});

test('detects service from relevant form fields', () => {
  assert.equal(detectLeadRoutingServiceKey(services, {}, { servico_de_interesse: 'Investimento em usina' }), 'usina');
});

test('returns null when no service is identified', () => {
  assert.equal(detectLeadRoutingServiceKey(services, { campaignName: 'Remarketing institucional' }), null);
});

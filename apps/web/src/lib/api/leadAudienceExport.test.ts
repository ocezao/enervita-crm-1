import { describe, expect, it } from 'vitest';
import { buildGoogleAudienceCsv, buildMetaAudienceCsv } from './leadAudienceExport';
import type { Lead } from './types';

const baseLead: Lead = {
  id: 'lead-1',
  contactId: 'contact-1',
  stage: 'novo_lead',
  qualificationStatus: 'qualificado',
  leadSource: 'site',
  estimatedTicket: 1000,
  sdrOwner: 'SDR',
  createdAt: '2026-05-29T00:00:00.000Z',
  updatedAt: '2026-05-29T00:00:00.000Z',
  energyBillValue: 1000,
  averageConsumptionKwh: 0,
  concessionaria: 'Elektro',
  offer: 'Enervita',
  projectedSavings: 200,
  priority: 'alta',
  contact: { id: 'contact-1', name: 'Maria Silva', email: 'MARIA@EXAMPLE.COM', phone: '(11) 99999-8888', company: 'Empresa', source: 'site', consent: true, createdAt: '2026-05-29T00:00:00.000Z' },
};

describe('lead audience exports', () => {
  it('builds Meta Ads customer list CSV with Meta schema-style headers', () => {
    const csv = buildMetaAudienceCsv([baseLead]);
    expect(csv.split('\n')[0]).toBe('"EMAIL","PHONE","FN","LN","COUNTRY","EXTERN_ID"');
    expect(csv).toContain('"maria@example.com","+5511999998888","maria","silva","br","contact-1"');
  });

  it('builds Google Ads Customer Match CSV with Google UI headers', () => {
    const csv = buildGoogleAudienceCsv([baseLead]);
    expect(csv.split('\n')[0]).toBe('"Email","Phone","First Name","Last Name","Country","Zip"');
    expect(csv).toContain('"maria@example.com","+5511999998888","maria","silva","BR",""');
  });
});

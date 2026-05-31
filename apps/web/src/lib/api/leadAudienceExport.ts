import type { Lead } from './types';

export type LeadExportFormat = 'crm' | 'meta_ads' | 'google_ads';

function csvEscape(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function toCsv(rows: unknown[][]) {
  return rows.map((row) => row.map(csvEscape).join(',')).join('\n');
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function splitName(name?: string) {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') };
}

function normalizePhone(phone?: string) {
  const digits = String(phone ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('55')) return `+${digits}`;
  if (digits.length >= 10) return `+55${digits}`;
  return digits;
}

function onlyAudienceReady(leads: Lead[]) {
  return leads.filter((lead) => lead.contact?.email || lead.contact?.phone);
}

export function buildCrmLeadsCsv(leads: Lead[]) {
  return toCsv([
    ['Nome', 'Empresa', 'Email', 'Telefone', 'Etapa', 'Prioridade', 'Conta', 'Origem', 'UTM Source', 'UTM Campaign'],
    ...leads.map((lead) => [lead.contact?.name ?? '', lead.contact?.company ?? '', lead.contact?.email ?? '', lead.contact?.phone ?? '', lead.stage, lead.priority, lead.energyBillValue || lead.estimatedTicket || '', lead.leadSource, lead.utmSource ?? '', lead.utmCampaign ?? '']),
  ]);
}

export function buildMetaAudienceCsv(leads: Lead[]) {
  return toCsv([
    ['EMAIL', 'PHONE', 'FN', 'LN', 'COUNTRY', 'EXTERN_ID'],
    ...onlyAudienceReady(leads).map((lead) => {
      const name = splitName(lead.contact?.name);
      return [lead.contact?.email?.trim().toLowerCase() ?? '', normalizePhone(lead.contact?.phone), name.firstName.toLowerCase(), name.lastName.toLowerCase(), 'br', lead.contactId || lead.id];
    }),
  ]);
}

export function buildGoogleAudienceCsv(leads: Lead[]) {
  return toCsv([
    ['Email', 'Phone', 'First Name', 'Last Name', 'Country', 'Zip'],
    ...onlyAudienceReady(leads).map((lead) => {
      const name = splitName(lead.contact?.name);
      return [lead.contact?.email?.trim().toLowerCase() ?? '', normalizePhone(lead.contact?.phone), name.firstName.toLowerCase(), name.lastName.toLowerCase(), 'BR', ''];
    }),
  ]);
}

export function exportLeadsForAudience(leads: Lead[], format: LeadExportFormat) {
  const stamp = new Date().toISOString().slice(0, 10);
  if (format === 'meta_ads') return downloadCsv(`meta-ads-publico-enervita-${stamp}.csv`, buildMetaAudienceCsv(leads));
  if (format === 'google_ads') return downloadCsv(`google-ads-customer-match-enervita-${stamp}.csv`, buildGoogleAudienceCsv(leads));
  return downloadCsv(`leads-enervita-crm-${stamp}.csv`, buildCrmLeadsCsv(leads));
}

export function countAudienceReadyLeads(leads: Lead[]) {
  return onlyAudienceReady(leads).length;
}

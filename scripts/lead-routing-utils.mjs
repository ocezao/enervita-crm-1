export function normalizeRoutingText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function collectFieldValues(fields) {
  if (!fields || typeof fields !== 'object') return [];
  return Object.entries(fields)
    .filter(([key]) => {
      const normalizedKey = normalizeRoutingText(key);
      return (
        normalizedKey.includes('interesse') ||
        normalizedKey.includes('servico') ||
        normalizedKey.includes('produto') ||
        normalizedKey.includes('solucao') ||
        normalizedKey.includes('adset') ||
        normalizedKey.includes('grupo') ||
        normalizedKey.includes('conjunto')
      );
    })
    .map(([, value]) => value);
}

export function routingTextCandidates(attribution = {}, fields = {}) {
  return [
    attribution.adsetName,
    attribution.utmTerm,
    attribution.formName,
    attribution.campaignName,
    attribution.adName,
    ...collectFieldValues(fields),
  ].filter((value) => typeof value === 'string' && value.trim());
}

export function detectLeadRoutingServiceKey(services, attribution = {}, fields = {}) {
  const haystack = normalizeRoutingText(routingTextCandidates(attribution, fields).join(' '));
  if (!haystack) return null;

  for (const service of services ?? []) {
    const rawKeywords = Array.isArray(service.keywords) ? service.keywords : [];
    const keywords = [service.key, service.label, ...rawKeywords]
      .map(normalizeRoutingText)
      .filter(Boolean);

    if (keywords.some((keyword) => haystack.includes(keyword))) {
      return service.key;
    }
  }

  return null;
}

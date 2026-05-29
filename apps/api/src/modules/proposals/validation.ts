export class ProposalValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProposalValidationError';
  }
}

export type ProposalInput = {
  leadId: string;
  title: string;
  monthlyBillValue: number;
  estimatedKwh?: number | null;
  discountPercentage: number;
  projectedMonthlySavings: number;
  projectedAnnualSavings: number;
  validUntil?: string | null;
  notes?: string | null;
};

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateUuid(value: unknown, field: string): string {
  if (typeof value !== 'string' || !uuidRe.test(value)) throw new ProposalValidationError(`${field} inválido`);
  return value;
}

function numberField(body: Record<string, unknown>, key: keyof ProposalInput): number {
  const value = body[key as string];
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new ProposalValidationError(`${String(key)} deve ser número positivo`);
  return value;
}

function optionalNumber(body: Record<string, unknown>, key: keyof ProposalInput): number | null | undefined {
  const value = body[key as string];
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new ProposalValidationError(`${String(key)} deve ser número positivo`);
  return value;
}

export function validateCreateProposalBody(body: unknown): ProposalInput {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ProposalValidationError('Payload inválido');
  const raw = body as Record<string, unknown>;
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  if (!title) throw new ProposalValidationError('title é obrigatório');
  return {
    leadId: validateUuid(raw.leadId, 'leadId'),
    title,
    monthlyBillValue: numberField(raw, 'monthlyBillValue'),
    estimatedKwh: optionalNumber(raw, 'estimatedKwh'),
    discountPercentage: numberField(raw, 'discountPercentage'),
    projectedMonthlySavings: numberField(raw, 'projectedMonthlySavings'),
    projectedAnnualSavings: numberField(raw, 'projectedAnnualSavings'),
    validUntil: typeof raw.validUntil === 'string' && raw.validUntil.trim() ? raw.validUntil : null,
    notes: typeof raw.notes === 'string' && raw.notes.trim() ? raw.notes.trim() : null,
  };
}

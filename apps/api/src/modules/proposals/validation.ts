export class ProposalValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProposalValidationError';
  }
}

export type ProposalSourceType = 'editor' | 'file';

export type ProposalImportedFileInput = {
  name: string;
  mimeType: string;
  size: number;
  dataBase64?: string | null;
};

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
  sourceType: ProposalSourceType;
  contentHtml?: string | null;
  contentText?: string | null;
  templateName?: string | null;
  isTemplate: boolean;
  importedFile?: ProposalImportedFileInput | null;
};

export type UpdateProposalInput = {
  title?: string;
  status?: string;
  monthlyBillValue?: number | null;
  estimatedKwh?: number | null;
  discountPercentage?: number | null;
  projectedMonthlySavings?: number | null;
  projectedAnnualSavings?: number | null;
  validUntil?: string | null;
  notes?: string | null;
  sourceType?: ProposalSourceType;
  contentHtml?: string | null;
  contentText?: string | null;
  templateName?: string | null;
  isTemplate?: boolean;
  importedFile?: ProposalImportedFileInput | null;
  leadId?: string;
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

function optionalText(body: Record<string, unknown>, key: string): string | null {
  const value = body[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function validateImportedFile(value: unknown): ProposalImportedFileInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ProposalValidationError('Arquivo da proposta é obrigatório');
  const file = value as Record<string, unknown>;
  const name = typeof file.name === 'string' ? file.name.trim() : '';
  const mimeType = typeof file.mimeType === 'string' ? file.mimeType.trim() : '';
  const size = file.size;
  const dataBase64 = typeof file.dataBase64 === 'string' && file.dataBase64.trim() ? file.dataBase64.trim() : null;
  if (!name) throw new ProposalValidationError('Nome do arquivo é obrigatório');
  if (!mimeType) throw new ProposalValidationError('Tipo do arquivo é obrigatório');
  if (typeof size !== 'number' || !Number.isFinite(size) || size <= 0) throw new ProposalValidationError('Tamanho do arquivo deve ser positivo');
  return { name, mimeType, size, dataBase64 };
}

export function validateCreateProposalBody(body: unknown): ProposalInput {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ProposalValidationError('Payload inválido');
  const raw = body as Record<string, unknown>;
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  if (!title) throw new ProposalValidationError('title é obrigatório');
  const sourceType = raw.sourceType === 'file' ? 'file' : 'editor';
  const contentHtml = optionalText(raw, 'contentHtml');
  const contentText = optionalText(raw, 'contentText');
  const importedFile = sourceType === 'file' ? validateImportedFile(raw.importedFile) : null;
  if (sourceType === 'editor' && !contentHtml && !contentText) throw new ProposalValidationError('Conteúdo da proposta é obrigatório');
  return {
    leadId: validateUuid(raw.leadId, 'leadId'),
    title,
    monthlyBillValue: numberField(raw, 'monthlyBillValue'),
    estimatedKwh: optionalNumber(raw, 'estimatedKwh'),
    discountPercentage: numberField(raw, 'discountPercentage'),
    projectedMonthlySavings: numberField(raw, 'projectedMonthlySavings'),
    projectedAnnualSavings: numberField(raw, 'projectedAnnualSavings'),
    validUntil: typeof raw.validUntil === 'string' && raw.validUntil.trim() ? raw.validUntil : null,
    notes: optionalText(raw, 'notes'),
    sourceType,
    contentHtml,
    contentText,
    templateName: optionalText(raw, 'templateName'),
    isTemplate: raw.isTemplate === true,
    importedFile,
  };
}

export function validateUpdateProposalBody(body: unknown): UpdateProposalInput {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ProposalValidationError('Payload inválido');
  const raw = body as Record<string, unknown>;
  const result: UpdateProposalInput = {};
  if (raw.title !== undefined) {
    const title = typeof raw.title === 'string' ? raw.title.trim() : '';
    if (!title) throw new ProposalValidationError('title não pode ser vazio');
    result.title = title;
  }
  if (raw.status !== undefined) {
    const validStatuses = ['draft', 'sent', 'accepted', 'lost', 'expired'];
    if (typeof raw.status !== 'string' || !validStatuses.includes(raw.status)) throw new ProposalValidationError('status inválido');
    result.status = raw.status;
  }
  if (raw.monthlyBillValue !== undefined) result.monthlyBillValue = optionalNumber(raw, 'monthlyBillValue') as number | null;
  if (raw.estimatedKwh !== undefined) result.estimatedKwh = optionalNumber(raw, 'estimatedKwh') as number | null;
  if (raw.discountPercentage !== undefined) result.discountPercentage = optionalNumber(raw, 'discountPercentage') as number | null;
  if (raw.projectedMonthlySavings !== undefined) result.projectedMonthlySavings = optionalNumber(raw, 'projectedMonthlySavings') as number | null;
  if (raw.projectedAnnualSavings !== undefined) result.projectedAnnualSavings = optionalNumber(raw, 'projectedAnnualSavings') as number | null;
  if (raw.validUntil !== undefined) result.validUntil = typeof raw.validUntil === 'string' && raw.validUntil.trim() ? raw.validUntil : null;
  if (raw.notes !== undefined) result.notes = optionalText(raw, 'notes');
  if (raw.sourceType !== undefined) result.sourceType = raw.sourceType === 'file' ? 'file' : 'editor';
  if (raw.contentHtml !== undefined) result.contentHtml = optionalText(raw, 'contentHtml');
  if (raw.contentText !== undefined) result.contentText = optionalText(raw, 'contentText');
  if (raw.templateName !== undefined) result.templateName = optionalText(raw, 'templateName');
  if (raw.isTemplate !== undefined) result.isTemplate = raw.isTemplate === true;
  if (raw.leadId !== undefined) result.leadId = validateUuid(raw.leadId, 'leadId');
  if (raw.importedFile !== undefined && raw.importedFile !== null) {
    result.importedFile = validateImportedFile(raw.importedFile);
  }
  return result;
}

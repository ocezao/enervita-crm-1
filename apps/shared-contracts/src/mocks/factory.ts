import { z } from 'zod';

/**
 * Gerador de Mocks Determinísticos
 * Cria dados falsos válidos baseados estritamente nos schemas Zod
 * 
 * Uso:
 * const mockLead = createMock(LeadSchema);
 * const mockLeads = createMockList(LeadSchema, 5);
 */

type SchemaType<T extends z.ZodType> = z.infer<T>;

function getRandomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomDate(start?: Date, end?: Date): Date {
  const startDate = start || new Date(2023, 0, 1);
  const endDate = end || new Date();
  return new Date(startDate.getTime() + Math.random() * (endDate.getTime() - startDate.getTime()));
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function createMock<T extends z.ZodType>(schema: T, overrides?: Partial<SchemaType<T>>): SchemaType<T> {
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape as Record<string, z.ZodType>;
    const obj: Record<string, any> = {};

    for (const [key, valueSchema] of Object.entries(shape)) {
      if (overrides && key in overrides) {
        obj[key] = overrides[key as keyof typeof overrides];
        continue;
      }

      obj[key] = createMock(valueSchema);
    }

    return obj as SchemaType<T>;
  }

  if (schema instanceof z.ZodString) {
    // Verifica se é UUID
    if (schema._def.checks?.some((c: any) => c.kind === 'uuid')) {
      return generateUUID() as SchemaType<T>;
    }
    // Verifica se é email
    if (schema._def.checks?.some((c: any) => c.kind === 'email')) {
      return `user${Math.floor(Math.random() * 10000)}@example.com` as SchemaType<T>;
    }
    return `mock_string_${Math.floor(Math.random() * 1000)}` as SchemaType<T>;
  }

  if (schema instanceof z.ZodNumber) {
    return (Math.floor(Math.random() * 1000) + Math.random()) as SchemaType<T>;
  }

  if (schema instanceof z.ZodBoolean) {
    return (Math.random() > 0.5) as SchemaType<T>;
  }

  if (schema instanceof z.ZodEnum) {
    const options = schema._def.values as string[];
    return getRandomElement(options) as SchemaType<T>;
  }

  if (schema instanceof z.ZodDate) {
    return getRandomDate() as SchemaType<T>;
  }

  if (schema instanceof z.ZodOptional) {
    return Math.random() > 0.7 ? undefined : createMock(schema.unwrap());
  }

  if (schema instanceof z.ZodNullable) {
    return Math.random() > 0.7 ? null : createMock(schema.unwrap());
  }

  if (schema instanceof z.ZodArray) {
    const length = Math.floor(Math.random() * 3) + 1; // 1-3 items
    return Array.from({ length }, () => createMock(schema.element)) as SchemaType<T>;
  }

  // Default fallback
  return null as SchemaType<T>;
}

export function createMockList<T extends z.ZodType>(schema: T, count: number, overrides?: Partial<SchemaType<T>>): SchemaType<T>[] {
  return Array.from({ length: count }, (_, i) => 
    createMock(schema, { 
      ...overrides,
      id: generateUUID() // Garante IDs únicos em listas
    })
  );
}

// Exemplo de uso específico para Leads
export function createMockLead(overrides?: Partial<any>) {
  return createMock(
    new z.ZodObject({
      id: z.string().uuid(),
      name: z.string(),
      email: z.string().email(),
      phone: z.string(),
      status: z.enum(['new', 'contacted', 'qualified', 'proposal_sent', 'negotiation', 'won', 'lost']),
      source: z.enum(['website', 'referral', 'ads', 'social_media', 'cold_call', 'event', 'other']).optional(),
      company: z.string().optional(),
      value: z.number().positive().optional(),
      notes: z.string().optional(),
      assignedTo: z.string().uuid().optional().nullable(),
      createdAt: z.date(),
      updatedAt: z.date(),
      deletedAt: z.date().optional().nullable()
    }),
    overrides
  );
}

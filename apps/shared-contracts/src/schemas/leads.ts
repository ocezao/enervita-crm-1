import { z } from 'zod';

// ============================================
// SCHEMA COMPARTILHADO DE LEADS
// Fonte única da verdade para Backend e Frontend
// ============================================

export const LeadStatusSchema = z.enum([
  'new',
  'contacted',
  'qualified',
  'proposal_sent',
  'negotiation',
  'won',
  'lost'
]);

export const LeadSourceSchema = z.enum([
  'website',
  'referral',
  'ads',
  'social_media',
  'cold_call',
  'event',
  'other'
]);

export const LeadSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(10, 'Phone must be at least 10 characters'),
  status: LeadStatusSchema,
  source: LeadSourceSchema.optional(),
  company: z.string().optional(),
  value: z.number().positive().optional(),
  notes: z.string().optional(),
  assignedTo: z.string().uuid().optional().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().optional().nullable()
});

export const CreateLeadSchema = LeadSchema.omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true, 
  deletedAt: true 
}).extend({
  email: z.string().email('Invalid email address'),
  phone: z.string().min(10, 'Phone must be at least 10 characters')
});

export const UpdateLeadSchema = CreateLeadSchema.partial();

export const LeadListResponseSchema = z.object({
  data: z.array(LeadSchema),
  pagination: z.object({
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative()
  })
});

export const LeadSingleResponseSchema = z.object({
  data: LeadSchema
});

export const LeadErrorResponseSchema = z.object({
  error: z.string(),
  code: z.string().optional()
});

// Types inferidos automaticamente
export type Lead = z.infer<typeof LeadSchema>;
export type CreateLeadInput = z.infer<typeof CreateLeadSchema>;
export type UpdateLeadInput = z.infer<typeof UpdateLeadSchema>;
export type LeadListResponse = z.infer<typeof LeadListResponseSchema>;
export type LeadSingleResponse = z.infer<typeof LeadSingleResponseSchema>;
export type LeadStatus = z.infer<typeof LeadStatusSchema>;
export type LeadSource = z.infer<typeof LeadSourceSchema>;

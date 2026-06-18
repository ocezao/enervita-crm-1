import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { createReadStream } from 'node:fs';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { requirePermission } from '../../middleware/requireAuth.ts';
import type { PublicUser, UserRepository } from '../auth/userRepository.ts';
import type { LeadDocumentContent, LeadsRepository } from './repository.ts';
import { LeadsNotFoundError, LeadsOperationError } from './repository.ts';
import { getStageScopeForUser } from '../permissions/permission.service.ts';
import { isAdminUser } from '../auth/userRepository.ts';
import { ValidationError, validateUuid } from './validation.ts';
import { DocumentUploadError, parseDocumentUpload } from './documentUpload.ts';

type LeadDocumentsRouteOptions = {
  userRepository: UserRepository;
  leadsRepository: LeadsRepository;
  sessionSecret: string;
};

type RequestWithUser = FastifyRequest & { authenticatedUser?: PublicUser };

function authenticatedUser(request: FastifyRequest): PublicUser {
  const user = (request as RequestWithUser).authenticatedUser;
  if (!user) throw new Error('Authenticated user missing after preHandler');
  return user;
}

function scopedStages(actor: PublicUser) {
  return getStageScopeForUser(actor);
}

function scopedOwner(actor: PublicUser): string | null {
  return isAdminUser(actor) ? null : actor.id;
}

function auditMetadata(request: FastifyRequest) {
  return {
    ipAddress: request.ip,
    userAgent: typeof request.headers['user-agent'] === 'string' ? request.headers['user-agent'] : undefined,
  };
}

function handleDocumentsError(error: unknown, reply: FastifyReply) {
  if (error instanceof ValidationError || error instanceof DocumentUploadError) return reply.code(400).send({ error: error.message });
  if (error instanceof LeadsNotFoundError) return reply.code(404).send({ error: 'Lead or document not found' });
  if (error instanceof LeadsOperationError) return reply.code(403).send({ error: error.message });
  throw error;
}

function dispositionFileName(fileName: string): string {
  return fileName.replace(/["\\\r\n]/g, '_');
}

function mimeTypeForLocalFile(fileName: string): string {
  const extension = path.extname(fileName).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
    '.json': 'application/json',
    '.xml': 'application/xml',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
  };
  return mimeMap[extension] ?? 'application/octet-stream';
}

async function sendLegacyLocalFile(reply: FastifyReply, document: LeadDocumentContent, disposition: 'inline' | 'attachment') {
  if (!document.fileUrl?.startsWith('/uploads/documents/')) return null;
  const fileName = path.basename(document.fileUrl);
  if (!/^[a-zA-Z0-9._-]+$/.test(fileName)) return null;
  const uploadRoot = process.env.DOCUMENT_UPLOAD_DIR?.trim() || path.resolve(process.cwd(), 'uploads', 'documents');
  const absolutePath = path.join(uploadRoot, fileName);
  try {
    await access(absolutePath);
  } catch {
    return null;
  }
  reply.header('Content-Type', document.mimeType || mimeTypeForLocalFile(fileName));
  reply.header('Content-Disposition', `${disposition}; filename="${dispositionFileName(document.fileName)}"`);
  return reply.send(createReadStream(absolutePath));
}

async function sendDocumentContent(reply: FastifyReply, document: LeadDocumentContent, disposition: 'inline' | 'attachment') {
  if (document.content) {
    reply.header('Content-Type', document.mimeType || 'application/octet-stream');
    reply.header('Content-Length', String(document.content.length));
    reply.header('Content-Disposition', `${disposition}; filename="${dispositionFileName(document.fileName)}"`);
    return reply.send(document.content);
  }
  const legacyResponse = await sendLegacyLocalFile(reply, document, disposition);
  if (legacyResponse) return legacyResponse;
  if (document.fileUrl) return reply.redirect(document.fileUrl);
  return reply.code(404).send({ error: 'Document content not found' });
}

export async function registerLeadDocumentsRoutes(app: FastifyInstance, options: LeadDocumentsRouteOptions): Promise<void> {
  const viewPreHandler = requirePermission('lead.view', { userRepository: options.userRepository, sessionSecret: options.sessionSecret });
  const editPreHandler = requirePermission('lead.edit', { userRepository: options.userRepository, sessionSecret: options.sessionSecret });

  app.get('/api/leads/:id/documents', { preHandler: viewPreHandler }, async (request, reply) => {
    try {
      const { id: rawId } = request.params as { id: string };
      const actor = authenticatedUser(request);
      const leadId = validateUuid(rawId, 'id');
      const documents = await options.leadsRepository.listLeadDocuments(actor.tenantId, leadId, scopedStages(actor), scopedOwner(actor));
      return { documents };
    } catch (error) {
      return handleDocumentsError(error, reply);
    }
  });

  app.post('/api/leads/:id/documents', { preHandler: editPreHandler, bodyLimit: 20 * 1024 * 1024 + 16_384 }, async (request, reply) => {
    try {
      const { id: rawId } = request.params as { id: string };
      const actor = authenticatedUser(request);
      const leadId = validateUuid(rawId, 'id');
      const contentType = typeof request.headers['content-type'] === 'string' ? request.headers['content-type'] : '';
      const context = { actorUserId: actor.id, tenantId: actor.tenantId, ...auditMetadata(request) };

      if (contentType.includes('multipart/form-data')) {
        const file = parseDocumentUpload(contentType, request.body);
        const document = await options.leadsRepository.addLeadDocument(context, leadId, scopedStages(actor), scopedOwner(actor), {
          fileName: file.fileName,
          mimeType: file.mimeType,
          fileSize: file.data.length,
          fileData: file.data,
          storageBackend: 'postgres',
          uploadedByUserAgent: auditMetadata(request).userAgent ?? null,
        });
        return reply.code(201).send({ document });
      }

      const body = request.body as { fileName?: unknown; fileUrl?: unknown; mimeType?: unknown; fileSize?: unknown };
      if (typeof body?.fileName !== 'string' || !body.fileName.trim()) return reply.code(400).send({ error: 'fileName is required' });
      if (typeof body?.fileUrl !== 'string' || !body.fileUrl.trim()) return reply.code(400).send({ error: 'fileUrl is required' });
      const document = await options.leadsRepository.addLeadDocument(context, leadId, scopedStages(actor), scopedOwner(actor), {
        fileName: body.fileName.trim(),
        fileUrl: body.fileUrl.trim(),
        mimeType: typeof body.mimeType === 'string' && body.mimeType.trim() ? body.mimeType.trim() : null,
        fileSize: typeof body.fileSize === 'number' && Number.isFinite(body.fileSize) ? Math.max(0, Math.floor(body.fileSize)) : null,
        storageBackend: body.fileUrl.trim().startsWith('/uploads/documents/') ? 'legacy_url' : 'external_url',
        uploadedByUserAgent: auditMetadata(request).userAgent ?? null,
      });
      return reply.code(201).send({ document });
    } catch (error) {
      return handleDocumentsError(error, reply);
    }
  });

  app.get('/api/leads/:id/documents/:documentId/preview', { preHandler: viewPreHandler }, async (request, reply) => {
    try {
      const { id: rawId, documentId: rawDocumentId } = request.params as { id: string; documentId: string };
      const actor = authenticatedUser(request);
      const document = await options.leadsRepository.getLeadDocumentContent(
        actor.tenantId,
        validateUuid(rawId, 'id'),
        validateUuid(rawDocumentId, 'documentId'),
        scopedStages(actor),
        scopedOwner(actor),
      );
      if (!document) return reply.code(404).send({ error: 'Document not found' });
      return sendDocumentContent(reply, document, 'inline');
    } catch (error) {
      return handleDocumentsError(error, reply);
    }
  });

  app.get('/api/leads/:id/documents/:documentId/download', { preHandler: viewPreHandler }, async (request, reply) => {
    try {
      const { id: rawId, documentId: rawDocumentId } = request.params as { id: string; documentId: string };
      const actor = authenticatedUser(request);
      const document = await options.leadsRepository.getLeadDocumentContent(
        actor.tenantId,
        validateUuid(rawId, 'id'),
        validateUuid(rawDocumentId, 'documentId'),
        scopedStages(actor),
        scopedOwner(actor),
      );
      if (!document) return reply.code(404).send({ error: 'Document not found' });
      return sendDocumentContent(reply, document, 'attachment');
    } catch (error) {
      return handleDocumentsError(error, reply);
    }
  });

  app.delete('/api/leads/:id/documents/:documentId', { preHandler: editPreHandler }, async (request, reply) => {
    try {
      const { id: rawId, documentId: rawDocumentId } = request.params as { id: string; documentId: string };
      const actor = authenticatedUser(request);
      await options.leadsRepository.deleteLeadDocument(
        { actorUserId: actor.id, tenantId: actor.tenantId, ...auditMetadata(request) },
        validateUuid(rawId, 'id'),
        validateUuid(rawDocumentId, 'documentId'),
        scopedStages(actor),
        scopedOwner(actor),
      );
      return reply.code(204).send();
    } catch (error) {
      return handleDocumentsError(error, reply);
    }
  });
}

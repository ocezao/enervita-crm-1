import path from 'node:path';

export type DocumentFileInput = {
  fileName: string;
  mimeType: string;
  data: Buffer;
};

export class DocumentUploadError extends Error {}

export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'text/plain',
  'text/csv',
  'text/markdown',
  'application/json',
  'application/xml',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  'application/octet-stream',
]);

function parseBoundary(contentType: string | undefined): string {
  const match = contentType?.match(/boundary=(?:(?:"([^"]+)")|([^;]+))/i);
  const boundary = match?.[1] ?? match?.[2]?.trim();
  if (!boundary) throw new DocumentUploadError('document upload must be multipart/form-data');
  return boundary;
}

function normalizeFileName(value: string | undefined): string {
  const baseName = path.basename(value ?? 'document');
  return baseName.replace(/[^a-zA-Z0-9._ -]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 200) || 'document';
}

export function parseDocumentUpload(contentType: string | undefined, body: unknown): DocumentFileInput {
  if (!Buffer.isBuffer(body)) throw new DocumentUploadError('document upload must be multipart/form-data');
  const boundary = parseBoundary(contentType);
  const delimiter = Buffer.from(`--${boundary}`);
  let cursor = body.indexOf(delimiter);

  while (cursor !== -1) {
    const nextCursor = body.indexOf(delimiter, cursor + delimiter.length);
    if (nextCursor === -1) break;
    let part = body.subarray(cursor + delimiter.length, nextCursor);
    if (part.subarray(0, 2).toString() === '--') break;
    if (part.subarray(0, 2).toString() === '\r\n') part = part.subarray(2);
    if (part.subarray(-2).toString() === '\r\n') part = part.subarray(0, -2);

    const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'));
    if (headerEnd === -1) {
      cursor = nextCursor;
      continue;
    }

    const rawHeaders = part.subarray(0, headerEnd).toString('utf8');
    const data = part.subarray(headerEnd + 4);
    const disposition = rawHeaders.match(/content-disposition:\s*form-data;[^\r\n]*/i)?.[0] ?? '';
    if (!/name="file"/i.test(disposition)) {
      cursor = nextCursor;
      continue;
    }

    const fileName = normalizeFileName(disposition.match(/filename="([^"]*)"/i)?.[1]);
    const rawMimeType = rawHeaders.match(/content-type:\s*([^\r\n;]+)/i)?.[1]?.trim().toLowerCase();
    const mimeType = rawMimeType && ALLOWED_MIME_TYPES.has(rawMimeType) ? rawMimeType : 'application/octet-stream';
    if (data.length === 0) throw new DocumentUploadError('file is required');
    if (data.length > MAX_DOCUMENT_BYTES) throw new DocumentUploadError('file must be at most 20MB');
    return { fileName, mimeType, data };
  }

  throw new DocumentUploadError('file is required');
}

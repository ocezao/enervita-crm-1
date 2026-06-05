import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { FastifyReply, FastifyRequest } from 'fastify';

export type AvatarFileInput = {
  fileName: string;
  mimeType: string;
  data: Buffer;
};

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const MIME_TO_EXTENSION: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export class AvatarUploadError extends Error {}

function parseBoundary(contentType: string | undefined): string {
  const match = contentType?.match(/boundary=(?:(?:"([^"]+)")|([^;]+))/i);
  const boundary = match?.[1] ?? match?.[2]?.trim();
  if (!boundary) throw new AvatarUploadError('avatar upload must be multipart/form-data');
  return boundary;
}

function normalizeFileName(value: string | undefined): string {
  const baseName = path.basename(value ?? 'avatar');
  return baseName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'avatar';
}

export function parseAvatarUpload(contentType: string | undefined, body: unknown): AvatarFileInput {
  if (!Buffer.isBuffer(body)) throw new AvatarUploadError('avatar upload must be multipart/form-data');
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
    if (!/name="avatar"/i.test(disposition)) {
      cursor = nextCursor;
      continue;
    }

    const fileName = normalizeFileName(disposition.match(/filename="([^"]*)"/i)?.[1]);
    const mimeType = rawHeaders.match(/content-type:\s*([^\r\n;]+)/i)?.[1]?.trim().toLowerCase() ?? '';
    if (!ALLOWED_MIME_TYPES.has(mimeType)) throw new AvatarUploadError('avatar must be an image file');
    if (data.length === 0) throw new AvatarUploadError('avatar file is required');
    if (data.length > MAX_AVATAR_BYTES) throw new AvatarUploadError('avatar must be at most 5MB');
    return { fileName, mimeType, data };
  }

  throw new AvatarUploadError('avatar file is required');
}

export function handleAvatarUploadError(error: unknown, reply: FastifyReply) {
  if (error instanceof AvatarUploadError) return reply.code(400).send({ error: error.message });
  throw error;
}

export async function saveAvatarToLocalUploads(userId: string, input: AvatarFileInput): Promise<string> {
  const uploadRoot = process.env.AVATAR_UPLOAD_DIR?.trim() || path.resolve(process.cwd(), 'uploads', 'avatars');
  await mkdir(uploadRoot, { recursive: true });
  const extension = MIME_TO_EXTENSION[input.mimeType] ?? 'bin';
  const fileName = `${userId}-${randomUUID()}.${extension}`;
  await writeFile(path.join(uploadRoot, fileName), input.data, { flag: 'w' });
  return `/uploads/avatars/${fileName}`;
}

export async function sendLocalAvatarFile(request: FastifyRequest, reply: FastifyReply) {
  const params = request.params as { fileName?: string };
  const fileName = params.fileName ?? '';
  if (!/^[a-zA-Z0-9._-]+$/.test(fileName)) return reply.code(404).send({ error: 'Not found' });
  const uploadRoot = process.env.AVATAR_UPLOAD_DIR?.trim() || path.resolve(process.cwd(), 'uploads', 'avatars');
  const absolutePath = path.join(uploadRoot, fileName);
  try {
    await access(absolutePath);
  } catch {
    return reply.code(404).send({ error: 'Not found' });
  }
  const extension = path.extname(fileName).toLowerCase();
  const contentType = extension === '.png' ? 'image/png' : extension === '.jpg' || extension === '.jpeg' ? 'image/jpeg' : extension === '.webp' ? 'image/webp' : extension === '.gif' ? 'image/gif' : 'application/octet-stream';
  return reply.type(contentType).send(createReadStream(absolutePath));
}

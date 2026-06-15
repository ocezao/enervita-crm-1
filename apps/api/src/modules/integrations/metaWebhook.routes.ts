import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import crypto from 'node:crypto';

const DEFAULT_VERIFY_TOKEN_ENV_KEYS = [
  'META_LEADGEN_VERIFY_TOKEN',
  'META_WEBHOOK_VERIFY_TOKEN',
  'WEBHOOK_VERIFY_TOKEN',
  'CRM_WEBHOOK_VERIFY_TOKEN',
] as const;

function getFirstStringEnv(names: readonly string[]): string {
  for (const n of names) {
    const v = process.env[n]?.trim() as string | undefined;
    if (v) return v;
  }
  return '';
}

function getRawBody(request: FastifyRequest): string {
  const body = request.body as unknown;
  if (typeof body === 'string') return body;
  if (body && Buffer.isBuffer(body)) return body.toString('utf8');
  if (body == null) return '';
  return JSON.stringify(body);
}

function verifyMetaSignature(rawBody: string, signatureHeader: string | string[] | undefined, appSecret: string): boolean {
  if (!appSecret) return false;
  const sigHeader = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
  if (!sigHeader || !sigHeader.startsWith('sha256=')) return false;
  const signature = sigHeader.slice('sha256='.length);
  const expected = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  try {
    const expectedBuf = Buffer.from(expected, 'hex');
    const signatureBuf = Buffer.from(signature, 'hex');
    if (expectedBuf.length !== signatureBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, signatureBuf);
  } catch {
    return false;
  }
}

type RouteContext = {
  verifyToken: string;
  appSecret: string;
};

function readVerifyToken(req: FastifyRequest): string {
  const query = req.query as Record<string, string | undefined>;
  return String(query.verify_token || query.token || query.secret || '') || '';
}

export function registerMetaWebhookRoutes(app: FastifyInstance): void {
  const verifyToken = getFirstStringEnv(DEFAULT_VERIFY_TOKEN_ENV_KEYS);
  const appSecret = getFirstStringEnv(['META_LEADGEN_APP_SECRET', 'META_APP_SECRET', 'APP_SECRET']);

  app.post('/api/public/integrations/meta/leadgen/webhook', async (request, reply: FastifyReply) => {
    const rawBody = getRawBody(request);
    const sigHeader = request.headers['x-hub-signature-256'] as string | undefined;
    const queryToken = readVerifyToken(request);

    const isTokenValid = Boolean(verifyToken && queryToken && queryToken === verifyToken);
    const isSignatureValid = Boolean(appSecret && sigHeader && verifyMetaSignature(rawBody, sigHeader, appSecret));

    if (!isTokenValid && !isSignatureValid) {
      return reply.code(403).send({ ok: false, error: 'Webhook authentication failed' });
    }

    return reply.code(200).send({ ok: true, received: true });
  });
}

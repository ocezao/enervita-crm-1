import { FastifyInstance } from 'fastify';

/**
 * Hook global de auditoria para logging estruturado
 * Registra todas as requisições e respostas para fins de auditoria e debugging
 */

export interface AuditLogEntry {
  timestamp: string;
  requestId: string;
  method: string;
  url: string;
  userId?: string;
  userEmail?: string;
  statusCode: number;
  responseTimeMs: number;
  userAgent?: string;
  ip?: string;
}

/**
 * Gera um ID único para cada request
 */
function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Configura hooks globais de auditoria e logging
 */
export function setupAuditHooks(app: FastifyInstance): void {
  // Hook onRequest - Executado no início de cada requisição
  app.addHook('onRequest', async (request, reply) => {
    const requestId = generateRequestId();
    
    // Adiciona ID da request ao contexto
    (request as any).requestId = requestId;
    (request as any).startTime = Date.now();
    
    // Log básico da requisição
    console.log('[AUDIT]', {
      event: 'REQUEST_START',
      requestId,
      method: request.method,
      url: request.url,
      userAgent: request.headers['user-agent'],
      ip: request.ip,
      timestamp: new Date().toISOString(),
    });
  });

  // Hook onResponse - Executado após cada resposta
  app.addHook('onResponse', async (request, reply) => {
    const startTime = (request as any).startTime as number;
    const requestId = (request as any).requestId as string;
    const responseTime = Date.now() - startTime;
    
    // Extrai informações do usuário se autenticado
    const user = (request as any).user;
    
    const auditEntry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      requestId,
      method: request.method,
      url: request.url,
      userId: user?.id,
      userEmail: user?.email,
      statusCode: reply.statusCode,
      responseTimeMs: responseTime,
      userAgent: request.headers['user-agent'],
      ip: request.ip,
    };

    // Log estruturado da resposta
    console.log('[AUDIT]', JSON.stringify(auditEntry));

    // Alerta para requests lentos (> 1000ms)
    if (responseTime > 1000) {
      console.warn('[SLOW_REQUEST]', {
        requestId,
        method: request.method,
        url: request.url,
        responseTimeMs: responseTime,
        userId: user?.id,
      });
    }
  });

  // Hook onError - Executado quando ocorre um erro não tratado
  app.addHook('onError', async (request, reply, error) => {
    const requestId = (request as any).requestId as string;
    const startTime = (request as any).startTime as number;
    const responseTime = Date.now() - startTime;
    
    const user = (request as any).user;
    
    console.error('[AUDIT_ERROR]', JSON.stringify({
      event: 'ERROR',
      requestId,
      method: request.method,
      url: request.url,
      userId: user?.id,
      userEmail: user?.email,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      responseTimeMs: responseTime,
      timestamp: new Date().toISOString(),
    }));
  });
}

/**
 * Middleware opcional para adicionar metadata de auditoria ao contexto da request
 */
export async function auditMetadataMiddleware(
  request: any,
  reply: any,
  done: () => void
): Promise<void> {
  // Adiciona metadata de auditoria ao contexto da request
  request.auditContext = {
    requestId: request.requestId,
    timestamp: new Date().toISOString(),
    user: request.user ? {
      id: request.user.id,
      email: request.user.email,
      role: request.user.role,
    } : null,
    source: {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    },
  };
  
  done();
}

/**
 * Função utilitária para log de auditoria customizado em serviços
 */
export function logAuditEvent(event: string, data: Record<string, unknown>): void {
  console.log('[AUDIT_CUSTOM]', JSON.stringify({
    event,
    ...data,
    timestamp: new Date().toISOString(),
  }));
}

import { FastifyReply } from 'fastify';
import { HTTP_STATUS, ApiErrorResponse } from '../types/api';

/**
 * Tipos de erros conhecidos da aplicação
 */
export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR,
    public code?: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, HTTP_STATUS.BAD_REQUEST, 'BAD_REQUEST', details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, HTTP_STATUS.UNAUTHORIZED, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, HTTP_STATUS.FORBIDDEN, 'FORBIDDEN');
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, HTTP_STATUS.NOT_FOUND, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, HTTP_STATUS.CONFLICT, 'CONFLICT', details);
  }
}

/**
 * Handler unificado de erros para todas as rotas
 */
export function createErrorHandler(reply: FastifyReply) {
  return async (error: unknown): Promise<void> => {
    console.error('[ErrorHandler]', error);

    if (error instanceof AppError) {
      const response: ApiErrorResponse = {
        error: error.message,
        code: error.code,
        ...(error.details && { details: error.details }),
      };

      return reply.status(error.statusCode).send(response);
    }

    // Erros do Fastify
    if (error && typeof error === 'object' && 'statusCode' in error) {
      const fastifyError = error as { statusCode: number; message: string };
      const response: ApiErrorResponse = {
        error: fastifyError.message,
        code: 'FASTIFY_ERROR',
      };

      return reply.status(fastifyError.statusCode).send(response);
    }

    // Erro genérico não tratado
    const response: ApiErrorResponse = {
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    };

    return reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(response);
  };
}

/**
 * Valida se uma string é um UUID válido
 */
export function isValidUuid(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Valida parâmetro UUID e lança erro padronizado se inválido
 */
export function validateUuidParam(id: string | undefined, paramName: string = 'id'): void {
  if (!id || !isValidUuid(id)) {
    throw new BadRequestError(`Invalid ${paramName}. Must be a valid UUID.`);
  }
}

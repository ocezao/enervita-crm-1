/**
 * Tipos compartilhados para padronização das respostas da API
 */

/**
 * Estrutura padrão para respostas de sucesso
 */
export interface ApiSuccessResponse<T = unknown> {
  data: T;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
  };
}

/**
 * Estrutura padrão para respostas de erro
 */
export interface ApiErrorResponse {
  error: string;
  code?: string;
  details?: Record<string, unknown>;
}

/**
 * Parâmetros de paginação comuns
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Parâmetro de ID no formato UUID
 */
export interface UuidParam {
  id: string;
}

/**
 * Tipo genérico para request com usuário autenticado
 */
export interface AuthenticatedRequest {
  user: {
    id: string;
    email: string;
    role?: string;
  };
}

/**
 * Status HTTP comuns
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
} as const;

import { HTTP_STATUS, ApiSuccessResponse } from '../types/api';

/**
 * Builder padronizado para respostas de sucesso
 */
export function success<T>(data: T, statusCode: number = HTTP_STATUS.OK): { statusCode: number; body: ApiSuccessResponse<T> } {
  return {
    statusCode,
    body: { data },
  };
}

/**
 * Builder para respostas de criação (201)
 */
export function created<T>(data: T): { statusCode: number; body: ApiSuccessResponse<T> } {
  return success(data, HTTP_STATUS.CREATED);
}

/**
 * Builder para respostas sem conteúdo (204)
 */
export function noContent(): { statusCode: number; body: null } {
  return {
    statusCode: HTTP_STATUS.NO_CONTENT,
    body: null,
  };
}

/**
 * Builder para respostas paginadas
 */
export function paginated<T>(
  data: T,
  total: number,
  page: number,
  limit: number
): { statusCode: number; body: ApiSuccessResponse<T> } {
  const totalPages = Math.ceil(total / limit);

  return {
    statusCode: HTTP_STATUS.OK,
    body: {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    },
  };
}

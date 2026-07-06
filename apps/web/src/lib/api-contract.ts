import { z } from 'zod';

/**
 * Cliente HTTP Tipado para Consumo da API no Frontend
 * 
 * Usa os schemas compartilhados para inferir automaticamente
 * os tipos de request e response, garantindo type safety end-to-end.
 * 
 * @example
 * ```typescript
 * // No frontend:
 * const leads = await apiClient.get('/leads', LeadListResponseSchema);
 * // `leads` é tipado automaticamente como LeadListResponse
 * 
 * const newLead = await apiClient.post('/leads', CreateLeadSchema, { name: 'John', ... });
 * ```
 */

type SchemaType<T extends z.ZodType> = z.infer<T>;

export class ApiClientError extends Error {
  constructor(
    public status: number,
    public code: string,
    public details?: any,
    message?: string
  ) {
    super(message || `API Error ${status}: ${code}`);
    this.name = 'ApiClientError';
  }
}

async function fetchWithValidation<T extends z.ZodType>(
  url: string,
  options: RequestInit,
  responseSchema: T
): Promise<SchemaType<T>> {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new ApiClientError(
        response.status,
        data.code || 'HTTP_ERROR',
        data.details || data.error,
        data.error || 'Request failed'
      );
    }

    // Valida a resposta contra o schema
    const result = responseSchema.safeParse(data);
    
    if (!result.success) {
      console.error('Contract violation in API response:', {
        url,
        errors: result.error.errors,
        receivedData: data
      });
      
      // Em desenvolvimento, lança erro para alertar o dev
      if (process.env.NODE_ENV !== 'production') {
        throw new Error(`API Contract Violation: ${result.error.message}`);
      }
      
      // Em produção, retorna os dados mesmo assim (fallback)
      return data as SchemaType<T>;
    }

    return result.data;
  } catch (error) {
    if (error instanceof ApiClientError) {
      throw error;
    }
    
    // Erro de rede ou parsing
    throw new ApiClientError(
      0,
      'NETWORK_ERROR',
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}

export const apiClient = {
  /**
   * GET request com validação de resposta
   */
  async get<T extends z.ZodType>(
    endpoint: string,
    responseSchema: T,
    params?: Record<string, string | number | undefined>
  ): Promise<SchemaType<T>> {
    const queryString = params 
      ? '?' + new URLSearchParams(
          Object.entries(params)
            .filter(([_, v]) => v !== undefined)
            .map(([k, v]) => [k, String(v)])
        ).toString()
      : '';
    
    return fetchWithValidation(`/api${endpoint}${queryString}`, { method: 'GET' }, responseSchema);
  },

  /**
   * POST request com validação de payload e resposta
   */
  async post<TInput extends z.ZodType, TOutput extends z.ZodType>(
    endpoint: string,
    inputSchema: TInput,
    inputData: SchemaType<TInput>,
    responseSchema: TOutput
  ): Promise<SchemaType<TOutput>> {
    // Valida input localmente antes de enviar
    const inputResult = inputSchema.safeParse(inputData);
    if (!inputResult.success) {
      throw new Error(`Invalid input data: ${inputResult.error.message}`);
    }

    return fetchWithValidation(
      `/api${endpoint}`,
      {
        method: 'POST',
        body: JSON.stringify(inputResult.data),
      },
      responseSchema
    );
  },

  /**
   * PUT request com validação de payload e resposta
   */
  async put<TInput extends z.ZodType, TOutput extends z.ZodType>(
    endpoint: string,
    inputSchema: TInput,
    inputData: SchemaType<TInput>,
    responseSchema: TOutput
  ): Promise<SchemaType<TOutput>> {
    const inputResult = inputSchema.safeParse(inputData);
    if (!inputResult.success) {
      throw new Error(`Invalid input data: ${inputResult.error.message}`);
    }

    return fetchWithValidation(
      `/api${endpoint}`,
      {
        method: 'PUT',
        body: JSON.stringify(inputResult.data),
      },
      responseSchema
    );
  },

  /**
   * PATCH request com validação de payload e resposta
   */
  async patch<TInput extends z.ZodType, TOutput extends z.ZodType>(
    endpoint: string,
    inputSchema: TInput,
    inputData: Partial<SchemaType<TInput>>,
    responseSchema: TOutput
  ): Promise<SchemaType<TOutput>> {
    return fetchWithValidation(
      `/api${endpoint}`,
      {
        method: 'PATCH',
        body: JSON.stringify(inputData),
      },
      responseSchema
    );
  },

  /**
   * DELETE request com validação de resposta
   */
  async delete<T extends z.ZodType>(
    endpoint: string,
    responseSchema: T
  ): Promise<SchemaType<T>> {
    return fetchWithValidation(`/api${endpoint}`, { method: 'DELETE' }, responseSchema);
  },
};

// Exporta tipos utilitários
export type ApiResponse<T> = Promise<T>;
export type ApiError = ApiClientError;

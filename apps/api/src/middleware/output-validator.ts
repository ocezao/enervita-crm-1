import { FastifyRequest, FastifyReply } from 'fastify';
import { ZodSchema, ZodError } from 'zod';

/**
 * Middleware de Validação de Saída (Output Guard)
 * 
 * Garante que TODAS as respostas da API estejam em conformidade com o schema definido.
 * Se os dados estiverem corrompidos ou incompletos, a requisição falha de forma segura.
 * 
 * @param schema - Schema Zod que define o contrato de resposta
 * @param skipInProduction - Se true, pula validação em produção para performance (opcional)
 */
export function createOutputValidatorMiddleware<T>(
  schema: ZodSchema<T>,
  options: { skipInProduction?: boolean; strict?: boolean } = {}
) {
  const { skipInProduction = false, strict = true } = options;

  return async (request: FastifyRequest, reply: FastifyReply) => {
    // Pula validação em produção se configurado (trade-off performance vs segurança)
    if (skipInProduction && process.env.NODE_ENV === 'production') {
      return;
    }

    // Hook executed after response is set but before sending
    reply.addHook('onSend', async (request, reply, payload) => {
      try {
        // Parse do payload
        let parsedPayload: unknown;
        
        if (typeof payload === 'string') {
          try {
            parsedPayload = JSON.parse(payload);
          } catch {
            // Se não for JSON válido, não valida
            return payload;
          }
        } else {
          parsedPayload = payload;
        }

        // Valida contra o schema
        const result = await schema.safeParseAsync(parsedPayload);
        
        if (!result.success) {
          const error = result.error;
          
          // Log do erro para debugging
          request.log.error({
            type: 'CONTRACT_VIOLATION',
            route: request.url,
            method: request.method,
            validationErrors: error.errors,
            receivedData: parsedPayload
          });

          if (strict) {
            // Em modo strict, falha a requisição
            reply.code(500);
            return JSON.stringify({
              error: 'Internal server error: Response contract violation',
              code: 'CONTRACT_VIOLATION',
              details: process.env.NODE_ENV !== 'production' ? error.errors : undefined
            });
          } else {
            // Em modo leniente, apenas loga e segue
            request.log.warn('Contract violation detected but allowed due to non-strict mode');
          }
        }

        return payload;
      } catch (validationError) {
        // Erro inesperado na validação
        request.log.error({
          type: 'VALIDATION_ERROR',
          route: request.url,
          error: validationError
        });

        if (strict) {
          reply.code(500);
          return JSON.stringify({
            error: 'Internal server error: Validation failed',
            code: 'VALIDATION_ERROR'
          });
        }
        
        return payload;
      }
    });
  };
}

/**
 * Helper para validar resposta manualmente em services
 * Útil quando você precisa validar antes de retornar ao controller
 */
export function validateResponse<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  
  if (!result.success) {
    throw new Error(`Contract violation: ${result.error.message}`);
  }
  
  return result.data;
}

/**
 * Type helper para extrair o tipo de um schema
 */
export type InferResponseType<T extends ZodSchema<any>> = z.infer<T>;

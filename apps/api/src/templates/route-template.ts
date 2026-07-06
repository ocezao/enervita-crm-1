import { FastifyInstance } from 'fastify';
import { BadRequestError, NotFoundError, ForbiddenError } from '../utils/error-handler';
import { success, created, noContent, paginated } from '../utils/response-builder';
import { PaginationParams, UuidParam } from '../types/api';

/**
 * Template base para rotas de módulos
 * 
 * Este arquivo serve como guia de padronização para criação/refatoração de rotas.
 * Copie este template e adapte para cada módulo específico.
 */

// Interface para parâmetros específicos do módulo (adicione conforme necessário)
interface ModuleSpecificQuery extends PaginationParams {
  // Exemplo: status?: string;
  // Exemplo: search?: string;
}

export async function moduleRoutes(app: FastifyInstance): Promise<void> {
  // Padrão: GET / - Listar todos com paginação
  app.get('/', async (request, reply) => {
    try {
      const query = request.query as ModuleSpecificQuery;
      
      // TODO: Implementar lógica do service
      // const result = await ModuleService.getAll(query);
      
      // Retorno padronizado com paginação
      return paginated([], 0, query.page || 1, query.limit || 20).send(reply);
    } catch (error) {
      // Handler de erro unificado será adicionado globalmente
      throw error;
    }
  });

  // Padrão: GET /:id - Obter por ID
  app.get<{ Params: UuidParam }>('/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      
      // Validação de UUID é feita pelo middleware global ou manualmente
      // if (!isValidUuid(id)) {
      //   throw new BadRequestError('Invalid ID. Must be a valid UUID.');
      // }
      
      // TODO: Implementar lógica do service
      // const item = await ModuleService.getById(id);
      
      // if (!item) {
      //   throw new NotFoundError('Resource not found');
      // }
      
      // Retorno padronizado
      return success({}).send(reply);
    } catch (error) {
      throw error;
    }
  });

  // Padrão: POST / - Criar novo recurso
  app.post('/', async (request, reply) => {
    try {
      const body = request.body;
      
      // TODO: Adicionar validação do body usando validation.ts
      // const validated = createSchema.validate(body);
      
      // TODO: Implementar lógica do service
      // const newItem = await ModuleService.create(body, request.user);
      
      // Retorno padronizado para criação (201)
      return created({}).send(reply);
    } catch (error) {
      throw error;
    }
  });

  // Padrão: PUT /:id - Atualizar recurso existente
  app.put<{ Params: UuidParam }>('/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      const body = request.body;
      
      // TODO: Validar ID e body
      
      // TODO: Implementar lógica do service
      // const updated = await ModuleService.update(id, body, request.user);
      
      // if (!updated) {
      //   throw new NotFoundError('Resource not found');
      // }
      
      return success({}).send(reply);
    } catch (error) {
      throw error;
    }
  });

  // Padrão: PATCH /:id - Atualização parcial
  app.patch<{ Params: UuidParam }>('/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      const body = request.body;
      
      // TODO: Implementar lógica do service para atualização parcial
      // const updated = await ModuleService.patch(id, body, request.user);
      
      return success({}).send(reply);
    } catch (error) {
      throw error;
    }
  });

  // Padrão: DELETE /:id - Remover recurso
  app.delete<{ Params: UuidParam }>('/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      
      // TODO: Implementar lógica do service
      // const deleted = await ModuleService.delete(id, request.user);
      
      // if (!deleted) {
      //   throw new NotFoundError('Resource not found');
      // }
      
      // Retorno padronizado para deleção (204 No Content)
      return noContent().send(reply);
    } catch (error) {
      throw error;
    }
  });

  // Exemplo de rota específica com permissão
  app.post<{ Params: UuidParam }>('/:id/specific-action', async (request, reply) => {
    try {
      const { id } = request.params;
      
      // Verificação de permissão padronizada
      // if (!request.user?.role || !hasPermission(request.user, 'action')) {
      //   throw new ForbiddenError('You do not have permission to perform this action');
      // }
      
      // TODO: Implementar ação específica
      // const result = await ModuleService.specificAction(id, request.user);
      
      return success({}).send(reply);
    } catch (error) {
      throw error;
    }
  });
}

/**
 * CHECKLIST PARA NOVAS ROTAS:
 * 
 * [ ] Usar handlers de erro unificados (createErrorHandler)
 * [ ] Usar response builders (success, created, noContent, paginated)
 * [ ] Validar parâmetros UUID com validateUuidParam ou isValidUuid
 * [ ] Tipar corretamente request params, query e body
 * [ ] Adicionar schemas de validação em validation.ts
 * [ ] Verificar permissões de usuário quando necessário
 * [ ] Documentar rota com comentários JSDoc
 * [ ] Adicionar testes para a rota
 * [ ] Seguir convenção de nomes: module.routes.ts
 */

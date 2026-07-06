# Arquitetura de Contratos - Design by Contract

## Visão Geral

Esta documentação descreve a implementação de **Design by Contract** no projeto, garantindo integridade entre Backend e Frontend através de validação runtime e type safety end-to-end.

## Princípios Fundamentais

1. **Single Source of Truth**: Schemas Zod definem o contrato único
2. **Validação em Camadas**: Múltiplas verificações ao longo do fluxo
3. **Fail Fast**: Erros são detectados o mais cedo possível
4. **Type Safety**: TypeScript inferido automaticamente dos schemas

## Estrutura de Arquivos

```
apps/
├── shared-contracts/          # Pacote compartilhado
│   ├── src/
│   │   ├── schemas/           # Definições Zod
│   │   │   └── leads.ts       # Schema de Leads
│   │   ├── mocks/             # Geradores de mock
│   │   │   └── factory.ts
│   │   └── index.ts           # Exports públicos
│   └── package.json
│
├── api/                       # Backend
│   └── src/
│       └── middleware/
│           └── output-validator.ts  # Validação de saída
│
└── web/                       # Frontend
    └── src/
        └── lib/
            └── api-contract.ts      # Cliente HTTP tipado
```

## Fluxo de Dados

### 1. Definição do Contrato (Backend)

```typescript
// apps/shared-contracts/src/schemas/leads.ts
export const LeadSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
  status: z.enum(['new', 'contacted', 'qualified']),
  createdAt: z.date()
});

export const LeadListResponseSchema = z.object({
  data: z.array(LeadSchema),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number()
  })
});
```

### 2. Validação de Saída (Backend Middleware)

```typescript
// apps/api/src/routes/leads.ts
import { createOutputValidatorMiddleware } from '@/middleware/output-validator';
import { LeadListResponseSchema } from '@myapp/shared-contracts';

fastify.get('/leads', {
  preHandler: [createOutputValidatorMiddleware(LeadListResponseSchema)]
}, async (request, reply) => {
  const leads = await leadService.findAll();
  return { data: leads, pagination: { ... } };
  // ✅ Validado automaticamente antes de enviar
});
```

### 3. Consumo Tipado (Frontend)

```typescript
// apps/web/src/pages/leads.tsx
import { apiClient } from '@/lib/api-contract';
import { LeadListResponseSchema } from '@myapp/shared-contracts';

async function loadLeads() {
  const response = await apiClient.get('/leads', LeadListResponseSchema);
  // `response` é tipado como LeadListResponse automaticamente
  
  response.data.forEach(lead => {
    console.log(lead.name); // ✅ Autocomplete funciona
    console.log(lead.invalid); // ❌ Erro de compilação
  });
}
```

## Componentes

### 1. Shared Contracts (`@myapp/shared-contracts`)

**Propósito**: Definir contratos únicos usados por backend e frontend.

**Vantagens**:
- Mudança no schema quebra o build do frontend se houver incompatibilidade
- Tipos TypeScript inferidos automaticamente
- Documentação viva do contrato

### 2. Output Validator Middleware

**Propósito**: Garantir que nenhuma resposta da API viole o contrato.

**Funcionamento**:
- Intercepta resposta antes de enviar ao cliente
- Valida payload contra schema Zod
- Em modo strict: falha com erro 500 se violar contrato
- Em modo leniente: apenas loga warning

**Configuração**:
```typescript
// Modo strict (padrão) - ideal para dev/staging
createOutputValidatorMiddleware(schema, { strict: true })

// Modo leniente - produção com alta carga
createOutputValidatorMiddleware(schema, { 
  strict: false, 
  skipInProduction: true 
})
```

### 3. API Client (Frontend)

**Propósito**: Consumir API com type safety e validação automática.

**Recursos**:
- Valida input antes de enviar
- Valida resposta após receber
- Erros de contrato lançam exceção em desenvolvimento
- Fallback gracioso em produção

**Exemplo de Uso**:
```typescript
// GET
const leads = await apiClient.get('/leads', LeadListResponseSchema, { 
  page: 1, 
  limit: 10 
});

// POST
const newLead = await apiClient.post(
  '/leads',
  CreateLeadSchema,
  { name: 'John', email: 'john@example.com', phone: '1234567890' },
  LeadSingleResponseSchema
);

// PUT/PATCH
const updated = await apiClient.patch(
  '/leads/uuid-here',
  UpdateLeadSchema,
  { status: 'qualified' },
  LeadSingleResponseSchema
);

// DELETE
const result = await apiClient.delete(
  '/leads/uuid-here',
  z.object({ deleted: z.boolean() })
);
```

### 4. Mock Factory

**Propósito**: Gerar dados falsos válidos para desenvolvimento e testes.

**Uso**:
```typescript
import { createMock, createMockList } from '@myapp/shared-contracts/mocks';
import { LeadSchema } from '@myapp/shared-contracts';

// Mock único
const mockLead = createMock(LeadSchema, {
  name: 'Lead Personalizado'
});

// Lista de mocks
const mockLeads = createMockList(LeadSchema, 5);

// Mock específico
import { createMockLead } from '@myapp/shared-contracts/mocks';
const lead = createMockLead({ status: 'won', value: 50000 });
```

### 5. Contract Testing Script

**Propósito**: Validar automaticamente se a API em execução segue os schemas.

**Execução**:
```bash
# Local
npx ts-node scripts/contract-test.ts

# CI/CD
npm run contract-test
```

**Saída Esperada**:
```
🔍 Running Contract Tests...

Testing: GET /leads - List response structure... ✅ PASS (45ms)

============================================================
TEST SUMMARY
============================================================
Total: 1 | Passed: 1 | Failed: 0

✅ All contract tests passed!
```

## Benefícios

### Para Desenvolvedores Backend
- ✅ Detecção precoce de bugs de dados
- ✅ Documentação automática dos contratos
- ✅ Refatoração segura (types avisam se quebrar algo)
- ✅ Debug facilitado com logs de violação de contrato

### Para Desenvolvedores Frontend
- ✅ Autocomplete preciso em todas as chamadas API
- ✅ Types sempre sincronizados com backend
- ✅ Erros de integração detectados no build
- ✅ Menos tempo debugando problemas de formato de dados

### Para Usuários Finais
- ✅ UI não quebra com dados inesperados
- ✅ Mensagens de erro mais claras
- ✅ Performance consistente (dados sempre no formato esperado)
- ✅ Menos bugs em produção

## Configuração no Monorepo

### 1. Adicionar workspace (package.json raiz)

```json
{
  "workspaces": [
    "apps/*",
    "packages/*"
  ]
}
```

### 2. Instalar dependências

```bash
# No shared-contracts
cd apps/shared-contracts
npm install zod

# Na API
cd apps/api
npm install @myapp/shared-contracts@workspace:*

# No Web
cd apps/web
npm install @myapp/shared-contracts@workspace:*
```

### 3. Configurar tsconfig (apps/api/tsconfig.json)

```json
{
  "compilerOptions": {
    "paths": {
      "@myapp/shared-contracts": ["../shared-contracts/src/index.ts"]
    }
  }
}
```

## Melhores Práticas

### ✅ Faça
- Sempre validar output em rotas críticas
- Usar schemas compartilhados para tudo
- Rodar contract tests no CI/CD
- Manter schemas simples e focados
- Documentar mudanças breaking nos schemas

### ❌ Não Faça
- Duplicar tipos manualmente no frontend
- Ignorar erros de validação em produção (apenas logar)
- Criar schemas muito complexos/aninhados
- Mudar schemas sem versionamento adequado
- Validar apenas input (output é igualmente importante)

## Versionamento de Contratos

Para mudanças breaking:

1. **Versione a API**: `/v1/leads`, `/v2/leads`
2. **Mantenha compatibilidade**: Suporte ambas versões temporariamente
3. **Comunique mudança**: Documente no changelog
4. **Deprecie gradualmente**: Avise usuários com antecedência

Exemplo:
```typescript
// v1 schema
export const LeadSchemaV1 = z.object({ /* ... */ });

// v2 schema (breaking change)
export const LeadSchemaV2 = LeadSchemaV1.extend({
  newField: z.string().required()
});
```

## Troubleshooting

### Erro: "Contract violation detected"

**Causa**: Dados retornados pela API não batem com o schema.

**Solução**:
1. Verifique logs do backend para ver dados recebidos
2. Compare com definição do schema
3. Ajuste service/repository ou atualize schema

### Erro: "Module not found: @myapp/shared-contracts"

**Causa**: Workspace não configurado corretamente.

**Solução**:
```bash
npm install
# Ou
yarn install
```

### Performance lenta em produção

**Causa**: Validação de output adiciona overhead.

**Solução**:
```typescript
// Pula validação em produção
createOutputValidatorMiddleware(schema, { 
  skipInProduction: true 
})
```

## Próximos Passos

1. [ ] Expandir schemas para todos os módulos (users, proposals, etc.)
2. [ ] Integrar com Swagger/OpenAPI para documentação automática
3. [ ] Adicionar mais testes de contrato no CI/CD
4. [ ] Criar dashboard de métricas de violações de contrato
5. [ ] Implementar versionamento automático de schemas

## Referências

- [Zod Documentation](https://zod.dev/)
- [Design by Contract (Wikipedia)](https://en.wikipedia.org/wiki/Design_by_contract)
- [Monorepo Best Practices](https://monorepo.tools/)

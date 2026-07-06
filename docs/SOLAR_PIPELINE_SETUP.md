# 🚀 Solar Pipeline & Meta CAPI - Setup Guide

## Visão Geral
Este guia descreve como configurar e ativar o novo **Pipeline Solar** com integração automática ao **Meta Conversions API (CAPI)**.

---

## 1. Variáveis de Ambiente

Adicione as seguintes variáveis ao seu arquivo `.env` (backend):

```bash
# Meta Conversions API (CAPI) Configuration
META_PIXEL_ID=123456789012345        # Seu Pixel ID do Facebook
META_ACCESS_TOKEN=EAA...             # Token de Acesso de Longa Duração
META_CAPI_URL=https://graph.facebook.com/v18.0
META_CAPI_ENABLED=true               # Ativa/desativa os disparos
META_CAPI_DEBUG_MODE=false           # true para logs detalhados em dev

# Solar Pipeline Configuration
SOLAR_PIPELINE_ENABLED=true          # Ativa o pipeline solar
```

### Como obter o Token de Acesso:
1. Acesse [Facebook Business Manager](https://business.facebook.com)
2. Vá para **Events Manager** > **Data Sources** > **Settings**
3. Em **Conversions API**, clique em **Generate Access Token**
4. Selecione "Long-Lived Token" para evitar expiração frequente.

---

## 2. Configuração do Banco de Dados

Execute o script de população das etapas do pipeline:

```bash
# Substitua $DATABASE_URL pela sua string de conexão
psql $DATABASE_URL -f infra/scripts/populate-solar-pipeline.sql
```

**O que este script faz:**
- Cria o tipo ENUM `pipeline_stage` se não existir.
- Insere o pipeline "Sistema Solar".
- Popula as 10 etapas com seus respectivos gatilhos CAPI.
- É idempotente (pode ser rodado múltiplas vezes sem duplicar dados).

**Verificação:**
```sql
SELECT stage_key, name, capi_event 
FROM pipeline_stages 
JOIN pipelines ON pipelines.id = pipeline_stages.pipeline_id 
WHERE pipelines.name = 'Sistema Solar' 
ORDER BY order_index;
```

---

## 3. Validação da Integração

### Passo 1: Teste de Disparo (Modo Debug)
Com `META_CAPI_DEBUG_MODE=true`, mova um lead para a etapa **"Elaboração de Proposta"**.
Verifique os logs do backend. Você deve ver algo como:
```
[MetaCAPI] Event 'Lead' sent for lead_id: xyz. Status: 200. Response: { "events": [...] }
```

### Passo 2: Verificar Logs no Banco
A tabela `meta_capi_logs` deve registrar o evento:
```sql
SELECT event_name, status, response_data, created_at 
FROM meta_capi_logs 
ORDER BY created_at DESC 
LIMIT 5;
```

### Passo 3: Facebook Events Manager
1. Acesse o **Events Manager** do Facebook.
2. Filtre pelo seu Pixel ID.
3. Procure pelos eventos `Lead`, `InitiateCheckout` ou `Purchase`.
4. O status deve aparecer como "Ativo" com dados recebidos recentemente.

---

## 4. Solução de Problemas (Troubleshooting)

| Problema | Causa Provável | Solução |
|----------|----------------|---------|
| **Erro 400 (Bad Request)** | Dados do usuário incompletos (falta email/tel) | Garanta que o lead tem email e telefone válidos antes da etapa 3. |
| **Erro 403 (Forbidden)** | Token de acesso inválido ou expirado | Gere um novo token em Business Manager e atualize o `.env`. |
| **Evento não aparece no FB** | Modo Debug ativo ou delay de processamento | Aguarde até 30 min. Verifique se `META_CAPI_ENABLED=true`. |
| **Ícone de erro na UI** | Falha no envio da API | Verifique `meta_capi_logs` no banco para detalhes do erro. |
| **Pipeline Solar não aparece** | Script de migração não rodado | Execute o script `populate-solar-pipeline.sql` novamente. |

---

## 5. Checklist de Deploy

Antes de subir para produção, confirme:

- [ ] Variáveis de ambiente configuradas no servidor de produção.
- [ ] Script SQL executado no banco de produção.
- [ ] Token de acesso é do tipo "Long-Lived".
- [ ] `META_CAPI_DEBUG_MODE=false` em produção (para performance).
- [ ] Teste de movimentação de lead realizado em staging.
- [ ] Eventos confirmados no Facebook Events Manager.

---

## 6. Próximos Passos Sugeridos

1. **Regras de Qualidade:** Implementar pontuação de lead (Lead Score) antes do disparo CAPI.
2. **Retry Automático:** Criar job agendado para retentar envios falhos (`status = 'failed'`).
3. **Dashboard de Conversão:** Criar painel mostrando taxa de conversão por etapa do funil.

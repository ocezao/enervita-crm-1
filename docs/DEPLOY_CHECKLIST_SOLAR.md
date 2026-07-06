# ✅ Checklist de Validação - Pipeline Solar & Meta CAPI

Use este checklist para validar a implementação antes e após o deploy.

## 📋 Pré-Deploy (Ambiente de Desenvolvimento/Staging)

### 1. Configuração de Ambiente
- [ ] Arquivo `.env` atualizado com `META_PIXEL_ID`, `META_ACCESS_TOKEN`.
- [ ] Variável `META_CAPI_ENABLED=true` definida.
- [ ] Variável `SOLAR_PIPELINE_ENABLED=true` definida.

### 2. Banco de Dados
- [ ] Script `infra/scripts/populate-solar-pipeline.sql` executado sem erros.
- [ ] Query de verificação retorna as 10 etapas do pipeline Solar.
- [ ] Tabela `meta_capi_logs` existe no banco.

### 3. Backend (API)
- [ ] Serviço `MetaCAPIAdapter` consegue instanciar sem erros.
- [ ] Logs de debug aparecem ao mover um lead (com `META_CAPI_DEBUG_MODE=true`).
- [ ] Movimentação de lead funciona mesmo se o CAPI falhar (Fail-Safe).

### 4. Frontend (UI)
- [ ] Página de Pipeline exibe as 10 colunas corretas ("Novo Lead" a "Pedido Perdido").
- [ ] Ícones de status CAPI (📡) aparecem nos cards após movimentação.
- [ ] Página de Detalhe do Lead exibe a seção "Integração Meta Ads".
- [ ] Logs de auditoria são carregados na página de detalhe.

---

## 🚀 Pós-Deploy (Produção)

### 1. Integração Meta
- [ ] Eventos aparecem no **Facebook Events Manager** em tempo real.
- [ ] Evento `Lead` dispara ao mover para "Elaboração de Proposta".
- [ ] Evento `InitiateCheckout` dispara ao mover para "Fechamento".
- [ ] Evento `Purchase` dispara ao mover para "Assinatura de Contrato" (com valor correto).

### 2. Performance e Estabilidade
- [ ] Latência da API não aumentou significativamente (< 200ms adicional).
- [ ] Nenhum erro 500 relacionado ao módulo Solar nos logs.
- [ ] `META_CAPI_DEBUG_MODE=false` em produção.

### 3. Dados e Auditoria
- [ ] Tabela `meta_capi_logs` está registrando todos os disparos.
- [ ] É possível rastrear qual lead gerou qual evento no Facebook.

---

## 🐛 Critérios de Aceite (Definition of Done)

A funcionalidade é considerada **PRONTA** quando:
1. Um lead pode ser movido através das 10 etapas sem erros.
2. Os 3 eventos principais (Lead, InitiateCheckout, Purchase) são confirmados no Facebook.
3. Se o Facebook estiver fora do ar, o lead **ainda assim** pode ser movido (resiliência).
4. O usuário consegue ver visualmente quais leads já foram reportados ao Meta.

---

## 📞 Contatos de Suporte

- **Dúvidas Técnicas:** Verifique `docs/SOLAR_PIPELINE_SETUP.md`.
- **Erros de Integração:** Consulte a tabela `meta_capi_logs`.
- **Problemas no Facebook:** Verifique a validade do Token em Business Manager.

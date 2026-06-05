# Homologação funcional E2E — CRM Custom Enervita

Data: 2026-06-04
Ambiente: `https://crm.enervita.com.br`
Tipo: E2E funcional com dados sintéticos controlados
Status: **GO COM RESSALVAS**

## Escopo executado

- Login admin autenticado.
- Verificação de sessão `/api/me`.
- Criação de lead sintético marcado como QA.
- Tag do lead sintético.
- Filtro/listagem por tag QA.
- Abertura do detalhe do lead.
- Alteração de etapa do lead para `qualificacao`.
- Edição de campos do lead.
- Criação de tarefa vinculada ao lead.
- Listagem de tarefas do lead.
- Conclusão da tarefa.
- Criação de atividade/timeline.
- Listagem da timeline.
- Criação de proposta vinculada ao lead.
- Listagem de propostas do lead.
- Consulta de eventos não-Google do lead.
- Limpeza do dado sintético.

## Resultado

- Login: OK.
- Permissões efetivas do usuário: 38.
- Lead sintético criado: OK.
- Filtro/listagem: OK.
- Detalhe do lead: OK.
- Alteração de etapa: OK.
- Edição de campos: OK.
- Tarefa criada: OK.
- Tarefa listada: OK.
- Tarefa concluída: OK após retry técnico corrigindo header indevido da chamada.
- Timeline criada/listada: OK.
- Proposta criada/listada: OK.
- Tracking events não-Google consultados: OK; 3 eventos retornados.
- Limpeza: OK; lead sintético removido e verificado com `404 Lead not found`.

## Ressalva

A primeira tentativa de `PATCH /api/tasks/:id/complete` e `DELETE /api/leads/:id` retornou `400` porque o script de homologação enviou `Content-Type: application/json` em requests sem body. A chamada foi corrigida e os mesmos passos passaram em retry. Isso foi classificado como erro do script de homologação, não como falha do CRM.

Observação técnica: a API retorna status de tarefa como `concluido`; scripts de teste devem aceitar o valor real do backend, não `concluida`.

## Artefatos

- `functional-e2e-initial.json`
- `cleanup-retry.json`

## Segurança

- Nenhuma senha/token foi gravada neste relatório.
- O lead usado foi sintético, com domínio `example.invalid`.
- O lead sintético foi removido ao final.
- Twenty legado não foi tocado.

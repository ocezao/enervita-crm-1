# Plano de Melhorias - Página de Campanhas (Ads)

## Visão Geral

Este documento descreve as melhorias planejadas para a página de Campanhas do CRM, visando tornar a exibição de dados mais intuitiva, completa e fácil de compreensão.

---

## 1. Estado Atual

A página atual já possui:
- ✅ Três modos de visualização (Cliente, Gestor, Técnico)
- ✅ Filtros por status, objetivo, busca global e ordenação
- ✅ Cards de métricas principais (Campanhas, Grupos, Anúncios, Leads, Públicos)
- ✅ Visualização hierárquica (Campanhas → Conjuntos → Anúncios)
- ✅ Sincronização com Meta Ads

---

## 2. Melhorias Propostas

### 2.1. Dashboard Executivo (Visão Consolidada)

**Objetivo:** Criar uma visão unificada que mostre todos os dados importantes em um único lugar.

#### Seção A: Cards de KPIs Principais (Topo da Página)
| Métrica | Descrição | Formato |
|---------|-----------|---------|
| **Investimento Total** | Soma de todos os gastos no período | R$ formatado |
| **Receita Atribuída** | Receita gerada pelas campanhas (se disponível) | R$ formatado |
| **ROAS** | Retorno sobre investimento em anúncios | X.XX |
| **CPL Médio** | Custo por lead médio | R$ XX,XX |
| **Leads Totais** | Total de leads gerados | Número inteiro |
| **Cliques** | Total de cliques nos anúncios | Número inteiro |
| **Impressões** | Total de impressões | Número formatado (K, M) |
| **CTR Médio** | Taxa de clique média | Porcentagem |

#### Seção B: Gráfico de Evolução Temporal
- **Tipo:** Gráfico de linha ou área
- **Eixo X:** Dias do período selecionado
- **Eixo Y:** Valores de investimento, leads e receita
- **Legenda:** Investimento (R$), Leads (qtd), Conversões (qtd)
- **Filtro:** Período (7, 14, 30, 60, 90 dias ou personalizado)

#### Seção C: Distribuição por Campanha
- **Tipo:** Gráfico de barras horizontais
- **Ordenação:** Maior investimento ou maior conversão
- **Dados:** Nome da campanha, investimento, leads, CPL, ROAS

---

### 2.2. Tabela Inteligente de Campanhas

**Objetivo:** Substituir ou complementar as visualizações atuais com uma tabela rica em informações.

#### Colunas Sugeridas:
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| **Status** | Badge | Ícone + cor (Ativa, Pausada, Inativa, Erro) |
| **Campanha** | Texto + ID | Nome da campanha + ID externo |
| **Período** | Data | Data de início e fim (ou "Em andamento") |
| **Objetivo** | Badge | Ícone representando o objetivo (Leads, Tráfego, Vendas) |
| **Investimento** | Moeda | Valor gasto no período |
| **Orçamento** | Moeda | Orçamento total definido |
| **Progresso** | Barra | % do orçamento utilizado |
| **Impressões** | Número | Total de impressões (formato K/M) |
| **Cliques** | Número | Total de cliques |
| **CTR** | Porcentagem | Taxa de clique (Cliques ÷ Impressões) |
| **Leads** | Número | Total de leads gerados |
| **CPL** | Moeda | Custo por lead (Investimento ÷ Leads) |
| **Conversões** | Número | Total de conversões atribuídas |
| **CPA** | Moeda | Custo por aquisição |
| **Receita** | Moeda | Receita atribuída à campanha |
| **ROAS** | Número | Retorno sobre investimento |
| **Ações** | Ícones | Editar, Pausar, Duplicar, Ver detalhes |

#### Funcionalidades da Tabela:
- ✅ Ordenação por qualquer coluna (crescente/decrescente)
- ✅ Filtros inline por coluna
- ✅ Seleção múltipla para ações em lote
- ✅ Expansão de linha para ver conjuntos de anúncios
- ✅ Indicadores visuais de performance (setas ↑↓, cores)
- ✅ Exportação para CSV/Excel

---

### 2.3. Drill-down Hierárquico

**Objetivo:** Permitir navegação fluida entre níveis de granularidade.

#### Nível 1: Campanhas
- Visão macro com KPIs agregados
- Comparativo entre campanhas
- Alertas de performance

#### Nível 2: Conjuntos de Anúncios (Ad Sets)
Ao expandir uma campanha:
- Público-alvo (nome, tamanho estimado, tipo)
- Regiões/geolocalização
- Faixa etária e gênero
- Posicionamentos (Feed, Stories, Reels, Audience Network)
- Otimização (evento, janela de atribuição)
- Orçamento do conjunto
- Performance individual (investimento, leads, CPL)

#### Nível 3: Anúncios (Ads)
Ao expandir um conjunto:
- Preview do criativo (imagem/vídeo)
- Copy (texto principal, título, descrição)
- Call-to-action (CTA)
- URL de destino
- Status de aprovação
- Performance individual
- Frequência do anúncio

#### Nível 4: Públicos e Regiões
- **Públicos:**
  - Custom Audiences (lista de clientes, visitantes do site)
  - Lookalike Audiences (públicos semelhantes)
  - Saved Audiences (públicos salvos por interesses/comportamentos)
  - Tamanho estimado vs. alcance real
  
- **Regiões:**
  - Mapa de calor geográfico
  - Lista de cidades/estados/países
  - Investimento por região
  - Leads/conversões por região
  - CPL por região

---

### 2.4. Painel de Públicos

**Objetivo:** Centralizar informações sobre públicos utilizados nas campanhas.

#### Estrutura:
- **Cards de Resumo:**
  - Total de públicos ativos
  - Público com melhor performance (menor CPL)
  - Público com maior alcance
  - Overlap entre públicos (se disponível)

- **Tabela de Públicos:**
  | Coluna | Descrição |
  |--------|-----------|
  | Nome | Nome do público |
  | Tipo | Custom, Lookalike, Saved |
  | Tamanho | Estimativa de pessoas alcançáveis |
  | Campanhas | Nº de campanhas usando este público |
  | Investimento | Total investido neste público |
  | Leads | Leads gerados |
  | CPL | Custo por lead médio |
  | Ações | Editar, Duplicar, Excluir |

---

### 2.5. Análise Geográfica

**Objetivo:** Visualizar performance por localização.

#### Componentes:
- **Mapa Interativo:**
  - Heatmap de investimentos
  - Bolhas proporcionais ao número de leads
  - Cores indicando CPL (verde = bom, vermelho = ruim)
  
- **Tabela de Regiões:**
  | Região | Investimento | Impressões | Cliques | Leads | CPL | Conversões |
  |--------|-------------|------------|---------|-------|-----|------------|
  | São Paulo | R$ 5.000 | 100K | 2K | 150 | R$ 33,33 | 45 |
  | Rio de Janeiro | R$ 3.000 | 80K | 1.5K | 90 | R$ 33,33 | 28 |

---

### 2.6. Análise de Custos e Resultados

**Objetivo:** Facilitar a compreensão do ROI das campanhas.

#### Cards de Eficiência:
- **Custo por Resultado:**
  - CPL (Custo por Lead)
  - CPC (Custo por Clique)
  - CPM (Custo por Mil Impressões)
  - CPA (Custo por Aquisição/Conversão)

- **Gráficos:**
  - Evolução do CPL ao longo do tempo
  - Distribuição de investimento por campanha
  - Comparativo de ROAS entre campanhas

- **Alertas de Performance:**
  - 🔴 CPL acima do esperado (> X% da meta)
  - 🟡 Orçamento quase esgotado (> 80% utilizado)
  - 🟢 Campanha com ROAS excepcional

---

### 2.7. Timeline de Eventos

**Objetivo:** Mostrar histórico de alterações e eventos importantes.

#### Eventos a Registrar:
- Criação de campanha/conjunto/anúncio
- Pausa/reativação
- Alterações de orçamento
- Alterações de público
- Aprovações/reprovações
- Picos de performance
- Mudanças de status

---

## 3. Melhorias de UX/UI

### 3.1. Layout Responsivo
- Grid adaptável para mobile, tablet e desktop
- Cards empilháveis em telas menores
- Tabelas com scroll horizontal em mobile

### 3.2. Filtros Avançados
- **Painel de Filtros Lateral:**
  - Período (date picker)
  - Plataforma (Meta, Google, etc.)
  - Objetivo da campanha
  - Status (Ativa, Pausada, Inativa)
  - Faixa de investimento
  - Faixa de CPL/ROAS
  - Públicos específicos
  - Regiões específicas

- **Filtros Salvos:**
  - Permitir salvar combinações de filtros
  - Acesso rápido a filtros frequentes

### 3.3. Tooltips e Help Text
- Explicação de cada métrica ao passar o mouse
- Links para documentação
- Sugestões de otimização baseadas em IA

### 3.4. Comparação de Períodos
- Toggle para comparar com período anterior
- Indicadores de variação (% e absoluto)
- Gráficos sobrepostos

---

## 4. Recursos de Ação

### 4.1. Ações Rápidas
- Pausar/reativar campanha diretamente da tabela
- Duplicar campanha/conjunto/anúncio
- Editar orçamento
- Alterar status de aprovação

### 4.2. Exportação e Relatórios
- Exportar dados para CSV/Excel
- Gerar PDF com resumo executivo
- Agendar envio automático de relatórios

### 4.3. Integrações
- Link direto para gerenciador de anúncios (Meta Ads Manager)
- Webhook para notificações de eventos
- API para sincronização bidirecional

---

## 5. Implementação Sugerida

### Fase 1 (Prioridade Alta)
1. ✅ Manter os três modos de visualização atuais
2. 🆕 Adicionar cards de KPIs no topo (Investimento, Leads, CPL, ROAS)
3. 🆕 Criar gráfico de evolução temporal
4. 🆕 Melhorar tabela de campanhas com mais colunas
5. 🆕 Adicionar drill-down para conjuntos e anúncios

### Fase 2 (Prioridade Média)
1. 🆕 Painel de públicos
2. 🆕 Análise geográfica com mapa
3. 🆕 Filtros avançados laterais
4. 🆕 Comparação de períodos
5. 🆕 Exportação de dados

### Fase 3 (Prioridade Baixa)
1. 🆕 Timeline de eventos
2. 🆕 Alertas inteligentes de performance
3. 🆕 Sugestões de otimização com IA
4. 🆕 Relatórios automatizados por email

---

## 6. Considerações Técnicas

### 6.1. Performance
- Lazy loading para dados históricos
- Paginação e virtualização de tabelas grandes
- Cache de dados frequentemente acessados

### 6.2. Acessibilidade
- Contraste de cores adequado
- Labels descritivos para leitores de tela
- Navegação por teclado

### 6.3. Internacionalização
- Suporte a múltiplos idiomas
- Formatação de moeda local
- Fusos horários corretos

---

## 7. Métricas de Sucesso

- ⏱️ Tempo médio gasto na página (aumento indica engajamento)
- 📉 Redução de tickets de suporte sobre dados de campanhas
- 👥 Aumento de usuários ativos na página de campanhas
- 🎯 Melhoria na tomada de decisão (feedback qualitativo)

---

## 8. Próximos Passos

1. Validar este plano com stakeholders
2. Priorizar funcionalidades para MVP
3. Criar wireframes/mockups das novas telas
4. Desenvolver em sprints iterativos
5. Coletar feedback dos usuários
6. Iterar e melhorar continuamente

---

**Documento criado em:** 2026-01-XX
**Responsável:** Equipe de Desenvolvimento
**Status:** Em revisão

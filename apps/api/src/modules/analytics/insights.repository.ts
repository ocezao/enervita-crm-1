import pg from 'pg';

type InsightType = 'pattern' | 'recommendation' | 'alert' | 'opportunity';
type InsightPriority = 'high' | 'medium' | 'low';

export type Insight = {
  id: string;
  type: InsightType;
  priority: InsightPriority;
  title: string;
  description: string;
  metric?: string;
  trend?: 'up' | 'down' | 'stable';
  comparison?: string;
  action?: string;
  category: 'conversion' | 'source' | 'timing' | 'pipeline';
};

export type InsightsResult = {
  generatedAt: string;
  period: string;
  insights: Insight[];
  summary: {
    totalLeads: number;
    conversionRate: number;
    avgTimeToConvert: number;
    topSource: string;
    bottleneck: string;
  };
};

export type InsightsRepository = {
  getInsights(tenantId: string, days?: number): Promise<InsightsResult>;
  close?: () => Promise<void>;
};

export function createStaticInsightsRepository(): InsightsRepository {
  return {
    async getInsights(_tenantId, days = 30) {
      return {
        generatedAt: new Date().toISOString(),
        period: `${days}d`,
        insights: [],
        summary: {
          totalLeads: 0,
          conversionRate: 0,
          avgTimeToConvert: 0,
          topSource: 'Sem dados',
          bottleneck: 'Sem dados',
        },
      };
    },
  };
}

export function createPgInsightsRepository(databaseUrl: string): InsightsRepository {
  const pool = new pg.Pool({ connectionString: databaseUrl });

  return {
    async getInsights(tenantId, days = 30) {
      const safeDays = Number.isFinite(days) ? Math.max(7, Math.min(365, Math.trunc(days))) : 30;
      const [
        summaryRows,
        topSourceRows,
        wonPatternsRows,
        lostPatternsRows,
        stuckRows,
        speedRows,
      ] = await Promise.all([
        // 1. Summary
        pool.query(
          `SELECT COUNT(*)::int AS total_leads,
                  COALESCE(ROUND((COUNT(*) FILTER (WHERE stage = 'contrato_enervita')::numeric / NULLIF(COUNT(*), 0) * 100), 2), 0) AS conversion_rate,
                  COALESCE(ROUND(AVG(CASE WHEN converted_at IS NOT NULL THEN EXTRACT(EPOCH FROM (converted_at - created_at)) / 86400 END), 2), 0) AS avg_days_to_convert
             FROM leads
            WHERE tenant_id = $1
              AND created_at >= NOW() - INTERVAL '${safeDays} days'`,
          [tenantId],
        ),
        // 2. Top source
        pool.query(
          `SELECT COALESCE(NULLIF(source, ''), 'Desconhecida') AS source, COUNT(*)::int AS total
             FROM leads
            WHERE tenant_id = $1
              AND created_at >= NOW() - INTERVAL '${safeDays} days'
            GROUP BY source
            ORDER BY total DESC
            LIMIT 1`,
          [tenantId],
        ),
        // 3. Won patterns (contrato_enervita)
        pool.query(
          `SELECT
              COALESCE(NULLIF(source, ''), 'Desconhecida') AS source,
              ROUND(AVG(COALESCE(estimated_ticket, 0))::numeric, 0) AS avg_ticket,
              COUNT(*)::int AS won_count
            FROM leads
            WHERE tenant_id = $1
              AND stage = 'contrato_enervita'
              AND created_at >= NOW() - INTERVAL '${safeDays} days'
            GROUP BY source
            ORDER BY won_count DESC
            LIMIT 3`,
          [tenantId],
        ),
        // 4. Lost patterns (perdido)
        pool.query(
          `SELECT
              COALESCE(NULLIF(source, ''), 'Desconhecida') AS source,
              COALESCE(NULLIF(last_stage_before_loss, ''), stage) AS last_stage,
              ROUND(AVG(COALESCE(estimated_ticket, 0))::numeric, 0) AS avg_ticket,
              COUNT(*)::int AS lost_count
            FROM leads
            WHERE tenant_id = $1
              AND stage = 'perdido'
              AND created_at >= NOW() - INTERVAL '${safeDays} days'
            GROUP BY source, last_stage
            ORDER BY lost_count DESC
            LIMIT 3`,
          [tenantId],
        ),
        // 5. Stuck high-value leads
        pool.query(
          `SELECT COUNT(*)::int AS stuck
             FROM leads
            WHERE tenant_id = $1
              AND stage NOT IN ('contrato_enervita', 'perdido')
              AND COALESCE(estimated_ticket, 0) > 500
              AND updated_at < NOW() - INTERVAL '7 days'
              AND created_at >= NOW() - INTERVAL '${safeDays} days'`,
          [tenantId],
        ),
        // 6. Speed insight
        pool.query(
          `SELECT
              COALESCE(NULLIF(source, ''), 'Desconhecida') AS source,
              ROUND(AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400)::numeric, 1) AS avg_days
            FROM leads
            WHERE tenant_id = $1
              AND stage = 'contrato_enervita'
              AND created_at >= NOW() - INTERVAL '${safeDays} days'
            GROUP BY source
            ORDER BY avg_days ASC
            LIMIT 1`,
          [tenantId],
        ),
      ]);

      const summaryRow = summaryRows.rows[0] as {
        total_leads: string;
        conversion_rate: string;
        avg_days_to_convert: string;
      };
      const totalLeads = Number(summaryRow?.total_leads ?? 0);
      const conversionRate = Number(summaryRow?.conversion_rate ?? 0);
      const avgTimeToConvert = Number(summaryRow?.avg_days_to_convert ?? 0);
      const topSource = topSourceRows.rows[0]?.source ?? 'N/A';

      const insights: Insight[] = [];

      // Insight 1: Panel habilitado
      insights.push({
        id: 'pattern-1',
        type: totalLeads > 0 ? 'pattern' : 'alert',
        priority: totalLeads > 0 ? 'medium' : 'low',
        title: totalLeads > 0 ? 'Painel de insights habilitado' : 'Ainda sem volume suficiente',
        description:
          totalLeads > 0
            ? `${totalLeads} leads registrados no período para análise de conversão e padrões.`
            : 'Adicione leads nas últimas semanas para gerar insights acionáveis.',
        metric: `Leads: ${totalLeads} | Conversão: ${conversionRate}%`,
        trend: totalLeads > 0 ? 'stable' : 'down',
        comparison: `Janela: últimos ${safeDays} dias`,
        action: 'Acompanhe padrões de ganho e perda abaixo.',
        category: 'conversion',
      });

      // Insight 2: Won patterns
      const wonPatterns = wonPatternsRows.rows as Array<{
        source: string;
        avg_ticket: string;
        won_count: string;
      }>;
      if (wonPatterns.length > 0 && Number(wonPatterns[0].won_count) > 0) {
        const best = wonPatterns[0];
        insights.push({
          id: 'pattern-won-1',
          type: 'pattern',
          priority: 'high',
          title: `Padrão de ganho: origem "${best.source}"`,
          description:
            `${best.won_count} contratos ganhos vieram de "${best.source}" com ticket médio de R$ ${Number(best.avg_ticket).toLocaleString('pt-BR')}.`,
          metric: `${best.won_count} contratos | R$ ${Number(best.avg_ticket).toLocaleString('pt-BR')} ticket médio`,
          trend: 'up',
          comparison: `Origem mais lucrativa do período`,
          action: `Dobre investimento em "${best.source}" e replique a estratégia de abordagem.`,
          category: 'source',
        });
      }

      // Insight 3: Lost patterns
      const lostPatterns = lostPatternsRows.rows as Array<{
        source: string;
        last_stage: string;
        avg_ticket: string;
        lost_count: string;
      }>;
      if (lostPatterns.length > 0 && Number(lostPatterns[0].lost_count) > 0) {
        const worst = lostPatterns[0];
        const stageLabels: Record<string, string> = {
          novo_lead: 'Novo lead',
          qualificacao: 'Qualificação',
          atendimento_iniciado: 'Atendimento iniciado',
          conta_recebida: 'Conta recebida',
          diagnostico: 'Diagnóstico',
          proposta_enviada: 'Proposta enviada',
        };
        const lastStageLabel = stageLabels[worst.last_stage] ?? worst.last_stage;
        insights.push({
          id: 'pattern-lost-1',
          type: 'alert',
          priority: 'high',
          title: `Padrão de perda: "${worst.source}" parou em "${lastStageLabel}"`,
          description:
            `${worst.lost_count} leads de "${worst.source}" foram perdidos após ficarem parados em "${lastStageLabel}". Ticket médio: R$ ${Number(worst.avg_ticket).toLocaleString('pt-BR')}.`,
          metric: `${worst.lost_count} perdidos | R$ ${Number(worst.avg_ticket).toLocaleString('pt-BR')} ticket`,
          trend: 'down',
          comparison: `Maior causa de perda do período`,
          action: `Crie follow-up automático para leads que ficam >3 dias em "${lastStageLabel}".`,
          category: 'pipeline',
        });
      }

      // Insight 4: Stuck high-value leads
      const stuckCount = Number(stuckRows.rows[0]?.stuck ?? 0);
      if (stuckCount > 0) {
        insights.push({
          id: 'opportunity-stuck',
          type: 'opportunity',
          priority: 'high',
          title: `${stuckCount} leads de alto valor parados`,
          description:
            `${stuckCount} leads com ticket > R$500 não são atualizados há mais de 7 dias. Risco de perda por esfriamento.`,
          metric: `${stuckCount} leads parados`,
          trend: 'down',
          comparison: 'Últimos 7 dias sem atualização',
          action: 'Priorize follow-up nesses leads antes que esfriem definitivamente.',
          category: 'pipeline',
        });
      }

      // Insight 5: Fastest converting source
      const speedRow = speedRows.rows[0] as
        | { source: string; avg_days: string }
        | undefined;
      if (speedRow && Number(speedRow.avg_days) > 0) {
        insights.push({
          id: 'pattern-speed-1',
          type: 'pattern',
          priority: 'medium',
          title: `Conversão mais rápida: "${speedRow.source}"`,
          description:
            `Leads de "${speedRow.source}" convertem em média em ${Number(speedRow.avg_days)} dias — mais rápido que a média de ${avgTimeToConvert} dias.`,
          metric: `${Number(speedRow.avg_days)} dias vs. ${avgTimeToConvert} dias média`,
          trend: 'up',
          comparison: `Velocidade de conversão por origem`,
          action: `Priorize leads de "${speedRow.source}" no funil para maximizar receita.`,
          category: 'timing',
        });
      }

      // Insight 6: Low conversion alert
      if (conversionRate < 10 && totalLeads >= 10) {
        insights.push({
          id: 'alert-low-conv',
          type: 'alert',
          priority: 'high',
          title: 'Taxa de conversão muito baixa',
          description:
            `Apenas ${conversionRate}% dos leads estão convertendo. Isso indica problemas na qualificação ou no processo comercial.`,
          metric: `${conversionRate}% conversão`,
          trend: 'down',
          comparison: `Média ideal: >15% para energia solar`,
          action: 'Revise critérios de qualificação e treine equipe em objeções comuns.',
          category: 'conversion',
        });
      }

      // Sort by priority
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      insights.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

      return {
        generatedAt: new Date().toISOString(),
        period: `${safeDays}d`,
        insights,
        summary: {
          totalLeads,
          conversionRate,
          avgTimeToConvert,
          topSource,
          bottleneck: totalLeads > 0
            ? stuckCount > 0
              ? `${stuckCount} leads de alto valor precisam de atenção`
              : 'Acompanhe gargalos por etapa'
            : 'Volume',
        },
      };
    },

    async close() {
      await pool.end();
    },
  };
}

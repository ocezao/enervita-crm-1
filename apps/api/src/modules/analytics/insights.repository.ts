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
      const [summaryRows, topSourceRows] = await Promise.all([
        pool.query(
          `SELECT COUNT(*)::int AS total_leads,
                  COALESCE(ROUND((COUNT(*) FILTER (WHERE stage = 'contrato_enervita')::numeric / NULLIF(COUNT(*), 0) * 100), 2), 0) AS conversion_rate,
                  COALESCE(ROUND(AVG(CASE WHEN converted_at IS NOT NULL THEN EXTRACT(EPOCH FROM (converted_at - created_at)) / 86400 END), 2), 0) AS avg_days_to_convert
             FROM leads
            WHERE tenant_id = $1
              AND created_at >= NOW() - INTERVAL '${safeDays} days'`,
          [tenantId],
        ),
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

      const insights: Insight[] = [
        {
          id: 'pattern-1',
          type: totalLeads > 0 ? 'pattern' : 'alert',
          priority: totalLeads > 0 ? 'medium' : 'low',
          title: totalLeads > 0 ? 'Painel de insights habilitado' : 'Ainda sem volume suficiente',
          description:
            totalLeads > 0
              ? 'Há leads registrados no período para análise básica de conversão e fontes.'
              : 'Adicione leads nas últimas semanas para gerar insights acionáveis.',
          metric: `Leads no período: ${totalLeads}`,
          trend: totalLeads > 0 ? 'stable' : 'down',
          comparison: `Janela: últimos ${safeDays} dias`,
          action: 'Acompanhe conversões por origem de entrada.',
          category: 'conversion',
        },
      ];

      return {
        generatedAt: new Date().toISOString(),
        period: `${safeDays}d`,
        insights,
        summary: {
          totalLeads,
          conversionRate,
          avgTimeToConvert,
          topSource,
          bottleneck: totalLeads > 0 ? 'Aumentar lead qualification por origem' : 'Volume',
        },
      };
    },

    async close() {
      await pool.end();
    },
  };
}

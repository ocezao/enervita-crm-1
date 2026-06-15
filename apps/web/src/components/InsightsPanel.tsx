import { useEffect, useState } from 'react';
import { api } from '../lib/api/crmApi';

type InsightType = 'pattern' | 'recommendation' | 'alert' | 'opportunity';
type InsightPriority = 'high' | 'medium' | 'low';

type Insight = {
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

type InsightsData = {
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

const TYPE_ICONS: Record<InsightType, string> = {
  pattern: '🔍',
  recommendation: '💡',
  alert: '⚠️',
  opportunity: '🎯',
};

const PRIORITY_COLORS: Record<InsightPriority, string> = {
  high: 'border-red-500 bg-red-50',
  medium: 'border-yellow-500 bg-yellow-50',
  low: 'border-blue-500 bg-blue-50',
};

const TREND_ICONS: Record<string, string> = {
  up: '📈',
  down: '📉',
  stable: '➡️',
};

export function InsightsPanel() {
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  async function loadInsights() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getInsights(days);
      setInsights(data);
    } catch (err) {
      setError('Erro ao carregar insights');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadInsights();
  }, [days]);

  if (loading) {
    return (
      <div className="p-6 bg-white rounded-lg shadow">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-gray-100 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-white rounded-lg shadow">
        <div className="text-red-600">{error}</div>
        <button onClick={loadInsights} className="mt-2 text-sm text-blue-600 hover:underline">
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!insights) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Insights Inteligentes</h2>
        <select
          value={days}
          onChange={(event) => setDays(Number(event.target.value))}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          <option value={7}>Últimos 7 dias</option>
          <option value={30}>Últimos 30 dias</option>
          <option value={90}>Últimos 90 dias</option>
          <option value={365}>Último ano</option>
        </select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-500">Total de Leads</p>
          <p className="text-2xl font-bold">{insights.summary.totalLeads}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-500">Taxa de Conversão</p>
          <p className="text-2xl font-bold">{insights.summary.conversionRate}%</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-500">Tempo Médio (dias)</p>
          <p className="text-2xl font-bold">{insights.summary.avgTimeToConvert}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-500">Top Source</p>
          <p className="text-lg font-bold truncate">{insights.summary.topSource}</p>
        </div>
      </div>

      <p className="text-xs text-gray-500">{insights.summary.bottleneck}</p>
      <p className="text-xs text-gray-500">Gerado em: {new Date(insights.generatedAt).toLocaleString('pt-BR')}</p>

      <div className="space-y-4">
        {insights.insights.length === 0 ? (
          <div className="p-6 bg-white rounded-lg shadow text-center text-gray-500">
            Nenhum insight disponível para este período.
          </div>
        ) : (
          insights.insights.map((item) => (
            <div key={item.id} className={`p-4 bg-white rounded-lg shadow border-l-4 ${PRIORITY_COLORS[item.priority]}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span>{TYPE_ICONS[item.type]}</span>
                  <strong>{item.title}</strong>
                </div>
                {item.trend ? <span>{TREND_ICONS[item.trend]}</span> : null}
              </div>
              <p className="text-sm text-gray-600 mt-2">{item.description}</p>
              {item.metric ? <p className="text-xs mt-2">{item.metric}</p> : null}
              {item.comparison ? <p className="text-xs text-gray-500">{item.comparison}</p> : null}
              {item.action ? <p className="text-xs text-blue-700 mt-2"><strong>Recomendação:</strong> {item.action}</p> : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

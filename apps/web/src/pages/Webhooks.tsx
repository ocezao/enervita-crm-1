import { useState } from 'react';
import { useWebhooks } from '../hooks/useCrm';
import { PageHeader } from '../components/ui/LayoutComponents';
import { Link } from 'react-router-dom';
import { Card, Button, Badge, type BadgeVariant } from '../components/ui/Base';
import { Link2, ExternalLink, Activity, Terminal, Shield, RefreshCw, CheckCircle2 } from 'lucide-react';
import { formatDate } from '../lib/utils';
import type { WebhookDelivery } from '../lib/api/types';

function webhookStatusLabel(status: string) {
  if (status === 'planned') return 'planejado';
  if (status === 'active') return 'ativo';
  if (status === 'failing') return 'falhando';
  return 'inativo';
}

function webhookBadgeVariant(status: string): BadgeVariant {
  if (status === 'active') return 'success';
  if (status === 'failing') return 'error';
  return 'default';
}

function deliveryStatusLabel(status: WebhookDelivery['status']) {
  if (status === 'sent') return 'Enviado';
  if (status === 'failed') return 'Falhou';
  return 'Na fila';
}

function deliveryBadgeVariant(status: WebhookDelivery['status']): BadgeVariant {
  if (status === 'sent') return 'success';
  if (status === 'failed') return 'error';
  return 'warning';
}

function deliverySummary(delivery: WebhookDelivery) {
  const pieces = [
    delivery.httpStatus ? `HTTP ${delivery.httpStatus}` : 'HTTP pendente',
    `${delivery.attempts} tentativa${delivery.attempts === 1 ? '' : 's'}`,
  ];
  if (delivery.deliveredAt) pieces.push(`entregue ${formatDate(delivery.deliveredAt)}`);
  return pieces.join(' · ');
}

function safeResponsePreview(responseBody?: string | null) {
  if (!responseBody) return null;
  return responseBody.length > 120 ? `${responseBody.slice(0, 120)}...` : responseBody;
}

export default function Webhooks() {
  const { webhooks, deliveries, loading, testWebhook } = useWebhooks();
  const [testResults, setTestResults] = useState<Record<string, string>>({});
  const [testingId, setTestingId] = useState<string | null>(null);

  const handleTest = async (id: string) => {
    setTestingId(id);
    try {
      const result = await testWebhook(id);
      setTestResults(prev => ({ ...prev, [id]: result.message }));
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Desenvolvedores & API"
        description="Conecte a Enervita com suas ferramentas favoritas."
        actions={
          <Link to="/settings?tab=integrations"><Button variant="outline" size="sm" className="gap-2">
            <Shield size={16} /> Gerenciar Chaves API
          </Button></Link>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-graphite flex items-center gap-2">
                <Link2 size={20} className="text-solar-orange" />
                Webhooks Ativos
              </h3>
              <Button variant="primary" size="sm" disabled title="Cadastro técnico em breve" className="opacity-60">Novo Webhook em breve</Button>
            </div>

            <div className="space-y-4">
              {loading ? (
                <div className="py-8 text-center text-gray-500">Carregando...</div>
              ) : webhooks.map((webhook) => (
                <div key={webhook.id} className="p-4 rounded-xl border border-gray-100 hover:border-solar-orange/20 transition-all group">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-bold text-sm text-graphite">{webhook.name}</h4>
                      <code className="text-[10px] text-gray-400 break-all">{webhook.url}</code>
                    </div>
                    <Badge variant={webhookBadgeVariant(webhook.status)}>
                      {webhookStatusLabel(webhook.status)}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap gap-1 mb-4">
                    {webhook.eventTypes.map(e => (
                      <span key={e} className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-mono">
                        {e}
                      </span>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-gray-50">
                    <div className="flex gap-4">
                      <div className="text-center">
                        <p className="text-[9px] text-gray-400 uppercase font-bold">Success Rate</p>
                        <p className="text-sm font-bold text-energy-success">{webhook.successRate}%</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[9px] text-gray-400 uppercase font-bold">Last Delivery</p>
                        <p className="text-sm font-bold text-graphite">{webhook.lastDeliveryAt ? formatDate(webhook.lastDeliveryAt) : '-'}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button aria-label={`Testar webhook ${webhook.name}`} variant="ghost" size="icon" className="h-8 w-8" onClick={() => void handleTest(webhook.id)} disabled={testingId === webhook.id}><RefreshCw size={14} /></Button>
                      <Link to="/settings?tab=integrations" aria-label="Abrir integrações"><Button variant="ghost" size="icon" className="h-8 w-8"><ExternalLink size={14} /></Button></Link>
                    </div>
                  </div>
                  {testResults[webhook.id] && (
                    <p className="mt-3 rounded-lg bg-energy-success/10 px-3 py-2 text-xs font-medium text-energy-success">{testResults[webhook.id]}</p>
                  )}
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="font-bold text-graphite mb-4 flex items-center gap-2">
              <Activity size={20} className="text-energy-green" />
              Logs Recentes (dispatcher controlado)
            </h3>
            <div className="bg-graphite rounded-xl p-4 font-mono text-xs text-energy-green overflow-x-auto space-y-2">
              {deliveries.length === 0 ? (
                <p className="opacity-50"># Nenhuma entrega registrada ainda no preview</p>
              ) : deliveries.slice(0, 6).map((delivery) => (
                <div key={delivery.id} className="rounded-lg border border-white/10 bg-white/5 p-3 text-[11px] text-mint-light">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-energy-green">{delivery.eventType}</span>
                    <span className="text-gray-400">→ {delivery.webhookName ?? delivery.webhookId}</span>
                    <Badge variant={deliveryBadgeVariant(delivery.status)}>{deliveryStatusLabel(delivery.status)}</Badge>
                  </div>
                  <p className="mt-1 text-gray-300">{deliverySummary(delivery)}</p>
                  {safeResponsePreview(delivery.responseBody) && (
                    <p className="mt-1 text-gray-400">resposta: {safeResponsePreview(delivery.responseBody)}</p>
                  )}
                </div>
              ))}
              <p className="opacity-50 mt-4"># Dispatcher seguro: só envia HTTP para hosts explicitamente permitidos por allowlist</p>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6 bg-mint-light/30 border-energy-green/10">
            <h3 className="font-bold text-graphite mb-4 flex items-center gap-2">
              <Terminal size={18} className="text-energy-deep" />
              API operacional e planejada
            </h3>
            <div className="space-y-3">
              <div className="p-3 bg-white rounded-lg shadow-sm border border-gray-100">
                <p className="text-[10px] font-bold text-energy-green mb-1 uppercase">GET /api/leads</p>
                <p className="text-xs text-gray-500">Listar todos os leads</p>
              </div>
              <div className="p-3 bg-white rounded-lg shadow-sm border border-gray-100">
                <p className="text-[10px] font-bold text-energy-green mb-1 uppercase">POST /api/leads</p>
                <p className="text-xs text-gray-500">Criar novo lead (Site/Ads)</p>
              </div>
              <div className="p-3 bg-white rounded-lg shadow-sm border border-gray-100">
                <p className="text-[10px] font-bold text-energy-green mb-1 uppercase">PATCH /api/leads/:id</p>
                <p className="text-xs text-gray-500">Atualizar dados ou etapa</p>
              </div>
              <div className="p-3 bg-white rounded-lg shadow-sm border border-gray-100">
                <p className="text-[10px] font-bold text-energy-green mb-1 uppercase">Tracking events internos</p>
                <p className="text-xs text-gray-500">Fila interna tracking_events + dispatcher Meta CAPI; endpoint público dedicado fica para uma fase posterior</p>
              </div>
            </div>
            <Link to="/settings?tab=integrations"><Button variant="outline" className="w-full mt-6 text-xs">Acessar Documentação</Button></Link>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 size={18} className="text-energy-success" />
              <h4 className="font-bold text-sm">Status da Infra</h4>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">API Gateway</span>
                <span className="text-energy-success font-bold">99.9%</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Webhooks Queue</span>
                <span className="text-energy-success font-bold">Dispatcher controlado</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Tracking Engine</span>
                <span className="text-energy-success font-bold">Controlada</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useWebhooks } from '../hooks/useCrm';
import { PageHeader } from '../components/ui/LayoutComponents';
import { Link } from 'react-router-dom';
import { Card, Button, Badge, type BadgeVariant } from '../components/ui/Base';
import { Link2, ExternalLink, Activity, Shield, RefreshCw, CheckCircle2 } from 'lucide-react';
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
        title="Integrações"
        description="Acompanhe integrações que conectam o CRM da Enervita aos fluxos comerciais."
        actions={
          <Link to="/settings?tab=integrations"><Button variant="outline" size="sm" className="gap-2">
            <Shield size={16} /> Gerenciar acessos
          </Button></Link>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-text-primary flex items-center gap-2">
                <Link2 size={20} className="text-orange-400" />
                Integrações ativas
              </h3>
              <Button variant="primary" size="sm" disabled title="Cadastro em revisão" className="opacity-60">Nova integração</Button>
            </div>

            <div className="space-y-4">
              {loading ? (
                <div className="py-8 text-center text-text-secondary">Carregando...</div>
              ) : webhooks.map((webhook) => (
                <div key={webhook.id} className="p-4 rounded-xl border border-border-soft hover:border-solar-orange/20 transition-all group">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-bold text-sm text-text-primary">{webhook.name}</h4>
                      <span className="text-[10px] text-text-secondary">Destino seguro configurado</span>
                    </div>
                    <Badge variant={webhookBadgeVariant(webhook.status)}>
                      {webhookStatusLabel(webhook.status)}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap gap-1 mb-4">
                    {webhook.eventTypes.map(e => (
                      <span key={e} className="text-[9px] bg-warm-sand/50 text-text-secondary px-1.5 py-0.5 rounded font-mono">
                        {e}
                      </span>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-border-hair">
                    <div className="flex gap-4">
                      <div className="text-center">
                        <p className="text-[9px] text-text-secondary uppercase font-bold">Taxa de sucesso</p>
                        <p className="text-sm font-bold text-energy-success">{webhook.successRate}%</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[9px] text-text-secondary uppercase font-bold">Última entrega</p>
                        <p className="text-sm font-bold text-text-primary">{webhook.lastDeliveryAt ? formatDate(webhook.lastDeliveryAt) : '-'}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button aria-label={`Validar integração ${webhook.name}`} variant="ghost" size="icon" className="h-8 w-8" onClick={() => void handleTest(webhook.id)} disabled={testingId === webhook.id}><RefreshCw size={14} /></Button>
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
            <h3 className="font-bold text-text-primary mb-4 flex items-center gap-2">
              <Activity size={20} className="text-mint-400" />
              Entregas recentes das integrações
            </h3>
            <div className="bg-graphite rounded-xl p-4 font-mono text-xs text-mint-400 crm-scroll-panel overflow-x-auto space-y-2">
              {deliveries.length === 0 ? (
                <p className="opacity-50">Nenhuma entrega registrada ainda</p>
              ) : deliveries.slice(0, 6).map((delivery) => (
                <div key={delivery.id} className="rounded-lg border border-white/10 bg-bg-surface-1/5 p-3 text-[11px] text-mint-light">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-mint-400">{delivery.eventType}</span>
                    <span className="text-text-secondary">→ {delivery.webhookName ?? delivery.webhookId}</span>
                    <Badge variant={deliveryBadgeVariant(delivery.status)}>{deliveryStatusLabel(delivery.status)}</Badge>
                  </div>
                  <p className="mt-1 text-text-secondary">{deliverySummary(delivery)}</p>
                  {safeResponsePreview(delivery.responseBody) && (
                    <p className="mt-1 text-text-secondary">resposta: {safeResponsePreview(delivery.responseBody)}</p>
                  )}
                </div>
              ))}
              <p className="opacity-50 mt-4">Segurança: entregas externas seguem uma lista de destinos permitidos</p>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6 bg-mint-light/30 border-energy-green/10">
            <h3 className="font-bold text-text-primary mb-4 flex items-center gap-2">
              <Link2 size={18} className="text-energy-deep" />
              Integrações comerciais
            </h3>
            <div className="space-y-3">
              <div className="p-3 bg-bg-surface-1 rounded-lg shadow-sm border border-border-soft">
                <p className="text-[10px] font-bold text-mint-400 mb-1 uppercase">Leitura de leads</p>
                <p className="text-xs text-text-secondary">Consulta segura das oportunidades autorizadas</p>
              </div>
              <div className="p-3 bg-bg-surface-1 rounded-lg shadow-sm border border-border-soft">
                <p className="text-[10px] font-bold text-mint-400 mb-1 uppercase">Entrada de leads</p>
                <p className="text-xs text-text-secondary">Receber oportunidades vindas do site e campanhas</p>
              </div>
              <div className="p-3 bg-bg-surface-1 rounded-lg shadow-sm border border-border-soft">
                <p className="text-[10px] font-bold text-mint-400 mb-1 uppercase">Atualização comercial</p>
                <p className="text-xs text-text-secondary">Atualizar dados ou etapa com permissão</p>
              </div>
              <div className="p-3 bg-bg-surface-1 rounded-lg shadow-sm border border-border-soft">
                <p className="text-[10px] font-bold text-mint-400 mb-1 uppercase">Eventos comerciais</p>
                <p className="text-xs text-text-secondary">Fila segura para sinais de campanha e conversão</p>
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
                <span className="text-text-secondary">Entrada segura</span>
                <span className="text-energy-success font-bold">99.9%</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-text-secondary">Fila de integrações</span>
                <span className="text-energy-success font-bold">Ativa</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-text-secondary">Rastreio comercial</span>
                <span className="text-energy-success font-bold">Controlada</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

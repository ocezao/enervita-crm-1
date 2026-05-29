import { useWebhooks } from '../hooks/useCrm';
import { PageHeader } from '../components/ui/LayoutComponents';
import { Card, Button, Badge } from '../components/ui/Base';
import { Link2, ExternalLink, Activity, Terminal, Shield, RefreshCw, CheckCircle2 } from 'lucide-react';
import { formatDate } from '../lib/utils';

export default function Webhooks() {
  const { webhooks, loading } = useWebhooks();

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Desenvolvedores & API" 
        description="Conecte a Enervita com suas ferramentas favoritas."
        actions={
          <Button variant="outline" size="sm" className="gap-2">
            <Shield size={16} /> Gerenciar Chaves API
          </Button>
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
              <Button variant="primary" size="sm">Novo Webhook</Button>
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
                    <Badge variant={webhook.status === 'active' ? 'success' : 'error'}>
                      {webhook.status}
                    </Badge>
                  </div>
                  
                  <div className="flex flex-wrap gap-1 mb-4">
                    {webhook.eventTypes.map(e => (
                      <span key={e} className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-mono">
                        {e}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-gray-50">
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
                      <Button variant="ghost" size="icon" className="h-8 w-8"><RefreshCw size={14} /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8"><ExternalLink size={14} /></Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="font-bold text-graphite mb-4 flex items-center gap-2">
              <Activity size={20} className="text-energy-green" />
              Logs Recentes (Mock)
            </h3>
            <div className="bg-graphite rounded-xl p-4 font-mono text-xs text-energy-green overflow-x-auto">
              <p className="opacity-50"># [2024-05-24 14:22:01] POST /webhook/leads - 200 OK</p>
              <p className="mt-1">{"{"} "event": "lead.created", "id": "l_923", "name": "Joao Silva" {"}"}</p>
              <p className="opacity-50 mt-4"># [2024-05-24 14:20:15] POST /webhook/leads - 200 OK</p>
              <p className="mt-1">{"{"} "event": "lead.stage_changed", "id": "l_112", "to": "proposta_enviada" {"}"}</p>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6 bg-mint-light/30 border-energy-green/10">
            <h3 className="font-bold text-graphite mb-4 flex items-center gap-2">
              <Terminal size={18} className="text-energy-deep" />
              API Planejada
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
                <p className="text-[10px] font-bold text-energy-green mb-1 uppercase">POST /api/events</p>
                <p className="text-xs text-gray-500">Registrar tracking event</p>
              </div>
            </div>
            <Button variant="outline" className="w-full mt-6 text-xs">Acessar Documentação</Button>
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
                <span className="text-energy-success font-bold">Online</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Tracking Engine</span>
                <span className="text-energy-success font-bold">Online</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

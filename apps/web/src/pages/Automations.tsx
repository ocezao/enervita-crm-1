import { useAutomations } from '../hooks/useCrm';
import { PageHeader } from '../components/ui/LayoutComponents';
import { Card, Button, Badge } from '../components/ui/Base';
import { Zap, Play, Settings2, Power, Clock, ArrowRight } from 'lucide-react';
import { formatDate } from '../lib/utils';

function statusLabel(status: string | undefined, active: boolean) {
  if (status === 'planned') return 'Planejada';
  if (status === 'paused') return 'Pausada';
  return active ? 'Ativa' : 'Inativa';
}

export default function Automations() {
  const { automations, loading, runAutomation, lastRun } = useAutomations();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Automações"
        description="Regras inteligentes para acelerar seu processo comercial."
        actions={
          <Button variant="primary" size="sm" className="gap-2">
            <Zap size={16} /> Criar Automação
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {loading ? (
          <div className="col-span-2 py-12 text-center text-gray-500">Carregando regras...</div>
        ) : automations.map((rule) => (
          <Card key={rule.id} className="p-6 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${rule.active ? 'bg-solar-orange/10 text-solar-orange' : 'bg-gray-100 text-gray-400'}`}>
                  <Zap size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-graphite">{rule.name}</h3>
                  <p className="text-xs text-gray-400">Trigger: {rule.trigger}</p>
                  <Badge variant={rule.active ? 'success' : 'default'} className="mt-2 text-[10px]">{statusLabel(rule.status, rule.active)}</Badge>
                </div>
              </div>
              <Button variant="ghost" size="icon" className={rule.active ? 'text-energy-success' : 'text-gray-300'}>
                <Power size={18} />
              </Button>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Condições</p>
                <div className="flex flex-wrap gap-2">
                  {rule.conditions.map((c, i) => (
                    <Badge key={i} variant="default" className="normal-case font-medium">{c}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Ações</p>
                <div className="space-y-2">
                  {rule.actions.map((a, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                      <ArrowRight size={14} className="text-solar-orange" />
                      {a}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[10px] text-gray-400">
                <Clock size={12} />
                Executado em {rule.lastRunAt ? formatDate(rule.lastRunAt) : 'Nunca'}
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => void runAutomation(rule.id)}>
                  <Play size={12} /> Executar controlado
                </Button>
                <Button variant="outline" size="sm" className="text-xs gap-1">
                  <Settings2 size={12} /> Configurar
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-8 bg-graphite text-white overflow-hidden relative mt-8">
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="max-w-md text-center md:text-left">
            <h3 className="text-xl font-bold mb-2">Sugestão da Enervita IA</h3>
            <p className="text-gray-400 text-sm">
              Catálogo técnico conectado à API real do preview. A execução controlada registra runs/filas sem chamar provedores externos.
            </p>
            {lastRun && (
              <p className="mt-3 text-xs text-energy-green font-mono">
                Última execução controlada: {lastRun.status} · filas geradas: {String(lastRun.outputPayload.queuedWebhookDeliveries ?? 0)}
              </p>
            )}
          </div>
          <Button variant="secondary" className="whitespace-nowrap">Planejar ativação n8n</Button>
        </div>
        <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-solar-orange/10 rounded-full blur-3xl"></div>
      </Card>
    </div>
  );
}

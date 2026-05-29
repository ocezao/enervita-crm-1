import { PageHeader } from '../components/ui/LayoutComponents';
import { Card, Button } from '../components/ui/Base';
import { 
  User, 
  Layers, 
  Settings2, 
  Link as LinkIcon, 
  Database,
  Monitor,
  Workflow,
  CheckCircle2,
  ArrowRight,
  Globe,
  Share2,
  Mail,
  Target
} from 'lucide-react';
import { useState } from 'react';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('general');

  const tabs = [
    { id: 'general', label: 'Geral', icon: Settings2 },
    { id: 'users', label: 'Usuários', icon: User },
    { id: 'pipeline', label: 'Etapas do Funil', icon: Layers },
    { id: 'integrations', icon: LinkIcon, label: 'Integrações' },
    { id: 'operation', label: 'Mapa da Operação', icon: Workflow },
    { id: 'appearance', label: 'Aparência', icon: Monitor },
  ];

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Configurações" 
        description="Personalize o Cockpit Comercial para a sua equipe."
      />

      <div className="flex flex-col md:flex-row gap-8">
        <aside className="w-full md:w-64 space-y-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab.id 
                  ? 'bg-solar-orange/10 text-solar-orange shadow-sm' 
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </aside>

        <main className="flex-1">
          {activeTab === 'general' && (
            <Card className="p-8">
              <h3 className="text-lg font-bold text-graphite mb-6">Configurações Gerais</h3>
              <div className="space-y-6 max-w-md">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Nome da Empresa</label>
                  <input className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm" defaultValue="Enervita Energia Solar" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">E-mail de Suporte</label>
                  <input className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm" defaultValue="contato@enervita.com.br" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Fuso Horário</label>
                  <select className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white">
                    <option>Brasília (GMT-3)</option>
                  </select>
                </div>
                <Button className="mt-4">Salvar Alterações</Button>
              </div>
            </Card>
          )}

          {activeTab === 'operation' && <OperationMap />}

          {activeTab !== 'general' && activeTab !== 'operation' && (
            <Card className="p-12 text-center text-gray-400">
              Esta seção de configurações será implementada na versão final.
            </Card>
          )}
        </main>
      </div>
    </div>
  );
}

function OperationMap() {
  const nodes = [
    { id: 'site', label: 'Site / Landing Page', icon: Globe, color: 'bg-blue-500' },
    { id: 'db', label: 'Banco de Dados Ops', icon: Database, color: 'bg-graphite' },
    { id: 'crm', label: 'Cockpit Enervita', icon: CheckCircle2, color: 'bg-solar-orange' },
    { id: 'n8n', label: 'Automação (n8n)', icon: Workflow, color: 'bg-energy-green' },
  ];

  const outputs = [
    { label: 'Google Sheets', icon: Database },
    { label: 'Meta Conversions', icon: Share2 },
    { label: 'Google Ads', icon: Target },
    { label: 'E-mail / WhatsApp', icon: Mail },
  ];

  return (
    <Card className="p-8">
      <h3 className="text-lg font-bold text-graphite mb-2">Mapa da Operação Comercial</h3>
      <p className="text-sm text-gray-500 mb-12">Visualize como os dados fluem através do seu ecossistema.</p>

      <div className="flex flex-col items-center gap-8">
        <div className="flex flex-wrap justify-center gap-12 relative">
          {nodes.map((node, i) => (
            <div key={node.id} className="flex flex-col items-center gap-4 relative">
              <div className={`w-20 h-20 rounded-2xl ${node.color} flex items-center justify-center text-white shadow-xl relative z-10`}>
                <node.icon size={32} />
              </div>
              <p className="text-xs font-bold text-graphite text-center max-w-[80px]">{node.label}</p>
              
              {i < nodes.length - 1 && (
                <div className="hidden lg:block absolute left-full top-10 w-12 h-0.5 bg-gray-200 -translate-y-1/2">
                   <ArrowRight size={12} className="absolute -right-2 -top-1.5 text-gray-300" />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="w-1 h-12 bg-gradient-to-b from-energy-green to-gray-100"></div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
          {outputs.map(out => (
            <div key={out.label} className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex flex-col items-center gap-2">
              <out.icon size={20} className="text-gray-400" />
              <span className="text-[10px] font-bold text-gray-600 text-center">{out.label}</span>
            </div>
          ))}
        </div>
      </div>
      
      <div className="mt-12 p-4 bg-solar-orange/5 rounded-xl border border-solar-orange/10">
        <h4 className="text-xs font-bold text-solar-orange uppercase mb-2">Resumo da Conectividade</h4>
        <p className="text-xs text-gray-600 leading-relaxed">
          Seu CRM está sincronizado em tempo real. Cada lead que entra pelo site é processado pelo banco operacional, enriquece o Cockpit e dispara eventos para GA4, Meta CAPI e planilhas de auditoria via n8n.
        </p>
      </div>
    </Card>
  );
}

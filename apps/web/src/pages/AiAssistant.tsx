import { useState } from 'react';
import { Bot, Send, ShieldCheck } from 'lucide-react';

const suggestions = [
  'Quais leads estão parados há mais tempo?',
  'Resumo dos leads novos desta semana',
  'Quais tarefas precisam de atenção hoje?',
  'Quais campanhas parecem gerar melhores leads?',
];

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export default function AiAssistant() {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'Assistente IA pronto. Vou consultar dados do CRM em modo seguro/read-only quando a configuração do backend estiver ativa.' },
  ]);
  const [loading, setLoading] = useState(false);

  async function send(text = message) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setMessages((current) => [...current, { role: 'user', content: trimmed }]);
    setMessage('');
    setLoading(true);
    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: trimmed }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const text = data?.error === 'LLM_NOT_CONFIGURED'
          ? 'Assistente ainda em configuração no backend. Avise o responsável técnico para ativar o serviço.'
          : `Erro do assistente: ${data?.error ?? response.status}`;
        setMessages((current) => [...current, { role: 'assistant', content: text }]);
        return;
      }
      setMessages((current) => [...current, { role: 'assistant', content: data.answer ?? 'Resposta recebida.' }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-solar-orange/10 text-solar-orange flex items-center justify-center">
            <Bot size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-graphite">Assistente IA</h1>
            <p className="text-sm text-graphite-soft">Consulta segura do CRM · modo read-only</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-energy-green bg-mint-light/70 px-3 py-2 rounded-full">
          <ShieldCheck size={16} /> Operação segura / sem credenciais no frontend
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        <section className="bg-white border border-warm-sand/50 rounded-3xl shadow-sm min-h-[560px] flex flex-col overflow-hidden">
          <div className="flex-1 p-5 space-y-4 crm-scroll-panel overflow-y-auto">
            {messages.map((item, index) => (
              <div key={index} className={item.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div className={item.role === 'user'
                  ? 'max-w-[80%] rounded-2xl bg-solar-orange text-white px-4 py-3 text-sm'
                  : 'max-w-[80%] rounded-2xl bg-warm-sand/30 text-graphite px-4 py-3 text-sm leading-relaxed'}>
                  {item.content}
                </div>
              </div>
            ))}
            {loading && <div className="text-sm text-graphite-soft">Pensando...</div>}
          </div>

          <div className="border-t border-warm-sand/50 p-4 flex gap-3">
            <input
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') void send(); }}
              placeholder="Pergunte sobre leads, tarefas, campanhas ou funil..."
              className="flex-1 rounded-2xl border border-warm-sand/70 px-4 py-3 text-sm outline-none focus:border-solar-orange"
            />
            <button
              onClick={() => void send()}
              disabled={loading}
              className="rounded-2xl bg-solar-orange text-white px-5 py-3 text-sm font-semibold disabled:opacity-50 flex items-center gap-2"
            >
              <Send size={16} /> Enviar
            </button>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="bg-white border border-warm-sand/50 rounded-3xl p-5 shadow-sm">
            <h2 className="font-bold text-graphite mb-3">Sugestões</h2>
            <div className="space-y-2">
              {suggestions.map((item) => (
                <button key={item} onClick={() => void send(item)} className="w-full text-left text-sm bg-warm-sand/30 hover:bg-mint-light/60 rounded-2xl px-3 py-3 text-graphite">
                  {item}
                </button>
              ))}
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-3xl p-5 text-sm text-amber-900">
            <strong>Status:</strong> assistente em configuração. O acesso será liberado quando o backend estiver ativo.
          </div>
        </aside>
      </div>
    </div>
  );
}

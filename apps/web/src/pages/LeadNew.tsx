import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { api, formatCnpj, formatCpf, isValidCnpj, isValidCpf } from '../lib/api/crmApi';

function required(v: string) {
  return v.trim();
}

export default function LeadNew() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [cpf, setCpf] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [leadSource, setLeadSource] = useState('');
  const [qualificationStatus, setQualificationStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState<'baixa' | 'media' | 'alta' | 'urgente'>('media');

  if (!user) {
    navigate('/login');
    return null;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!required(name)) {
      setError('Nome é obrigatório.');
      return;
    }
    if (cpf.trim() && !isValidCpf(cpf)) {
      setError('CPF inválido. Confira os dígitos antes de salvar.');
      return;
    }
    if (cnpj.trim() && !isValidCnpj(cnpj)) {
      setError('CNPJ inválido. Confira os dígitos antes de salvar.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const payload = {
        name,
        email: email || undefined,
        phone: phone || undefined,
        company: company || undefined,
        cpf: cpf || undefined,
        cnpj: cnpj || undefined,
        leadSource: leadSource || undefined,
        qualificationStatus: qualificationStatus || undefined,
        priority,
        notes: notes || undefined,
      } as Record<string, unknown>;

      const lead = await api.createLead(payload);
      navigate(`/leads/${lead.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar lead.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="rounded-xl border border-warm-sand/70 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-black text-graphite">Novo lead</h1>
          <Link to="/leads" className="text-sm text-graphite-soft hover:text-solar-orange transition-colors">Voltar</Link>
        </div>

        <form onSubmit={onSubmit} className="grid gap-4">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" required className="w-full rounded-lg border border-warm-sand/70 bg-warm-sand/30 px-4 py-2.5 text-sm text-graphite placeholder:text-graphite-soft focus:outline-none focus:ring-2 focus:ring-solar-orange/30 focus:border-solar-orange/50 transition-all" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" type="email" className="w-full rounded-lg border border-warm-sand/70 bg-warm-sand/30 px-4 py-2.5 text-sm text-graphite placeholder:text-graphite-soft focus:outline-none focus:ring-2 focus:ring-solar-orange/30 focus:border-solar-orange/50 transition-all" />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Telefone" className="w-full rounded-lg border border-warm-sand/70 bg-warm-sand/30 px-4 py-2.5 text-sm text-graphite placeholder:text-graphite-soft focus:outline-none focus:ring-2 focus:ring-solar-orange/30 focus:border-solar-orange/50 transition-all" />
          <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Empresa" className="w-full rounded-lg border border-warm-sand/70 bg-warm-sand/30 px-4 py-2.5 text-sm text-graphite placeholder:text-graphite-soft focus:outline-none focus:ring-2 focus:ring-solar-orange/30 focus:border-solar-orange/50 transition-all" />
          <input value={cpf} onChange={(e) => setCpf(formatCpf(e.target.value))} placeholder="CPF do contato" inputMode="numeric" className="w-full rounded-lg border border-warm-sand/70 bg-warm-sand/30 px-4 py-2.5 text-sm text-graphite placeholder:text-graphite-soft focus:outline-none focus:ring-2 focus:ring-solar-orange/30 focus:border-solar-orange/50 transition-all" />
          <input value={cnpj} onChange={(e) => setCnpj(formatCnpj(e.target.value))} placeholder="CNPJ da empresa" inputMode="numeric" className="w-full rounded-lg border border-warm-sand/70 bg-warm-sand/30 px-4 py-2.5 text-sm text-graphite placeholder:text-graphite-soft focus:outline-none focus:ring-2 focus:ring-solar-orange/30 focus:border-solar-orange/50 transition-all" />
          <input value={leadSource} onChange={(e) => setLeadSource(e.target.value)} placeholder="Fonte" className="w-full rounded-lg border border-warm-sand/70 bg-warm-sand/30 px-4 py-2.5 text-sm text-graphite placeholder:text-graphite-soft focus:outline-none focus:ring-2 focus:ring-solar-orange/30 focus:border-solar-orange/50 transition-all" />

          <select value={qualificationStatus} onChange={(e) => setQualificationStatus(e.target.value)} className="w-full rounded-lg border border-warm-sand/70 bg-warm-sand/30 px-4 py-2.5 text-sm text-graphite focus:outline-none focus:ring-2 focus:ring-solar-orange/30 focus:border-solar-orange/50 transition-all">
            <option value="">Qualificação</option>
            <option value="frio">Frio</option>
            <option value="morno">Morno</option>
            <option value="quente">Quente</option>
          </select>

          <select value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)} className="w-full rounded-lg border border-warm-sand/70 bg-warm-sand/30 px-4 py-2.5 text-sm text-graphite focus:outline-none focus:ring-2 focus:ring-solar-orange/30 focus:border-solar-orange/50 transition-all">
            <option value="baixa">Baixa</option>
            <option value="media">Média</option>
            <option value="alta">Alta</option>
            <option value="urgente">Urgente</option>
          </select>

          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Observações" className="w-full rounded-lg border border-warm-sand/70 bg-warm-sand/30 px-4 py-2.5 text-sm text-graphite placeholder:text-graphite-soft focus:outline-none focus:ring-2 focus:ring-solar-orange/30 focus:border-solar-orange/50 transition-all" />

          {error ? <p className="text-sm text-alert-red font-medium">{error}</p> : null}

          <div className="flex justify-end gap-2 pt-2">
            <button type="submit" disabled={saving} className="inline-flex items-center justify-center rounded-lg bg-solar-orange px-5 py-2.5 text-sm font-bold text-white shadow-sm shadow-solar-orange/20 hover:bg-solar-orange/90 hover:shadow-md hover:shadow-solar-orange/25 transition-all disabled:opacity-50 disabled:pointer-events-none">
              {saving ? 'Salvando...' : 'Salvar lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

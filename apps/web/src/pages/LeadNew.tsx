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
      <div className="rounded-xl border border-slate-200 bg-warm-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-graphite">Novo lead</h1>
          <Link to="/leads" className="text-sm text-graphite underline">Voltar</Link>
        </div>

        <form onSubmit={onSubmit} className="grid gap-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" required className="rounded-lg border border-slate-300 px-3 py-2" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" type="email" className="rounded-lg border border-slate-300 px-3 py-2" />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Telefone" className="rounded-lg border border-slate-300 px-3 py-2" />
          <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Empresa" className="rounded-lg border border-slate-300 px-3 py-2" />
          <input value={cpf} onChange={(e) => setCpf(formatCpf(e.target.value))} placeholder="CPF do contato" inputMode="numeric" className="rounded-lg border border-slate-300 px-3 py-2" />
          <input value={cnpj} onChange={(e) => setCnpj(formatCnpj(e.target.value))} placeholder="CNPJ da empresa" inputMode="numeric" className="rounded-lg border border-slate-300 px-3 py-2" />
          <input value={leadSource} onChange={(e) => setLeadSource(e.target.value)} placeholder="Fonte" className="rounded-lg border border-slate-300 px-3 py-2" />

          <select value={qualificationStatus} onChange={(e) => setQualificationStatus(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2">
            <option value="">Qualificação</option>
            <option value="frio">Frio</option>
            <option value="morno">Morno</option>
            <option value="quente">Quente</option>
          </select>

          <select value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)} className="rounded-lg border border-slate-300 px-3 py-2">
            <option value="baixa">Baixa</option>
            <option value="media">Média</option>
            <option value="alta">Alta</option>
            <option value="urgente">Urgente</option>
          </select>

          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Observações" className="rounded-lg border border-slate-300 px-3 py-2" />

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex justify-end gap-2">
            <button type="submit" disabled={saving} className="rounded-lg bg-solar-orange px-4 py-2 font-semibold text-white disabled:opacity-50">
              {saving ? 'Salvando...' : 'Salvar lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

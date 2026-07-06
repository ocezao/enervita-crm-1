import { FormEvent, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Sun } from 'lucide-react';
import { Button } from '../components/ui/Base';
import { useAuth } from '../auth/useAuth';

export default function Login() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const redirectTarget = (location.state as { from?: { pathname?: string; search?: string; hash?: string } } | null)?.from;
  const from = redirectTarget ? `${redirectTarget.pathname ?? '/'}${redirectTarget.search ?? ''}${redirectTarget.hash ?? ''}` : '/';

  if (!loading && user) return <Navigate to={from} replace />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (loginError) {
      const message = loginError instanceof Error ? loginError.message : '';
      if (message.toLowerCase().includes('too many')) {
        setError('Muitas tentativas de login. Aguarde um minuto e tente novamente.');
      } else if (message.startsWith('Não foi possível')) {
        setError('Não foi possível conectar ao CRM agora. Tente novamente em instantes.');
      } else {
        setError('E-mail ou senha inválidos.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-warm-white flex flex-col items-center justify-center gap-4 px-6">
      <section className="w-full max-w-md bg-warm-white rounded-3xl border border-warm-sand/50 shadow-xl p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="bg-solar-orange p-2 rounded-xl">
            <Sun className="text-white" size={28} fill="currentColor" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-solar-orange font-bold">Enervita Energia</p>
            <h1 className="text-2xl font-display font-bold text-graphite">Entrar no Cockpit Enervita</h1>
          </div>
        </div>

        <p className="text-sm text-graphite-soft mb-6">
          Acesse o CRM operacional com sua conta autorizada. A sessão é mantida em cookie seguro HttpOnly pela API.
        </p>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-semibold text-graphite">E-mail</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-warm-sand/70 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-solar-orange/30 focus:border-solar-orange/50"
              placeholder="seuemail@enervita.com.br"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-semibold text-graphite">Senha</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-warm-sand/70 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-solar-orange/30 focus:border-solar-orange/50"
              placeholder="Digite sua senha"
            />
          </div>

          {error && <p role="alert" className="rounded-xl bg-alert-red/10 text-alert-red px-4 py-3 text-sm">{error}</p>}

          <Button type="submit" className="w-full rounded-xl py-3" disabled={submitting || loading}>
            {submitting ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>
      </section>
    </main>
  );
}

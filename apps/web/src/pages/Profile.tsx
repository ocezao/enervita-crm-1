import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, CheckSquare, FileText, Kanban, KeyRound, LayoutDashboard, Loader2, Megaphone, Save, ShieldCheck, Sparkles, UploadCloud, UserCog, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { authApi } from '../auth/authApi';
import { userHasAnyPermission, userHasPermission } from '../auth/permissions';
import { useAuth } from '../auth/useAuth';
import { useDashboardMetrics } from '../hooks/useCrm';
import { Badge, Button, Card, MetricCard } from '../components/ui/Base';
import { PageHeader } from '../components/ui/LayoutComponents';

type AccessiblePage = {
  label: string;
  path: string;
  description: string;
  icon: LucideIcon;
  requiredAny: string[];
};

const pageCards: AccessiblePage[] = [
  { label: 'Dashboard', path: '/', description: 'Resumo comercial e gargalos do dia.', icon: LayoutDashboard, requiredAny: ['page.dashboard'] },
  { label: 'Leads', path: '/leads', description: 'Oportunidades, contatos e histórico.', icon: Users, requiredAny: ['page.leads', 'lead.view'] },
  { label: 'Pipeline', path: '/pipeline', description: 'Etapas comerciais permitidas para você.', icon: Kanban, requiredAny: ['page.pipeline'] },
  { label: 'Tarefas', path: '/tasks', description: 'Follow-ups e pendências atribuídas.', icon: CheckSquare, requiredAny: ['page.tasks'] },
  { label: 'Propostas', path: '/proposals', description: 'Simulações e propostas comerciais.', icon: FileText, requiredAny: ['page.proposals', 'proposal.view'] },
  { label: 'Analytics', path: '/analytics', description: 'Aquisição, rastreio comercial e funil.', icon: BarChart3, requiredAny: ['page.analytics', 'analytics.view', 'rastreio.visualizar'] },
  { label: 'Campanhas', path: '/ads', description: 'Mídia paga e criativos.', icon: Megaphone, requiredAny: ['page.ads', 'ads.view'] },
];

function initials(name?: string) {
  return (name ?? 'Usuário').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

export default function Profile() {
  const { user, updateUser } = useAuth();
  const { metrics } = useDashboardMetrics();
  const [profileForm, setProfileForm] = useState({ name: user?.name ?? '', email: user?.email ?? '', avatarUrl: user?.avatarUrl ?? '' });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '' });
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const accessiblePages = useMemo(() => pageCards.filter((page) => userHasAnyPermission(user, page.requiredAny)), [user]);
  const canManageUsers = userHasPermission(user, 'user.manage');

  const handleProfileSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingProfile(true);
    setError(null);
    setProfileMessage(null);
    setPasswordMessage(null);
    try {
      const updated = await authApi.updateProfile({
        name: profileForm.name,
        email: profileForm.email,
        avatarUrl: profileForm.avatarUrl.trim() || null,
      });
      updateUser(updated);
      setProfileForm({ name: updated.name, email: updated.email, avatarUrl: updated.avatarUrl ?? '' });
      setProfileMessage('Perfil atualizado. Seu ambiente pessoal foi sincronizado.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível atualizar perfil.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    setError(null);
    setProfileMessage(null);
    setPasswordMessage(null);
    try {
      const updated = await authApi.uploadAvatar(file);
      updateUser(updated);
      setProfileForm({ name: updated.name, email: updated.email, avatarUrl: updated.avatarUrl ?? '' });
      setProfileMessage('Foto enviada. Seu perfil foi atualizado com o upload local.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar a foto.');
    } finally {
      setUploadingAvatar(false);
      event.target.value = '';
    }
  };

  const handlePasswordSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingPassword(true);
    setError(null);
    setPasswordMessage(null);
    try {
      await authApi.changePassword(passwordForm);
      setPasswordForm({ currentPassword: '', newPassword: '' });
      setPasswordMessage('Senha alterada com segurança.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível alterar senha.');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1500px] space-y-8 overflow-hidden">
      <PageHeader
        title="Minha página"
        description={`Ambiente pessoal de ${user?.name ?? 'usuário'}: dados, senha e resumo somente do que este usuário pode acessar.`}
        actions={canManageUsers ? <Link to="/settings?tab=users"><Button variant="outline" className="gap-2"><UserCog size={18} />Administrar usuários</Button></Link> : <Badge variant="solar">Meu ambiente</Badge>}
      />

      <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-graphite via-[#26342f] to-[#102019] p-7 text-white shadow-xl">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-orange-500/25 blur-3xl" />
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-5">
            <div className={`relative grid h-24 w-24 place-items-center overflow-hidden rounded-[2rem] border bg-bg-surface-1/10 text-3xl font-black shadow-inner transition ${uploadingAvatar ? 'border-solar-orange/70 ring-4 ring-solar-orange/20' : 'border-white/20'}`}>
              {user?.avatarUrl ? <img src={user.avatarUrl} alt="Foto do usuário" className={`h-full w-full object-cover transition ${uploadingAvatar ? 'scale-105 opacity-50 blur-[1px]' : 'opacity-100'}`} /> : initials(user?.name)}
              {uploadingAvatar && (
                <div className="absolute inset-0 grid place-items-center bg-bg-surface-2/55 backdrop-blur-[2px]" aria-label="Enviando foto">
                  <Loader2 className="animate-spin text-orange-400 drop-shadow" size={30} />
                </div>
              )}
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.35em] text-white/45">Meu perfil</p>
              <h2 className="mt-2 text-3xl font-black">{user?.name ?? 'Usuário'}</h2>
              <p className="mt-1 text-sm text-white/60">{user?.email}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-2xl border border-white/10 bg-bg-surface-1/10 p-4"><p className="text-2xl font-black">{accessiblePages.length}</p><p className="text-[11px] uppercase text-white/50">páginas</p></div>
            <div className="rounded-2xl border border-white/10 bg-bg-surface-1/10 p-4"><p className="text-2xl font-black">{user?.allowedStages?.length ?? 0}</p><p className="text-[11px] uppercase text-white/50">etapas</p></div>
            <div className="rounded-2xl border border-white/10 bg-bg-surface-1/10 p-4"><p className="text-2xl font-black">{canManageUsers ? 'Admin' : 'Usuário'}</p><p className="text-[11px] uppercase text-white/50">nível</p></div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1.2fr]">
        <div className="space-y-6">
          <Card className="p-6">
            <div className="mb-5 flex items-center gap-2"><Sparkles className="text-orange-400" size={20} /><h3 className="text-lg font-black text-text-primary">Personalização</h3></div>
            <form className="space-y-4" onSubmit={handleProfileSubmit}>
              <label className="block space-y-1 text-sm font-bold text-text-primary">Nome de exibição<input aria-label="Nome de exibição" value={profileForm.name} onChange={(event) => setProfileForm({ ...profileForm, name: event.target.value })} className="w-full rounded-xl border border-border-strong px-3 py-2 font-medium outline-none focus:border-solar-orange" /></label>
              <label className="block space-y-1 text-sm font-bold text-text-primary">Email<input aria-label="Email" type="email" value={profileForm.email} onChange={(event) => setProfileForm({ ...profileForm, email: event.target.value })} className="w-full rounded-xl border border-border-strong px-3 py-2 font-medium outline-none focus:border-solar-orange" /></label>
              <label className="block space-y-1 text-sm font-bold text-text-primary">URL da foto<input aria-label="URL da foto" value={profileForm.avatarUrl} onChange={(event) => setProfileForm({ ...profileForm, avatarUrl: event.target.value })} placeholder="https://... ou /uploads/avatars/..." className="w-full rounded-xl border border-border-strong px-3 py-2 font-medium outline-none focus:border-solar-orange" /></label>
              <label className={`flex items-center justify-center gap-2 rounded-xl border border-dashed px-3 py-3 text-sm font-black transition ${uploadingAvatar ? 'cursor-wait border-solar-orange/70 bg-orange-500/10 text-orange-400 shadow-sm' : 'cursor-pointer border-solar-orange/40 bg-orange-500/5 text-orange-400 hover:bg-orange-500/10'}`}>
                {uploadingAvatar ? <Loader2 className="animate-spin" size={17} /> : <UploadCloud size={17} />}{uploadingAvatar ? 'Enviando foto...' : 'Enviar foto local'}
                <input aria-label="Enviar foto local" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleAvatarUpload} disabled={uploadingAvatar} className="sr-only" />
              </label>
              {uploadingAvatar && (
                <div role="status" aria-live="polite" className="flex items-center gap-3 rounded-2xl border border-solar-orange/20 bg-orange-500/10 px-4 py-3 text-sm font-bold text-text-primary">
                  <Loader2 className="shrink-0 animate-spin text-orange-400" size={18} />
                  <span>Enviando foto e atualizando seu perfil. Aguarde alguns segundos...</span>
                </div>
              )}
              <p className="text-xs font-medium text-text-secondary">Você pode colar uma URL ou enviar uma imagem local do computador/celular.</p>
              <Button disabled={savingProfile} className="w-full gap-2"><Save size={17} />{savingProfile ? 'Salvando...' : 'Salvar personalização'}</Button>
            </form>
          </Card>

          <Card className="p-6">
            <div className="mb-5 flex items-center gap-2"><KeyRound className="text-mint-400" size={20} /><h3 className="text-lg font-black text-text-primary">Senha</h3></div>
            <form className="space-y-4" onSubmit={handlePasswordSubmit}>
              <label className="block space-y-1 text-sm font-bold text-text-primary">Senha atual<input aria-label="Senha atual" type="password" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })} className="w-full rounded-xl border border-border-strong px-3 py-2 outline-none focus:border-energy-green" /></label>
              <label className="block space-y-1 text-sm font-bold text-text-primary">Nova senha<input aria-label="Nova senha" type="password" value={passwordForm.newPassword} onChange={(event) => setPasswordForm({ ...passwordForm, newPassword: event.target.value })} className="w-full rounded-xl border border-border-strong px-3 py-2 outline-none focus:border-energy-green" /></label>
              <Button variant="secondary" disabled={savingPassword} className="w-full gap-2"><ShieldCheck size={17} />{savingPassword ? 'Alterando...' : 'Alterar senha'}</Button>
            </form>
          </Card>
          {profileMessage && <div className="rounded-2xl border border-energy-green/20 bg-mint-500/10 px-4 py-3 text-sm font-bold text-mint-400">{profileMessage}</div>}
          {passwordMessage && <div className="rounded-2xl border border-energy-green/20 bg-mint-500/10 px-4 py-3 text-sm font-bold text-mint-400">{passwordMessage}</div>}
          {error && <div className="rounded-2xl border border-alert-red/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-alert-red">{error}</div>}
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {userHasPermission(user, 'page.dashboard') && <MetricCard title="Novos leads hoje" value={metrics?.newLeadsToday ?? '—'} icon={Users} color="solar" />}
            {userHasPermission(user, 'page.dashboard') && <MetricCard title="Sem Follow-up" value={metrics?.leadsWithoutFollowup ?? '—'} icon={CheckSquare} color="graphite" />}
            {userHasAnyPermission(user, ['page.tasks']) && <MetricCard title="Tarefas Vencidas" value={metrics?.overdueTasks ?? '—'} icon={CheckSquare} color="graphite" />}
            {userHasAnyPermission(user, ['page.proposals', 'proposal.view']) && <MetricCard title="Propostas Abertas" value={metrics?.openProposals ?? '—'} icon={FileText} color="energy" />}
          </div>

          <Card className="p-6">
            <div className="mb-5 flex items-center justify-between gap-4"><div><h3 className="text-lg font-black text-text-primary">Resumo do seu acesso</h3><p className="mt-1 text-sm text-text-secondary">Os cards abaixo mostram as áreas liberadas para o seu perfil e etapas de atendimento.</p></div><Badge variant={canManageUsers ? 'success' : 'solar'}>{canManageUsers ? 'Admin' : 'Operação'}</Badge></div>
            <div data-testid="profile-access-summary" className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {accessiblePages.map((page) => {
                const Icon = page.icon;
                return <Link key={page.path} to={page.path} className="group rounded-2xl border border-border-soft bg-bg-surface-2/50/70 p-4 transition hover:border-solar-orange/40 hover:bg-orange-500/5"><div className="flex items-start gap-3"><div className="rounded-xl bg-bg-surface-1 p-2 text-orange-400 shadow-sm"><Icon size={18} /></div><div><p className="font-black text-text-primary group-hover:text-orange-400">{page.label}</p><p className="mt-1 text-xs text-text-secondary">{page.description}</p></div></div></Link>;
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

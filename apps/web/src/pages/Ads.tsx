import { useMemo, useState, type ComponentType, type ReactNode } from 'react';
import { PageHeader } from '../components/ui/LayoutComponents';
import { Badge, Button, Card, MetricCard } from '../components/ui/Base';
import { useAdsOverview } from '../hooks/useCrm';
import { formatCurrency, cn } from '../lib/utils';
import type { AdCampaign, AdCreative, AdsAccount } from '../lib/api/types';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Database,
  DollarSign,
  ExternalLink,
  Eye,
  Filter,
  ImageIcon,
  Layers3,
  LayoutDashboard,
  Megaphone,
  MessageCircle,
  MousePointerClick,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Wallet,
  X,
} from 'lucide-react';

type WorkspaceMode = 'cliente' | 'gestor' | 'tecnico';
type StatusFilter = 'active' | 'all' | 'paused' | 'inactive' | 'with_leads' | 'with_spend' | 'needs_attention';
type SortOption = 'active_first' | 'spend_desc' | 'leads_desc' | 'clicks_desc' | 'name_asc';
type EntityTab = 'campaigns' | 'adsets' | 'ads';
type MetricIcon = ComponentType<{ size?: number; className?: string }>;

type Filters = {
  search: string;
  status: StatusFilter;
  objective: string;
  sort: SortOption;
  hideEmpty: boolean;
};

const statusFilterLabels: Record<StatusFilter, string> = {
  active: 'Ativas',
  all: 'Todas',
  paused: 'Pausadas',
  inactive: 'Inativas/arquivadas',
  with_leads: 'Com leads',
  with_spend: 'Com investimento',
  needs_attention: 'Pedem atenção',
};

const sortLabels: Record<SortOption, string> = {
  active_first: 'Ativas primeiro',
  spend_desc: 'Maior investimento',
  leads_desc: 'Mais leads',
  clicks_desc: 'Mais cliques',
  name_asc: 'Nome A-Z',
};

const visibleStatusFilters: StatusFilter[] = ['active', 'with_leads', 'with_spend', 'needs_attention', 'all'];

const modeCopy: Record<WorkspaceMode, { title: string; subtitle: string; icon: MetricIcon }> = {
  cliente: {
    title: 'Painel simples',
    subtitle: 'Resumo executivo, alertas e cards por objetivo. Sem IDs, sem termos internos e sem árvore completa.',
    icon: LayoutDashboard,
  },
  gestor: {
    title: 'Mesa do gestor',
    subtitle: 'Lista de campanhas no centro, filtros à esquerda e detalhes à direita.',
    icon: SlidersHorizontal,
  },
  tecnico: {
    title: 'Auditoria avançada',
    subtitle: 'Tabelas detalhadas para conferência: campanhas, grupos e anúncios com identificadores e métricas originais.',
    icon: Database,
  },
};

const objectiveLabels: Record<string, { label: string; description: string }> = {
  OUTCOME_LEADS: { label: 'Captação de leads', description: 'Gerar contatos interessados para atendimento comercial.' },
  LEAD_GENERATION: { label: 'Captação de leads', description: 'Formulários, conversas ou cadastros vindos dos anúncios.' },
  OUTCOME_TRAFFIC: { label: 'Tráfego', description: 'Levar pessoas para o site, landing page ou WhatsApp.' },
  LINK_CLICKS: { label: 'Cliques no link', description: 'Trazer visitantes para um destino específico.' },
  OUTCOME_SALES: { label: 'Vendas/conversões', description: 'Buscar ações de maior intenção comercial.' },
  CONVERSIONS: { label: 'Conversões', description: 'Otimizar eventos medidos pelo pixel.' },
  OUTCOME_AWARENESS: { label: 'Reconhecimento', description: 'Aumentar alcance e lembrança da marca.' },
  REACH: { label: 'Alcance', description: 'Mostrar anúncios para o maior número possível de pessoas.' },
  OUTCOME_ENGAGEMENT: { label: 'Engajamento', description: 'Gerar interações com anúncio, perfil ou mensagem.' },
};

const bidStrategyLabels: Record<string, string> = {
  LOWEST_COST_WITHOUT_CAP: 'menor custo possível',
  LOWEST_COST_WITH_BID_CAP: 'menor custo com limite de lance',
  COST_CAP: 'controle de custo',
  LOWEST_COST_WITH_MIN_ROAS: 'menor custo com ROAS mínimo',
};

const initialFilters: Filters = {
  search: '',
  status: 'active',
  objective: 'all',
  sort: 'active_first',
  hideEmpty: false,
};

function humanizeToken(value: string | null | undefined) {
  if (!value) return 'Não informado';
  return value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusVariant(status: string) {
  const normalized = status.toLowerCase();
  if (['active', 'enabled', 'running', 'connected'].includes(normalized)) return 'success' as const;
  if (['pending_credentials', 'unknown', 'paused', 'in_process', 'with_issues'].includes(normalized)) return 'warning' as const;
  if (['error', 'failed', 'disabled', 'rejected'].includes(normalized)) return 'error' as const;
  return 'default' as const;
}

function isActiveStatus(status: string) {
  return ['active', 'enabled', 'running'].includes(status.toLowerCase());
}

function isPausedStatus(status: string) {
  return status.toLowerCase() === 'paused';
}

function isInactiveStatus(status: string) {
  return ['deleted', 'archived', 'disabled', 'inactive', 'rejected'].includes(status.toLowerCase());
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    active: 'Ativa',
    enabled: 'Ativa',
    running: 'Rodando',
    paused: 'Pausada',
    deleted: 'Excluída',
    archived: 'Arquivada',
    inactive: 'Inativa',
    disabled: 'Desativada',
    connected: 'Conectada',
    pending_credentials: 'Credenciais pendentes',
    error: 'Erro',
    unknown: 'Sem snapshot',
  };
  return labels[status.toLowerCase()] ?? humanizeToken(status);
}

function explainObjective(objective: string | null) {
  if (!objective) return { label: 'Objetivo não informado', description: 'A Meta não retornou o objetivo desta campanha.' };
  return objectiveLabels[objective] ?? { label: humanizeToken(objective), description: 'Objetivo original retornado pelo Meta Ads.' };
}

function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat('pt-BR').format(value ?? 0);
}

function safeName(value: string | null | undefined, fallback: string) {
  if (!value || !value.trim()) return fallback;
  return value.trim();
}

function metadataArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item)) : [];
}

function customAudiences(account: AdsAccount | undefined): Record<string, unknown>[] {
  return account ? metadataArray(account.metadata.customAudiences) : [];
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function creativeHeadline(ad: AdCreative) {
  return ad.title ?? ad.creativeName ?? safeName(ad.name, 'Anúncio sem título retornado');
}

function creativeBody(ad: AdCreative) {
  return ad.body ?? 'Texto público ainda não disponível neste anúncio.';
}

function allAds(campaign: AdCampaign) {
  return campaign.adSets.flatMap((set) => set.ads);
}

function hasActiveDeliveryChain(campaign: AdCampaign) {
  return isActiveStatus(campaign.effectiveStatus)
    && campaign.adSets.some((set) => isActiveStatus(set.effectiveStatus) && set.ads.some((ad) => isActiveStatus(ad.effectiveStatus)));
}

function onlyActiveDeliveryChain(campaign: AdCampaign): AdCampaign {
  return {
    ...campaign,
    adSets: campaign.adSets
      .filter((set) => isActiveStatus(set.effectiveStatus))
      .map((set) => ({ ...set, ads: set.ads.filter((ad) => isActiveStatus(ad.effectiveStatus)) }))
      .filter((set) => set.ads.length > 0),
  };
}

function campaignNeedsAttention(campaign: AdCampaign) {
  return campaign.spendAmount > 0 && campaign.leads === 0 || isActiveStatus(campaign.effectiveStatus) && campaign.adSets.length === 0;
}

function campaignSearchText(campaign: AdCampaign) {
  return [
    campaign.name,
    campaign.objective,
    explainObjective(campaign.objective).label,
    campaign.effectiveStatus,
    campaign.externalCampaignId,
    ...campaign.adSets.flatMap((set) => [set.name, set.externalAdSetId, set.audienceSummary, set.optimizationGoal, ...set.ads.flatMap((ad) => [ad.name, ad.externalAdId, ad.title, ad.body, ad.creativeName])]),
  ].filter(Boolean).join(' ').toLowerCase();
}

function matchesStatus(campaign: AdCampaign, status: StatusFilter) {
  if (status === 'all') return true;
  if (status === 'active') return isActiveStatus(campaign.effectiveStatus);
  if (status === 'paused') return isPausedStatus(campaign.effectiveStatus);
  if (status === 'inactive') return isInactiveStatus(campaign.effectiveStatus);
  if (status === 'with_leads') return campaign.leads > 0;
  if (status === 'with_spend') return campaign.spendAmount > 0;
  if (status === 'needs_attention') return campaignNeedsAttention(campaign);
  return true;
}

function sortCampaigns(campaigns: AdCampaign[], sort: SortOption) {
  return [...campaigns].sort((a, b) => {
    if (sort === 'spend_desc') return b.spendAmount - a.spendAmount;
    if (sort === 'leads_desc') return b.leads - a.leads;
    if (sort === 'clicks_desc') return b.clicks - a.clicks;
    if (sort === 'name_asc') return a.name.localeCompare(b.name, 'pt-BR');
    const activeDelta = Number(isActiveStatus(b.effectiveStatus)) - Number(isActiveStatus(a.effectiveStatus));
    if (activeDelta !== 0) return activeDelta;
    return b.spendAmount - a.spendAmount;
  });
}

function campaignTotals(campaigns: AdCampaign[]) {
  return campaigns.reduce((totals, campaign) => {
    totals.spend += campaign.spendAmount;
    totals.clicks += campaign.clicks;
    totals.leads += campaign.leads;
    totals.impressions += campaign.impressions;
    totals.adSets += campaign.adSets.length;
    totals.ads += allAds(campaign).length;
    return totals;
  }, { spend: 0, clicks: 0, leads: 0, impressions: 0, adSets: 0, ads: 0 });
}

function MetricPill({ label, value, icon: Icon, help }: { label: string; value: string | number; icon: MetricIcon; help?: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-gray-400"><Icon size={14} /><span>{label}</span></div>
      <p className="mt-1 text-base font-black text-graphite">{value}</p>
      {help && <p className="mt-1 text-[11px] leading-snug text-gray-400">{help}</p>}
    </div>
  );
}

function KpiCard({ title, value, subtext, icon: Icon, trend, color = 'solar', size = 'md' }: { title: string; value: string | number; subtext?: string; icon: MetricIcon; trend?: { value: string; direction: 'up' | 'down' }; color?: 'solar' | 'energy' | 'graphite' | 'alert'; size?: 'sm' | 'md' }) {
  const colors = {
    solar: 'bg-solar-orange/10 text-solar-orange',
    energy: 'bg-energy-green/10 text-energy-green',
    graphite: 'bg-gray-100 text-graphite',
    alert: 'bg-alert-red/10 text-alert-red',
  };
  
  const sizes = {
    sm: 'p-2',
    md: 'p-2.5',
  };
  
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className={cn('rounded-xl', sizes[size], colors[color])}>
          <Icon size={size === 'sm' ? 16 : 20} />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-bold ${trend.direction === 'up' ? 'text-energy-success' : 'text-alert-red'}`}>
            {trend.direction === 'up' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
            {trend.value}
          </div>
        )}
      </div>
      <div className="mt-2">
        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{title}</p>
        <p className={`mt-0.5 font-black text-graphite ${size === 'sm' ? 'text-lg' : 'text-2xl'}`}>{value}</p>
        {subtext && <p className="mt-0.5 text-[10px] text-gray-500">{subtext}</p>}
      </div>
    </Card>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return <Card className="p-8 text-center"><BarChart3 className="mx-auto mb-3 text-gray-300" size={34} /><h3 className="font-black text-graphite">{title}</h3><p className="mt-1 text-sm text-gray-500">{text}</p></Card>;
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return <div className="rounded-xl bg-gray-50 p-3"><p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">{label}</p><div className="mt-1 text-sm font-semibold text-graphite">{value}</div></div>;
}

function ModeSwitch({ mode, setMode }: { mode: WorkspaceMode; setMode: (mode: WorkspaceMode) => void }) {
  return (
    <Card className="p-2">
      <div className="grid gap-2 lg:grid-cols-3">
        {(['cliente', 'gestor', 'tecnico'] as WorkspaceMode[]).map((item) => {
          const Icon = modeCopy[item].icon;
          const active = item === mode;
          return (
            <button key={item} type="button" onClick={() => setMode(item)} className={`rounded-2xl p-4 text-left transition ${active ? 'bg-graphite text-white shadow-sm' : 'bg-white text-graphite hover:bg-gray-50'}`}>
              <div className="flex items-center gap-2"><Icon size={18} className={active ? 'text-solar-orange' : 'text-gray-400'} /><p className="font-black">{modeCopy[item].title}</p></div>
              <p className={`mt-2 text-sm leading-relaxed ${active ? 'text-white/70' : 'text-gray-500'}`}>{modeCopy[item].subtitle}</p>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function FilterBar({ filters, setFilters, objectives, shown, total }: { filters: Filters; setFilters: (filters: Filters) => void; objectives: string[]; shown: number; total: number }) {
  return (
    <Card className="p-4">
      <div className="grid gap-3 xl:grid-cols-[1.4fr_0.9fr_0.9fr_0.9fr_auto] xl:items-end">
        <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-gray-400">
          Busca global
          <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 focus-within:border-solar-orange">
            <Search size={16} className="text-gray-400" />
            <input value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="campanha, público, criativo, texto, ID..." className="w-full bg-transparent text-sm font-semibold normal-case tracking-normal text-graphite outline-none" />
            {filters.search && <button type="button" onClick={() => setFilters({ ...filters, search: '' })}><X size={14} /></button>}
          </div>
        </label>
        <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-gray-400">Status<select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value as StatusFilter })} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold normal-case tracking-normal text-graphite">{visibleStatusFilters.map((key) => <option key={key} value={key}>{statusFilterLabels[key]}</option>)}</select></label>
        <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-gray-400">Objetivo<select value={filters.objective} onChange={(event) => setFilters({ ...filters, objective: event.target.value })} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold normal-case tracking-normal text-graphite"><option value="all">Todos</option>{objectives.map((objective) => <option key={objective} value={objective}>{explainObjective(objective).label}</option>)}</select></label>
        <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-gray-400">Ordenação<select value={filters.sort} onChange={(event) => setFilters({ ...filters, sort: event.target.value as SortOption })} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold normal-case tracking-normal text-graphite">{(Object.keys(sortLabels) as SortOption[]).map((key) => <option key={key} value={key}>{sortLabels[key]}</option>)}</select></label>
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 whitespace-nowrap text-sm font-semibold text-gray-600"><input type="checkbox" checked={filters.hideEmpty} onChange={(event) => setFilters({ ...filters, hideEmpty: event.target.checked })} className="h-4 w-4 accent-solar-orange" /> ocultar zeradas</label>
          <Button variant="ghost" size="sm" onClick={() => setFilters(initialFilters)} className="gap-2"><Filter size={14} /> Limpar</Button>
        </div>
      </div>
      <p className="mt-3 text-xs font-semibold text-gray-400">Mostrando {shown} de {total} campanhas elegíveis. Só entram campanhas Meta ativas com pelo menos 1 conjunto ativo e 1 anúncio ativo.</p>
    </Card>
  );
}

function AdMiniCard({ ad }: { ad: AdCreative }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-gray-100 bg-white p-3">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-100">{ad.thumbnailUrl ? <img src={ad.thumbnailUrl} alt={creativeHeadline(ad)} className="h-full w-full object-cover" /> : <ImageIcon size={22} className="text-gray-300" />}</div>
      <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><Badge variant={statusVariant(ad.effectiveStatus)}>{statusLabel(ad.effectiveStatus)}</Badge><span className="text-xs font-bold text-gray-400">{formatCurrency(ad.spendAmount)}</span></div><p className="mt-1 line-clamp-1 text-sm font-black text-graphite">{creativeHeadline(ad)}</p><p className="mt-1 line-clamp-2 text-xs text-gray-500">{creativeBody(ad)}</p></div>
    </div>
  );
}

function ClientSummaryView({ campaigns }: { campaigns: AdCampaign[] }) {
  const totals = campaignTotals(campaigns);
  const active = campaigns.filter((campaign) => isActiveStatus(campaign.effectiveStatus));
  const attention = campaigns.filter(campaignNeedsAttention).slice(0, 5);
  const topCampaigns = [...campaigns].sort((a, b) => b.spendAmount - a.spendAmount).slice(0, 6);
  const groups = campaigns.reduce<Record<string, AdCampaign[]>>((acc, campaign) => {
    const key = explainObjective(campaign.objective).label;
    acc[key] = [...(acc[key] ?? []), campaign];
    return acc;
  }, {});
  
  // Calcular métricas de eficiência
  const cpl = totals.leads > 0 ? totals.spend / totals.leads : 0;
  const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  const cpm = totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0;

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <section className="space-y-5">
        <Card className="bg-gradient-to-br from-orange-50 to-white p-6">
          <Badge variant="solar">Resumo para cliente</Badge>
          <h2 className="mt-3 text-2xl font-black text-graphite">O que está rodando agora?</h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">Esta visão parece menos com planilha e mais com relatório: foca em campanhas, objetivos, verba e sinais de atenção.</p>
          
          {/* Dashboard Executivo com KPIs principais */}
          <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <KpiCard title="Campanhas Ativas" value={active.length} icon={Megaphone} color="graphite" subtext={`${campaigns.length} no total`} />
            <KpiCard title="Investimento Total" value={formatCurrency(totals.spend)} icon={DollarSign} color="solar" trend={{ value: '+12%', direction: 'up' }} />
            <KpiCard title="Leads Gerados" value={formatNumber(totals.leads)} icon={MessageCircle} color="energy" trend={{ value: '+8%', direction: 'up' }} />
            <KpiCard title="CPL Médio" value={cpl > 0 ? formatCurrency(cpl) : '—'} icon={TrendingUp} color={cpl > 0 && cpl < 50 ? 'energy' : cpl > 100 ? 'alert' : 'solar'} subtext="Custo por lead" />
          </div>
          
          {/* Segunda linha de KPIs */}
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <KpiCard title="Cliques" value={formatNumber(totals.clicks)} icon={MousePointerClick} color="solar" subtext={`${ctr.toFixed(2)}% CTR`} />
            <KpiCard title="Impressões" value={formatNumber(totals.impressions)} icon={Eye} color="graphite" subtext={`CPM: ${cpm > 0 ? formatCurrency(cpm) : '—'}`} />
            <KpiCard title="Grupos de Anúncios" value={totals.adSets} icon={Layers3} color="energy" />
          </div>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          {Object.entries(groups).map(([objective, items]) => {
            const groupTotals = campaignTotals(items);
            const groupCpl = groupTotals.leads > 0 ? groupTotals.spend / groupTotals.leads : 0;
            return <Card key={objective} className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="font-black text-graphite">{objective}</p><p className="mt-1 text-sm text-gray-500">{items.length} campanha{items.length === 1 ? '' : 's'} neste objetivo</p></div><Target size={20} className="text-solar-orange" /></div><div className="mt-4 grid grid-cols-4 gap-2 text-center"><div className="rounded-xl bg-gray-50 p-3"><p className="font-black text-graphite">{formatCurrency(groupTotals.spend)}</p><p className="text-[11px] text-gray-400">investido</p></div><div className="rounded-xl bg-gray-50 p-3"><p className="font-black text-graphite">{groupTotals.leads}</p><p className="text-[11px] text-gray-400">leads</p></div><div className="rounded-xl bg-gray-50 p-3"><p className="font-black text-graphite">{groupTotals.ads}</p><p className="text-[11px] text-gray-400">anúncios</p></div><div className="rounded-xl bg-gray-50 p-3"><p className="font-black text-graphite">{groupCpl > 0 ? formatCurrency(groupCpl) : '—'}</p><p className="text-[11px] text-gray-400">CPL</p></div></div></Card>;
          })}
        </div>
      </section>

      <aside className="space-y-5">
        <Card className="p-5">
          <div className="flex items-center gap-2"><AlertTriangle size={18} className="text-alert-amber" /><h3 className="font-black text-graphite">Pontos de atenção</h3></div>
          <div className="mt-4 space-y-3">{attention.length === 0 ? <p className="text-sm text-gray-500">Nenhum alerta relevante nos filtros atuais.</p> : attention.map((campaign) => <div key={campaign.id} className="rounded-2xl bg-amber-50 p-3"><p className="font-bold text-graphite line-clamp-1">{campaign.name}</p><p className="mt-1 text-xs text-gray-600">{campaign.spendAmount > 0 && campaign.leads === 0 ? 'Teve investimento, mas não registrou leads no período.' : 'Está ativa, mas sem grupos importados.'}</p></div>)}</div>
        </Card>
        <Card className="p-5"><h3 className="font-black text-graphite">Maiores investimentos</h3><div className="mt-4 space-y-3">{topCampaigns.map((campaign, index) => <div key={campaign.id} className="flex items-center gap-3"><div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-xs font-black text-gray-500">{index + 1}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-graphite">{campaign.name}</p><p className="text-xs text-gray-500">{formatCurrency(campaign.spendAmount)} · {campaign.leads} leads</p></div></div>)}</div></Card>
      </aside>
    </div>
  );
}

function CampaignTable({ campaigns, selectedId, setSelectedId }: { campaigns: AdCampaign[]; selectedId: string | null; setSelectedId: (id: string) => void }) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-gray-100 bg-gray-50 px-4 py-3"><p className="text-xs font-black uppercase tracking-wide text-gray-400">Campanhas</p></div>
      <div className="max-h-[760px] crm-scroll-panel overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10 bg-white text-xs uppercase tracking-wide text-gray-400">
            <tr>
              <th className="p-3">Nome</th>
              <th className="p-3">Objetivo</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Investido</th>
              <th className="p-3 text-right">Leads</th>
              <th className="p-3 text-right">CPL</th>
              <th className="p-3 text-right">Cliques</th>
              <th className="p-3 text-right">CTR</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {campaigns.map((campaign) => {
              const cpl = campaign.leads > 0 ? campaign.spendAmount / campaign.leads : 0;
              const ctr = campaign.impressions > 0 ? (campaign.clicks / campaign.impressions) * 100 : 0;
              return (
                <tr 
                  key={campaign.id} 
                  onClick={() => setSelectedId(campaign.id)} 
                  className={`cursor-pointer hover:bg-orange-50/50 ${selectedId === campaign.id ? 'bg-orange-50' : ''}`}
                >
                  <td className="p-3">
                    <p className="max-w-[280px] truncate font-bold text-graphite">{campaign.name}</p>
                    <p className="text-xs text-gray-400">{campaign.adSets.length} grupos · {allAds(campaign).length} anúncios</p>
                  </td>
                  <td className="p-3 text-gray-600">{explainObjective(campaign.objective).label}</td>
                  <td className="p-3"><Badge variant={statusVariant(campaign.effectiveStatus)}>{statusLabel(campaign.effectiveStatus)}</Badge></td>
                  <td className="p-3 text-right font-bold text-graphite">{formatCurrency(campaign.spendAmount)}</td>
                  <td className="p-3 text-right font-bold text-graphite">{campaign.leads}</td>
                  <td className="p-3 text-right">
                    {cpl > 0 ? (
                      <span className={`font-bold ${cpl < 50 ? 'text-energy-success' : cpl > 100 ? 'text-alert-red' : 'text-gray-600'}`}>
                        {formatCurrency(cpl)}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="p-3 text-right font-semibold text-gray-600">{formatNumber(campaign.clicks)}</td>
                  <td className="p-3 text-right">
                    <span className={`text-xs font-bold ${ctr > 2 ? 'text-energy-success' : ctr > 1 ? 'text-gray-600' : 'text-gray-400'}`}>
                      {ctr.toFixed(2)}%
                    </span>
                  </td>
                  <td className="p-3"><ChevronRight size={16} className="text-gray-300" /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function CampaignInspector({ campaign }: { campaign: AdCampaign | undefined }) {
  if (!campaign) return <Card className="p-6"><p className="text-sm text-gray-500">Selecione uma campanha para ver detalhes.</p></Card>;
  const objective = explainObjective(campaign.objective);
  const ads = allAds(campaign);
  
  // Calcular métricas de eficiência da campanha
  const cpl = campaign.leads > 0 ? campaign.spendAmount / campaign.leads : 0;
  const ctr = campaign.impressions > 0 ? (campaign.clicks / campaign.impressions) * 100 : 0;
  const cpc = campaign.clicks > 0 ? campaign.spendAmount / campaign.clicks : 0;
  const cpm = campaign.impressions > 0 ? (campaign.spendAmount / campaign.impressions) * 1000 : 0;
  
  return (
    <Card className="sticky top-6 max-h-[820px] crm-scroll-panel overflow-auto p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Badge variant={statusVariant(campaign.effectiveStatus)}>{statusLabel(campaign.effectiveStatus)}</Badge>
          <h3 className="mt-3 text-lg font-black text-graphite">{campaign.name}</h3>
          <p className="mt-2 text-sm leading-relaxed text-gray-500">
            <strong className="text-graphite">{objective.label}.</strong> {objective.description}
          </p>
        </div>
      </div>
      
      {/* Métricas principais em cards */}
      <div className="mt-5 grid grid-cols-2 gap-2">
        <KpiCard title="Investido" value={formatCurrency(campaign.spendAmount)} icon={DollarSign} color="solar" size="sm" />
        <KpiCard title="Leads" value={campaign.leads} icon={MessageCircle} color="energy" size="sm" />
        <KpiCard title="Cliques" value={formatNumber(campaign.clicks)} icon={MousePointerClick} color="graphite" size="sm" />
        <KpiCard title="Impressões" value={formatNumber(campaign.impressions)} icon={Eye} color="graphite" size="sm" />
      </div>
      
      {/* Métricas de eficiência */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <MetricPill label="CPL" value={cpl > 0 ? formatCurrency(cpl) : '—'} icon={TrendingUp} help="Custo por lead" />
        <MetricPill label="CTR" value={`${ctr.toFixed(2)}%`} icon={BarChart3} help="Taxa de clique" />
        <MetricPill label="CPC" value={cpc > 0 ? formatCurrency(cpc) : '—'} icon={MousePointerClick} help="Custo por clique" />
        <MetricPill label="CPM" value={cpm > 0 ? formatCurrency(cpm) : '—'} icon={Eye} help="Custo por mil impressões" />
      </div>
      
      <div className="mt-5 grid gap-3">
        <Field label="Estratégia" value={campaign.bidStrategy ? (bidStrategyLabels[campaign.bidStrategy] ?? humanizeToken(campaign.bidStrategy)) : 'Não informada'} />
        <Field label="Orçamento" value={campaign.budgetAmount === null ? 'Não informado' : formatCurrency(campaign.budgetAmount)} />
      </div>
      
      <div className="mt-5">
        <h4 className="font-black text-graphite">Grupos</h4>
        <div className="mt-3 space-y-3">
          {campaign.adSets.map((set) => (
            <div key={set.id} className="rounded-2xl bg-gray-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="line-clamp-1 font-bold text-graphite">{set.name}</p>
                <Badge variant={statusVariant(set.effectiveStatus)}>{statusLabel(set.effectiveStatus)}</Badge>
              </div>
              <p className="mt-1 text-xs text-gray-500">{set.audienceSummary ?? 'Público não informado'} · {set.ads.length} anúncios</p>
            </div>
          ))}
        </div>
      </div>
      
      <div className="mt-5">
        <h4 className="font-black text-graphite">Criativos principais</h4>
        <div className="mt-3 space-y-3">
          {ads.slice(0, 4).map((ad) => <AdMiniCard key={ad.id} ad={ad} />)}
        </div>
        {ads.length > 4 && <p className="mt-3 text-xs font-semibold text-gray-400">+ {ads.length - 4} anúncios no total</p>}
      </div>
    </Card>
  );
}

function ManagerWorkspace({ campaigns, selectedId, setSelectedId, filters, setFilters }: { campaigns: AdCampaign[]; selectedId: string | null; setSelectedId: (id: string) => void; filters: Filters; setFilters: (filters: Filters) => void }) {
  const selected = campaigns.find((campaign) => campaign.id === selectedId) ?? campaigns[0];
  return (
    <div className="grid gap-5 xl:grid-cols-[230px_minmax(0,1fr)_360px]">
      <aside className="space-y-4"><Card className="p-4"><p className="text-xs font-black uppercase tracking-wide text-gray-400">Visões rápidas</p><div className="mt-3 space-y-2">{visibleStatusFilters.map((status) => <button key={status} type="button" onClick={() => setFilters({ ...filters, status })} className={`w-full rounded-xl px-3 py-2 text-left text-sm font-bold transition ${filters.status === status ? 'bg-graphite text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>{statusFilterLabels[status]}</button>)}</div></Card><Card className="p-4"><p className="text-xs font-black uppercase tracking-wide text-gray-400">Como usar</p><p className="mt-2 text-sm leading-relaxed text-gray-500">Use os filtros laterais, selecione uma campanha e acompanhe os detalhes no painel à direita.</p></Card></aside>
      <CampaignTable campaigns={campaigns} selectedId={selected?.id ?? null} setSelectedId={setSelectedId} />
      <CampaignInspector campaign={selected} />
    </div>
  );
}

function TechTable({ campaigns, tab, setTab }: { campaigns: AdCampaign[]; tab: EntityTab; setTab: (tab: EntityTab) => void }) {
  const adSets = campaigns.flatMap((campaign) => campaign.adSets.map((set) => ({ campaign, set })));
  const ads = adSets.flatMap(({ campaign, set }) => set.ads.map((ad) => ({ campaign, set, ad })));
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 bg-gray-50 p-3">{(['campaigns', 'adsets', 'ads'] as EntityTab[]).map((item) => <button key={item} type="button" onClick={() => setTab(item)} className={`rounded-xl px-3 py-2 text-xs font-black ${tab === item ? 'bg-graphite text-white' : 'bg-white text-gray-500'}`}>{item === 'campaigns' ? 'Campanhas' : item === 'adsets' ? 'Grupos' : 'Anúncios'}</button>)}</div>
      <div className="crm-scroll-panel overflow-auto">
        {tab === 'campaigns' && <table className="w-full whitespace-nowrap text-left text-xs"><thead className="bg-white text-gray-400"><tr><th className="p-3">ID</th><th className="p-3">Nome</th><th className="p-3">Status bruto</th><th className="p-3">Objetivo bruto</th><th className="p-3 text-right">Spend</th><th className="p-3 text-right">Leads</th></tr></thead><tbody className="divide-y divide-gray-50">{campaigns.map((campaign) => <tr key={campaign.id}><td className="p-3 font-mono text-gray-500">{campaign.externalCampaignId ?? '—'}</td><td className="p-3 font-bold text-graphite">{campaign.name}</td><td className="p-3">{campaign.effectiveStatus}</td><td className="p-3">{campaign.objective ?? '—'}</td><td className="p-3 text-right">{campaign.spendAmount}</td><td className="p-3 text-right">{campaign.leads}</td></tr>)}</tbody></table>}
        {tab === 'adsets' && <table className="w-full whitespace-nowrap text-left text-xs"><thead className="bg-white text-gray-400"><tr><th className="p-3">ID grupo</th><th className="p-3">Grupo</th><th className="p-3">Campanha</th><th className="p-3">Status</th><th className="p-3">Otimização</th><th className="p-3">Cobrança</th></tr></thead><tbody className="divide-y divide-gray-50">{adSets.map(({ campaign, set }) => <tr key={set.id}><td className="p-3 font-mono text-gray-500">{set.externalAdSetId ?? '—'}</td><td className="p-3 font-bold text-graphite">{set.name}</td><td className="p-3">{campaign.name}</td><td className="p-3">{set.effectiveStatus}</td><td className="p-3">{set.optimizationGoal ?? '—'}</td><td className="p-3">{set.billingEvent ?? '—'}</td></tr>)}</tbody></table>}
        {tab === 'ads' && <table className="w-full whitespace-nowrap text-left text-xs"><thead className="bg-white text-gray-400"><tr><th className="p-3">ID anúncio</th><th className="p-3">Anúncio</th><th className="p-3">Grupo</th><th className="p-3">Status</th><th className="p-3 text-right">Spend</th><th className="p-3 text-right">Leads</th><th className="p-3">Destino</th></tr></thead><tbody className="divide-y divide-gray-50">{ads.map(({ set, ad }) => <tr key={ad.id}><td className="p-3 font-mono text-gray-500">{ad.externalAdId ?? '—'}</td><td className="p-3 font-bold text-graphite">{ad.name}</td><td className="p-3">{set.name}</td><td className="p-3">{ad.effectiveStatus}</td><td className="p-3 text-right">{ad.spendAmount}</td><td className="p-3 text-right">{ad.leads}</td><td className="p-3">{ad.destinationUrl ? <a href={ad.destinationUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-solar-orange"><ExternalLink size={12} /> abrir</a> : '—'}</td></tr>)}</tbody></table>}
      </div>
    </Card>
  );
}

export default function Ads() {
  const { overview, loading, syncing, error, syncMessage, syncMetaAds } = useAdsOverview();
  const [mode, setMode] = useState<WorkspaceMode>('cliente');
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [techTab, setTechTab] = useState<EntityTab>('campaigns');

  const metaCampaigns = useMemo(() => (overview?.campaigns ?? [])
    .filter((campaign) => campaign.platform === 'meta')
    .map(onlyActiveDeliveryChain)
    .filter(hasActiveDeliveryChain), [overview]);
  const metaAccount = overview?.accounts.find((account) => account.platform === 'meta');
  const audiences = customAudiences(metaAccount);
  const objectiveOptions = useMemo(() => Array.from(new Set(metaCampaigns.map((campaign) => campaign.objective).filter((objective): objective is string => Boolean(objective)))).sort((a, b) => explainObjective(a).label.localeCompare(explainObjective(b).label, 'pt-BR')), [metaCampaigns]);
  const filteredCampaigns = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    const filtered = metaCampaigns.filter((campaign) => {
      if (filters.objective !== 'all' && campaign.objective !== filters.objective) return false;
      if (!matchesStatus(campaign, filters.status)) return false;
      if (filters.hideEmpty && campaign.spendAmount <= 0 && campaign.leads <= 0) return false;
      if (query && !campaignSearchText(campaign).includes(query)) return false;
      return true;
    });
    return sortCampaigns(filtered, filters.sort);
  }, [filters, metaCampaigns]);
  const totals = campaignTotals(filteredCampaigns);

  if (loading) return <div className="py-12 text-center text-gray-500">Carregando mídia paga...</div>;
  if (!overview) return <div className="py-12 text-center text-alert-red">{error ?? 'Erro ao carregar mídia paga'}</div>;

  return (
    <div className="space-y-8">
      <PageHeader title="Campanhas e Anúncios" description="Campanhas ativas da Meta com conjunto e anúncio ativos para leitura comercial da Enervita." actions={<Button variant="outline" size="sm" className="gap-2" onClick={() => void syncMetaAds()} disabled={syncing}><RefreshCw size={14} className={syncing ? 'animate-spin' : ''} /> {syncing ? 'Sincronizando Meta...' : 'Atualizar dados do Meta'}</Button>} />
      {error && <div className="rounded-2xl border border-alert-red/20 bg-alert-red/10 p-5 flex gap-3 text-alert-red"><AlertTriangle size={22} /> <span className="text-sm">{error}</span></div>}
      {syncMessage && <div className="rounded-2xl border border-energy-success/20 bg-mint-light/50 p-5 flex gap-3 text-energy-success"><CheckCircle2 size={22} /> <span className="text-sm">{syncMessage}</span></div>}

      <Card className="bg-gradient-to-br from-[#101820] via-graphite to-[#173f32] p-6 text-white">
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-center"><div><Badge variant="solar" className="bg-white/10 text-orange-100"><span className="inline-flex items-center gap-1"><Sparkles size={12} /> Leitura executiva de mídia paga</span></Badge><h2 className="mt-3 text-2xl font-black">Três formas de acompanhar as campanhas.</h2><p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/75">Painel simples para leitura, mesa do gestor para operar e visão de auditoria para conferência. A base já vem filtrada: campanha, conjunto e anúncio precisam estar ativos.</p></div><div className="grid grid-cols-3 gap-3 text-center"><div className="rounded-2xl bg-white/10 p-4"><p className="text-2xl font-black">{formatNumber(filteredCampaigns.length)}</p><p className="text-xs text-white/65">campanhas visíveis</p></div><div className="rounded-2xl bg-white/10 p-4"><p className="text-2xl font-black">{formatCurrency(totals.spend)}</p><p className="text-xs text-white/65">investido filtrado</p></div><div className="rounded-2xl bg-white/10 p-4"><p className="text-2xl font-black">{formatNumber(totals.leads)}</p><p className="text-xs text-white/65">leads filtrados</p></div></div></div>
      </Card>

      <ModeSwitch mode={mode} setMode={setMode} />
      <FilterBar filters={filters} setFilters={setFilters} objectives={objectiveOptions} shown={filteredCampaigns.length} total={metaCampaigns.length} />

      <div className="grid grid-cols-1 md:grid-cols-5 gap-5"><MetricCard title="Campanhas" value={filteredCampaigns.length} icon={Megaphone} color="graphite" /><MetricCard title="Grupos" value={totals.adSets} icon={Layers3} color="energy" /><MetricCard title="Anúncios" value={totals.ads} icon={MousePointerClick} color="solar" /><MetricCard title="Leads" value={totals.leads} icon={MessageCircle} color="energy" /><MetricCard title="Públicos" value={audiences.length} icon={Users} color="solar" /></div>

      {filteredCampaigns.length === 0 ? <EmptyState title="Nenhuma campanha ativa elegível" text="O CRM só exibe campanhas em que campanha, conjunto e anúncio estão ativos ao mesmo tempo. Se qualquer nível estiver desativado, ele fica oculto." /> : mode === 'cliente' ? <ClientSummaryView campaigns={filteredCampaigns} /> : mode === 'gestor' ? <ManagerWorkspace campaigns={filteredCampaigns} selectedId={selectedCampaignId} setSelectedId={setSelectedCampaignId} filters={filters} setFilters={setFilters} /> : <TechTable campaigns={filteredCampaigns} tab={techTab} setTab={setTechTab} />}

      {mode === 'tecnico' && audiences.length > 0 && <Card className="p-5"><h3 className="font-black text-graphite">Públicos Meta retornados</h3><div className="mt-4 grid gap-3 md:grid-cols-3">{audiences.slice(0, 12).map((audience) => <div key={String(audience.id)} className="rounded-2xl bg-gray-50 p-3"><p className="font-bold text-graphite">{text(audience.name) ?? 'Público sem nome'}</p><p className="text-xs text-gray-500">{humanizeToken(text(audience.subtype) ?? 'custom')} · {String(audience.approximate_count ?? '—')} pessoas</p></div>)}</div></Card>}
    </div>
  );
}

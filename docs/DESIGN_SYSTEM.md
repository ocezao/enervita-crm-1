# Design System — Enervita CRM

Design system do CRM comercial Enervita. Todo componente visual DEVE seguir estes tokens, padrões e convenções.

## Cores (Tokens)

Definidas em `apps/web/tailwind.config.ts` e `apps/web/src/styles/globals.css` via `@theme`.

| Token Tailwind | CSS Variable | Hex | Uso |
|----------------|-------------|-----|-----|
| `solar-orange` | `--color-solar-orange` | `#C05800` | Cor primária — CTAs, links ativos, foco, ações principais |
| `energy-green` | `--color-energy-green` | `#2EAD5B` | Cor secundária — botão secundário, badges de sucesso leve |
| `energy-deep` | `--color-energy-deep` | `#0E7A3D` | Variação escura do verde |
| `energy-success` | `--color-energy-success` | `#22A06B` | Badges de sucesso, estados concluídos |
| `graphite` | `--color-graphite` | `#17211B` | Texto principal |
| `graphite-soft` | `--color-graphite-soft` | `#2A332D` | Texto secundário |
| `warm-white` | `--color-warm-white` | `#FAF7F0` | Background principal da aplicação |
| `warm-sand` | `--color-warm-sand` | `#EFE6D4` | Scrollbar track, bordas sutis |
| `mint-light` | `--color-mint-light` | `#EAF6EE` | Background de badges success |
| `alert-red` | `--color-alert-red` | `#D94A38` | Erro, urgente, danger |
| `alert-amber` | `--color-alert-amber` | `#F5A524` | Warning, alertas |

### Regras de cor
- **NUNCA** usar cores hardcoded fora destes tokens — usar `solar-orange`, `energy-green`, etc.
- Para estados semânticos: success → `energy-success`/`mint-light`, error → `alert-red`, warning → `alert-amber`
- O sistema de aparência (`lib/appearance.ts`) permite ao usuário alterar cores primárias via CSS custom properties — os componentes já respondem a isso automaticamente

## Tipografia

| Propriedade | Valor |
|-------------|-------|
| Fonte principal | Manrope (400–800, self-hosted) |
| Fallback | Inter → system-ui → sans-serif |
| Headings (`h1-h6`) | `font-display` (Manrope) |
| Body | `font-sans` (Manrope) |
| Feature settings | `cv02`, `cv03`, `cv04`, `cv11` |

### Tamanhos de heading usados
- `h1` (título de página): `text-2xl font-bold`
- `h2` (seção): `text-lg font-semibold`
- `h3` (subseção): `text-base font-semibold`

### Numeração e formatação
- Moeda: `formatCurrency()` → `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`
- Datas: `formatDate()` → `Intl.DateTimeFormat('pt-BR')` com dia/mês/ano e hora:minuto
- Ambos em `apps/web/src/lib/utils.ts`

## Componentes Base

Todos em `apps/web/src/components/ui/Base.tsx`. Usar estes componentes — NUNCA recriar do zero.

### Button
```tsx
<Button variant="primary" size="md">Ação</Button>
```

| Variante | Cor | Uso |
|----------|-----|-----|
| `primary` | `bg-solar-orange` | Ações principais (criar, salvar, confirmar) |
| `secondary` | `bg-energy-green` | Ações secundárias positivas |
| `outline` | borda cinza, transparente | Ações neutras, filtros |
| `ghost` | transparente | Ações de baixo destaque |
| `danger` | `bg-alert-red` | Excluir, remover, destrutivo |
| `success` | `bg-energy-success` | Confirmar, finalizar |

Sizes: `sm` (px-3 py-1.5 text-xs), `md` (px-4 py-2 text-sm), `lg` (px-6 py-3 text-base), `icon` (p-2)

Efeito visual: todos os buttons têm efeito glow no hover via `.crm-button::after` (radial gradient).

### Card
```tsx
<Card className="p-5">Conteúdo</Card>
```
Padrão: `bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden`

### Badge
```tsx
<Badge variant="success">Ativo</Badge>
```

| Variante | Cor | Uso |
|----------|-----|-----|
| `default` | cinza | Estado neutro |
| `success` | verde/mint | Ativo, concluído, ganho |
| `warning` | amarelo | Atenção, pendente |
| `error` | vermelho | Erro, perdido, urgente |
| `info` | azul | Informacional |
| `solar` | laranja | Destaque de marca |

Style: `rounded-full text-[10px] font-bold uppercase tracking-wider`

### MetricCard
```tsx
<MetricCard title="Leads" value={42} icon={Users} trend="+12%" color="solar" />
```
Colors: `solar`, `energy`, `graphite`

### SearchInput
```tsx
<SearchInput placeholder="Buscar..." onChange={...} />
```
Ícone `Search` do lucide-react à esquerda, focus ring laranja.

### PageHeader
```tsx
<PageHeader title="Leads" description="Gerenciar leads" actions={<Button>Novo</Button>} />
```
Layout responsivo: empilhado em mobile, lado a lado em desktop.

## Componentes de Status

Em `apps/web/src/components/ui/StatusBadges.tsx`.

### StageBadge
Mapeia cada pipeline stage para um Badge com label em português e cor semântica:
- `novo_lead` → solar, `qualificacao`/`atendimento_iniciado`/`conta_recebida` → info
- `diagnostico`/`proposta_enviada` → warning, `contrato_enervita` → success, `perdido` → error

### PriorityBadge
- `baixa` → default, `media` → info, `alta` → warning, `urgente` → error

## Utilitários

### `cn()` — Merge de classes
```tsx
import { cn } from '../../lib/utils';
className={cn('base-class', condition && 'conditional-class', className)}
```
Sempre usar `cn()` para merge de classes Tailwind — NUNCA concatenar strings.

### Glass Card (CSS utility)
```tsx
<div className="glass-card">Conteúdo glassmorphism</div>
```
`bg-white/70 backdrop-blur-md border border-white/20 shadow-sm`

### Gradientes (CSS utilities)
- `.solar-gradient` — `linear-gradient(135deg, #F58220, #F5A524)`
- `.energy-gradient` — `linear-gradient(135deg, #0E7A3D, #2EAD5B)`

## Ícones

Biblioteca: **lucide-react** — importar ícones individuais:
```tsx
import { Users, TrendingUp, Search } from 'lucide-react';
```
Size padrão: 18–20px para ícones inline, 20px para MetricCard.

## Radix UI

Componentes Radix usados diretamente (sem wrapper padronizado):
- `@radix-ui/react-dialog` — modais
- `@radix-ui/react-dropdown-menu` — menus dropdown
- `@radix-ui/react-select` — selects customizados
- `@radix-ui/react-tabs` — abas
- `@radix-ui/react-checkbox` — checkboxes
- `@radix-ui/react-popover` — popovers
- `@radix-ui/react-tooltip` — tooltips
- `@radix-ui/react-switch` — toggles
- `@radix-ui/react-scroll-area` — scroll areas customizadas
- `@radix-ui/react-avatar` — avatares
- `@radix-ui/react-label` — labels
- `@radix-ui/react-separator` — divisores
- `@radix-ui/react-progress` — barras de progresso

## Tabelas

Biblioteca: **@tanstack/react-table** para tabelas complexas.

## Gráficos

Biblioteca: **recharts** para dashboards e analytics.

## Animações

Biblioteca: **framer-motion** para animações de transição.

Respeitar `prefers-reduced-motion` e `html[data-crm-motion="reduced"]` — o sistema de aparência permite desativar animações.

## Layout Responsivo

- Sidebar: fixa em desktop, grid responsivo em mobile (<900px)
- `PageHeader`: stack vertical em mobile, horizontal em desktop (`flex-col md:flex-row`)
- Container principal: padding controlado via `data-crm-app-main` e `data-crm-density`

## Sistema de Aparência

O CRM permite personalização visual pelo usuário (Settings > Aparência). Presets em `lib/appearance.ts`:
- **enervita** (default): comfortable, expanded nav, soft corners
- **executive**: compact, high contrast, flat cards, focused width
- **focus**: spacious, large font
- **night**: glass cards, compact nav, rounded corners

Os presets alteram CSS custom properties no `<html>` — componentes respondem automaticamente.

## Checklist para criar/editar UI

- [ ] Usar componentes de `components/ui/Base.tsx` (Button, Card, Badge, etc.)
- [ ] Usar tokens de cor do sistema (não inventar novos)
- [ ] Formatar dados em pt-BR com `formatCurrency()` / `formatDate()`
- [ ] Merge de classes via `cn()`
- [ ] Labels e textos em português brasileiro
- [ ] Ícones do lucide-react
- [ ] Respeitar `prefers-reduced-motion`
- [ ] Verificar responsividade (mobile <900px)

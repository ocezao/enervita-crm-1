# Design System - CRM

## Visão Geral

Infraestrutura do Design System baseada em **Tailwind CSS v4** (CSS First).

## Arquitetura

Fluxo unidirecional: `Tokens → Foundations → Components → Utilities`

### Camadas

| Camada | Pasta | Responsabilidade |
|--------|-------|------------------|
| Tokens | `tokens/` | Valores atômicos (SSOT) |
| Foundations | `foundations/` | Config @theme + Reset + **Temas CRM** |
| Components | `components/` | Estilos de componentes UI |
| Utilities | `utilities/` | Utilitários customizados |

## Estrutura

```
design-system/
├── index.css              # Entry point
├── README.md              # Esta doc
├── tokens/
│   ├── index.css
│   ├── colors.css         # Cores
│   ├── typography.css     # Fontes
│   ├── spacing.css        # Espaços
│   ├── radius.css         # Bordas
│   ├── shadows.css        # Sombras
│   ├── motion.css         # Animações
│   ├── z-index.css        # Z-Index
│   └── breakpoints.css    # Breakpoints
├── foundations/
│   ├── index.css
│   ├── theme.css          # @theme Tailwind
│   ├── base.css           # Reset
│   └── themes.css         # Variantes CRM (html[data-*])
├── components/
│   ├── index.css
│   ├── button.css
│   ├── card.css
│   └── scroll.css
└── utilities/
    ├── index.css
    ├── effects.css
    ├── layout.css
    └── scrollbars.css
```

## Regras

### Permitido ✅
- Tokens apenas em `tokens/*.css`
- Usar `var(--...)` em componentes
- Criar utils em `utilities/`
- Temas CRM apenas em `foundations/themes.css`

### Proibido ❌
- Tokens em `globals.css`
- Valores hardcoded em componentes
- CSS fora desta estrutura
- **Regras `html[data-*]` em qualquer lugar que não seja `foundations/themes.css`**

## SSOT (Single Source of Truth)

| Conceito | Arquivo |
|----------|---------|
| Cores | `tokens/colors.css` |
| Fontes | `tokens/typography.css` |
| Spaces | `tokens/spacing.css` |
| Radius | `tokens/radius.css` |
| Shadows | `tokens/shadows.css` |
| Temas CRM | `foundations/themes.css` |

## Ordem de Carregamento

```tsx
// main.tsx
import './styles/globals.css'
```

O `globals.css` importa este Design System na ordem:
1. Tailwind CSS
2. Design System (tokens → foundations → components → utilities)

## Tailwind v4

- Tema via `@theme` em CSS (`foundations/theme.css`)
- `tailwind.config.ts` sem definições de tema

## Governança

### Onde colocar cada coisa:

| Tipo de Estilo | Local Correto |
|---------------|---------------|
| Variáveis de cor, fonte, espaço, etc. | `tokens/*.css` |
| Mapeamento @theme para Tailwind | `foundations/theme.css` |
| Reset CSS global | `foundations/base.css` |
| **Regras html[data-*] / Variantes de tema** | **`foundations/themes.css`** |
| Componentes UI (.button, .card) | `components/*.css` |
| Utilitários (.glass, .scrollbar-hide) | `utilities/*.css` |
| Font-face (@font-face) | `globals.css` (exceção) |
| Reset do body | `globals.css` (mínimo) |

# Design System - CRM

## Visão Geral

Infraestrutura do Design System baseada em **Tailwind CSS v4** (CSS First).

## Arquitetura

Fluxo unidirecional: `Tokens → Foundations → Components → Utilities`

### Camadas

| Camada | Pasta | Responsabilidade |
|--------|-------|------------------|
| Tokens | `tokens/` | Valores atômicos (SSOT) |
| Foundations | `foundations/` | Config @theme + Reset |
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
│   └── themes.css         # Variantes
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

### Proibido ❌
- Tokens em `globals.css`
- Valores hardcoded em componentes
- CSS fora desta estrutura

## SSOT (Single Source of Truth)

| Conceito | Arquivo |
|----------|---------|
| Cores | `tokens/colors.css` |
| Fontes | `tokens/typography.css` |
| Spaces | `tokens/spacing.css` |
| Radius | `tokens/radius.css` |
| Shadows | `tokens/shadows.css` |

## Ordem de Carregamento

```tsx
// main.tsx
import './styles/globals.css'
```

O `globals.css` importa este Design System.

## Tailwind v4

- Tema via `@theme` em CSS
- `tailwind.config.ts` sem definições de tema

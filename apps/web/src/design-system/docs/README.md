# Design System Documentation

## Visão Geral

Esta pasta contém toda a infraestrutura do Design System do CRM Enervita.

## Estrutura de Diretórios

```
design-system/
├── index.ts          # Entry point TypeScript (exports)
├── index.css         # Entry point CSS (imports)
├── tokens/           # Átomos: valores brutos de design
│   ├── colors.css    # Cores do sistema
│   ├── typography.css # Fontes e tipografia
│   ├── spacing.css   # Escala de espaçamento
│   ├── radius.css    # Bordas arredondadas
│   ├── shadows.css   # Sombras e glows
│   ├── motion.css    # Animações e transições
│   └── z-index.css   # Camadas de empilhamento
├── foundations/      # Moléculas: configuração do tema
│   ├── theme.css     # Registro @theme para Tailwind v4
│   └── base.css      # Reset e estilos base
├── components/       # Organismos: estilos de componentes UI
├── utilities/        # Utilitários customizados
├── hooks/            # React hooks do Design System
├── providers/        # Context providers do Design System
├── types/            # TypeScript types e interfaces
├── animations/       # Keyframes e animações complexas
├── effects/          # Efeitos visuais especiais
├── icons/            # Ícones e SVGs
├── assets/           # Outros assets (imagens, fonts)
├── docs/             # Documentação (este arquivo)
└── tests/            # Testes do Design System
```

## Fluxo de Carregamento

1. `main.tsx` importa `./styles/globals.css`
2. `globals.css` importa `tailwindcss` e `@/design-system/index.css`
3. `design-system/index.css` importa na ordem:
   - `tokens/index.css` (átomos)
   - `foundations/index.css` (configuração + reset)
   - `components/index.css` (componentes)
   - `utilities/index.css` (utilitários)

## Princípios

- **Single Source of Truth**: Cada token existe apenas uma vez
- **CSS First**: Tokens definidos em CSS, não em JS config
- **Tailwind v4 Native**: Usa `@theme` directive
- **Responsabilidade Única**: Cada arquivo tem um propósito claro
- **Sem Hardcode**: Componentes consomem tokens, não valores literais

## Integração Futura

Quando o novo Design System estiver pronto:

1. Atualizar tokens em `tokens/*.css`
2. Adicionar componentes em `components/*.css`
3. Exportar componentes React via `index.ts`
4. Atualizar documentação nesta pasta

## Convenções de Nomenclatura

- Tokens: `--color-{category}-{variant}`
- Utilities: Seguir padrão Tailwind
- Componentes: lowercase-kebab-case

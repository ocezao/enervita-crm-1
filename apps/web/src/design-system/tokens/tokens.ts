/**
 * ============================================================================
 * HELION DESIGN SYSTEM — TOKENS EM TYPESCRIPT (SOMENTE LEITURA)
 * ============================================================================
 * ATENÇÃO — LEIA ANTES DE EDITAR:
 *
 * A fonte única de verdade dos tokens é CSS (tokens/*.css), conforme
 * Fase 5 do Relatório de Arquitetura ("Configuração Zero JS... toda a
 * configuração via @theme no CSS"). Este arquivo NÃO é uma segunda fonte
 * de verdade — é um espelho de leitura para os casos em que um valor de
 * token precisa existir como JS puro, porque CSS custom properties não
 * são lidas por bibliotecas de gráfico/canvas (Recharts, D3, Chart.js,
 * Canvas API) sem um passo extra de getComputedStyle.
 *
 * REGRA DE MANUTENÇÃO: todo valor aqui tem um comentário apontando para
 * a linha exata do arquivo .css de origem. Se você mudar um valor em
 * tokens/colors.css, precisa mudar a linha correspondente aqui também.
 * O teste em tokens.sync.test.ts (ver design-system/tokens/__tests__/)
 * falha automaticamente se os dois arquivos divergirem — não é só
 * convenção de boa vontade, é validado em CI.
 *
 * QUANDO USAR ESTE ARQUIVO vs. classes Tailwind:
 *   - Estilizando um elemento DOM?              → use classes Tailwind
 *     (bg-brand-primary, text-status-success, etc.), NÃO este arquivo.
 *   - Passando cor para um gráfico/canvas/SVG
 *     gerado dinamicamente em JS?                → use este arquivo.
 * ============================================================================
 */

/** Espelha tokens/colors.css — camada de primitivos */
export const palette = {
  neutral: {
    950: "#0a0d10",
    900: "#0d1114",
    850: "#12171b",
    800: "#171d22",
    750: "#1d242a",
    700: "#232b32",
    600: "#3d4449",
    500: "#626b72",
    400: "#a3acb3",
    100: "#edeff1",
  },
  orange: {
    200: "#ffc28a",
    400: "#ff9640",
    500: "#ff7a1a",
    600: "#e8620a",
    700: "#b84c08",
  },
  mint: {
    200: "#86efc9",
    400: "#3fdda3",
    500: "#2ed9a3",
    600: "#1fb584",
    700: "#148a66",
  },
  red: {
    400: "#f58b83",
    500: "#f1584e",
  },
  amber: {
    400: "#f5c451",
    500: "#f0b429",
  },
  blue: {
    400: "#5b9ee8",
    500: "#3d82d1",
  },
} as const;

/** Espelha tokens/colors.css — camada semântica */
export const colors = {
  background: {
    void: palette.neutral[950],
    base: palette.neutral[900],
    surface1: palette.neutral[850],
    surface2: palette.neutral[800],
    surface3: palette.neutral[750],
    surface4: palette.neutral[700],
  },
  text: {
    primary: palette.neutral[100],
    secondary: palette.neutral[400],
    muted: palette.neutral[500],
    disabled: palette.neutral[600],
  },
  brand: {
    primary: palette.orange[500],
    primaryHover: palette.orange[400],
    primaryActive: palette.orange[600],
    primarySubtle: palette.orange[200],
    primaryEmphasis: palette.orange[700],
    secondary: palette.mint[500],
    secondaryHover: palette.mint[400],
    secondaryActive: palette.mint[600],
    secondarySubtle: palette.mint[200],
    secondaryEmphasis: palette.mint[700],
  },
  status: {
    success: palette.mint[500],
    warning: palette.amber[500],
    danger: palette.red[500],
    info: palette.blue[500],
    neutral: palette.neutral[500],
  },
} as const;

/** Espelha tokens/typography.css */
export const typography = {
  fontFamily: {
    display: "'Space Grotesk', ui-sans-serif, system-ui, sans-serif",
    body: "'Inter', ui-sans-serif, system-ui, sans-serif",
    mono: "'JetBrains Mono', ui-monospace, 'SF Mono', monospace",
  },
  fontSize: {
    "2xs": "0.6875rem",
    xs: "0.75rem",
    sm: "0.8125rem",
    base: "0.875rem",
    md: "0.9375rem",
    lg: "1.0625rem",
    xl: "1.3125rem",
    "2xl": "1.625rem",
    "3xl": "2rem",
    "4xl": "2.5rem",
  },
} as const;

/** Espelha tokens/motion.css — para uso em bibliotecas de animação JS
 *  (Framer Motion, React Spring) que não consomem CSS custom properties
 *  diretamente em seus objetos de config. */
export const motion = {
  duration: {
    fast: 0.14,
    base: 0.24,
    slow: 0.42,
  },
  easing: {
    outExpo: [0.16, 1, 0.3, 1] as [number, number, number, number],
    spring: { type: "spring", stiffness: 380, damping: 22 },
  },
} as const;

/** Espelha tokens/radius.css */
export const radius = {
  none: "0px",
  sm: "0.5rem",
  md: "0.75rem",
  lg: "1.125rem",
  xl: "1.5rem",
  full: "9999px",
} as const;

/**
 * Tipos derivados — para autocomplete e checagem estática ao consumir
 * este arquivo em componentes de gráfico.
 */
export type ColorToken = typeof colors;
export type PaletteToken = typeof palette;
export type TypographyToken = typeof typography;
export type MotionToken = typeof motion;
export type RadiusToken = typeof radius;

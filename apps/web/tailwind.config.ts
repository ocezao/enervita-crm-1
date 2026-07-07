import type { Config } from 'tailwindcss'

/**
 * Tailwind CSS v4 Configuration
 * 
 * NOTA: Tailwind v4 usa CSS First. Todas as definições de tema
 * foram migradas para src/design-system/foundations/theme.css
 * usando a diretiva @theme.
 * 
 * Este arquivo deve permanecer apenas para:
 * - Configurações de content (paths)
 * - Plugins JavaScript (se necessário)
 * 
 * NÃO adicione definições de theme aqui.
 */

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  // Theme configuration migrada para CSS (@theme em foundations/theme.css)
  theme: {},
  plugins: [],
} satisfies Config

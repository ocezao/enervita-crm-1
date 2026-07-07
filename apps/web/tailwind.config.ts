import type { Config } from 'tailwindcss'

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Design System Helion - Tema Escuro
        bg: {
          void: '#0A0D10',
          base: '#0D1114',
          surface1: '#12171B',
          surface2: '#171D22',
          surface3: '#1D242A',
          overlay: 'rgba(10,13,16,0.72)',
        },
        border: {
          hair: 'rgba(255,255,255,0.06)',
          soft: 'rgba(255,255,255,0.09)',
          strong: 'rgba(255,255,255,0.14)',
        },
        text: {
          primary: '#EDEFF1',
          secondary: '#A3ACB3',
          muted: '#626B72',
          disabled: '#3D4449',
        },
        orange: {
          50: '#FFF2E7',
          200: '#FFC28A',
          400: '#FF9640',
          500: '#FF7A1A',
          600: '#E8620A',
          700: '#B84C08',
        },
        mint: {
          50: '#E4FBF3',
          200: '#86EFC9',
          400: '#3FDDA3',
          500: '#2ED9A3',
          600: '#1FB584',
          700: '#148A66',
        },
        glow: {
          orange: 'rgba(255,122,26,0.35)',
          orangeSoft: 'rgba(255,122,26,0.16)',
          mint: 'rgba(46,217,163,0.32)',
          mintSoft: 'rgba(46,217,163,0.14)',
        },
        red: {
          500: '#F1584E',
        },
        amber: {
          500: '#F0B429',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Space Grotesk', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '18px',
        xl: '24px',
        pill: '999px',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.16, 1, 0.3, 1)',
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      transitionDuration: {
        fast: '140ms',
        base: '240ms',
        slow: '420ms',
      },
    },
  },
  plugins: [],
} satisfies Config

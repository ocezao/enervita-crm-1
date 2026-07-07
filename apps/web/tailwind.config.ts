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
        // Superfícies
        'bg-void': '#0A0D10',
        'bg-base': '#0D1114',
        'bg-surface-1': '#12171B',
        'bg-surface-2': '#171D22',
        'bg-surface-3': '#1D242A',
        'bg-overlay': 'rgba(10,13,16,0.72)',
        
        // Bordas
        'border-hair': 'rgba(255,255,255,0.06)',
        'border-soft': 'rgba(255,255,255,0.09)',
        'border-strong': 'rgba(255,255,255,0.14)',
        
        // Texto
        'text-primary': '#EDEFF1',
        'text-secondary': '#A3ACB3',
        'text-muted': '#626B72',
        'text-disabled': '#3D4449',
        
        // Laranja — energia gerada / ação primária
        orange: {
          50: '#FFF2E7',
          200: '#FFC28A',
          400: '#FF9640',
          500: '#FF7A1A',
          600: '#E8620A',
          700: '#B84C08',
        },
        
        // Verde-menta — economia / sucesso / ROI
        mint: {
          50: '#E4FBF3',
          200: '#86EFC9',
          400: '#3FDDA3',
          500: '#2ED9A3',
          600: '#1FB584',
          700: '#148A66',
        },
        
        // Estados
        'alert-red': '#F1584E',
        'amber-500': '#F0B429',
        
        // Cores legacy para transição (serão removidas)
        graphite: '#1A1D23',
        'warm-sand': '#2A2F35',
        'solar-orange': '#FF7A1A',
        'solar-yellow': '#FFA726',
        'energy-green': '#2ED9A3',
        'mint-light': '#E4FBF3',
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
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
      boxShadow: {
        'soft': '0 2px 15px rgba(0,0,0,0.3)',
        'glow-orange': '0 0 20px rgba(255,122,26,0.35)',
        'glow-mint': '0 0 20px rgba(46,217,163,0.32)',
      },
    },
  },
  plugins: [],
} satisfies Config

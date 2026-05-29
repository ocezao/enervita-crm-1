import type { Config } from 'tailwindcss'

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        solar: {
          orange: '#F58220',
        },
        energy: {
          green: '#2EAD5B',
          deep: '#0E7A3D',
          success: '#22A06B',
        },
        graphite: {
          DEFAULT: '#17211B',
          soft: '#2A332D',
        },
        warm: {
          white: '#FAF7F0',
          sand: '#EFE6D4',
        },
        mint: {
          light: '#EAF6EE',
        },
        alert: {
          red: '#D94A38',
          amber: '#F5A524',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Lexend', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config

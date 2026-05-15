import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── Brand: 燕麦色 oatmeal ──────────────
        oat: {
          50:  '#fefdfb',
          100: '#faf8f3',
          200: '#f4f1ea',   /* #F4F1EA — canonical background */
          300: '#e8e3d6',
          400: '#d6cebc',
          500: '#bfb59e',
          600: '#a0947e',
          700: '#7e7460',
          800: '#605848',
          900: '#443e33',
        },
        // ── Brand: 麦穗金 wheat-gold ────────────
        gold: {
          50:  '#fdfaee',
          100: '#f9f1cc',
          200: '#f2e08c',
          300: '#e8c84a',
          400: '#d4af37',   /* #D4AF37 — canonical primary */
          500: '#b8942a',
          600: '#97771e',
          700: '#755b16',
          800: '#574211',
          900: '#3d2f0c',
        },
        // ── Accent: 静默绿 sage ─────────────────
        sage: {
          50:  '#f4f7f4',
          100: '#e4ede4',
          200: '#c8dac8',
          300: '#9ebf9e',
          400: '#6f9f6f',
          500: '#4e8050',
          600: '#3a6640',
          700: '#2f5234',
          800: '#27422c',
          900: '#213725',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config

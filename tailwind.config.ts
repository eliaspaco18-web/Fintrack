import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    './modules/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'sans-serif'],
        body:    ['Geist', '"SF Pro Display"', 'system-ui', 'sans-serif'],
        sans:    ['Geist', '"SF Pro Display"', 'system-ui', 'sans-serif'],
        mono:    ['"Geist Mono"', '"SF Mono"', '"JetBrains Mono"', 'monospace'],
      },
      colors: {
        // ── Warm Neutral + Teal Accent (redesign v3) ───────────────────
        'primary':      '#0D6B5E',
        'primary-hover':'#095C51',
        'primary-soft': 'rgba(13,107,94,0.07)',
        // warm neutrals
        'warm-bg':      '#FAFAF9',
        'warm-surface': '#FFFFFF',
        'warm-surface-2':'#F5F5F3',
        'warm-hover':   '#EEEEEC',
        'warm-border':  '#E8E8E6',
        // text
        'ink':          '#1A1A19',
        'ink-muted':    '#6B6B69',
        'ink-faint':    '#9C9C99',
        // legacy aliases kept for backward compat
        'forest':       '#0D6B5E',
        'forest-hover': '#095C51',
        'forest-soft':  'rgba(13,107,94,0.07)',
        accent: {
          DEFAULT: '#0D6B5E',
          hover:   '#095C51',
        },
      },
      animation: {
        'slide-down':  'slide-down 0.18s ease-out',
        'slide-up':    'slide-up 0.18s ease-out',
        'scale-in':    'scale-in 0.15s ease-out',
        'fade-in':     'fade-in 0.2s ease-out',
        'bounce-in':   'bounce-in 0.22s cubic-bezier(0.22, 1, 0.36, 1)', /* M-6 fix: expo-out, no spring */
        'shimmer':     'shimmer 1.5s ease-in-out infinite',
        'toast-drain': 'toast-drain var(--duration,4000ms) linear forwards',
      },
      keyframes: {
        'slide-down': {
          from: { opacity: '0', transform: 'translateY(-6px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to:   { opacity: '1', transform: 'scale(1)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        'bounce-in': {
          '0%':   { transform: 'scale(0.9)',   opacity: '0' },
          '60%':  { transform: 'scale(1.02)' },
          '100%': { transform: 'scale(1)',     opacity: '1' },
        },
        'shimmer': {
          '0%':   { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(200%)' },
        },
        'toast-drain': {
          from: { transform: 'scaleX(1)' },
          to:   { transform: 'scaleX(0)' },
        },
      },
      maxWidth: {
        '8xl': '88rem',
      },
      boxShadow: {
        'card':    '0 1px 2px rgba(26,26,25,0.04)',
        'card-md': '0 4px 12px rgba(26,26,25,0.06)',
        'card-lg': '0 12px 32px rgba(26,26,25,0.08)',
        'card-xl': '0 24px 56px rgba(26,26,25,0.10)',
      },
    },
  },
  plugins: [],
}

export default config

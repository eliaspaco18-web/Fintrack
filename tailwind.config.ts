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
        display: ['var(--font-display)', 'sans-serif'],
        body:    ['var(--font-body)',    'sans-serif'],
      },
      colors: {
        // Acento principal
        accent: {
          DEFAULT: '#10b981',
          hover:   '#34d399',
        },
      },
      animation: {
        'slide-down':  'slide-down 0.15s ease-out',
        'scale-in':    'scale-in 0.15s ease-out',
        'bounce-in':   'bounce-in 0.3s cubic-bezier(0.34,1.56,0.64,1)',
        'shimmer':     'shimmer 1.5s ease-in-out infinite',
        'toast-drain': 'toast-drain var(--duration,4000ms) linear forwards',
      },
      keyframes: {
        'slide-down': {
          from: { opacity: '0', transform: 'translateY(-6px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to:   { opacity: '1', transform: 'scale(1)' },
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
    },
  },
  plugins: [],
}

export default config

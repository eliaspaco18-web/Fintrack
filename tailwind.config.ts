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
        // Canonical semantic roles for new redesign work.
        canvas: 'var(--ft-canvas)',
        surface: {
          DEFAULT: 'var(--ft-surface)',
          muted: 'var(--ft-surface-muted)',
          hover: 'var(--ft-surface-hover)',
        },
        content: {
          strong: 'var(--ft-text-strong)',
          muted: 'var(--ft-text-muted)',
          subtle: 'var(--ft-text-subtle)',
        },
        border: {
          DEFAULT: 'var(--ft-border)',
          strong: 'var(--ft-border-strong)',
        },
        focus: 'var(--ft-focus-ring-color)',
        success: 'var(--ft-success)',
        warning: 'var(--ft-warning)',
        danger: 'var(--ft-danger)',
        info: 'var(--ft-info)',

        // Compatibility utility names; keep until consumers migrate.
        'primary':      'var(--ft-primary)',
        'primary-hover':'var(--ft-primary-hover)',
        'primary-soft': 'var(--ft-primary-soft)',
        'warm-bg':      'var(--ft-canvas)',
        'warm-surface': 'var(--ft-surface)',
        'warm-surface-2':'var(--ft-surface-muted)',
        'warm-hover':   'var(--ft-surface-hover)',
        'warm-border':  'var(--ft-border)',
        'ink':          'var(--ft-text-strong)',
        'ink-muted':    'var(--ft-text-muted)',
        'ink-faint':    'var(--ft-text-subtle)',
        'forest':       'var(--ft-primary)',
        'forest-hover': 'var(--ft-primary-hover)',
        'forest-soft':  'var(--ft-primary-soft)',
        accent: {
          DEFAULT: 'var(--ft-primary)',
          hover:   'var(--ft-primary-hover)',
        },
      },
      borderRadius: {
        control: 'var(--ft-radius-control)',
        surface: 'var(--ft-radius-surface)',
        panel: 'var(--ft-radius-panel)',
        modal: 'var(--ft-radius-modal)',
      },
      transitionDuration: {
        instant: 'var(--ft-duration-instant)',
        fast: 'var(--ft-duration-fast)',
        base: 'var(--ft-duration-base)',
        slow: 'var(--ft-duration-slow)',
      },
      zIndex: {
        sticky: 'var(--ft-z-sticky)',
        dropdown: 'var(--ft-z-dropdown)',
        drawer: 'var(--ft-z-drawer)',
        tooltip: 'var(--ft-z-tooltip)',
        overlay: 'var(--ft-z-overlay)',
        modal: 'var(--ft-z-modal)',
        toast: 'var(--ft-z-toast)',
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
        'elevation-sm': 'var(--ft-elevation-sm)',
        'elevation-md': 'var(--ft-elevation-md)',
        'elevation-lg': 'var(--ft-elevation-lg)',
        'elevation-xl': 'var(--ft-elevation-xl)',
        // Compatibility utility names; preserve their historical values.
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

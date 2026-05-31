/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // Enables class-based dark mode
  theme: {
    extend: {
      colors: {
        // Mapped CSS variables for premium themes
        bg: 'var(--bg)',
        'bg-subtle': 'var(--bg-subtle)',
        'bg-muted': 'var(--bg-muted)',
        'bg-hover': 'var(--bg-hover)',
        'bg-active': 'var(--bg-active)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        'sidebar-bg': 'var(--sidebar-bg)',
        border: 'var(--border)',
        'border-mid': 'var(--border-mid)',
        'border-strong': 'var(--border-strong)',
        text: 'var(--text)',
        'text-2': 'var(--text-2)',
        'text-3': 'var(--text-3)',
        'text-4': 'var(--text-4)',
        'text-inv': 'var(--text-inv)',
        accent: 'var(--accent)',
        'accent-hover': 'var(--accent-hover)',
        'accent-dim': 'var(--accent-dim)',
        'accent-mid': 'var(--accent-mid)',
        'accent-glow': 'var(--accent-glow)',
        success: 'var(--success)',
        'success-dim': 'var(--success-dim)',
        warning: 'var(--warning)',
        'warning-dim': 'var(--warning-dim)',
        error: 'var(--error)',
        'error-dim': 'var(--error-dim)',
        info: 'var(--info)',
        'info-dim': 'var(--info-dim)',
        brand: {
          50: '#f0f5ff',
          100: '#e0ebff',
          200: '#c7dcff',
          300: '#9ec1ff',
          400: '#6b9cff',
          500: '#3b6cff',
          600: '#254ce6',
          700: '#1d3cb3',
          800: '#1a328f',
          900: '#1b2d73',
        }

      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'glow-indigo': '0 0 15px rgba(99, 102, 241, 0.15)',
        'glow-cyan': '0 0 15px rgba(6, 182, 212, 0.15)',
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out forwards',
        'pulse-subtle': 'pulseSubtle 2s infinite ease-in-out',
        'typing': 'typing 1.4s infinite'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.8', transform: 'scale(0.98)' }
        },
        typing: {
          '0%, 100%': { transform: 'translateY(0px)', opacity: '0.4' },
          '50%': { transform: 'translateY(-4px)', opacity: '1' }
        }
      }
    },
  },
  plugins: [],
}

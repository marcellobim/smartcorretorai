/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        smart: {
          canvas: 'var(--smart-canvas)',
          surface: 'var(--smart-surface)',
          muted: 'var(--smart-surface-muted)',
          border: 'var(--smart-border)',
        },
        primary: {
          50:  '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0e7490',
          600: '#0f5f7a',
          700: '#163b5c',
          800: '#0f2742',
          900: '#0b1f36',
          950: '#071827',
        },
        accent: {
          400: '#22d3ee',
          500: '#0e7490',
          600: '#0f5f7a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      maxWidth: {
        smart: '80rem',
      },
      spacing: {
        'smart-page': 'clamp(1rem, 4vw, 2rem)',
      },
      borderRadius: {
        'smart-control': '0.75rem',
        'smart-card': '1.5rem',
        'smart-hero': '2rem',
      },
      boxShadow: {
        'smart-card': '0 20px 55px -40px rgba(15, 23, 42, 0.45)',
        'smart-floating': '0 24px 60px -42px rgba(15, 23, 42, 0.5)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}

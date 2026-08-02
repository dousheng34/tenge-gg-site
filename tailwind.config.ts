import type { Config } from 'tailwindcss';

/**
 * Дизайн-токены tenge.gg: нейтральная шкала, прямые углы,
 * акцент — оранжевый Teenage Engineering. Радиусы намеренно минимальны.
 */
const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: '#FF5C00',
          soft: '#FF7A2F',
        },
      },
      borderRadius: {
        none: '0px',
        sm: '2px',
        DEFAULT: '2px',
        md: '4px',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      letterSpacing: {
        label: '0.08em',
      },
      keyframes: {
        'toast-progress': {
          from: { transform: 'scaleX(1)' },
          to: { transform: 'scaleX(0)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;

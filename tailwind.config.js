/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ios: {
          bg: '#0a0a0f',
          surface: 'rgba(255,255,255,0.08)',
          'surface-strong': 'rgba(255,255,255,0.12)',
          'surface-light': 'rgba(255,255,255,0.72)',
          text: '#f5f5f7',
          muted: '#86868b',
          blue: '#0a84ff',
          green: '#30d158',
          red: '#ff453a',
          orange: '#ff9f0a',
        },
      },
      borderRadius: {
        'liquid-sm': '16px',
        'liquid-md': '20px',
        'liquid-lg': '28px',
        'liquid-xl': '32px',
        'liquid-2xl': '36px',
        'liquid-3xl': '40px',
      },
      boxShadow: {
        'ios-1': '0 0 0 1px rgba(255,255,255,0.08), 0 0 0 0.5px rgba(255,255,255,0.1) inset, 0 4px 10px rgba(0,0,0,0.18)',
        'ios-2': '0 0 0 1px rgba(255,255,255,0.1), 0 1px 0 rgba(255,255,255,0.15) inset, 0 -2px 16px rgba(0,0,0,0.22), 0 18px 32px rgba(0,0,0,0.22)',
        'ios-3': '0 0 0 1px rgba(255,255,255,0.12), 0 1px 0 rgba(255,255,255,0.22) inset, 0 -8px 40px rgba(0,0,0,0.28), 0 24px 72px rgba(0,0,0,0.34)',
      },
      spacing: {
        1: '4px',
        2: '8px',
        3: '12px',
        4: '16px',
        6: '24px',
        8: '32px',
        10: '40px',
        12: '48px',
        16: '64px',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        'spring-in': 'cubic-bezier(0.6, -0.28, 0.735, 0.045)',
      },
      keyframes: {
        'spring-in': {
          '0%': { opacity: '0', transform: 'scale(0.96) translateY(12px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'spring-pulse': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.02)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-4px)' },
        },
      },
      animation: {
        'spring-in': 'spring-in 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        'spring-pulse': 'spring-pulse 3s cubic-bezier(0.175, 0.885, 0.32, 1.275) infinite',
        float: 'float 5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        repo: {
          bg:     '#0c0c12',
          surface:'#111118',
          card:   '#16161f',
          border: '#23232f',
          accent:   '#60a5fa',
          'accent-hover': '#3b82f6',
          'accent-glow':'rgba(59,130,246,0.16)',
          green: '#10b981',
          red: '#ef4444',
          yellow: '#f59e0b',
          muted: '#8b8b96',
          text: '#f3f4f6',
          subtext: '#b0b3b8',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        accent: '0 0 24px rgba(34,211,238,0.22)',
        card: '0 4px 24px rgba(0,0,0,0.45)',
        glass: '0 8px 32px rgba(0,0,0,0.35)',
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sabrar: {
          50: '#edfbf2',
          100: '#d4f7e0',
          200: '#acf0c3',
          300: '#74e29c',
          400: '#3dcd73',
          500: '#22c55e',
          600: '#1f8f47',
          700: '#1b723a',
          800: '#195a31',
          900: '#174a2a',
          950: '#0a2916',
        },
        dark: {
          950: 'var(--bg-dark-950, #0A0A0A)', // Preto puro / background canvas
          900: 'var(--bg-dark-900, #121212)', // Chumbo escuro / header, cards, sidebar
          850: 'var(--bg-dark-850, #1A1A1A)', // Chumbo médio / elementos elevados, subcards
          800: 'var(--bg-dark-800, #222222)', // Chumbo neutro / inputs, badges, hovers
          750: 'var(--border-dark-750, #2C2C2C)', // Bordas técnicas e divisores
          700: 'var(--border-dark-700, #383838)', // Bordas e detalhes secundários
          600: 'var(--text-dark-600, #525252)', // Cinza chumbo neutro
          500: 'var(--text-dark-500, #737373)', // Cinza intermediário para textos secundários
        },
        construction: {
          amber: '#f59e0b',
          orange: '#ea580c',
          yellow: '#eab308',
        }
      },
      screens: {
        'xs': '375px',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      }
    },
  },
  plugins: [],
}

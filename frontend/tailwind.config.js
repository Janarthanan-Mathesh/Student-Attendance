/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#0b0f17',
        surface: '#111827',
        card: '#1e293b',
        border: '#334155',
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          500: '#0284c7',
          600: '#0284c7',
          700: '#0369a1',
        },
        risk: {
          green: '#10b981',
          amber: '#f59e0b',
          red: '#ef4444',
          critical: '#881337'
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif']
      }
    },
  },
  plugins: [],
}

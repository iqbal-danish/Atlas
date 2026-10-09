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
        background: '#0a0a0c',
        foreground: '#ededed',
        sidebar: '#111114',
        surface: '#16161a',
        'surface-hover': '#202026',
        'surface-active': '#2b2b33',
        border: 'rgba(255, 255, 255, 0.08)',
        accent: '#0c7bea',
        'accent-hover': '#1b8aff',
        muted: '#8e8e93',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['Geist Mono', 'Consolas', 'monospace'],
      }
    },
  },
  plugins: [],
}

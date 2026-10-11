/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Notploy brand colors - based on web/desktop palette
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        secondary: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
        // Semantic colors for status
        success: '#22c55e',
        warning: '#f59e0b',
        error: '#ef4444',
        info: '#3b82f6',
        // Background colors
        background: {
          light: '#f8fafc',
          dark: '#0f172a',
        },
        // Surface colors
        surface: {
          light: '#ffffff',
          dark: '#1e293b',
        },
        // Border colors
        border: {
          light: '#e2e8f0',
          dark: '#334155',
        },
      },
      fontFamily: {
        sans: ['Inter', 'System'],
        mono: ['Monaco', 'Courier New'],
      },
      spacing: {
        '0.5': '2px',
        '1.5': '6px',
        '2.5': '10px',
        '3.5': '14px',
      },
    },
  },
  plugins: [],
};

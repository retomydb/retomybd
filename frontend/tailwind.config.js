/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Steam-inspired dark palette
        'retomy': {
          'bg': '#171a21',           // Main background
          'bg-secondary': '#1b2838', // Secondary bg
          'bg-card': '#213040',      // Card background
          'bg-hover': '#2a475e',     // Hover state
          'surface': '#16202d',      // Surface
          'accent': '#66c0f4',       // Primary accent (Steam blue)
          'accent-hover': '#4bb8f0',
          'accent-dark': '#1a9fff',
          'green': '#4c6b22',        // Success green
          'green-light': '#a4d007',
          'price-green': '#acdbf5',
          'text': '#c7d5e0',         // Primary text
          'text-secondary': '#8f98a0', // Muted text
          'text-bright': '#ffffff',
          'gold': '#e5a100',         // Featured/premium
          'red': '#cd381e',          // Error/danger
          'border': '#2a3f5f',
          'gradient-start': '#1b2838',
          'gradient-end': '#171a21',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      backgroundImage: {
        'hero-gradient': 'linear-gradient(135deg, #1b2838 0%, #171a21 50%, #0e141b 100%)',
        'card-gradient': 'linear-gradient(180deg, #213040 0%, #1b2838 100%)',
        'accent-gradient': 'linear-gradient(135deg, #66c0f4 0%, #1a9fff 100%)',
      },
      boxShadow: {
        'card': '0 4px 20px rgba(0, 0, 0, 0.4)',
        'card-hover': '0 8px 30px rgba(0, 0, 0, 0.6)',
        'glow': '0 0 15px rgba(102, 192, 244, 0.3)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { opacity: '0.3' },
          '50%': { opacity: '0.6' },
          '100%': { opacity: '0.3' },
        },
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        terrain: {
          bg:         '#0a0a0f',
          surface:    '#111118',
          surfaceAlt: '#18181f',
          border:     '#252530',
          text:       '#f0ede8',
          muted:      '#6b6b7a',
          subtle:     '#3a3a48',
          gold:       '#c9a84c',
          goldDim:    'rgba(201,168,76,0.12)',
          goldBorder: 'rgba(201,168,76,0.3)',
        },
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        mono:    ['"DM Mono"', '"Courier New"', 'monospace'],
      },
      animation: {
        'spin-slow': 'spin 2s linear infinite',
      },
    },
  },
  plugins: [],
}

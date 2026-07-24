/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        chart: {
          bg: '#131722',
          panel: '#1e222d',
          border: '#2a2e39',
          text: '#d1d4dc',
          up: '#26a69a',
          down: '#ef5350',
          grid: '#2a2e39',
        }
      }
    },
  },
  plugins: [],
}
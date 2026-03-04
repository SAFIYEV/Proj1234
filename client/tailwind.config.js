/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#FF4444',
        secondary: '#FFD700',
        dark: '#1a1a1a',
        gray: {
          850: '#1f1f1f',
          750: '#2a2a2a'
        }
      },
      fontFamily: {
        sans: ['Arial', 'sans-serif']
      }
    },
  },
  plugins: [],
}

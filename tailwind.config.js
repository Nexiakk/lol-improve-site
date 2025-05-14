// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // Ścieżki do plików, gdzie będziesz używać klas Tailwind
  ],
  theme: {
    extend: {}, // Tutaj możesz rozszerzać domyślny motyw Tailwind
  },
  plugins: [], // Tutaj możesz dodawać wtyczki Tailwind
}

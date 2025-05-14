// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // Ścieżki do plików, gdzie będziesz używać klas Tailwind
  ],
  theme: {
    extend: {
      fontFamily: {
        // Ustaw 'Plus Jakarta Sans' jako pierwszą w kolejności dla sans-serif,
        // zachowując domyślne czcionki systemowe jako fallback.
        sans: ['"Plus Jakarta Sans"', ...defaultTheme.fontFamily.sans],
      },
    }, // Tutaj możesz rozszerzać domyślny motyw Tailwind
  },
  plugins: [], // Tutaj możesz dodawać wtyczki Tailwind
}

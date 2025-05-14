// tailwind.config.js
/** @type {import('tailwindcss').Config} */
import defaultTheme from 'tailwindcss/defaultTheme'; // KRYTYCZNE: Upewnij się, że ta linia jest obecna!

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Ustawia "Plus Jakarta Sans" jako pierwszą czcionkę w stosie dla `font-sans`.
        // Nazwa czcionki musi być w cudzysłowach, jeśli zawiera spacje.
        sans: ['"Plus Jakarta Sans"', ...defaultTheme.fontFamily.sans],
      },
      // Możesz tutaj dodać inne rozszerzenia motywu, np. kolory
    },
  },
  plugins: [],
}
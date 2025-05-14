// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite' // Upewnij się, że ten import jest

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // Upewnij się, że wtyczka jest tutaj
  ],
})
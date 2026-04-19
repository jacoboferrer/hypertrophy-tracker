import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// For GitHub Pages: replace 'hypertrophy-tracker' with your repo name
export default defineConfig({
  plugins: [react()],
  base: '/hypertrophy-tracker/',
})

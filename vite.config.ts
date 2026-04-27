import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Deployed to amyleesterling.github.io/inner_cosmos/ — paths must be prefixed.
// In dev (npm run dev) we still want '/' so the iframe preview works.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/inner_cosmos/' : '/',
  plugins: [react(), tailwindcss()],
}))

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// The build inlines everything into one HTML file, so it also opens with a
// double-click (file://), not only from a server.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), viteSingleFile()],
  server: { port: 5530, strictPort: true },
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// The admin app is built on its own, into dist/admin/, so it is served at /admin/
// and shares nothing with orbit's page except the database.
export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile()],
  build: { outDir: 'dist', emptyOutDir: false, rollupOptions: { input: 'admin/index.html' } },
})

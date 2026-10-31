import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Every build gets an id, baked into the page and written to version.json next to it,
// so an open tab can notice a newer orbit and offer to reload.
const BUILD_ID = Date.now().toString(36)
const versionFile = {
  name: 'orbit-version',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ id: BUILD_ID }) })
  },
}

// The build inlines everything into one HTML file, so it also opens with a
// double-click (file://), not only from a server.
export default defineConfig({
  base: './',
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  plugins: [react(), tailwindcss(), viteSingleFile(), versionFile],
  server: { port: 5530, strictPort: true },
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'

// Blueprints are served from the static assets copied out of `public/`, where
// `public/blueprints` is a symlink to `../blueprints` (the catalogue source of
// truth). Vite copies the contents of `public/` into `dist/`, so no extra copy
// plugin is needed. Paths below are anchored to this file rather than to the
// process cwd, which differs between local and Cloudflare builds.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})

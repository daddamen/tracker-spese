import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Su GitHub Pages l'app vive in un sottopercorso (/nome-repo/): il workflow imposta VITE_BASE. Altrove resta '/'.
const base = process.env.VITE_BASE || '/'
const pkg = JSON.parse(readFileSync('./package.json', 'utf8'))
const versione = `${pkg.version} · ${new Date().toISOString().slice(0, 16).replace('T', ' ')}` // mostrata nell'app: serve a capire se hai l'ultima build

export default defineConfig({
  base,
  define: { __APP_VERSION__: JSON.stringify(versione) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        id: base, name: 'Tracker Spese', short_name: 'Spese', description: 'Tieni traccia di spese ed entrate',
        lang: 'it', display: 'standalone', start_url: base, scope: base, categories: ['finance'],
        background_color: '#f3f4f1', theme_color: '#0f5c52',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      }
    })
  ],
  build: { chunkSizeWarningLimit: 700, rollupOptions: { output: { manualChunks: { recharts: ['recharts'] } } } }
})

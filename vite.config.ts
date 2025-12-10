import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'HALNAPLÓ',
        short_name: 'HALNAPLÓ',
        description: 'Vízállás és időjárás információk halászoknak',
        theme_color: '#2563eb',
        background_color: '#FFFFF7',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        icons: [

           {
             src: 'icon-192x192.png',
             sizes: '192x192',
             type: 'image/png',
           },
           {
             src: 'icon-512x512.png',
             sizes: '512x512',
             type: 'image/png',
           },
        ],
      },
      // Service worker nincs engedélyezve Fázis 1-ben
      // Csak a manifest generálódik
      // A workbox konfiguráció elhagyásával is generálódik service worker,
      // de a registerType: 'prompt' és devOptions.enabled: false miatt
      // nem lesz aktív service worker regisztráció
      devOptions: {
        enabled: false, // Development módban ne regisztráljon service worker-t
      },
    }),
  ],
  server: {
    proxy: {
      '/api/ovszws': {
        target: 'https://hydroinfo.hu',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ovszws/, '/WSCSS/ovszws'),
        secure: true,
      },
    },
  },
  preview: {
    proxy: {
      '/api/ovszws': {
        target: 'https://hydroinfo.hu',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ovszws/, '/WSCSS/ovszws'),
        secure: true,
      },
    },
  },
})

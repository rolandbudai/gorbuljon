import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
// URL/port: .env fájlban VITE_APP_BASE_URL (pl. '/' vagy '/halnaplo/'), VITE_DEV_PORT (pl. 5173)
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const base = env.VITE_APP_BASE_URL ?? '/'
  const port = parseInt(env.VITE_DEV_PORT ?? '5173', 10)

  return {
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon_light.ico', 'favicon_dark.ico', 'icon-192x192.png', 'icon-512x512.png', 'apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'Pergetőnapló',
        short_name: 'Halnapló',
        description: 'Horgászfogások és időjárási adatok rögzítése',
        theme_color: '#215a64',
        background_color: '#242424',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          }
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
        // Kikényszeríti a service worker frissítését minden deploy után
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            // Netlify proxy hívások - mindig hálózatról
            urlPattern: ({ url }) => url.hostname.includes('netlify.app'),
            handler: 'NetworkOnly',
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 // 1 nap
              },
            },
          }
        ]
      },
      devOptions: {
        enabled: true, // Enable in dev to test PWA features
      },
    }),
  ],
  server: {
    host: true,
    port,
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
  }
})

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves the app from /<repo>/, so the deploy workflow sets BASE_PATH.
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  base,
  build: { chunkSizeWarningLimit: 1500 },
  define: { __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '1.0.0') },
  plugins: [
    react(),
    VitePWA({
      // New versions take over at once; src/lib/pwa.ts reloads when it can't interrupt anything.
      registerType: 'autoUpdate',
      injectRegister: false, // registered in src/lib/pwa.ts (update checks on resume)
      includeManifestIcons: false, // already matched by globPatterns
      manifest: {
        id: base,
        name: 'LiftLog – Workout Tracker',
        short_name: 'LiftLog',
        description: 'Offline gym workout tracker',
        lang: 'en',
        theme_color: '#0a0b0d',
        background_color: '#0a0b0d',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        // Activate new versions right away; iOS rarely closes every window of a Home Screen app.
        skipWaiting: true,
        clientsClaim: true,
      },
    }),
  ],
});

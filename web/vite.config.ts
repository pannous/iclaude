import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Use existing public/manifest.json — do not generate one
      manifest: false,
      registerType: "autoUpdate",
      strategies: "generateSW",
      workbox: {
        // Precache all build output: JS chunks (incl. lazy-loaded), CSS, HTML,
        // icons, SVGs, and the two terminal Nerd Font woff2 files (~2.4MB total)
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        // Main bundle exceeds default 2 MiB — raise to 5 MiB
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        skipWaiting: true,
        clientsClaim: true,
        // Hash routing: all navigations hit "/" → serve index.html from cache
        navigateFallback: "index.html",
        // Never intercept API calls, WebSocket upgrades, or SSE streams
        navigateFallbackDenylist: [/^\/api/, /^\/ws/],
        runtimeCaching: [
          {
            // All /api/* fetch() calls: always go to network, never cache
            urlPattern: /^\/api\//,
            handler: "NetworkOnly",
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      // LOCAL: PWA devOptions disabled — stub the virtual module so dev server doesn't fail
      "virtual:pwa-register": path.resolve("src/__mocks__/virtual-pwa-register.ts"),
    },
  },
  optimizeDeps: {
    include: ["@xterm/xterm", "@xterm/addon-fit"],
  },
  server: {
    // LOCAL: bind to 127.0.0.1 only — LAN phones access via the Hono proxy
    // on port 3456, so Vite doesn't need to be directly reachable from the network.
    host: "127.0.0.1",
    port: 2345,
    strictPort: true,
    allowedHosts: [".trycloudflare.com","mac.fritz.box"],
    // LOCAL: pin HMR to localhost so the phone (served via Hono proxy) can't
    // reach the HMR WebSocket and trigger infinite reload loops.
    hmr: { host: "localhost", port: 2345 },
    proxy: {
      "/api": "http://localhost:3456",
      "/ws": {
        target: "ws://localhost:3456",
        ws: true,
        rewriteWsOrigin: true,
        changeOrigin: true,
      },
    },
  },
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
import os from "os";

function getLocalIPs(): string[] {
  const interfaces = os.networkInterfaces();
  const ips: string[] = [];
  for (const addrs of Object.values(interfaces)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      if (!addr.internal && addr.family === "IPv4") ips.push(addr.address);
    }
  }
  return ips;
}

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
    host: "0.0.0.0",
    // LOCAL: custom port and allowed hosts for our dev setup
    port: 2345,
    strictPort: true,
    // LOCAL: dynamically include all local network IPs so LAN access works
    allowedHosts: [".trycloudflare.com","mac.fritz.box","companion.pannous.com","claude.pannous.com", ...getLocalIPs()],
    watch: {
      // Vitest writes coverage files here during test runs; exclude them
      // so Vite doesn't trigger spurious HMR reloads.
      ignored: ["**/coverage/**"],
    },
    proxy: {
      "/api": {
        target: "http://localhost:3456",
        configure: (proxy) => {
          proxy.on("error", (err) => {
            const code = (err as NodeJS.ErrnoException).code;
            if (code === "ECONNRESET" || code === "EPIPE" || err.message === "socket hang up") return;
            console.error("[api proxy]", err.message);
          });
        },
      },
      "/ws": {
        target: "ws://localhost:3456",
        ws: true,
        rewriteWsOrigin: true,
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on("error", (err) => {
            // Suppress noisy connection-reset errors from normal browser disconnects
            const code = (err as NodeJS.ErrnoException).code;
            if (code === "ECONNRESET" || code === "EPIPE" || err.message === "socket hang up") return;
            console.error("[ws proxy]", err.message);
          });
        },
      },
    },
  },
});

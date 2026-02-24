import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    include: ["@xterm/xterm", "@xterm/addon-fit"],
  },
  server: {
    host: "0.0.0.0",
    port: 2345,
    strictPort: true,
    allowedHosts: [".trycloudflare.com","mac.fritz.box"],
    proxy: {
      "/api": "http://localhost:3457",
      "/ws": {
        target: "ws://localhost:3457",
        ws: true,
        rewriteWsOrigin: true,
        changeOrigin: true,
      },
    },
  },
});

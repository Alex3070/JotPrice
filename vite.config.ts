import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "买菜比价",
        short_name: "买菜比价",
        description: "记录与对比各菜市场、线上平台的买菜单价",
        theme_color: "#FF7A45",
        background_color: "#FFF7F0",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
    }),
  ],
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
  },
});

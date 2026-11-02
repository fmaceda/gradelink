import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Dev: the browser only sees the Vite origin; /api is proxied to Express (no CORS).
// The API port is a placeholder until TASK-001 settles the dev setup.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: { "/api": "http://localhost:3000" },
  },
});

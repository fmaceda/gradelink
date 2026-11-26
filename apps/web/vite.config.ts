import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const DEFAULT_API_PORT = "3000";
// Better Auth trusts this exact origin in development (apps/api/src/auth.ts).
const DEV_PORT = 5173;

// Dev: the browser only sees the Vite origin; /api is proxied to Express (no CORS).
export default defineConfig(({ mode }) => {
  // BP-044 exception: Vite runs outside the API, so it reads only PORT, from the same root .env
  // and environment the API uses. Nothing here reaches the client bundle.
  const apiPort = loadEnv(mode, REPO_ROOT, "PORT").PORT || DEFAULT_API_PORT;

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    server: {
      port: DEV_PORT,
      strictPort: true,
      proxy: { "/api": `http://localhost:${apiPort}` },
    },
  };
});

import { defineConfig } from "vite";

export default defineConfig({
  server: {
    // Permissive headers so a self-hosted Neuroglancer bundle can later be
    // mounted from this same origin. (Cross-origin iframes still work in
    // Phase 1; this is forward-prep.)
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "credentialless",
    },
  },
});

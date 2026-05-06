import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Deployed target: GitHub Pages on `amyleesterling/explore-the-universe`,
// served at https://amyleesterling.github.io/explore-the-universe/
// In dev (`npm run dev`) we still want '/' so the iframe preview works.
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/explore-the-universe/" : "/",
  plugins: [react(), tailwindcss()],
}));

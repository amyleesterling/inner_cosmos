import { defineConfig } from "vite";

// When deployed under github.io/explore-the-universe/ the asset paths need
// the repo prefix; in dev we want '/'.
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/explore-the-universe/" : "/",
}));

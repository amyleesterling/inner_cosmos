import { defineConfig } from "vite";

// While vendored inside inner_cosmos, the production base is
// /inner_cosmos/explore-the-universe/ — it gets copied into the inner_cosmos
// Pages dist by the deploy workflow. Once spun out into its own repo, change
// this to /explore-the-universe/ (or whatever the new Pages path is).
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/inner_cosmos/explore-the-universe/" : "/",
}));

#!/usr/bin/env node
/**
 * Pre-render the /activity 360° loop to an MP4.
 *
 * Pipeline:
 *   1. Boot the local Vite dev server if it isn't already up.
 *   2. Launch headless Chromium via Playwright at /activity?capture=1.
 *   3. Wait for window.__activityCapture.isReady() (all GLBs loaded).
 *   4. For each frame in [0, totalFrames):
 *        - Set elapsedSec + cameraTheta via window.__activityCapture.setFrame.
 *        - Wait one rAF so the renderer applies the new state.
 *        - Screenshot the page to frames/frame-NNNN.png.
 *   5. Hand the frames to ffmpeg to produce public/activity-loop.mp4.
 *
 * Usage:
 *   node scripts/render-activity-video.mjs            # default 1280×800 @ 30 fps
 *   node scripts/render-activity-video.mjs --width 1080 --height 1080 --fps 30
 *
 * Requires `playwright` (run `npx playwright install chromium` once) and
 * ffmpeg on PATH.
 */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const FRAMES_DIR = resolve(ROOT, ".functional-cache/frames");
const OUT_PATH = resolve(ROOT, "public/activity-loop.mp4");

// Args
const args = Object.fromEntries(
  process.argv
    .slice(2)
    .reduce((acc, v, i, arr) => {
      if (v.startsWith("--")) acc.push([v.slice(2), arr[i + 1]]);
      return acc;
    }, [])
);
const WIDTH = Number(args.width ?? 1280);
const HEIGHT = Number(args.height ?? 800);
const FPS = Number(args.fps ?? 30);
const URL = args.url ?? "http://127.0.0.1:5173/activity?capture=1";
const SETUP_DELAY_MS = Number(args.warmup ?? 1500);

console.log(`render-activity-video: ${WIDTH}×${HEIGHT} @ ${FPS}fps → ${OUT_PATH}`);

// Reset frames dir
if (existsSync(FRAMES_DIR)) rmSync(FRAMES_DIR, { recursive: true });
mkdirSync(FRAMES_DIR, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  // Use system Chromium when present — Playwright's bundled Chromium isn't
  // always reachable (Azure CDN blocked from some sandboxes). Set
  // CHROMIUM_PATH to a Chrome-for-Testing binary if needed.
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium-browser",
  args: [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu-vsync",
    "--ignore-certificate-errors",
  ],
});
const ctx = await browser.newContext({
  viewport: { width: WIDTH, height: HEIGHT },
  deviceScaleFactor: 1,
});
const page = await ctx.newPage();
page.on("pageerror", (err) => console.error("[page error]", err.message));
page.on("console", (msg) => {
  if (msg.type() === "error") console.error("[console]", msg.text());
});

console.log("loading", URL);
// `load` instead of `networkidle` — some assets (fonts) can hang in
// headless and we don't need them for the screenshot, only the canvas.
await page.goto(URL, { waitUntil: "load" });

// Wait for the capture API to appear, then for the swarm to finish loading.
await page.waitForFunction(
  () => typeof window.__activityCapture !== "undefined",
  null,
  { timeout: 30_000 },
);
console.log("capture API attached, waiting for swarm…");
await page.waitForFunction(
  () => window.__activityCapture.isReady(),
  null,
  { timeout: 120_000 },
);
const meta = await page.evaluate(() => ({
  cells: window.__activityCapture.cellCount(),
  loop: window.__activityCapture.loopSeconds(),
}));
console.log(`swarm ready: ${meta.cells} cells, ${meta.loop}s loop`);

// Let the materials settle for a beat (the rAF loop has been running but
// the first emissive update can lag the first paint; this avoids the
// opening frames being subtly dimmer than the rest).
await page.waitForTimeout(SETUP_DELAY_MS);

const totalFrames = Math.round(meta.loop * FPS);
console.log(`capturing ${totalFrames} frames…`);
const t0 = Date.now();
for (let i = 0; i < totalFrames; i++) {
  const tSec = (i / FPS);
  // 360° over the whole loop, slightly negative so the swarm spins counter-
  // clockwise (the way the web page's auto-rotate goes by default).
  const theta = -((i / totalFrames) * Math.PI * 2);
  await page.evaluate(
    ([elapsed, th]) => window.__activityCapture.setFrame(elapsed, th),
    [tSec, theta],
  );
  // Two rAFs — first one applies the React state; second one renders.
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  const path = `${FRAMES_DIR}/frame-${String(i).padStart(4, "0")}.png`;
  await page.screenshot({ path, type: "png", omitBackground: false });
  if (i % 30 === 0 || i === totalFrames - 1) {
    const pct = (((i + 1) / totalFrames) * 100).toFixed(0);
    const eta = ((Date.now() - t0) / (i + 1)) * (totalFrames - i - 1) / 1000;
    console.log(`  frame ${i + 1}/${totalFrames} (${pct}%, ETA ${eta.toFixed(0)}s)`);
  }
}
await browser.close();
console.log(`captured ${totalFrames} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s`);

// Encode with ffmpeg. yuv420p + even dimensions for max player compatibility.
const evenW = WIDTH - (WIDTH % 2);
const evenH = HEIGHT - (HEIGHT % 2);
const ffmpegArgs = [
  "-y",
  "-framerate", String(FPS),
  "-i", `${FRAMES_DIR}/frame-%04d.png`,
  "-c:v", "libx264",
  "-pix_fmt", "yuv420p",
  "-vf", `scale=${evenW}:${evenH}`,
  "-crf", "20",
  "-preset", "medium",
  "-movflags", "+faststart",
  OUT_PATH,
];
console.log("encoding:", "ffmpeg", ffmpegArgs.join(" "));
await new Promise((resolve, reject) => {
  const child = spawn("ffmpeg", ffmpegArgs, { stdio: "inherit" });
  child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`))));
});
console.log(`done → ${OUT_PATH}`);

# Scale of the Universe

A museum-grade interactive zoom journey through 27 scale stops, from a proton
(10⁻¹⁵ m) to the observable universe (~10²⁷ m).

> Reality does not unfold at one size. It changes character as you move
> through it.

## What it is

- A continuous logarithmic camera — `log10(meters)` is the axis you scrub.
- One hero object centered at a time, with the next stop appearing as a
  growing halo around it and the previous as a shrinking dot inside.
- Powers-of-ten ruler always visible on the right edge.
- Category-tinted ambient gradient that morphs as you cross thresholds
  (chemistry, life, the visible world, the human realm, planets and
  stars, deep space).
- Ambient canvas starfield, soft and slow.
- Guided autoplay (space bar), keyboard navigation (arrow keys), drag,
  scroll, click-on-ruler-to-jump.

## Stack

- Vite + React 19 + TypeScript
- Tailwind v4 (`@tailwindcss/vite`)
- Framer Motion for transitions
- No router, no global store — local state is enough.

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc -b && vite build → ./dist
npm run preview  # serve the production build
```

## Where the content lives

- `src/data/scaleStops.ts` — the 27 stops. Each has `sizeM`, derived
  `zoom = log10(sizeM)`, `category`, `description`, `whyItMatters`, and
  optional `threshold` copy. Edit there; the explorer reads from this
  file.
- DNA helix-width is 2 nm, smaller than protein at 5 nm — that ordering
  is editorial. Each stop names a different *kind* of object, not a
  strict sort.

## Architecture

```
src/
  data/scaleStops.ts          27-stop journey + category palette
  components/
    StarField.tsx             ambient canvas starfield (rAF)
    ScaleExplorer.tsx         the instrument (camera, HUD, all of it)
  App.tsx                     <StarField/> + <ScaleExplorer/>
  main.tsx                    React mount
  index.css                   Tailwind v4 theme + base styles
```

The "continuous zoom feel" comes from one trick: every stop renders as a
glowing disk centered in the viewport with `radius = base × 10^(stop.zoom −
camera.zoom)`. When the camera passes a stop, the previous one shrinks to
a dot and the next one swells to engulf the screen. Stops outside ±2.5
decades are culled.

## Deploy

This subdirectory was built to live as its own repo
(`amyleesterling/explore-the-universe`). To extract it cleanly, from the
parent `inner_cosmos` repo:

```bash
# 1. Split this subtree out into a fresh branch with its own history
git subtree split --prefix=scale-of-universe -b scale-split

# 2. Push that branch to the new repo's main
git push git@github.com:amyleesterling/explore-the-universe.git scale-split:main

# 3. (one-time) On GitHub: Settings → Pages → Source: GitHub Actions
#    Then enable a simple Vite-on-Pages workflow on the new repo.
```

The Vite `base` is hard-coded to `/explore-the-universe/` in `vite.config.ts`
to match GitHub Pages at `https://amyleesterling.github.io/explore-the-universe/`.
If the repo is renamed, change that one line.

## Keyboard

- `↑ ↓ ← →`, `+ −` — step to neighboring stops
- `Home` / `End` — jump to proton / observable universe
- `Space` — toggle guided autoplay
- `i` — toggle the description below the disk
- `p` — toggle the powers-of-ten ruler

## Credits

Built as an exploration of science, scale, and wonder.

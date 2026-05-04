# Explore the Universe

> A journey through the powers of ten — and the changing rules of reality.

Eight hand-picked stops across 35 orders of magnitude, each with one killer
sentence about what changes at that scale. Built as a continuous scroll-driven
zoom: as you fall through the page, the hero illustration at the centre of
the stage emerges from outside the frame, settles at native size, then shrinks
into the distance — the way a real camera pulls back through scale.

This is **v1** — a tiny, exquisite vertical slice. Eight stops, no mode
switches, no walls of text. Better one shimmering hallway of wonder than 300
mediocre facts flopping around like damp pamphlets.

## The journey

| Stop                | Scale                    | What changes here                                                |
| ------------------- | ------------------------ | ---------------------------------------------------------------- |
| Molecule            | 10⁻⁹ m / 1 nm            | At this scale, chemistry becomes architecture.                   |
| Synapse             | 10⁻⁷ m / 500 nm          | Where thought rides electricity across an impossibly small gap.  |
| Pyramidal neuron    | 10⁻⁴ m / 100 µm          | A single cell wide as a thought, deep as a memory.               |
| Human               | 10⁰ m / 1.7 m            | Where the universe first turns and asks itself what it is.       |
| Earth               | 10⁷ m / 12,742 km        | A wet stone with weather and witnesses, lit on one side.         |
| Solar system        | 10¹³ m / 9 billion km    | Planets are where dust learns patience.                          |
| Milky Way           | 10²¹ m / 100,000 ly      | A river of suns turning once every quarter-billion years.        |
| Cosmic web          | 10²⁶ m / observable U    | All the matter we know, hung in a glowing scaffold of nothing.   |

## Why this exists

Most "scale of the universe" sites are basically scroll-zoom-cute-fact loops.
Respectable, but flat. The bet here is that scale is not just about size —
it's about which **rules** of reality apply. At one scale, gravity matters.
At another, surface tension is suddenly powerful. At another, life appears.
At another, memory. At another, galactic structure. So this is less "tiny to
huge" and more "what governs reality here?"

The interface is meant to feel ceremonial — Apple keynote meets planetarium
meets scientific dream sequence. Dark, slow, declarative. One hero object per
stop, one sentence with voltage, one quiet scale ladder so you always know
where you are in the ladder of size.

## Stack

Vanilla TypeScript + Vite. No framework, no animation library — every hero
is inline SVG, every transition is a single `transform` + `opacity` write per
scroll frame. Goal is sub-20 KB JS, instant first paint, buttery on mobile.

```bash
cd explore-the-universe
npm install
npm run dev
```

Build:

```bash
npm run build
npm run preview
```

`vite.config.ts` sets `base: '/explore-the-universe/'` for the GitHub Pages
deploy; in `dev` it's `'/'`.

## Architecture

```
src/
  stops.ts     ← the eight stops + copy. Edit here to change the journey.
  heroes.ts    ← inline-SVG hero illustrations, one per stop. Each renderer
                 returns an SVG string at a 600×600 viewBox so they share a
                 centred origin and the cross-fade reads as a single morph.
  main.ts      ← page scaffold + scroll handler. Mounts all 8 heroes once
                 inside a fixed .stage layer, then mutates their transform
                 and opacity per scroll frame to produce the continuous-zoom
                 illusion.
  style.css    ← the whole look. CSS variables for the four glow accents.
```

### The zoom math

For every hero we compute `delta = stop.exp - now.exp` (where `now.exp` is
the continuous exponent the page is currently "at", interpolated from scroll
position). Then:

```
scale   = 2.4 ^ (delta / 3.5)         // appears bigger if not yet reached,
                                      // smaller if already passed
opacity = 1 - |delta / 3.5|^1.6 * 1.05 // gaussian-ish falloff
```

`stepWidth = 3.5` was tuned by eye — small enough that adjacent stops both
contribute during a transition, large enough that you don't see all eight
ghosts piled on top of each other. Heroes with opacity below ~0.005 are
hidden so the per-hero `breathe` keyframe doesn't keep ticking offscreen.

### Why one fixed stage instead of per-section heroes

If each section had its own hero in flow, scrolling would feel like wiping
through pages. With one fixed stage shared across all sections, the hero is
the one constant the page rotates around, and the cards rise past it like
frames of a museum walk. Same trick the original Scale of the Universe
sites use — just driven continuously instead of stepwise.

## Spin-out into its own repo

This currently lives vendored inside `inner_cosmos/explore-the-universe/`
because the build agent's GitHub access is scoped to one repo. To extract
into `github.com/amyleesterling/explore-the-universe` on the `v1` branch
with full history:

```bash
# from the inner_cosmos repo root, after this directory has commits:
git subtree split --prefix=explore-the-universe -b v1-split

# then push that branch as v1 on the new repo:
git push https://github.com/amyleesterling/explore-the-universe.git v1-split:v1

# (or, if the new repo already has a main, push v1-split:v1 to keep them
#  separate, then merge or PR as you prefer)
```

After extraction, drop the `vite.config.ts` `base` if you want the dev
server URL to be `/` again at the new repo's path, or keep it as
`/explore-the-universe/` if you're deploying to GitHub Pages on the same
project.

## Roadmap (post-v1)

- **Mode switches.** Same stops, different lenses: physical size · time
  scale · speed · number of parts · complexity. Toggle in the masthead;
  each lens has its own copy + hero variant. (This is the bit that turns
  the page from a toy into an instrument.)
- **More stops.** ~12 eventually — DNA between molecule and synapse, a
  city between human and Earth, a nebula between solar system and galaxy.
  Don't go past 14; the cosmic-museum feel collapses into a list.
- **"Tell me more" drawer** per stop — one paragraph, a citation, a link.
  Slides up from the bottom of the card, doesn't replace it.
- **Touch pinch-to-zoom** as an alternate input — scroll is fine on
  desktop; pinching feels right on phones.
- **Real data where it makes sense.** The neuron hero is currently a
  procedural pyramidal silhouette; could be swapped for a real MICrONS
  reconstruction (downsampled mesh → 2D projection → SVG path) without
  changing any other code.
- **Audio.** A single low pad that pitches up as you zoom out, so the
  whole journey has one sustained breath. Optional, off by default.

## Credits

Built by Amy & Claude. The design ethos — "ceremonial, declarative, a
discovery card in a cosmic museum" — comes straight from Amy's brief.
The eight stops and their killer sentences were chosen for one purpose:
to make scale feel emotionally and intellectually alive.

## License

TBD.

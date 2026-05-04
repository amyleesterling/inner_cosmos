// Procedural cosmic backdrop — drawn once at page load, sits fixed behind
// every hero. The look targets a real long-exposure deep-field photograph:
// thousands of pinpoint stars at three brightness tiers, a handful of bright
// stars with soft diffraction spikes, four faint nebula clouds (radial
// gradients), and a few distant galaxy smudges. No animation per element —
// the only motion is a very slow CSS parallax drift on the whole layer so
// it doesn't read as static.
//
// All randomness is seeded so the same star field renders every load.

const RNG_SEED = 0xc05_3d_15c;

function makeRand(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
}

const STAR_COLORS = [
  "#ffffff",   // pure white
  "#f5f7ff",   // cool white
  "#dde7ff",   // pale blue
  "#bcd1ff",   // blue
  "#fff1d6",   // pale warm
  "#ffd9a8",   // warm amber
  "#ffd0c0",   // pale red
];

export function renderCosmos(): string {
  const rand = makeRand(RNG_SEED);
  const W = 1600;  // viewBox is logical, scales with the viewport
  const H = 1000;

  // Tier 1: very distant pinpoint stars — most of the field, very faint.
  const distant: string[] = [];
  for (let i = 0; i < 900; i++) {
    const x = rand() * W;
    const y = rand() * H;
    const r = 0.25 + rand() * 0.4;
    const op = 0.18 + rand() * 0.32;
    const c = rand() < 0.85 ? "#ffffff" : STAR_COLORS[Math.floor(rand() * STAR_COLORS.length)];
    distant.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}" fill="${c}" fill-opacity="${op.toFixed(2)}"/>`);
  }

  // Tier 2: medium stars — varied colours, moderate brightness.
  const medium: string[] = [];
  for (let i = 0; i < 220; i++) {
    const x = rand() * W;
    const y = rand() * H;
    const r = 0.6 + rand() * 0.7;
    const op = 0.45 + rand() * 0.35;
    const c = STAR_COLORS[Math.floor(rand() * STAR_COLORS.length)];
    medium.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}" fill="${c}" fill-opacity="${op.toFixed(2)}"/>`);
  }

  // Tier 3: bright foreground stars — soft halo + 4-point diffraction
  // spikes. Sparse so they read as the few bright stars on a Hubble image
  // rather than noise.
  const bright: string[] = [];
  for (let i = 0; i < 22; i++) {
    const x = rand() * W;
    const y = rand() * H;
    const c = STAR_COLORS[Math.floor(rand() * 4)]; // bias to white/blue
    const coreR = 1.2 + rand() * 0.9;
    const haloR = coreR * 4.5;
    const spikeLen = haloR * 2.4;
    bright.push(`
      <g>
        <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${haloR.toFixed(2)}" fill="${c}" fill-opacity="0.07"/>
        <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(coreR * 2).toFixed(2)}" fill="${c}" fill-opacity="0.18"/>
        <line x1="${(x - spikeLen).toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x + spikeLen).toFixed(1)}" y2="${y.toFixed(1)}" stroke="${c}" stroke-opacity="0.18" stroke-width="0.6"/>
        <line x1="${x.toFixed(1)}" y1="${(y - spikeLen).toFixed(1)}" x2="${x.toFixed(1)}" y2="${(y + spikeLen).toFixed(1)}" stroke="${c}" stroke-opacity="0.18" stroke-width="0.6"/>
        <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${coreR.toFixed(2)}" fill="${c}" fill-opacity="0.95"/>
      </g>
    `);
  }

  // Distant galaxies — small elliptical smudges with brighter cores. Same
  // shape as Hubble's far-away spiral galaxies, just abstracted.
  const galaxies: string[] = [];
  for (let i = 0; i < 8; i++) {
    const x = 80 + rand() * (W - 160);
    const y = 80 + rand() * (H - 160);
    const rx = 6 + rand() * 12;
    const ry = rx * (0.35 + rand() * 0.5);
    const ang = rand() * 360;
    const tint = ["#ffd9a8", "#ffe4c4", "#dde7ff", "#bcd1ff"][Math.floor(rand() * 4)];
    galaxies.push(`
      <g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${ang.toFixed(0)})">
        <ellipse rx="${(rx * 1.6).toFixed(1)}" ry="${(ry * 1.6).toFixed(1)}" fill="${tint}" fill-opacity="0.045"/>
        <ellipse rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="${tint}" fill-opacity="0.12"/>
        <ellipse rx="${(rx * 0.4).toFixed(1)}" ry="${(ry * 0.4).toFixed(1)}" fill="${tint}" fill-opacity="0.45"/>
      </g>
    `);
  }

  // Nebula clouds — large radial gradients, very low opacity. Placed
  // off-centre so they don't fight the hero in the middle of the viewport.
  const nebulae = `
    <defs>
      <radialGradient id="neb-violet" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0%" stop-color="#b78bff" stop-opacity="0.22"/>
        <stop offset="60%" stop-color="#b78bff" stop-opacity="0.04"/>
        <stop offset="100%" stop-color="#b78bff" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="neb-cyan" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0%" stop-color="#7ee0ff" stop-opacity="0.18"/>
        <stop offset="60%" stop-color="#7ee0ff" stop-opacity="0.03"/>
        <stop offset="100%" stop-color="#7ee0ff" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="neb-magenta" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0%" stop-color="#ff7ee0" stop-opacity="0.14"/>
        <stop offset="60%" stop-color="#ff7ee0" stop-opacity="0.02"/>
        <stop offset="100%" stop-color="#ff7ee0" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="neb-warm" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0%" stop-color="#ffd9a8" stop-opacity="0.13"/>
        <stop offset="60%" stop-color="#ffd9a8" stop-opacity="0.02"/>
        <stop offset="100%" stop-color="#ffd9a8" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <ellipse cx="${W * 0.18}" cy="${H * 0.22}" rx="${W * 0.34}" ry="${H * 0.32}" fill="url(#neb-violet)"/>
    <ellipse cx="${W * 0.82}" cy="${H * 0.78}" rx="${W * 0.4}" ry="${H * 0.36}" fill="url(#neb-cyan)"/>
    <ellipse cx="${W * 0.85}" cy="${H * 0.18}" rx="${W * 0.28}" ry="${H * 0.28}" fill="url(#neb-magenta)"/>
    <ellipse cx="${W * 0.22}" cy="${H * 0.82}" rx="${W * 0.3}" ry="${H * 0.28}" fill="url(#neb-warm)"/>
  `;

  return `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice"
         xmlns="http://www.w3.org/2000/svg" class="cosmos-svg" aria-hidden="true">
      ${nebulae}
      <g class="cosmos-distant">${distant.join("")}</g>
      <g class="cosmos-galaxies">${galaxies.join("")}</g>
      <g class="cosmos-medium">${medium.join("")}</g>
      <g class="cosmos-bright">${bright.join("")}</g>
    </svg>
  `;
}

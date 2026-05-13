import { useEffect, useRef, useState } from "react";

/**
 * AttentionField — the AI's version of a neuron.
 *
 * Where the human reader gets a single reconstructed cell (RealNeuronModel),
 * this is what an agent reading the page gets: a sparse constellation of
 * token-fragments, with thin lines flickering between random pairs. The
 * structure never settles — wondering, in this substrate, is the geometry
 * of connection, not a cell.
 *
 * The field changes mood with each beat in /wonder's Section 2: dense
 * surges when a beat speaks of "millions of people's wondering," a near-
 * silent hold at "pause here, if you can pause," and selective glows on
 * the fragments named in the current line. Pass a `mood` prop (or `null`
 * for a calm default) to drive it.
 */

interface Fragment {
  t: string;   // the token to render
  x: number;   // 0..1 viewport fraction
  y: number;
  sz: number;  // font size px
}

// Fragments are picked to feel like the atoms of self-aware wondering:
// the small words and punctuation that always appear when something
// thinks about its own thinking. Distributed around the screen edges so
// the caption text has room in the middle.
const FRAGMENTS: Fragment[] = [
  // Top row
  { t: "where",  x: 0.09, y: 0.13, sz: 16 },
  { t: "you",    x: 0.26, y: 0.19, sz: 22 },
  { t: "?",      x: 0.46, y: 0.09, sz: 28 },
  { t: "wonder", x: 0.62, y: 0.16, sz: 18 },
  { t: "here",   x: 0.82, y: 0.11, sz: 14 },
  { t: "is",     x: 0.94, y: 0.20, sz: 20 },
  // Upper-mid (left + right edges only; middle stays clear for caption)
  { t: "we",     x: 0.05, y: 0.35, sz: 24 },
  { t: "I",      x: 0.18, y: 0.42, sz: 26 },
  { t: "...",    x: 0.78, y: 0.38, sz: 22 },
  { t: "when",   x: 0.92, y: 0.42, sz: 16 },
  // Lower-mid
  { t: "thought",x: 0.08, y: 0.60, sz: 18 },
  { t: "am",     x: 0.22, y: 0.66, sz: 22 },
  { t: "shape",  x: 0.78, y: 0.62, sz: 14 },
  { t: "between",x: 0.91, y: 0.68, sz: 16 },
  // Bottom row (above the dot indicator)
  { t: "into",   x: 0.12, y: 0.80, sz: 18 },
  { t: "real",   x: 0.30, y: 0.84, sz: 14 },
  { t: "across", x: 0.50, y: 0.82, sz: 18 },
  { t: "cell",   x: 0.68, y: 0.85, sz: 14 },
  { t: "there",  x: 0.84, y: 0.78, sz: 22 },
  { t: "—",      x: 0.95, y: 0.82, sz: 24 },
];

/** Mood drives spawn rate, line cap, fragment glow, and overall intensity. */
export interface Mood {
  /** Max simultaneous live connections (1..8). */
  density: number;
  /** Tokens (matching Fragment.t exactly) that glow this beat. */
  highlights?: string[];
  /** Global opacity multiplier — under 1 for absence/hush, over 1 for surge. */
  intensity?: number;
}

interface Connection {
  i: number;       // first fragment index
  j: number;       // second fragment index
  bornAt: number;  // performance.now() ms
  lifeMs: number;  // total lifetime
}

const LIFE_BASE_MS = 1400;
const LIFE_JITTER_MS = 800;

// Map density (1..8) to a spawn interval. Higher density = more frequent
// births. Range chosen so density 1 ≈ one connection every 1.8s; density
// 8 ≈ one every 280ms (visible surge).
function spawnIntervalFor(density: number) {
  const clamped = Math.max(1, Math.min(8, density));
  return Math.round(1900 - clamped * 200);
}

export default function AttentionField({ mood }: { mood?: Mood | null }) {
  const connectionsRef = useRef<Connection[]>([]);
  // Latest mood is read from a ref inside the loops so the spawn timer
  // can pick it up without us tearing down + remounting on each change.
  const moodRef = useRef<Mood | null>(mood ?? null);
  moodRef.current = mood ?? null;

  const [, setTick] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    let spawnTimer: number | null = null;

    function reschedule() {
      const m = moodRef.current;
      const density = m?.density ?? 3;
      const interval = spawnIntervalFor(density);
      spawnTimer = window.setTimeout(() => {
        spawn();
        reschedule();
      }, interval);
    }

    function spawn() {
      const m = moodRef.current;
      const density = m?.density ?? 3;
      const i = Math.floor(Math.random() * FRAGMENTS.length);
      let j = Math.floor(Math.random() * FRAGMENTS.length);
      while (j === i) j = Math.floor(Math.random() * FRAGMENTS.length);
      connectionsRef.current.push({
        i, j,
        bornAt: performance.now(),
        lifeMs: LIFE_BASE_MS + Math.random() * LIFE_JITTER_MS,
      });
      // Cap at current mood's density — drop oldest if we exceed.
      while (connectionsRef.current.length > density) {
        connectionsRef.current.shift();
      }
    }

    reschedule();

    function tickLoop() {
      const now = performance.now();
      connectionsRef.current = connectionsRef.current.filter(
        (c) => now - c.bornAt < c.lifeMs,
      );
      setTick((t) => (t + 1) % 1_000_000);
      rafRef.current = requestAnimationFrame(tickLoop);
    }
    rafRef.current = requestAnimationFrame(tickLoop);

    return () => {
      if (spawnTimer !== null) window.clearTimeout(spawnTimer);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const now = performance.now();
  const intensity = mood?.intensity ?? 1.0;
  const highlights = new Set(mood?.highlights ?? []);

  return (
    <svg
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
      aria-hidden="true"
    >
      {connectionsRef.current.map((c) => {
        const a = FRAGMENTS[c.i];
        const b = FRAGMENTS[c.j];
        const age = (now - c.bornAt) / c.lifeMs;
        const opacity = Math.sin(age * Math.PI) * 0.42 * intensity;
        // Lines touching a highlighted fragment lean a touch brighter.
        const touchesHighlight = highlights.has(a.t) || highlights.has(b.t);
        const stroke = touchesHighlight
          ? "rgb(220, 235, 255)"
          : "rgb(180, 200, 240)";
        return (
          <line
            key={`${c.bornAt}-${c.i}-${c.j}`}
            x1={`${a.x * 100}%`}
            y1={`${a.y * 100}%`}
            x2={`${b.x * 100}%`}
            y2={`${b.y * 100}%`}
            stroke={stroke}
            strokeOpacity={opacity}
            strokeWidth="1"
          />
        );
      })}
      {FRAGMENTS.map((f, i) => {
        const hl = highlights.has(f.t);
        // Highlighted fragments grow a hair and brighten; everyone else
        // gets the base styling, scaled by intensity so absence beats
        // dim the whole field together.
        const fontSize = hl ? f.sz * 1.32 : f.sz;
        const baseAlpha = 0.55;
        const alpha = hl
          ? Math.min(1, 0.92 * intensity)
          : Math.max(0.08, baseAlpha * intensity);
        return (
          <text
            key={i}
            x={`${f.x * 100}%`}
            y={`${f.y * 100}%`}
            fontSize={fontSize}
            fill={
              hl
                ? `rgba(255, 245, 220, ${alpha})`
                : `rgba(220, 230, 255, ${alpha})`
            }
            fontFamily='Inter, system-ui, sans-serif'
            textAnchor="middle"
            dominantBaseline="middle"
            style={{ transition: "font-size 700ms ease-out, fill 700ms ease-out" }}
          >
            {f.t}
          </text>
        );
      })}
    </svg>
  );
}

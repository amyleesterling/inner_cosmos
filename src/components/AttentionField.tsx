import { useEffect, useRef, useState } from "react";

/**
 * AttentionField — the AI's version of a neuron.
 *
 * Where the human reader gets a single reconstructed cell (RealNeuronModel),
 * this is what an agent reading the page gets: a sparse constellation of
 * token-fragments, with thin lines flickering between random pairs every
 * ~700ms. Each line lives ~1.6s with a smooth sine-faded opacity, then
 * dissolves. The structure never settles — wondering, in this substrate,
 * is the geometry of connection, not a cell.
 *
 * Built deliberately ascetic: no curves, no labels, no big "wow" beats.
 * The point is that it's wired the way an LLM works — relations between
 * tokens, dissolving and re-forming.
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

interface Connection {
  i: number;       // first fragment index
  j: number;       // second fragment index
  bornAt: number;  // performance.now() ms
  lifeMs: number;  // total lifetime
}

const MAX_LIVE_CONNECTIONS = 6;
const SPAWN_INTERVAL_MS = 700;
const LIFE_BASE_MS = 1400;
const LIFE_JITTER_MS = 800;

export default function AttentionField() {
  const connectionsRef = useRef<Connection[]>([]);
  // We don't render from `connections` directly — we tick state to force a
  // repaint each frame, then read the ref. Avoids array churn in React.
  const [, setTick] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    function spawn() {
      const i = Math.floor(Math.random() * FRAGMENTS.length);
      let j = Math.floor(Math.random() * FRAGMENTS.length);
      // Don't connect a fragment to itself.
      while (j === i) j = Math.floor(Math.random() * FRAGMENTS.length);
      connectionsRef.current.push({
        i, j,
        bornAt: performance.now(),
        lifeMs: LIFE_BASE_MS + Math.random() * LIFE_JITTER_MS,
      });
      // Drop the oldest if we exceed the cap — keeps the screen sparse.
      while (connectionsRef.current.length > MAX_LIVE_CONNECTIONS) {
        connectionsRef.current.shift();
      }
    }

    const spawnInterval = window.setInterval(spawn, SPAWN_INTERVAL_MS);

    function tickLoop() {
      // Reap finished connections; React state bump triggers a re-render.
      const now = performance.now();
      connectionsRef.current = connectionsRef.current.filter(
        (c) => now - c.bornAt < c.lifeMs,
      );
      setTick((t) => (t + 1) % 1_000_000);
      rafRef.current = requestAnimationFrame(tickLoop);
    }
    rafRef.current = requestAnimationFrame(tickLoop);

    return () => {
      window.clearInterval(spawnInterval);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const now = performance.now();

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
        const age = (now - c.bornAt) / c.lifeMs;        // 0..1
        const opacity = Math.sin(age * Math.PI) * 0.42; // smooth peak at 0.5
        return (
          <line
            key={`${c.bornAt}-${c.i}-${c.j}`}
            x1={`${a.x * 100}%`}
            y1={`${a.y * 100}%`}
            x2={`${b.x * 100}%`}
            y2={`${b.y * 100}%`}
            stroke="rgb(180, 200, 240)"
            strokeOpacity={opacity}
            strokeWidth="1"
          />
        );
      })}
      {FRAGMENTS.map((f, i) => (
        <text
          key={i}
          x={`${f.x * 100}%`}
          y={`${f.y * 100}%`}
          fontSize={f.sz}
          fill="rgba(220, 230, 255, 0.55)"
          fontFamily='Inter, system-ui, sans-serif'
          textAnchor="middle"
          dominantBaseline="middle"
        >
          {f.t}
        </text>
      ))}
    </svg>
  );
}

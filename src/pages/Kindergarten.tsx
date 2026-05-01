import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Kindergarten — a "zoom into your brain" cinematic for 5–6 year-olds on a big
 * screen. Tie-dye dream sky, golden glowing brain, four soft zoom stages.
 *
 * Stage progression (auto-advances or on click/tap):
 *   0  brain        "This is your brain."
 *   1  region       "Let's go inside your thoughts."
 *   2  neuron       "These are brain trees."
 *   3  synapse      "These are spark bridges."
 *
 * Visual continuity: every layer scales-up-and-fades-out as the next layer
 * scales-in-and-fades-in. The camera is always moving forward.
 */

type StageId = "brain" | "region" | "neuron" | "synapse";

const STAGES: { id: StageId; text: string; auto: number | null }[] = [
  { id: "brain",   text: "This is your brain.",            auto: 4200 },
  { id: "region",  text: "Let's go inside your thoughts.", auto: 4800 },
  { id: "neuron",  text: "These are brain trees.",         auto: 5200 },
  { id: "synapse", text: "These are spark bridges.",       auto: null },
];

const ZOOM_DURATION = 1.8; // seconds for each stage transition

export default function Kindergarten() {
  const [stageIdx, setStageIdx] = useState(0);
  const [restartKey, setRestartKey] = useState(0);
  const stage = STAGES[stageIdx];

  // Auto-advance — pauses on the last stage (lets the synapse sparkle).
  useEffect(() => {
    if (stage.auto == null) return;
    const t = window.setTimeout(() => {
      setStageIdx((s) => Math.min(s + 1, STAGES.length - 1));
    }, stage.auto);
    return () => window.clearTimeout(t);
  }, [stageIdx, stage.auto, restartKey]);

  function advance() {
    if (stageIdx < STAGES.length - 1) {
      setStageIdx(stageIdx + 1);
    } else {
      // Loop back so the experience can be replayed without a refresh.
      setStageIdx(0);
      setRestartKey((k) => k + 1);
    }
  }

  // Keyboard for kiosk / projector use — space, enter, arrow advance.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === " " || e.key === "Enter" || e.key === "ArrowRight") {
        advance();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageIdx]);

  return (
    <div
      className="kg-root"
      onClick={advance}
      role="presentation"
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        cursor: "pointer",
        userSelect: "none",
      }}
    >
      <TieDyeSky />
      <DustMotes intensity={stageIdx} />

      {/* Scene stack. Each scene knows its own depth; we hand it the current
          stage and it positions itself relative to the camera. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          perspective: 1400,
        }}
      >
        <SceneLayer depth={0} stageIdx={stageIdx}><BrainScene /></SceneLayer>
        <SceneLayer depth={1} stageIdx={stageIdx}><RegionScene /></SceneLayer>
        <SceneLayer depth={2} stageIdx={stageIdx}><NeuronScene /></SceneLayer>
        <SceneLayer depth={3} stageIdx={stageIdx}><SynapseScene /></SceneLayer>
      </div>

      <Caption text={stage.text} stageIdx={stageIdx} />
      <ProgressDots count={STAGES.length} active={stageIdx} />
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Layered scene container.
 *
 * The camera is the viewer; we model "where am I in the journey" with a single
 * `phase` per scene:
 *    phase = depth - stageIdx
 *
 *    phase = 0 → this is the active scene (full size, full opacity)
 *    phase < 0 → we've zoomed past it (scaled large, faded out)
 *    phase > 0 → it's still ahead (small, faded out, waiting)
 *
 * Framer Motion smoothly interpolates between phases, which is what makes the
 * stage change feel like one continuous dolly-zoom rather than a slide swap.
 * ------------------------------------------------------------------------- */
function SceneLayer({
  depth,
  stageIdx,
  children,
}: {
  depth: number;
  stageIdx: number;
  children: React.ReactNode;
}) {
  const phase = depth - stageIdx;
  // Past, current, future
  const scale = phase === 0 ? 1 : phase < 0 ? 9 : 0.18;
  const opacity = phase === 0 ? 1 : 0;
  // Stack so the active scene is always on top.
  const z = 100 - Math.abs(phase) * 10;

  // If the layer is too far away, don't render it (saves paint cost).
  if (Math.abs(phase) > 1) return null;

  return (
    <motion.div
      initial={false}
      animate={{ scale, opacity }}
      transition={{
        duration: ZOOM_DURATION,
        ease: phase < 0 ? [0.4, 0, 0.6, 1] : [0.16, 0.8, 0.24, 1],
      }}
      style={{
        position: "absolute",
        inset: 0,
        display: "grid",
        placeItems: "center",
        zIndex: z,
        willChange: "transform, opacity",
        pointerEvents: "none",
      }}
    >
      {children}
    </motion.div>
  );
}

/* ---------------------------------------------------------------------------
 * Tie-dye sky — soft animated rainbow blobs. Built from layered radial
 * gradients on a fixed div, with two slow keyframe animations: one rotates
 * and pans the gradient stack, the other hue-shifts the whole thing. The
 * effect is a slow, fluid swirl, like clouds gently moving.
 * ------------------------------------------------------------------------- */
function TieDyeSky() {
  return (
    <>
      <style>{`
        @keyframes kg-tiedye-drift {
          0%   { transform: scale(1.15) translate(-2%, -1%) rotate(0deg); }
          50%  { transform: scale(1.25) translate(2%, 1%)  rotate(8deg); }
          100% { transform: scale(1.15) translate(-2%, -1%) rotate(0deg); }
        }
        @keyframes kg-tiedye-hue {
          0%   { filter: blur(40px) saturate(150%) hue-rotate(0deg); }
          100% { filter: blur(40px) saturate(150%) hue-rotate(360deg); }
        }
        .kg-tiedye-base {
          position: absolute;
          inset: -10%;
          background:
            radial-gradient(40% 35% at 22% 28%, rgba(255, 175, 220, 0.95), transparent 60%),
            radial-gradient(35% 30% at 78% 22%, rgba(255, 220, 150, 0.95), transparent 60%),
            radial-gradient(45% 40% at 80% 78%, rgba(165, 220, 255, 0.95), transparent 60%),
            radial-gradient(40% 35% at 25% 80%, rgba(200, 175, 255, 0.95), transparent 60%),
            radial-gradient(50% 45% at 50% 55%, rgba(190, 255, 220, 0.85), transparent 65%),
            linear-gradient(135deg, #fff5e8 0%, #ffe6f5 50%, #e6f4ff 100%);
          animation:
            kg-tiedye-drift 38s ease-in-out infinite,
            kg-tiedye-hue 120s linear infinite;
          will-change: transform, filter;
        }
        .kg-tiedye-veil {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(60% 50% at 50% 50%, rgba(255,255,255,0.18), transparent 70%);
          mix-blend-mode: screen;
          pointer-events: none;
        }
      `}</style>
      <div className="kg-tiedye-base" />
      <div className="kg-tiedye-veil" />
    </>
  );
}

/* ---------------------------------------------------------------------------
 * Drifting dust motes — a few dozen tiny golden sparkles slowly floating up.
 * Density grows with depth so the deep stages feel "more alive."
 * ------------------------------------------------------------------------- */
function DustMotes({ intensity }: { intensity: number }) {
  // Generate once, reuse for the lifetime of the component. Coordinates are
  // randomized so each visit has a slightly different sky.
  const motes = useMemo(() => {
    const n = 80;
    return Array.from({ length: n }, (_, i) => ({
      key: i,
      left: Math.random() * 100,
      top: Math.random() * 100,
      size: 2 + Math.random() * 4,
      delay: Math.random() * 12,
      duration: 14 + Math.random() * 14,
      hue: 30 + Math.random() * 30, // warm gold range
      drift: (Math.random() - 0.5) * 60,
    }));
  }, []);

  // Show fewer motes early, more later — feels like we're zooming into a
  // denser, more magical world.
  const visibleCount = Math.min(motes.length, 12 + intensity * 22);

  return (
    <>
      <style>{`
        @keyframes kg-mote-rise {
          0%   { transform: translate(0, 0) scale(0.6); opacity: 0; }
          12%  { opacity: 1; }
          88%  { opacity: 1; }
          100% { transform: translate(var(--drift, 0px), -120vh) scale(1); opacity: 0; }
        }
        .kg-mote {
          position: absolute;
          border-radius: 50%;
          will-change: transform, opacity;
          animation: kg-mote-rise linear infinite;
        }
      `}</style>
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 50 }}>
        {motes.slice(0, visibleCount).map((m) => (
          <span
            key={m.key}
            className="kg-mote"
            style={{
              left: `${m.left}%`,
              top: `${m.top}%`,
              width: m.size,
              height: m.size,
              background: `hsla(${m.hue}, 100%, 80%, 0.95)`,
              boxShadow: `0 0 ${m.size * 3}px hsla(${m.hue}, 100%, 75%, 0.9)`,
              animationDelay: `-${m.delay}s`,
              animationDuration: `${m.duration}s`,
              ["--drift" as string]: `${m.drift}px`,
            } as React.CSSProperties}
          />
        ))}
      </div>
    </>
  );
}

/* ---------------------------------------------------------------------------
 * Caption — short kid-friendly text, fades + drifts up between stages.
 * ------------------------------------------------------------------------- */
function Caption({ text, stageIdx }: { text: string; stageIdx: number }) {
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: "12vh",
        display: "grid",
        placeItems: "center",
        zIndex: 200,
        pointerEvents: "none",
      }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={stageIdx}
          initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0,  filter: "blur(0px)" }}
          exit={{    opacity: 0, y: -8, filter: "blur(6px)" }}
          transition={{ duration: 1.0, ease: [0.16, 0.8, 0.24, 1] }}
          style={{
            fontSize: "clamp(2.4rem, 5.5vw, 5rem)",
            fontWeight: 600,
            color: "#3d2a14",
            letterSpacing: "-0.01em",
            textAlign: "center",
            textShadow:
              "0 2px 24px rgba(255,236,180,0.95), 0 1px 0 rgba(255,255,255,0.6)",
            fontFamily:
              '"Fraunces", "Inter", system-ui, sans-serif',
          }}
        >
          {text}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Tiny progress dots — five dots at the bottom, no text, no labels. Just a
 * gentle wayfinding cue.
 * ------------------------------------------------------------------------- */
function ProgressDots({ count, active }: { count: number; active: number }) {
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: "5vh",
        display: "flex",
        justifyContent: "center",
        gap: 14,
        zIndex: 200,
        pointerEvents: "none",
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          style={{
            width: i === active ? 28 : 10,
            height: 10,
            borderRadius: 999,
            background:
              i === active
                ? "rgba(78, 50, 22, 0.65)"
                : "rgba(78, 50, 22, 0.22)",
            transition: "all 600ms cubic-bezier(0.16,0.8,0.24,1)",
          }}
        />
      ))}
    </div>
  );
}

/* ===========================================================================
 * SCENES
 * Each scene is its own SVG (or composition) sized to the viewport. They all
 * share a warm-gold palette and a soft bloom, so transitions feel continuous.
 * ======================================================================== */

const goldDefs = (
  <defs>
    {/* Three-stop gold for soft inner glow → warm rim */}
    <radialGradient id="kgGold" cx="50%" cy="45%" r="65%">
      <stop offset="0%"   stopColor="#fffbe2" stopOpacity="1" />
      <stop offset="40%"  stopColor="#ffd86a" stopOpacity="1" />
      <stop offset="80%"  stopColor="#ff9d2e" stopOpacity="1" />
      <stop offset="100%" stopColor="#d36a17" stopOpacity="1" />
    </radialGradient>
    {/* Soft halo for the bloom rings */}
    <radialGradient id="kgHalo" cx="50%" cy="50%" r="50%">
      <stop offset="0%"   stopColor="#ffe79a" stopOpacity="0.95" />
      <stop offset="60%"  stopColor="#ffb867" stopOpacity="0.45" />
      <stop offset="100%" stopColor="#ffb867" stopOpacity="0" />
    </radialGradient>
    {/* Bloom blur — used on most golden shapes */}
    <filter id="kgBloom" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="6" result="b" />
      <feMerge>
        <feMergeNode in="b" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    {/* Stronger bloom for the synapse sparks */}
    <filter id="kgSparkle" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="3" result="b" />
      <feMerge>
        <feMergeNode in="b" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
);

/* ---------------------------------------------------------------------------
 * BRAIN — friendly cartoon-y brain. Two soft hemispheres, a few curvy sulci,
 * a slow "breathing" pulse, and a layered halo.
 * ------------------------------------------------------------------------- */
function BrainScene() {
  return (
    <>
      <style>{`
        @keyframes kg-breathe {
          0%, 100% { transform: scale(1);    filter: drop-shadow(0 0 30px rgba(255,200,100,0.6)); }
          50%      { transform: scale(1.04); filter: drop-shadow(0 0 50px rgba(255,200,100,0.9)); }
        }
        @keyframes kg-halo {
          0%, 100% { transform: scale(1);    opacity: 0.55; }
          50%      { transform: scale(1.15); opacity: 0.85; }
        }
        .kg-brain      { animation: kg-breathe 4.2s ease-in-out infinite; transform-origin: center; will-change: transform, filter; }
        .kg-brain-halo { animation: kg-halo 4.2s ease-in-out infinite;    transform-origin: center; will-change: transform, opacity; }
      `}</style>
      <svg
        viewBox="0 0 600 600"
        style={{
          width: "min(60vw, 60vh)",
          height: "min(60vw, 60vh)",
          overflow: "visible",
        }}
      >
        {goldDefs}

        {/* Outer halo — large, soft */}
        <circle className="kg-brain-halo" cx="300" cy="300" r="240" fill="url(#kgHalo)" />

        <g className="kg-brain">
          {/* Brain body — two hemispheres */}
          <path
            d="
              M 300 130
              C 240 130, 175 165, 165 230
              C 130 240, 110 280, 130 320
              C 110 360, 145 410, 200 420
              C 220 460, 280 470, 300 450
              C 320 470, 380 460, 400 420
              C 455 410, 490 360, 470 320
              C 490 280, 470 240, 435 230
              C 425 165, 360 130, 300 130 Z"
            fill="url(#kgGold)"
            filter="url(#kgBloom)"
          />
          {/* Center divide */}
          <path
            d="M 300 145 Q 295 290 300 445"
            stroke="#c8741b" strokeWidth="3" strokeLinecap="round"
            fill="none" opacity="0.55"
          />
          {/* A few curvy "sulci" hint lines per hemisphere — soft, kid-friendly */}
          <g stroke="#c8741b" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.5">
            <path d="M 230 200 Q 215 230 235 255 Q 215 280 240 305" />
            <path d="M 200 320 Q 230 335 215 365" />
            <path d="M 250 390 Q 260 405 245 420" />

            <path d="M 370 200 Q 385 230 365 255 Q 385 280 360 305" />
            <path d="M 400 320 Q 370 335 385 365" />
            <path d="M 350 390 Q 340 405 355 420" />
          </g>
          {/* Soft inner highlight */}
          <ellipse cx="245" cy="210" rx="40" ry="22" fill="#fff8d8" opacity="0.5" />
        </g>
      </svg>
    </>
  );
}

/* ---------------------------------------------------------------------------
 * REGION — we're inside the brain now. A galaxy of glowing cell-bodies on a
 * soft warm haze. Looks like neighborhoods of light.
 * ------------------------------------------------------------------------- */
function RegionScene() {
  // A scatter of glowing dots — fixed seed so layout is consistent across
  // re-renders. Sizes/positions chosen by hand to feel organic.
  const cells = useMemo(() => {
    const positions = [
      [0.20, 0.32, 1.0], [0.30, 0.50, 0.7], [0.18, 0.65, 0.85], [0.42, 0.40, 1.1],
      [0.50, 0.62, 0.9], [0.38, 0.78, 0.7], [0.62, 0.30, 1.0], [0.72, 0.50, 0.8],
      [0.58, 0.48, 0.6], [0.80, 0.65, 1.1], [0.68, 0.72, 0.7], [0.86, 0.42, 0.85],
      [0.30, 0.20, 0.6], [0.62, 0.20, 0.55], [0.46, 0.28, 0.5], [0.50, 0.50, 1.4], // big central
      [0.26, 0.85, 0.5], [0.74, 0.85, 0.55], [0.10, 0.45, 0.5], [0.92, 0.55, 0.6],
    ];
    return positions.map(([x, y, s], i) => ({
      key: i, x: x * 100, y: y * 100, size: s,
      hue: 32 + (i % 4) * 6, // small hue variety inside warm gold
      delay: (i * 0.27) % 3.6,
    }));
  }, []);

  return (
    <>
      <style>{`
        @keyframes kg-cell-pulse {
          0%, 100% { opacity: 0.65; transform: scale(1); }
          50%      { opacity: 1;    transform: scale(1.08); }
        }
        .kg-cell { animation: kg-cell-pulse 3.6s ease-in-out infinite; transform-origin: center; will-change: transform, opacity; }
      `}</style>
      <div
        style={{
          width: "min(80vw, 80vh)",
          height: "min(80vw, 80vh)",
          position: "relative",
        }}
      >
        {/* warm glow underneath, gives the "neighborhood" feel */}
        <div
          style={{
            position: "absolute", inset: "5%",
            background:
              "radial-gradient(closest-side, rgba(255,210,120,0.55), rgba(255,210,120,0.15) 60%, transparent 80%)",
            filter: "blur(20px)",
          }}
        />
        {cells.map((c) => (
          <div
            key={c.key}
            className="kg-cell"
            style={{
              position: "absolute",
              left: `${c.x}%`,
              top: `${c.y}%`,
              width: 36 * c.size,
              height: 36 * c.size,
              borderRadius: "50%",
              transform: "translate(-50%, -50%)",
              background: `radial-gradient(circle at 35% 35%, hsl(${c.hue}, 100%, 92%), hsl(${c.hue}, 95%, 65%) 55%, hsl(${c.hue - 8}, 80%, 45%) 100%)`,
              boxShadow: `0 0 ${28 * c.size}px hsla(${c.hue}, 100%, 70%, 0.85), 0 0 ${48 * c.size}px hsla(${c.hue}, 100%, 65%, 0.55)`,
              animationDelay: `-${c.delay}s`,
            }}
          />
        ))}
      </div>
    </>
  );
}

/* ---------------------------------------------------------------------------
 * NEURON — a single tree-like neuron. Soma at the center, dendrites branching
 * out in every direction like a luminous fractal. A real-feeling Cajal sketch
 * but warm and friendly, gently swaying.
 * ------------------------------------------------------------------------- */
function NeuronScene() {
  return (
    <>
      <style>{`
        @keyframes kg-neuron-sway {
          0%, 100% { transform: rotate(-1.2deg) scale(1); }
          50%      { transform: rotate(1.2deg)  scale(1.02); }
        }
        @keyframes kg-soma-pulse {
          0%, 100% { filter: drop-shadow(0 0 22px rgba(255,200,100,0.85)); }
          50%      { filter: drop-shadow(0 0 38px rgba(255,200,100,1)); }
        }
        .kg-neuron-tree { animation: kg-neuron-sway 6s ease-in-out infinite; transform-origin: 300px 320px; will-change: transform; }
        .kg-soma        { animation: kg-soma-pulse 2.6s ease-in-out infinite; transform-origin: center; }
      `}</style>
      <svg
        viewBox="0 0 600 600"
        style={{
          width: "min(85vw, 85vh)",
          height: "min(85vw, 85vh)",
          overflow: "visible",
        }}
      >
        {goldDefs}
        <g className="kg-neuron-tree" stroke="url(#kgGold)" strokeLinecap="round" fill="none">
          {/* Apical dendrite — main trunk going up, branching twice */}
          <g strokeWidth="9" opacity="0.95" filter="url(#kgBloom)">
            <path d="M 300 320 C 300 250, 295 200, 300 130" />
            <path d="M 300 200 C 270 170, 245 150, 220 110" />
            <path d="M 300 200 C 330 170, 355 150, 380 110" />
            <path d="M 300 150 C 285 130, 275 110, 270 80" />
            <path d="M 300 150 C 315 130, 325 110, 330 80" />
            <path d="M 220 110 C 205 95, 195 80, 190 55" />
            <path d="M 380 110 C 395 95, 405 80, 410 55" />
          </g>

          {/* Basal dendrites — radiating outward and downward */}
          <g strokeWidth="8" opacity="0.92" filter="url(#kgBloom)">
            <path d="M 300 340 C 250 360, 210 380, 165 415" />
            <path d="M 300 340 C 350 360, 390 380, 435 415" />
            <path d="M 300 340 C 285 380, 270 415, 250 460" />
            <path d="M 300 340 C 315 380, 330 415, 350 460" />
            <path d="M 300 340 C 230 350, 175 345, 120 360" />
            <path d="M 300 340 C 370 350, 425 345, 480 360" />
          </g>

          {/* Smaller terminal twigs — finer detail */}
          <g strokeWidth="4" opacity="0.85">
            <path d="M 165 415 C 150 425, 135 440, 130 460" />
            <path d="M 165 415 C 145 410, 125 410, 105 415" />
            <path d="M 435 415 C 450 425, 465 440, 470 460" />
            <path d="M 435 415 C 455 410, 475 410, 495 415" />
            <path d="M 250 460 C 240 480, 235 495, 235 510" />
            <path d="M 350 460 C 360 480, 365 495, 365 510" />
            <path d="M 190 55 C 180 45, 175 35, 170 20" />
            <path d="M 410 55 C 420 45, 425 35, 430 20" />
            <path d="M 270 80 C 265 65, 260 50, 260 35" />
            <path d="M 330 80 C 335 65, 340 50, 340 35" />
          </g>

          {/* Axon — thin, going down and away */}
          <g strokeWidth="5" opacity="0.7">
            <path d="M 300 350 C 310 420, 295 480, 305 560" />
          </g>
        </g>

        {/* Soma — glowing cell body sits on top of the dendrite trunk junction */}
        <g className="kg-soma">
          <circle cx="300" cy="325" r="48" fill="url(#kgHalo)" opacity="0.85" />
          <circle cx="300" cy="325" r="32" fill="url(#kgGold)" />
          <ellipse cx="290" cy="315" rx="11" ry="6" fill="#fff8d8" opacity="0.7" />
        </g>
      </svg>
    </>
  );
}

/* ---------------------------------------------------------------------------
 * SYNAPSE — two neuron tips reaching toward each other, with a stream of
 * glowing "pearls" jumping the gap. The climax of the journey.
 * ------------------------------------------------------------------------- */
function SynapseScene() {
  // Eight sparks staggered along the gap, each with its own delay so the
  // stream looks continuous rather than flashing all at once.
  const sparks = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => ({
        key: i,
        delay: (i * 0.18) % 1.6,
        offset: (i % 3 - 1) * 6, // tiny vertical wobble
      })),
    [],
  );

  return (
    <>
      <style>{`
        @keyframes kg-spark-fly {
          0%   { transform: translateX(0)    scale(0.5); opacity: 0; }
          12%  { opacity: 1; transform: translateX(20px) scale(1); }
          80%  { opacity: 1; transform: translateX(160px) scale(1); }
          100% { transform: translateX(220px) scale(0.4); opacity: 0; }
        }
        @keyframes kg-tip-glow {
          0%, 100% { filter: drop-shadow(0 0 22px rgba(255,200,100,0.85)); }
          50%      { filter: drop-shadow(0 0 38px rgba(255,200,100,1)); }
        }
        .kg-syn-tip-left  { animation: kg-tip-glow 3s ease-in-out infinite; transform-origin: center; }
        .kg-syn-tip-right { animation: kg-tip-glow 3s ease-in-out infinite 0.4s; transform-origin: center; }
        .kg-spark         { animation: kg-spark-fly 1.6s linear infinite; will-change: transform, opacity; }
      `}</style>
      <div
        style={{
          width: "min(90vw, 70vh)",
          height: "min(60vw, 55vh)",
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg
          viewBox="0 0 800 500"
          style={{ width: "100%", height: "100%", overflow: "visible" }}
        >
          {goldDefs}

          {/* Soft halo behind the gap — implies the energy in the air */}
          <ellipse cx="400" cy="250" rx="240" ry="120" fill="url(#kgHalo)" opacity="0.55" />

          {/* Left presynaptic terminal — branched twig with a bulb */}
          <g className="kg-syn-tip-left" stroke="url(#kgGold)" strokeLinecap="round" fill="none" filter="url(#kgBloom)">
            <path d="M  40 250 C 130 250, 220 250, 290 250" strokeWidth="14" />
            <path d="M  90 220 C 160 230, 220 240, 280 250" strokeWidth="6" opacity="0.7" />
            <path d="M  90 280 C 160 270, 220 260, 280 250" strokeWidth="6" opacity="0.7" />
            <circle cx="290" cy="250" r="36" fill="url(#kgGold)" />
          </g>

          {/* Right postsynaptic terminal — mirrored, slightly differently shaped */}
          <g className="kg-syn-tip-right" stroke="url(#kgGold)" strokeLinecap="round" fill="none" filter="url(#kgBloom)">
            <path d="M 760 250 C 670 250, 580 250, 510 250" strokeWidth="14" />
            <path d="M 710 220 C 640 230, 580 240, 520 250" strokeWidth="6" opacity="0.7" />
            <path d="M 710 280 C 640 270, 580 260, 520 250" strokeWidth="6" opacity="0.7" />
            <circle cx="510" cy="250" r="36" fill="url(#kgGold)" />
          </g>

          {/* Spark stream — small glowing pearls flying left → right across the gap */}
          <g filter="url(#kgSparkle)">
            {sparks.map((s) => (
              <g
                key={s.key}
                className="kg-spark"
                style={{ animationDelay: `-${s.delay}s` }}
              >
                <circle
                  cx={290}
                  cy={250 + s.offset}
                  r={10}
                  fill="#fff7c8"
                  opacity="0.95"
                />
                <circle
                  cx={290}
                  cy={250 + s.offset}
                  r={5}
                  fill="#ffffff"
                />
              </g>
            ))}
          </g>
        </svg>
      </div>
    </>
  );
}

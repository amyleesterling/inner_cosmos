import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ZoomScene from "../components/ZoomScene";
import CellSwarm from "../components/CellSwarm";
import {
  loadActivityManifest,
  loadActivityTraces,
  type ActivityManifest,
  type ActivityTraces,
} from "../data/activityCells";

/**
 * /kindergarten — the same real-data journey as /explore, with kid captions.
 * Mounts ZoomScene directly so every mesh is the actual MICrONS / Allen
 * Institute reconstruction the rest of the site uses, AND so OrbitControls
 * stay live: kids drag, pinch, and spin the 3D themselves; nothing
 * auto-advances. Tap the › chevron next to the dots to move on.
 */

const ZOOM_ACTIVITY = -1;

interface KgStage {
  zoom: number;
  text: string;
}

const KG_STAGES: KgStage[] = [
  { zoom: 0, text: "This is your brain." },
  { zoom: 1, text: "And this is a mouse's brain." },
  { zoom: 2, text: "Let's go inside." },
  { zoom: 4, text: "These are neurons." },
  { zoom: 5, text: "Just one tree." },
  { zoom: 6, text: "Where two trees almost touch…" },
  { zoom: 7, text: "…tiny lightning." },
  { zoom: ZOOM_ACTIVITY, text: "Watch your brain sparkle." },
];

export default function Kindergarten() {
  const [idx, setIdx] = useState(0);
  const [apFireToken, setApFireToken] = useState(0);

  const [activity, setActivity] = useState<{
    manifest: ActivityManifest;
    traces: ActivityTraces;
  } | null>(null);
  const [activityElapsed, setActivityElapsed] = useState(0);
  const activityFrameRef = useRef<number | null>(null);

  const stage = KG_STAGES[idx];
  const isLast = idx === KG_STAGES.length - 1;
  const isActivity = stage.zoom === ZOOM_ACTIVITY;
  // CSS filter to retone the violet/cyan hologram brain to warm gold.
  const isBrainStage = stage.zoom === 0 || stage.zoom === 1;

  useEffect(() => {
    let aborted = false;
    Promise.all([loadActivityManifest(), loadActivityTraces()])
      .then(([manifest, traces]) => {
        if (!aborted) setActivity({ manifest, traces });
      })
      .catch((err) => console.warn("[kindergarten] activity not loaded:", err));
    return () => { aborted = true; };
  }, []);

  useEffect(() => {
    if (!isActivity || !activity) return;
    let last: number | null = null;
    const tick = (now: number) => {
      if (last !== null) {
        const dt = (now - last) / 1000;
        setActivityElapsed((p) => {
          const next = p + dt;
          const total = activity.manifest.seconds;
          return next >= total ? next - total : next;
        });
      }
      last = now;
      activityFrameRef.current = requestAnimationFrame(tick);
    };
    activityFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (activityFrameRef.current) cancelAnimationFrame(activityFrameRef.current);
    };
  }, [isActivity, activity]);

  useEffect(() => {
    if (stage.zoom !== 7) return;
    setApFireToken((t) => t + 1);
    const interval = window.setInterval(() => setApFireToken((t) => t + 1), 4000);
    return () => window.clearInterval(interval);
  }, [stage.zoom]);

  function advance() { setIdx((i) => (i < KG_STAGES.length - 1 ? i + 1 : 0)); }
  function back() { setIdx((i) => (i > 0 ? i - 1 : i)); }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === " " || e.key === "Enter" || e.key === "ArrowRight") {
        e.preventDefault(); advance();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault(); back();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Tie-dye fades as we go deeper. Strong on stages 0-1, gone by stage 3.
  const tieDyeOpacity = idx <= 1 ? 1 : idx === 2 ? 0.55 : 0;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        userSelect: "none",
        background: "#04060c",
      }}
    >
      <RainbowTieDye opacity={tieDyeOpacity} />

      {/* The scene — real meshes (ZoomScene) for stages 0..7, calcium swarm
          (CellSwarm) for the activity finale. Brain stages get a CSS gold
          tint applied to the canvas; OrbitControls inside the canvas still
          handle drag/pinch/spin. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          filter: isBrainStage
            ? "grayscale(1) sepia(1) saturate(6) hue-rotate(8deg) brightness(1.35) contrast(1.05)"
            : "none",
          transition: "filter 1.2s ease-out",
        }}
      >
        {!isActivity && (
          <ZoomScene
            stage={stage.zoom}
            apFireToken={apFireToken}
            particleScale={0.6}
          />
        )}
        {isActivity && activity && (
          <CellSwarm
            manifest={activity.manifest}
            traces={activity.traces}
            elapsedSec={activityElapsed}
            className="absolute inset-0"
          />
        )}
        {isActivity && !activity && (
          <div className="absolute inset-0 flex items-center justify-center text-amber-200/65 text-sm uppercase tracking-[0.3em]">
            loading…
          </div>
        )}
      </div>

      <Caption text={stage.text} idx={idx} />
      <BottomBar
        idx={idx}
        count={KG_STAGES.length}
        isLast={isLast}
        onBack={back}
        onNext={advance}
      />
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Vibrant rainbow tie-dye — six saturated color blobs filling the screen,
 * slowly drifting + hue-rotating. Surface color (no screen-blend), so it
 * actually reads as rainbow rather than mute against the dark below.
 * Fades out by stage 3 so the cosmic dark of cortex takes over.
 * ------------------------------------------------------------------------- */
function RainbowTieDye({ opacity }: { opacity: number }) {
  return (
    <>
      <style>{`
        @keyframes kg-rainbow-drift {
          0%   { transform: scale(1.16) translate(-1.5%, -0.5%) rotate(0deg); }
          50%  { transform: scale(1.24) translate(1.5%, 0.5%)   rotate(6deg); }
          100% { transform: scale(1.16) translate(-1.5%, -0.5%) rotate(0deg); }
        }
        .kg-rainbow-base {
          position: absolute;
          inset: -10%;
          /* Hand-tuned per the brief:
             pink → golden yellow → teal green → light blue → dark blue
             → teal blue → light purple → magenta. No hue-rotate here —
             that animation would scramble the chosen palette. */
          background:
            radial-gradient(30% 26% at 20% 18%, #ff8fc8 0%, transparent 65%),  /* pink top-left */
            radial-gradient(28% 24% at 50% 12%, #ffcb55 0%, transparent 65%),  /* golden yellow top */
            radial-gradient(30% 26% at 82% 22%, #c89fff 0%, transparent 65%),  /* light purple top-right */
            radial-gradient(30% 26% at 10% 50%, #93d4ff 0%, transparent 65%),  /* light blue mid-left */
            radial-gradient(34% 30% at 50% 50%, #4fd9b3 0%, transparent 65%),  /* teal green center */
            radial-gradient(28% 24% at 90% 50%, #d84cb6 0%, transparent 65%),  /* magenta mid-right */
            radial-gradient(32% 28% at 22% 82%, #4fb6cc 0%, transparent 65%),  /* teal blue bottom-left */
            radial-gradient(32% 28% at 78% 84%, #2c4ed0 0%, transparent 65%),  /* dark blue bottom-right */
            linear-gradient(135deg, #ffd6e8 0%, #d6f0ff 45%, #d6e3ff 100%);
          animation: kg-rainbow-drift 42s ease-in-out infinite;
          will-change: transform;
        }
        /* Dark purple vignette frames the canvas — pulls the eye toward
           the brain at center. Transparent inside, deep purple at edges. */
        .kg-rainbow-vignette {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(78% 68% at 50% 50%, transparent 0%, transparent 55%, rgba(48, 14, 82, 0.45) 82%, rgba(26, 6, 50, 0.82) 100%);
          pointer-events: none;
        }
        /* Soft elliptical shadow behind the brain — gives the mesh
           something to "sit on" instead of floating. */
        .kg-brain-shadow {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(26% 20% at 50% 50%, rgba(20, 6, 40, 0.40) 0%, rgba(20, 6, 40, 0.18) 50%, transparent 78%);
          pointer-events: none;
        }
      `}</style>
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity,
          transition: "opacity 1.6s ease-out",
          pointerEvents: "none",
          zIndex: 0,
        }}
      >
        <div className="kg-rainbow-base" />
        <div className="kg-rainbow-vignette" />
        <div className="kg-brain-shadow" />
      </div>
    </>
  );
}

/* ---------------------------------------------------------------------------
 * Caption — kid-friendly text, fades + drifts up between stages.
 * ------------------------------------------------------------------------- */
function Caption({ text, idx }: { text: string; idx: number }) {
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: "14vh",
        display: "grid",
        placeItems: "center",
        zIndex: 200,
        pointerEvents: "none",
        padding: "0 6vw",
      }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0,  filter: "blur(0px)" }}
          exit={{    opacity: 0, y: -8, filter: "blur(6px)" }}
          transition={{ duration: 0.9, ease: [0.16, 0.8, 0.24, 1] }}
          style={{
            fontSize: "clamp(2.2rem, 5vw, 4.6rem)",
            fontWeight: 600,
            color: "#fff7e0",
            letterSpacing: "-0.01em",
            textAlign: "center",
            textShadow:
              "0 2px 24px rgba(0,0,0,0.85), 0 0 38px rgba(255, 200, 110, 0.35)",
            fontFamily: '"Fraunces", "Inter", system-ui, sans-serif',
          }}
        >
          {text}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Bottom bar: chevron back · progress dots · chevron next. The chevrons sit
 * flush with the dots — small, clearly tappable, never dominate the screen.
 * ------------------------------------------------------------------------- */
function BottomBar({
  idx,
  count,
  isLast,
  onBack,
  onNext,
}: {
  idx: number;
  count: number;
  isLast: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: "5vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: 18,
        zIndex: 250,
        pointerEvents: "none",
      }}
    >
      <ChevronButton direction="back" onClick={onBack} visible={idx > 0} />

      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        {Array.from({ length: count }).map((_, i) => (
          <span
            key={i}
            style={{
              width: i === idx ? 28 : 10,
              height: 10,
              borderRadius: 999,
              background:
                i === idx
                  ? "rgba(255, 235, 200, 0.92)"
                  : "rgba(255, 235, 200, 0.32)",
              transition: "all 600ms cubic-bezier(0.16,0.8,0.24,1)",
            }}
          />
        ))}
      </div>

      <ChevronButton direction="next" onClick={onNext} visible loop={isLast} />
    </div>
  );
}

function ChevronButton({
  direction,
  onClick,
  visible,
  loop = false,
}: {
  direction: "back" | "next";
  onClick: () => void;
  visible: boolean;
  loop?: boolean;
}) {
  const isNext = direction === "next";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={isNext ? (loop ? "Restart" : "Next") : "Back"}
      style={{
        width: 44,
        height: 44,
        borderRadius: 999,
        border: "none",
        background: "transparent",
        color: "rgba(255, 235, 200, 0.92)",
        cursor: "pointer",
        opacity: visible ? 1 : 0,
        transform: visible ? "scale(1)" : "scale(0.6)",
        transition: "opacity 280ms ease, transform 280ms cubic-bezier(0.16,0.8,0.24,1)",
        pointerEvents: visible ? "auto" : "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 32,
        lineHeight: 1,
        fontFamily: '"Fraunces", "Inter", system-ui, sans-serif',
      }}
      onPointerDown={(e) => { e.currentTarget.style.transform = "scale(0.85)"; }}
      onPointerUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
      onPointerLeave={(e) => { e.currentTarget.style.transform = visible ? "scale(1)" : "scale(0.6)"; }}
    >
      {isNext ? (loop ? "↻" : "›") : "‹"}
    </button>
  );
}

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useParams, useNavigate } from "react-router-dom";
import ZoomScene from "../components/ZoomScene";
import CellSwarm from "../components/CellSwarm";
import {
  loadActivityManifest,
  loadActivityTraces,
  type ActivityManifest,
  type ActivityTraces,
} from "../data/activityCells";
// Hand-curated legend for the cluster stage. Color-by-type: every
// pyramidal subtype shares one "Pyramidal neuron" entry, since they're
// all the same broad class even if the subtypes (L2/3, L5 thick-tufted,
// etc.) differ. Inhibitory subtypes get their own entries because
// each one does something genuinely different.
const CLUSTER_LEGEND: { color: string; label: string }[] = [
  { color: "#5b7cff", label: "Pyramidal neuron" },
  { color: "#b56fd8", label: "Parvalbumin basket cell" },
  { color: "#ffd24a", label: "Chandelier cell" },
  { color: "#3ee0bc", label: "Martinotti cell" },
  { color: "#ffae3e", label: "Bipolar interneuron" },
  { color: "#4a8bff", label: "Long-range axon" },
];

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span
        className="w-2 h-2 rounded-full"
        style={{ background: color, boxShadow: `0 0 8px ${color}aa` }}
      />
      {label}
    </span>
  );
}

const STAGES = [
  {
    eyebrow: "Stage 1 of 9",
    title: "Your brain",
    subtitle:
      "Every thought. Every memory and feeling. You happen here. In the beautiful human brain. About 86 billion cells, talking to each other in patterns we're only beginning to understand.",
  },
  {
    eyebrow: "Stage 2 of 9",
    title: "Next to a mouse brain",
    subtitle:
      "About 15 times smaller in every direction, roughly the volume of a peanut. Inside that peanut: 70 million neurons, connected by ~200 billion synapses. Mice are a key model organism, helping scientists uncover the principles that also shape the human brain. Drag to look around.",
  },
  {
    eyebrow: "Stage 3 of 9",
    title: "Inside the mouse brain",
    subtitle:
      "This is the mesh of an actual mouse brain from the Allen Institute. The dots inside are placeholders for some of the ~70 million neurons that live in here.",
  },
  {
    eyebrow: "Stage 4 of 9",
    title: "Primary visual cortex",
    subtitle:
      "Where the eye meets the brain. About a teaspoon of tissue at the back of the cortex, the first place signals from the retina turn into something the rest of the brain can use. Sight begins to become perception. The cells you'll meet next all came from this region.",
  },
  {
    eyebrow: "Stage 5 of 9",
    title: "A piece of cortex",
    subtitle:
      "MICrONS reconstructed about a cubic millimeter of this region. Inside that cube: roughly 200,000 cells (neurons + glia), wired together by ~523 million synapses. Ten of those cells are shown here, drag to look around.",
  },
  {
    eyebrow: "Stage 6 of 9",
    title: "A neuron",
    subtitle:
      "One cell. Thousands of connections. The upper branches, called dendrites, receive signals. The cell sends its own signals out through its axon, making synapses with other cells, which connect to more cells. Thus a neural network is born, representing reality and experience.",
  },
  {
    eyebrow: "Stage 7 of 9",
    title: "One synapse",
    subtitle:
      "An axon from a cell somewhere far away in the brain reaches up to form a synapse. It connects with the blue cell, a tufted pyramidal neuron that lives deep in cortex. The blue cell is excitatory: when it sends a signal out its own axon, it will encourage downstream cells to send their signals too.",
  },
  {
    eyebrow: "Stage 8 of 9",
    title: "Action potential",
    subtitle:
      "The signals neurons send are called action potentials. Watch the signal travel: a pulse races down the axon to the synapse, briefly flashes as it crosses, and then ignites a new pulse that travels down the pyramidal cell. This is one neuron, talking to the next. Your brain sends on the order of a quadrillion (1,000,000,000,000,000) electrical signals every second.",
  },
  {
    eyebrow: "Stage 9 of 9",
    title: "Activity",
    subtitle:
      "Now multiply that one signal by hundreds of cells, all firing at once. These are real pyramidal neurons from the MICrONS cubic millimeter dataset, glowing in time with their measured calcium activity while a mouse watched a movie. Drag to rotate.",
  },
];

export default function Explore() {
  // /explore/:stage (1-indexed) gives every stage its own shareable URL.
  // /explore alone defaults to stage 1. The local stage state and the URL
  // are kept in sync both ways: state→URL via replace() (so each click
  // doesn't pile up history) and URL→state (so browser back/forward and
  // address-bar edits work).
  const params = useParams<{ stage?: string }>();
  const navigate = useNavigate();
  const parseStage = (raw: string | undefined): number => {
    if (!raw) return 0;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? Math.max(0, Math.min(STAGES.length - 1, n - 1)) : 0;
  };
  const [stage, setStage] = useState(() => parseStage(params.stage));
  // Keep the URL in sync with the current stage (1-indexed). Use replace
  // so each click/keypress doesn't pile up history entries.
  useEffect(() => {
    const desired = `/explore/${stage + 1}`;
    if (window.location.pathname.replace(/\/$/, "").endsWith(desired)) return;
    navigate(desired, { replace: true });
  }, [stage, navigate]);
  // And keep the state in sync with the URL — covers browser back/forward
  // and someone editing the address bar by hand.
  useEffect(() => {
    const fromUrl = parseStage(params.stage);
    if (fromUrl !== stage) setStage(fromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.stage]);
  // Increments every time the user wants to (re)fire the AP animation
  // on stage 8. ZoomScene watches this token and starts a fresh cycle
  // when it changes; the first fire happens automatically on entry.
  const [apFireToken, setApFireToken] = useState(0);
  // Collapsed-text mode: hide title/subtitle so the 3D scene takes the
  // whole viewport. Mainly for mobile where the copy block was eating
  // half the screen. Toggled via a chevron button next to the controls;
  // expanding any new stage auto-shows the copy again so newcomers don't
  // have to know the toggle exists.
  const [textCollapsed, setTextCollapsed] = useState(false);
  // Presentation mode: hide nav chrome, push title + subtitle to the
  // bottom-right corner, condensed advance + progress on the bottom-right
  // edge. Designed for live demos where the 3D should fill the screen
  // and the talk-track sits subtle but readable. Toggled with the
  // present icon in the controls row, or by pressing "p".
  const [presentMode, setPresentMode] = useState(false);
  const last = STAGES.length - 1;
  const isActivityStage = stage === last;

  // Activity-stage data: lazy-loaded the first time the user reaches the
  // last slide. Same dataset the standalone /activity page uses.
  const [activityData, setActivityData] = useState<{
    manifest: ActivityManifest;
    traces: ActivityTraces;
  } | null>(null);
  const [activityElapsed, setActivityElapsed] = useState(0);
  useEffect(() => {
    if (!isActivityStage || activityData) return;
    let cancelled = false;
    Promise.all([loadActivityManifest(), loadActivityTraces()])
      .then(([manifest, traces]) => {
        if (!cancelled) setActivityData({ manifest, traces });
      })
      .catch((err) => console.warn("[explore] activity not loaded:", err));
    return () => { cancelled = true; };
  }, [isActivityStage, activityData]);
  useEffect(() => {
    if (!isActivityStage || !activityData) return;
    let prevTs: number | null = null;
    let frameId = 0;
    const tick = (now: number) => {
      if (prevTs !== null) {
        const dt = (now - prevTs) / 1000;
        setActivityElapsed((p) => {
          const total = activityData.manifest.seconds;
          const next = p + dt;
          return next >= total ? next - total : next;
        });
      }
      prevTs = now;
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [isActivityStage, activityData]);

  // Toggle a body class so NavBar (rendered outside this component) can
  // hide itself in presentation mode without needing a context Provider.
  // Cleanup also wipes the class on unmount so navigating away doesn't
  // leave the rest of the app in present-mode.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.toggle("present-mode", presentMode);
    return () => { document.body.classList.remove("present-mode"); };
  }, [presentMode]);

  // Keyboard arrows + presentation-mode toggle. Advancing or stepping
  // back also re-expands the text so the new stage's copy is visible.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "Enter") {
        setStage((s) => {
          const n = Math.min(last, s + 1);
          if (n !== s) setTextCollapsed(false);
          return n;
        });
      } else if (e.key === "ArrowLeft" || e.key === "Backspace") {
        setStage((s) => {
          const n = Math.max(0, s - 1);
          if (n !== s) setTextCollapsed(false);
          return n;
        });
      } else if (e.key === "p" || e.key === "P") {
        setPresentMode((p) => !p);
      } else if (e.key === "Escape") {
        setPresentMode(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [last]);

  const cur = STAGES[stage];
  const isLast = stage === last;

  return (
    <>
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(28,39,66,0.55) 0%, rgba(4,6,12,1) 70%)",
        }}
      />
      {/* Whisper-quiet violet halo behind the meshes — a subconscious sense
          of glow rather than a visible color cast. Centered slightly above
          mid-page where the mesh now sits after the look-at shifts. */}
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 38% 32% at 50% 38%, rgba(120, 80, 200, 0.10) 0%, rgba(120, 80, 200, 0.04) 45%, rgba(120, 80, 200, 0) 75%)",
        }}
      />

      {/* 3D scene fills the viewport behind the UI. Stage 9 swaps the
          synapse/AP scene for the calcium-activity swarm. */}
      <div className="fixed inset-0 z-[1]">
        {isActivityStage ? (
          activityData ? (
            <CellSwarm
              manifest={activityData.manifest}
              traces={activityData.traces}
              elapsedSec={activityElapsed}
              className="absolute inset-0"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-white/40 text-[11px] uppercase tracking-[0.3em]">
              loading swarm…
            </div>
          )
        ) : (
          <ZoomScene stage={stage} apFireToken={apFireToken} />
        )}
      </div>

      {/* Top vignette */}
      <div className="pointer-events-none fixed inset-x-0 top-0 h-48 z-[5] bg-gradient-to-b from-[var(--color-ink-950)] to-transparent" />
      {/* Bottom vignette — taller and stronger so the stage label sits clearly above the mesh */}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 h-[55vh] z-[5]"
        style={{
          background:
            "linear-gradient(to top, rgba(4,6,12,0.97) 0%, rgba(4,6,12,0.85) 30%, rgba(4,6,12,0.45) 65%, rgba(4,6,12,0) 100%)",
        }}
      />
      {/* Focused darkening directly behind the label area */}
      <div
        className="pointer-events-none fixed bottom-0 left-1/2 -translate-x-1/2 z-[5] w-[min(900px,90vw)] h-[420px]"
        style={{
          background:
            "radial-gradient(ellipse at center bottom, rgba(4,6,12,0.65) 0%, rgba(4,6,12,0.35) 45%, rgba(4,6,12,0) 80%)",
        }}
      />

      {/* `pointer-events-none` on the wrapper lets drag/scroll fall through to
          the canvas behind. Re-enabled on the actual interactive controls
          (progress dots + buttons) so users can still click/tap them. */}
      {/* Presentation-mode overlay: title + subtitle bottom-right, condensed
          advance button and progress on the bottom-right edge. The standard
          centered text + control row is hidden via `presentMode &&` below. */}
      {presentMode && (
        <div className="fixed bottom-6 right-6 z-30 pointer-events-auto max-w-[min(560px,46vw)] text-right">
          <AnimatePresence mode="wait">
            <motion.div
              key={stage}
              initial={{ opacity: 0, y: 14, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            >
              <p
                className="text-[10px] uppercase tracking-[0.4em] text-white/45 mb-2.5"
                style={{ textShadow: "0 1px 10px rgba(4,6,12,0.95)" }}
              >
                {cur.eyebrow}
              </p>
              <h2
                className="font-display font-light leading-[1.1]"
                style={{
                  fontSize: "clamp(1.5rem, 2.6vw, 2.4rem)",
                  textShadow: "0 2px 16px rgba(4,6,12,0.95)",
                }}
              >
                {cur.title}
              </h2>
              <p
                className="mt-3 text-white/75 font-light leading-relaxed"
                style={{
                  fontSize: "clamp(0.85rem, 1vw, 1rem)",
                  textShadow: "0 1px 12px rgba(4,6,12,0.95)",
                }}
              >
                {cur.subtitle}
              </p>
            </motion.div>
          </AnimatePresence>

          <div className="mt-5 flex items-center justify-end gap-3">
            {/* Compact progress bar */}
            <div className="flex items-center gap-2 w-[180px]">
              <span className="text-[9px] font-mono uppercase tracking-[0.25em] text-white/55 tabular-nums whitespace-nowrap">
                {String(stage + 1).padStart(2, "0")}
                <span className="text-white/25"> / {String(STAGES.length).padStart(2, "0")}</span>
              </span>
              <div className="relative h-[2px] flex-1">
                <div className="absolute inset-0 rounded-full bg-white/10" />
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${((stage + 1) / STAGES.length) * 100}%`,
                    background: "linear-gradient(90deg, rgba(142,218,255,0.7) 0%, rgba(142,218,255,1) 100%)",
                    boxShadow: "0 0 6px rgba(142, 218, 255, 0.55)",
                  }}
                />
              </div>
            </div>
            <button
              onClick={() => {
                setStage((s) => Math.max(0, s - 1));
                setTextCollapsed(false);
              }}
              disabled={stage === 0}
              className="p-2 rounded-full glass disabled:opacity-25 disabled:cursor-default hover:bg-white/[0.08] transition cursor-pointer"
              aria-label="Previous stage"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M13 8H3M7 4l-4 4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              onClick={() => {
                if (isLast) return;
                setStage((s) => Math.min(last, s + 1));
                setTextCollapsed(false);
              }}
              disabled={isLast}
              className="px-4 py-2 rounded-full glass-strong hover:bg-white/[0.08] transition flex items-center gap-2 cursor-pointer text-sm font-medium disabled:opacity-25 disabled:cursor-default"
              aria-label="Next stage"
            >
              <span>Next</span>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              onClick={() => setPresentMode(false)}
              className="p-2 rounded-full glass hover:bg-white/[0.08] transition cursor-pointer"
              aria-label="Exit presentation mode (Esc)"
              title="Exit presentation mode (Esc)"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Stage progress bar — compact, bottom-left. Cyan fill grows
          left-to-right as you advance; small clickable tick dots at each
          stage. Hidden in presentation mode (right-side bar replaces it). */}
      {!presentMode && (
      <div className="fixed bottom-5 left-6 z-30 pointer-events-auto flex items-center gap-3 w-[260px]">
        <span className="text-[9px] font-mono uppercase tracking-[0.25em] text-white/55 tabular-nums whitespace-nowrap">
          {String(stage + 1).padStart(2, "0")}
          <span className="text-white/25"> / {String(STAGES.length).padStart(2, "0")}</span>
        </span>
        <div className="relative h-[2px] flex-1">
          <div className="absolute inset-0 rounded-full bg-white/10" />
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${((stage + 1) / STAGES.length) * 100}%`,
              background: "linear-gradient(90deg, rgba(142,218,255,0.7) 0%, rgba(142,218,255,1) 100%)",
              boxShadow: "0 0 6px rgba(142, 218, 255, 0.55)",
            }}
          />
          {STAGES.map((_, i) => (
            <button
              key={i}
              onClick={() => setStage(i)}
              aria-label={`Go to stage ${i + 1}`}
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 flex items-center justify-center"
              style={{ left: `${(i / (STAGES.length - 1)) * 100}%` }}
            >
              <span
                className="block rounded-full transition-all duration-300"
                style={
                  i === stage
                    ? {
                        width: 7,
                        height: 7,
                        background: "#8edaff",
                        boxShadow: "0 0 7px rgba(142,218,255,0.95)",
                      }
                    : i < stage
                    ? { width: 3, height: 3, background: "rgba(142,218,255,0.7)" }
                    : { width: 3, height: 3, background: "rgba(255,255,255,0.18)" }
                }
              />
            </button>
          ))}
        </div>
      </div>
      )}

      <main className={`relative z-10 min-h-screen flex flex-col pointer-events-none ${presentMode ? "hidden" : ""}`}>

        {/* Stage label — centered low */}
        <div className="flex-1 flex flex-col justify-end pb-32 sm:pb-40 px-6">
          <div className="max-w-3xl mx-auto text-center">
            <AnimatePresence mode="wait">
              {!textCollapsed && (
                <motion.div
                  key={stage}
                  initial={{ opacity: 0, y: 20, filter: "blur(6px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -16, filter: "blur(6px)" }}
                  transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                >
                  <p
                    className="text-[11px] uppercase tracking-[0.4em] text-white/55 mb-4"
                    style={{ textShadow: "0 1px 12px rgba(4,6,12,0.95)" }}
                  >
                    {cur.eyebrow}
                  </p>
                  <h2
                    style={{
                      fontSize: "clamp(1.75rem, 4.5vw, 3.5rem)",
                      textShadow:
                        "0 2px 24px rgba(4,6,12,0.95), 0 0 12px rgba(4,6,12,0.85)",
                    }}
                    className="font-display font-light leading-[1.05]"
                  >
                    {cur.title}
                  </h2>
                  <p
                    style={{
                      fontSize: "clamp(0.95rem, 1.4vw, 1.2rem)",
                      textShadow: "0 1px 16px rgba(4,6,12,0.95)",
                    }}
                    className="mt-5 text-white/80 font-light leading-relaxed text-balance"
                  >
                    {cur.subtitle}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Controls — opt back into pointer events here, since the parent
                <main> is pointer-events-none to let canvas drag through.
                When the text is collapsed we lift the controls to sit closer
                to where the title block was, so they don't float in space. */}
            <div className={`flex items-center justify-center gap-3 pointer-events-auto ${textCollapsed ? "mt-0" : "mt-10"}`}>
              <button
                onClick={() => {
                  setStage((s) => Math.max(0, s - 1));
                  setTextCollapsed(false);
                }}
                disabled={stage === 0}
                className="p-2.5 rounded-full glass disabled:opacity-25 disabled:cursor-default hover:bg-white/[0.08] transition cursor-pointer"
                aria-label="Previous stage"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M13 8H3M7 4l-4 4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {/* On the AP stage (7), replay sits alongside the Next button
                  that advances to the activity finale. On the activity stage
                  (last), only the "Meet a neuron" CTA — the swarm auto-loops
                  on its own, no replay needed. */}
              {stage === 7 && (
                <button
                  onClick={() => setApFireToken((n) => n + 1)}
                  className="group px-5 py-2.5 rounded-full glass-strong hover:bg-white/[0.08] transition flex items-center gap-2 cursor-pointer text-sm font-medium"
                  style={{
                    boxShadow: "0 0 18px rgba(142,218,255,0.18), inset 0 0 0 1px rgba(142,218,255,0.25)",
                  }}
                  aria-label="Send action potential"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="transition-transform group-hover:scale-110">
                    <path d="M9 1L2 9h5l-1 6 7-8H8l1-6z" stroke="#8edaff" strokeWidth="1.4" strokeLinejoin="round" fill="rgba(142,218,255,0.18)" />
                  </svg>
                  <span className="whitespace-nowrap">Send action potential</span>
                </button>
              )}
              {!isLast ? (
                <button
                  onClick={() => {
                    setStage((s) => Math.min(last, s + 1));
                    setTextCollapsed(false);
                  }}
                  className="group px-6 py-2.5 rounded-full glass-strong hover:bg-white/[0.08] transition flex items-center gap-2.5 cursor-pointer text-sm font-medium"
                >
                  <span>
                    {stage === 0
                      ? "Explore"
                      : stage === 6
                      ? "Send signal"
                      : stage === 7
                      ? "Activity"
                      : "Closer"}
                  </span>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="transition-transform group-hover:translate-x-0.5">
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              ) : (
                <Link
                  to="/meet"
                  className="group px-6 py-2.5 rounded-full glass-strong hover:bg-white/[0.08] transition flex items-center gap-2.5 text-sm font-medium"
                >
                  <span className="whitespace-nowrap">Meet a neuron</span>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="transition-transform group-hover:translate-x-0.5">
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              )}

              {/* Collapse toggle — hides title/subtitle so the 3D scene
                  fills the screen. Tap again (or any nav action) brings
                  the copy back. */}
              <button
                onClick={() => setTextCollapsed((c) => !c)}
                className="p-2.5 rounded-full glass hover:bg-white/[0.08] transition cursor-pointer"
                aria-label={textCollapsed ? "Show description" : "Hide description"}
                title={textCollapsed ? "Show description" : "Hide description"}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ transform: textCollapsed ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.25s ease" }}>
                  <path d="M3 6l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {/* Presentation mode — full-screen, copy moves to bottom-right.
                  Press "p" to toggle anywhere; "Esc" exits. */}
              <button
                onClick={() => setPresentMode(true)}
                className="p-2.5 rounded-full glass hover:bg-white/[0.08] transition cursor-pointer"
                aria-label="Presentation mode (P)"
                title="Presentation mode (P)"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M2 3h12v8H2z M5 14h6 M8 11v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            {!textCollapsed && (
              <p className="mt-6 text-[10px] uppercase tracking-[0.3em] text-white/30">
                Use ← → keys
              </p>
            )}

            {/* Color legend — moved below the controls so it reads as a
                caption / footer rather than competing with the copy. Only
                shown on the cortex cluster + the synapse stage. */}
            {stage === 4 && (
              <div className="mt-8 flex items-center justify-center flex-wrap gap-x-4 gap-y-1.5 text-[10px] uppercase tracking-[0.16em] text-white/60">
                {CLUSTER_LEGEND.map((entry) => (
                  <LegendDot key={entry.label} color={entry.color} label={entry.label} />
                ))}
              </div>
            )}
            {(stage === 6 || stage === 7) && (
              <div className="mt-8 flex items-center justify-center flex-wrap gap-x-5 gap-y-1.5 text-[10px] uppercase tracking-[0.16em] text-white/60">
                <LegendDot color="#4a8bff" label="Pyramidal neuron" />
                <LegendDot color="#ffd24a" label="Axon" />
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}

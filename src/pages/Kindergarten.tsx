import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
  /** Optional second line shown smaller beneath the main caption. */
  subtitle?: string;
  /** When true, the cluster legend (color-key for cell types) is shown. */
  showLegend?: boolean;
}

const KG_STAGES: KgStage[] = [
  { zoom: 0, text: "This is your brain." },
  // Mouse-brain bridge stages (whole mouse brain → "let's go inside" → V1
  // highlight) intentionally removed. ZoomScene's camera lerps over the
  // multi-stage gap when zoom jumps 0 → 4, so the kid sees a single
  // continuous zoom-in from "your brain" straight onto the neuron cluster.
  {
    zoom: 4,
    text: "Neurons!",
    subtitle: "There are many types of cells in the brain, but neurons are the stars.",
    showLegend: true,
  },
  {
    zoom: 5,
    text: "One neuron.",
    subtitle: "Your brain contains 86 billion!",
  },
  {
    zoom: 6,
    text: "Synapse",
    subtitle: "Neurons connect and communicate through synapses.",
  },
  {
    zoom: 7,
    text: "Action potential!",
    subtitle: "The language of neurons, an electrical impulse that travels down a branch to zing other cells.",
  },
  // Same scene, different beat — the AP keeps firing in the background
  // while the kid lands on the wow-stat that gives it scale.
  {
    zoom: 7,
    text: "Neurons send signals faster than a cheetah runs!",
    subtitle: "Every second your brain sends a quadrillion action potentials, 1,000,000,000,000,000.",
  },
  { zoom: ZOOM_ACTIVITY, text: "Watch your brain sparkle." },
];

// Color/label key for the cluster stage — same colors as /explore so the
// meshes on screen match the legend exactly.
const CLUSTER_LEGEND: { color: string; label: string }[] = [
  { color: "#5b7cff", label: "Pyramidal neuron" },
  { color: "#b56fd8", label: "Basket cell" },
  { color: "#ffd24a", label: "Chandelier cell" },
  { color: "#3ee0bc", label: "Martinotti cell" },
  { color: "#ffae3e", label: "Bipolar interneuron" },
  { color: "#4a8bff", label: "Long-range axon" },
];

export default function Kindergarten() {
  // URL is the source of truth so teachers can share /kindergarten/3 etc.
  // and the page lands on that exact stage. Bare /kindergarten == stage 1.
  // params.stage is 1-indexed for human-readable share links; idx is 0-indexed
  // for the KG_STAGES array.
  const params = useParams<{ stage?: string }>();
  const navigate = useNavigate();
  const parsedStage = params.stage ? parseInt(params.stage, 10) : 1;
  const safeStage = Number.isFinite(parsedStage) && parsedStage >= 1 && parsedStage <= KG_STAGES.length
    ? parsedStage
    : 1;
  const idx = safeStage - 1;

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
  // CSS filter retones the violet/cyan hologram into a bright sky blue.
  // After dropping the mouse-brain bridge stages, only the human-brain
  // hero shot (zoom 0) gets the filter.
  const isBrainStage = stage.zoom === 0;

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

  // Pushing a new history entry per stage means teachers can share any
  // /kindergarten/N link AND the browser back button rewinds one stage
  // at a time. Wrapping past the last stage loops back to stage 1.
  function goTo(nextIdx: number) {
    const safe = Math.max(0, Math.min(KG_STAGES.length - 1, nextIdx));
    navigate(`/kindergarten/${safe + 1}`);
  }
  function advance() { goTo(idx < KG_STAGES.length - 1 ? idx + 1 : 0); }
  function back() { if (idx > 0) goTo(idx - 1); }

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
    // advance/back read `idx` from the closure — rebind when it changes
    // so the keyboard always navigates from the visible stage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  // Tie-dye only on the single remaining brain stage; CSS transition
  // (1.6s ease-out) handles the soft fade-out into the cluster scene.
  const tieDyeOpacity = idx === 0 ? 1 : 0;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        userSelect: "none",
        background: "#04060c",
        // Mobile/iPad: prevent double-tap zoom and tap-flash highlight on
        // chevrons. Drag-to-spin still works because OrbitControls listens
        // for pointer events directly on the canvas.
        touchAction: "manipulation",
        WebkitTapHighlightColor: "transparent",
        WebkitTouchCallout: "none",
        // Block iOS Safari pull-to-refresh / Android overscroll bounce —
        // the kid swiping down mid-presentation should not nuke the page.
        overscrollBehavior: "none",
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
            // Bright sky blue — lifted brightness + boosted saturation for
            // a kid-friendly "happy blue" instead of the dusty denim swatch.
            ? "hue-rotate(275deg) saturate(1.25) brightness(1.3)"
            : "none",
          transition: "filter 1.2s ease-out",
        }}
      >
        {!isActivity && (
          <ZoomScene
            stage={stage.zoom}
            apFireToken={apFireToken}
            particleScale={0.35}
            particleColor="#ffffff"
            particleHotColor="#ffffff"
            hideProgress
            studioLighting
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

      <Caption
        text={stage.text}
        subtitle={stage.subtitle}
        showLegend={stage.showLegend}
        idx={idx}
      />
      <BottomBar
        idx={idx}
        count={KG_STAGES.length}
        isLast={isLast}
        onBack={back}
        onNext={advance}
      />

      {/* Action-potential trigger — kids tap to fire the AP on demand. The
          auto-fire interval keeps running in the background so something is
          always happening, but the button gives them agency. */}
      {stage.zoom === 7 && (
        <ZapButton onFire={() => setApFireToken((t) => t + 1)} />
      )}

      {/* Attribution — small, sans-serif, only on the first and last slides. */}
      {(idx === 0 || isLast) && (
        <div
          style={{
            position: "absolute",
            // dvh = dynamic viewport height (Safari URL-bar safe). Fallback
            // to vh + safe-area inset for older iOS.
            bottom: "max(env(safe-area-inset-bottom, 0px) + 8px, 1.5dvh)",
            right: "max(env(safe-area-inset-right, 0px) + 12px, 2vw)",
            fontSize: 11,
            color: "rgba(255, 245, 220, 0.45)",
            fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif',
            letterSpacing: "0.02em",
            zIndex: 240,
            pointerEvents: "none",
            textAlign: "right",
            maxWidth: "min(70vw, 480px)",
          }}
        >
          Made by Amy Sterling for Sophia Sterling's Kindergarten Class · May 1, 2026
        </div>
      )}
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
        /* Undulating drift — wave-like S-curve in X and Y so the layer
           rolls instead of just scaling. Different keyframes per layer
           so they undulate out of sync (gas looking alive, not in lockstep). */
        @keyframes kg-undulate-a {
          0%   { transform: scale(1.18) translate(-2%, -1%); }
          25%  { transform: scale(1.22) translate(1.5%, -2%); }
          50%  { transform: scale(1.20) translate(2%, 1.5%); }
          75%  { transform: scale(1.24) translate(-1%, 2%); }
          100% { transform: scale(1.18) translate(-2%, -1%); }
        }
        @keyframes kg-undulate-b {
          0%   { transform: scale(1.20) translate(2%, 1%); }
          25%  { transform: scale(1.16) translate(-1.5%, 2%); }
          50%  { transform: scale(1.22) translate(-2%, -1.5%); }
          75%  { transform: scale(1.18) translate(1%, -2%); }
          100% { transform: scale(1.20) translate(2%, 1%); }
        }
        @keyframes kg-undulate-c {
          0%   { transform: scale(1.20) translate(0%, -1.5%) rotate(0deg); }
          50%  { transform: scale(1.24) translate(0.5%, 1.5%) rotate(3deg); }
          100% { transform: scale(1.20) translate(0%, -1.5%) rotate(0deg); }
        }
        /* Star twinkle — global opacity gentle pulse. */
        @keyframes kg-stars-twinkle {
          0%, 100% { opacity: 1;    }
          50%      { opacity: 0.55; }
        }
        /* Star-bloom breathing — the brain-as-star inhales/exhales light. */
        @keyframes kg-star-breathe {
          0%, 100% { opacity: 0.92; transform: scale(1);    }
          50%      { opacity: 1;    transform: scale(1.05); }
        }
        /* Nebula/galaxy: deep ink base + many large soft color clouds
           overlapping with screen-blend so they mix organically (not blocky
           crayon zones), an SVG turbulence layer on top for wispy gas
           texture, and tiny stars sprinkled across. */
        .kg-rainbow-bg {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(circle at 50% 55%, #1a0a3a 0%, #07021a 60%, #02000a 100%);
        }
        .kg-rainbow-base {
          position: absolute;
          inset: -15%;
          /* Soft, large, feathered clouds — no solid centers. Each cloud
             reaches max color at the very middle then gradually fades to
             transparent, so when they overlap (via screen blend) they
             blend like real gas, not stamp on each other. */
          background:
            radial-gradient(50% 45% at 18% 22%, rgba(255, 60, 150, 0.85) 0%, transparent 70%),  /* pink */
            radial-gradient(46% 40% at 50% 10%, rgba(255, 170, 30, 0.78) 0%, transparent 72%),  /* gold */
            radial-gradient(50% 44% at 84% 24%, rgba(140, 70, 255, 0.85) 0%, transparent 70%),  /* purple */
            radial-gradient(48% 42% at 8% 56%,  rgba(60, 170, 255, 0.85) 0%, transparent 72%),  /* light blue */
            radial-gradient(58% 50% at 52% 50%, rgba(40, 200, 140, 0.55) 0%, transparent 75%),  /* teal green soft center */
            radial-gradient(46% 40% at 92% 56%, rgba(220, 40, 170, 0.85) 0%, transparent 70%),  /* magenta */
            radial-gradient(52% 44% at 24% 88%, rgba(40, 160, 200, 0.85) 0%, transparent 72%),  /* teal blue */
            radial-gradient(54% 46% at 78% 92%, rgba(40, 70, 220, 0.85) 0%, transparent 72%);   /* dark blue */
          mix-blend-mode: screen;
          animation: kg-undulate-a 70s ease-in-out infinite;
          will-change: transform;
        }
        /* Wispy gas texture — fractalNoise SVG that shifts at low frequency.
           Multiplied at low opacity so it adds tendrils/swirls without
           dominating. Real nebulas are wispy; flat gradients are not. */
        .kg-rainbow-noise {
          position: absolute;
          inset: -20%;
          opacity: 0.55;
          mix-blend-mode: overlay;
          pointer-events: none;
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='600' height='600'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.012' numOctaves='3' seed='4'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1.4 -0.3'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
          background-size: cover;
          animation: kg-undulate-b 110s ease-in-out infinite;
        }
        /* Stars — tiny white dots scattered as a CSS background. Three
           layers at different sizes/distributions for parallax-y depth. */
        .kg-rainbow-stars {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background-image:
            radial-gradient(1.5px 1.5px at 12% 14%, rgba(255,255,255,0.95), transparent),
            radial-gradient(1px 1px at 26% 32%, rgba(255,255,255,0.85), transparent),
            radial-gradient(1.5px 1.5px at 44% 18%, rgba(255,255,255,0.95), transparent),
            radial-gradient(1px 1px at 60% 28%, rgba(255,255,255,0.7), transparent),
            radial-gradient(2px 2px at 78% 12%, rgba(255,250,220,0.95), transparent),
            radial-gradient(1px 1px at 88% 36%, rgba(255,255,255,0.8), transparent),
            radial-gradient(1.5px 1.5px at 8% 58%, rgba(255,255,255,0.85), transparent),
            radial-gradient(1px 1px at 22% 72%, rgba(255,255,255,0.7), transparent),
            radial-gradient(1.5px 1.5px at 38% 86%, rgba(255,250,220,0.9), transparent),
            radial-gradient(1px 1px at 54% 64%, rgba(255,255,255,0.7), transparent),
            radial-gradient(2px 2px at 70% 78%, rgba(255,255,255,0.95), transparent),
            radial-gradient(1px 1px at 84% 84%, rgba(255,255,255,0.7), transparent),
            radial-gradient(1.5px 1.5px at 96% 64%, rgba(255,250,220,0.9), transparent),
            radial-gradient(1px 1px at 4% 38%, rgba(255,255,255,0.7), transparent),
            radial-gradient(1px 1px at 32% 6%, rgba(255,255,255,0.7), transparent);
          background-size: 100% 100%;
          animation: kg-stars-twinkle 7s ease-in-out infinite;
        }
        /* Dark purple vignette — pulls the corners deep so center stage
           is the brain. Stronger than before to support "darker background". */
        .kg-rainbow-vignette {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(78% 68% at 50% 50%, transparent 0%, transparent 50%, rgba(20, 6, 40, 0.55) 78%, rgba(8, 2, 20, 0.92) 100%);
          pointer-events: none;
        }
        /* Star-bloom behind the brain — the brain becomes the radiant
           heart of the nebula. Two layered halos: a tight warm core that
           sells "this thing is emitting light" and a soft outer haze that
           bathes the surrounding gas in a warmer key. */
        .kg-brain-shadow {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(11% 9% at 50% 48%, rgba(255, 235, 150, 0.95) 0%, rgba(255, 200, 80, 0.55) 30%, rgba(255, 160, 40, 0.18) 60%, transparent 80%),
            radial-gradient(36% 30% at 50% 48%, rgba(255, 200, 100, 0.32) 0%, rgba(255, 170, 60, 0.10) 50%, transparent 78%);
          pointer-events: none;
          mix-blend-mode: screen;
          animation: kg-star-breathe 6s ease-in-out infinite;
        }
        /* Galactic dust band — a sweeping diagonal of denser gas, like
           the Milky Way's plane or the warm shoulder of a Hubble nebula. */
        .kg-rainbow-band {
          position: absolute;
          inset: -20%;
          background:
            linear-gradient(112deg,
              transparent 0%,
              transparent 28%,
              rgba(255, 100, 180, 0.18) 38%,
              rgba(180, 90, 255, 0.28) 48%,
              rgba(80, 130, 255, 0.22) 58%,
              transparent 70%,
              transparent 100%);
          mix-blend-mode: screen;
          filter: blur(40px);
          animation: kg-undulate-c 130s ease-in-out infinite;
          will-change: transform;
        }
        /* Second turbulence pass at higher frequency — fine wisps + tendrils
           on top of the broad gas blobs, so the eye reads "structure" not
           "smooth gradient." */
        .kg-rainbow-wisps {
          position: absolute;
          inset: -25%;
          opacity: 0.4;
          mix-blend-mode: soft-light;
          pointer-events: none;
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='800'><filter id='w'><feTurbulence type='fractalNoise' baseFrequency='0.04' numOctaves='2' seed='9'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1.6 -0.4'/></filter><rect width='100%' height='100%' filter='url(%23w)'/></svg>");
          background-size: cover;
          animation: kg-undulate-b 95s ease-in-out infinite reverse;
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
        <div className="kg-rainbow-bg" />
        <div className="kg-rainbow-base" />
        <div className="kg-rainbow-band" />
        <div className="kg-rainbow-noise" />
        <div className="kg-rainbow-wisps" />
        <div className="kg-rainbow-stars" />
        <div className="kg-rainbow-vignette" />
        <div className="kg-brain-shadow" />
      </div>
    </>
  );
}

/* ---------------------------------------------------------------------------
 * Caption — kid-friendly text, fades + drifts up between stages.
 * ------------------------------------------------------------------------- */
function Caption({
  text,
  subtitle,
  showLegend,
  idx,
}: {
  text: string;
  subtitle?: string;
  showLegend?: boolean;
  idx: number;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        // dvh keeps the caption fixed against the actual visible viewport
        // on iOS Safari instead of jumping when the URL bar shows/hides.
        bottom: "12dvh",
        display: "grid",
        placeItems: "center",
        zIndex: 200,
        pointerEvents: "none",
        padding: "0 5vw",
      }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0,  filter: "blur(0px)" }}
          exit={{    opacity: 0, y: -8, filter: "blur(6px)" }}
          transition={{ duration: 0.9, ease: [0.16, 0.8, 0.24, 1] }}
          style={{ textAlign: "center", maxWidth: "min(90vw, 920px)" }}
        >
          <div
            style={{
              fontSize: "clamp(2.2rem, 5vw, 4.6rem)",
              fontWeight: 600,
              color: "#fff7e0",
              letterSpacing: "-0.01em",
              textShadow:
                "0 2px 24px rgba(0,0,0,0.85), 0 0 38px rgba(255, 200, 110, 0.35)",
              fontFamily: '"Fraunces", "Inter", system-ui, sans-serif',
            }}
          >
            {text}
          </div>
          {subtitle && (
            <div
              style={{
                marginTop: "0.5em",
                fontSize: "clamp(0.95rem, 1.5vw, 1.3rem)",
                fontWeight: 400,
                color: "rgba(255, 247, 224, 0.78)",
                fontFamily: '"Fraunces", "Inter", system-ui, sans-serif',
                textShadow: "0 1px 12px rgba(0,0,0,0.7)",
              }}
            >
              {subtitle}
            </div>
          )}
          {showLegend && (
            <div
              style={{
                marginTop: "1em",
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "center",
                alignItems: "center",
                gap: "6px 16px",
                fontSize: "clamp(11px, 1vw, 13px)",
                color: "rgba(255, 247, 224, 0.85)",
                fontFamily: 'Inter, system-ui, sans-serif',
              }}
            >
              {CLUSTER_LEGEND.map((item) => (
                <span
                  key={item.label}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    whiteSpace: "nowrap",
                  }}
                >
                  <span
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: 999,
                      background: item.color,
                      boxShadow: `0 0 8px ${item.color}99`,
                    }}
                  />
                  {item.label}
                </span>
              ))}
            </div>
          )}
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
        // Lift above iPhone home-indicator + iOS Safari URL bar.
        bottom: "max(env(safe-area-inset-bottom, 0px) + 16px, 4dvh)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: 14,
        zIndex: 250,
        pointerEvents: "none",
      }}
    >
      <ChevronButton direction="back" onClick={onBack} visible={idx > 0} />

      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
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

/* ---------------------------------------------------------------------------
 * ZapButton — kid-tappable lightning bolt that fires one extra action
 * potential per tap. Sits above the progress dots on the AP stages. The
 * pulse animation telegraphs "tap me"; an inline press transform replaces
 * the animation while the finger is down so the press lands with weight.
 * ------------------------------------------------------------------------- */
function ZapButton({ onFire }: { onFire: () => void }) {
  const idle = "kg-zap-pulse 2.4s ease-in-out infinite";
  return (
    <>
      <style>{`
        @keyframes kg-zap-pulse {
          0%, 100% {
            transform: translate(-50%, 0) scale(1);
            box-shadow:
              0 6px 28px rgba(255, 200, 80, 0.42),
              0 0 50px rgba(255, 180, 40, 0.30);
          }
          50% {
            transform: translate(-50%, 0) scale(1.06);
            box-shadow:
              0 10px 38px rgba(255, 220, 100, 0.65),
              0 0 76px rgba(255, 200, 60, 0.50);
          }
        }
      `}</style>
      <button
        type="button"
        onClick={onFire}
        aria-label="Fire an action potential"
        style={{
          position: "absolute",
          bottom: "22dvh",
          left: "50%",
          transform: "translate(-50%, 0)",
          width: 92,
          height: 92,
          borderRadius: 999,
          border: "2.5px solid rgba(255, 235, 130, 0.95)",
          background:
            "radial-gradient(circle at 50% 35%, rgba(255, 245, 170, 0.98) 0%, rgba(255, 185, 50, 0.72) 65%, rgba(255, 130, 0, 0.45) 100%)",
          color: "#2a1400",
          cursor: "pointer",
          zIndex: 220,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          animation: idle,
          touchAction: "manipulation",
          WebkitTapHighlightColor: "transparent",
          padding: 0,
        }}
        onPointerDown={(e) => {
          e.currentTarget.style.animation = "none";
          e.currentTarget.style.transform = "translate(-50%, 0) scale(0.88)";
        }}
        onPointerUp={(e) => {
          e.currentTarget.style.transform = "translate(-50%, 0) scale(1)";
          e.currentTarget.style.animation = idle;
        }}
        onPointerLeave={(e) => {
          e.currentTarget.style.transform = "translate(-50%, 0) scale(1)";
          e.currentTarget.style.animation = idle;
        }}
      >
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M11 15H6l7-14v8h5l-7 14v-8z" />
        </svg>
      </button>
    </>
  );
}

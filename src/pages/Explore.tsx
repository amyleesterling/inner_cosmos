import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import ZoomScene from "../components/ZoomScene";
// Hand-curated legend for the cluster stage. Color-by-type: every
// pyramidal subtype shares one "Pyramidal neuron" entry, since they're
// all the same broad class even if the subtypes (L2/3, L5 thick-tufted,
// etc.) differ. Inhibitory subtypes get their own entries because
// each one does something genuinely different.
const CLUSTER_LEGEND: { color: string; label: string }[] = [
  { color: "#5fb8ff", label: "Pyramidal neuron" },
  { color: "#ffd24a", label: "Layer 4 cell" },
  { color: "#ff6dc4", label: "Parvalbumin basket cell" },
  { color: "#d56dff", label: "Chandelier cell" },
  { color: "#5fe07a", label: "Martinotti cell" },
  { color: "#ff9f3e", label: "Bipolar interneuron" },
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
    eyebrow: "Stage 1 of 7",
    title: "Your brain.",
    subtitle:
      "Every thought, every memory, every feeling — happens in here. About 86 billion cells, talking to each other in patterns we're only beginning to understand.",
  },
  {
    eyebrow: "Stage 2 of 7",
    title: "Next to a mouse brain.",
    subtitle:
      "About 15 times smaller in every direction, roughly the volume of a peanut. Inside that peanut: 70 million neurons, connected by ~200 billion synapses. Mice are a key model organism, helping scientists uncover the principles that also shape the human brain. Drag to look around.",
  },
  {
    eyebrow: "Stage 3 of 7",
    title: "Inside the mouse brain.",
    subtitle:
      "This is the mesh of an actual mouse brain from the Allen Institute. The dots inside are placeholders for some of the ~70 million neurons that live in here.",
  },
  {
    eyebrow: "Stage 4 of 7",
    title: "Primary visual cortex.",
    subtitle:
      "Where the eye meets the brain. About a teaspoon of tissue at the back of the cortex, the first place signals from the retina turn into something the rest of the brain can use. Sight begins to become perception. The cells you'll meet next all came from this region.",
  },
  {
    eyebrow: "Stage 5 of 7",
    title: "A piece of cortex.",
    subtitle:
      "MICrONS reconstructed about a cubic millimeter of this region. Inside that cube: roughly 200,000 cells (neurons + glia), wired together by ~523 million synapses. Ten of those cells are shown here, drag to look around.",
  },
  {
    eyebrow: "Stage 6 of 7",
    title: "A neuron.",
    subtitle:
      "One cell. Thousands of connections. The upper branches, called dendrites, receive signals. The cell sends its own signals out through its axon, making synapses with other cells, which connect to more cells. Thus a neural network is born, representing reality and experience.",
  },
  {
    eyebrow: "Stage 7 of 7",
    title: "One synapse.",
    subtitle:
      "An axon from a cell somewhere far away in the brain reaches up to form a synapse. It connects with the blue cell, a tufted pyramidal neuron that lives deep in cortex. The blue cell is excitatory: when it sends a signal out its own axon, it will encourage downstream cells to send their signals too. The whole contact is the size of a few hundred nanometers.",
  },
];

export default function Explore() {
  const [stage, setStage] = useState(0);
  const last = STAGES.length - 1;

  // Keyboard arrows
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "Enter") {
        setStage((s) => Math.min(last, s + 1));
      } else if (e.key === "ArrowLeft" || e.key === "Backspace") {
        setStage((s) => Math.max(0, s - 1));
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

      {/* 3D scene fills the viewport behind the UI */}
      <div className="fixed inset-0 z-[1]">
        <ZoomScene stage={stage} />
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
      <main className="relative z-10 min-h-screen flex flex-col pointer-events-none">
        {/* Stage progress dots */}
        <div className="pt-28 flex items-center justify-center gap-2 pointer-events-auto">
          {STAGES.map((_, i) => (
            <button
              key={i}
              onClick={() => setStage(i)}
              aria-label={`Go to stage ${i + 1}`}
              className={`h-1 rounded-full transition-all duration-700 ${
                i === stage
                  ? "w-12 bg-white/85"
                  : i < stage
                  ? "w-6 bg-white/45 hover:bg-white/65"
                  : "w-6 bg-white/15 hover:bg-white/35"
              }`}
            />
          ))}
        </div>

        {/* Stage label — centered low */}
        <div className="flex-1 flex flex-col justify-end pb-32 sm:pb-40 px-6">
          <div className="max-w-3xl mx-auto text-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={stage}
                initial={{ opacity: 0, y: 20, filter: "blur(6px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -16, filter: "blur(6px)" }}
                transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
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
            </AnimatePresence>

            {/* Color legend — only on the cortex-cluster stage. One entry
                per cell-type category; pyramidal subtypes share a color. */}
            {stage === 4 && (
              <div className="mt-6 flex items-center justify-center flex-wrap gap-x-4 gap-y-1.5 text-[10px] uppercase tracking-[0.16em] text-white/60">
                {CLUSTER_LEGEND.map((entry) => (
                  <LegendDot key={entry.label} color={entry.color} label={entry.label} />
                ))}
              </div>
            )}
            {/* Synapse-stage legend — tiny 2-entry caption naming the axon
                and the cell it's contacting. */}
            {stage === 6 && (
              <div className="mt-6 flex items-center justify-center flex-wrap gap-x-5 gap-y-1.5 text-[10px] uppercase tracking-[0.16em] text-white/60">
                <LegendDot color="#4a8bff" label="Pyramidal neuron" />
                <LegendDot color="#ffd24a" label="Axon" />
                <LegendDot color="#ff5edc" label="Synapse" />
              </div>
            )}

            {/* Controls — opt back into pointer events here, since the parent
                <main> is pointer-events-none to let canvas drag through. */}
            <div className="mt-10 flex items-center justify-center gap-3 pointer-events-auto">
              <button
                onClick={() => setStage((s) => Math.max(0, s - 1))}
                disabled={stage === 0}
                className="p-2.5 rounded-full glass disabled:opacity-25 disabled:cursor-default hover:bg-white/[0.08] transition cursor-pointer"
                aria-label="Previous stage"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M13 8H3M7 4l-4 4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {!isLast ? (
                <button
                  onClick={() => setStage((s) => Math.min(last, s + 1))}
                  className="group px-6 py-2.5 rounded-full glass-strong hover:bg-white/[0.08] transition flex items-center gap-2.5 cursor-pointer text-sm font-medium"
                >
                  <span>{stage === 0 ? "Explore" : "Closer"}</span>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="transition-transform group-hover:translate-x-0.5">
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              ) : (
                <Link
                  to="/meet"
                  className="group px-6 py-2.5 rounded-full glass-strong hover:bg-white/[0.08] transition flex items-center gap-2.5 text-sm font-medium"
                >
                  <span>Meet a neuron</span>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="transition-transform group-hover:translate-x-0.5">
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              )}
            </div>

            <p className="mt-6 text-[10px] uppercase tracking-[0.3em] text-white/30">
              Use ← → keys
            </p>
          </div>
        </div>
      </main>
    </>
  );
}

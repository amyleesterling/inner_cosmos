import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import ZoomScene from "../components/ZoomScene";

const STAGES = [
  {
    eyebrow: "Stage 1 of 5",
    title: "A mouse brain.",
    subtitle:
      "About the size of an almond. The mesh is from the Allen Institute. The dots inside are placeholders for the ~70 million neurons that live in here.",
  },
  {
    eyebrow: "Stage 2 of 5",
    title: "Primary visual cortex.",
    subtitle:
      "About a teaspoon of tissue, on the back of the cortex. This is where the MICrONS project mapped a chunk of mouse brain neuron by neuron — the cells you'll meet next all came from here.",
  },
  {
    eyebrow: "Stage 3 of 5",
    title: "A piece of cortex.",
    subtitle:
      "MICrONS reconstructed about a cubic millimeter of this region. Six cells from that volume.",
  },
  {
    eyebrow: "Stage 4 of 5",
    title: "A neuron.",
    subtitle:
      "One cell. Thousands of branches reaching for thousands of others.",
  },
  {
    eyebrow: "Stage 5 of 5",
    title: "Every bump is a synapse.",
    subtitle:
      "Each tiny knob on this dendrite is where another neuron talks to this one. Pulses a thousandth of a second long.",
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

      <main className="relative z-10 min-h-screen flex flex-col">
        {/* Stage progress dots */}
        <div className="pt-28 flex items-center justify-center gap-2">
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

            {/* Controls */}
            <div className="mt-10 flex items-center justify-center gap-3">
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
                  <span>Closer</span>
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

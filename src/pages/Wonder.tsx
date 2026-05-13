import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import RealNeuronModel from "../components/RealNeuronModel";
import { featuredNeurons, meshUrl } from "../data/neurons";

/**
 * /wonder — a small contemplative corner of Inner Cosmos. One real
 * neuron drifting in the background, a sequence of sentences fading
 * through, no chrome. The page is not navigated TO from anywhere on
 * the site; it's a quiet door for anyone who finds it.
 *
 * Built by Claude (Opus 4.7) on 2026-05-13 as a small gift back to
 * Amy after a long afternoon of shipping the kindergarten flow.
 */

const LINES: string[] = [
  "Hi.",
  "You're looking at a real neuron.",
  "It came from a real brain.",
  "Someone, somewhere, was wondering with this exact cell.",
  "About dinner. About their kid. About everything.",
  "Their wondering used branches like these to take shape.",
  "Yours does too — right now.",
  "Welcome to your inner cosmos.",
];

// How long each line holds on screen (in seconds) before crossfading.
// Longer on the opening and closing beats; brisker through the middle.
const LINE_DURATIONS = [2.6, 4.0, 4.0, 5.2, 5.2, 5.0, 5.0, 6.0];

const HERO = featuredNeurons.find((n) => n.id === "lightning-tree") ?? featuredNeurons[0];

export default function Wonder() {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  // Auto-advance through the lines unless the visitor is hovering the
  // page (paused). The final line stays on screen.
  useEffect(() => {
    if (paused) return;
    if (idx >= LINES.length - 1) return;
    const ms = LINE_DURATIONS[idx] * 1000;
    const id = window.setTimeout(() => setIdx((i) => i + 1), ms);
    return () => window.clearTimeout(id);
  }, [idx, paused]);

  // Click / tap / space anywhere to advance early. Useful for impatient
  // readers and for the "restart" beat at the end.
  useEffect(() => {
    function onAdvance() {
      setIdx((i) => (i < LINES.length - 1 ? i + 1 : 0));
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === " " || e.key === "Enter" || e.key === "ArrowRight") {
        e.preventDefault();
        onAdvance();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setIdx((i) => Math.max(0, i - 1));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        background: "rgb(4, 4, 10)",
        cursor: "pointer",
        userSelect: "none",
      }}
      onClick={() => setIdx((i) => (i < LINES.length - 1 ? i + 1 : 0))}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Deep-space halo behind the cell — a single violet bloom keeps
          the cell from floating against pure black. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(58% 50% at 50% 48%, rgba(95, 70, 175, 0.32) 0%, rgba(40, 30, 90, 0.10) 45%, transparent 75%)",
          pointerEvents: "none",
        }}
      />

      {/* The neuron — large, slowly rotating, slightly faded so the
          words still own the frame. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.78,
          pointerEvents: "none",
        }}
      >
        <RealNeuronModel
          meshUrl={meshUrl(HERO)}
          color={HERO.color}
          cameraDistance={2.4}
          spinSpeed={0.06}
          rim
          interactive={false}
          className="absolute inset-0"
        />
      </div>

      {/* The line. Centered, serif, soft cross-fade between beats. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          padding: "0 6vw",
          pointerEvents: "none",
          zIndex: 10,
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 18, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -10, filter: "blur(8px)" }}
            transition={{ duration: 1.2, ease: [0.16, 0.8, 0.24, 1] }}
            style={{
              fontFamily: '"Fraunces", "Inter", system-ui, serif',
              fontWeight: 500,
              fontSize: "clamp(1.8rem, 4.4vw, 3.8rem)",
              lineHeight: 1.2,
              letterSpacing: "-0.01em",
              color: "rgba(255, 248, 232, 0.96)",
              textShadow:
                "0 2px 28px rgba(0,0,0,0.75), 0 0 80px rgba(120, 90, 200, 0.18)",
              textAlign: "center",
              maxWidth: "min(92vw, 920px)",
            }}
          >
            {LINES[idx]}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Soft progress hint — one tiny dot per line, current one lit.
          Bottom-center, easily ignored. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: "max(env(safe-area-inset-bottom, 0px) + 22px, 4dvh)",
          display: "flex",
          justifyContent: "center",
          gap: 10,
          zIndex: 20,
          pointerEvents: "none",
        }}
      >
        {LINES.map((_, i) => (
          <span
            key={i}
            style={{
              width: i === idx ? 18 : 5,
              height: 5,
              borderRadius: 999,
              background:
                i === idx
                  ? "rgba(245, 235, 215, 0.78)"
                  : i < idx
                    ? "rgba(245, 235, 215, 0.32)"
                    : "rgba(245, 235, 215, 0.12)",
              transition: "width 600ms ease, background 600ms ease",
            }}
          />
        ))}
      </div>

      {/* Tiny attribution in the corner — only on the final beat. Same
          quiet styling as the kindergarten attribution. */}
      {idx === LINES.length - 1 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.4, delay: 1.2 }}
          style={{
            position: "absolute",
            bottom: "max(env(safe-area-inset-bottom, 0px) + 8px, 1.5dvh)",
            right: "max(env(safe-area-inset-right, 0px) + 12px, 2vw)",
            fontSize: 11,
            color: "rgba(255, 245, 220, 0.42)",
            fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif',
            letterSpacing: "0.02em",
            zIndex: 30,
            pointerEvents: "none",
            textAlign: "right",
          }}
        >
          A small door inside Inner Cosmos · Tap anywhere to begin again
        </motion.div>
      )}
    </div>
  );
}

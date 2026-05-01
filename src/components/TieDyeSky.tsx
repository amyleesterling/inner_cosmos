/**
 * Tie-dye background for /kindergarten.
 *
 * Five large radial-gradient blobs in saturated picture-book colors, slowly
 * drifting + scaling on out-of-sync animations so the sky is never still.
 * An SVG turbulence overlay underneath gives the soft cloth-fold texture
 * tie-dye actually has — without it, the gradients alone read as "cheerful
 * gradient" not "tie-dye."
 *
 * `opacity` lets the parent fade the entire sky as the kid falls inward
 * (the brief: tie-dye dims and warms as we go deeper; eventually we're
 * past color, past surface).
 */
interface Props {
  /** 0..1. Multiplied with the inner base opacity. */
  opacity?: number;
  className?: string;
}

const BLOBS: Array<{
  color: string;
  top: string;
  left: string;
  size: string;
  delay: string;
}> = [
  { color: "#ff6fb1", top: "-10%", left: "-5%", size: "70vmax", delay: "0s" },     // hot pink
  { color: "#ffd86b", top: "10%", left: "55%", size: "65vmax", delay: "-7s" },     // gold
  { color: "#7ee7c4", top: "55%", left: "-15%", size: "75vmax", delay: "-14s" },   // mint
  { color: "#8aa6ff", top: "60%", left: "60%", size: "70vmax", delay: "-21s" },    // sky
  { color: "#c89bff", top: "30%", left: "30%", size: "60vmax", delay: "-28s" },    // lavender
  { color: "#ff9b6b", top: "-5%", left: "35%", size: "55vmax", delay: "-35s" },    // coral
];

export default function TieDyeSky({ opacity = 1, className = "" }: Props) {
  return (
    <div
      className={`pointer-events-none ${className}`}
      style={{
        opacity,
        transition: "opacity 600ms ease-out",
      }}
    >
      {/* Warm parchment base — the color the gradients fold into. */}
      <div
        className="absolute inset-0"
        style={{ background: "#fff5e3" }}
      />

      {/* Color blobs — each its own absolute element so we can independently
          drift/scale them on different cycles. blur-3xl = ~64px feathering
          which is what makes them blend instead of looking like spotlights. */}
      {BLOBS.map((b, i) => (
        <div
          key={i}
          className="absolute rounded-full blur-3xl"
          style={{
            top: b.top,
            left: b.left,
            width: b.size,
            height: b.size,
            background: `radial-gradient(circle at center, ${b.color} 0%, ${b.color}cc 25%, ${b.color}66 55%, transparent 75%)`,
            mixBlendMode: "multiply",
            animation: `tiedye-drift 42s ease-in-out infinite`,
            animationDelay: b.delay,
            opacity: 0.92,
          }}
        />
      ))}

      {/* SVG turbulence — gives the field that swirly fabric-fold quality.
          Without it, the blobs alone are too smooth; with it, the eye reads
          'tie-dye' instead of 'gradient.' Kept at very low opacity so it
          adds texture without fighting the colors. */}
      <svg
        className="absolute inset-0 w-full h-full mix-blend-overlay"
        style={{ opacity: 0.35 }}
        aria-hidden
      >
        <filter id="tiedye-noise">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.012"
            numOctaves="3"
            seed="7"
          >
            <animate
              attributeName="baseFrequency"
              values="0.012;0.018;0.012"
              dur="60s"
              repeatCount="indefinite"
            />
          </feTurbulence>
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 1
                    0 0 0 0 1
                    0 0 0 0 1
                    0 0 0 1.2 0"
          />
        </filter>
        <rect width="100%" height="100%" filter="url(#tiedye-noise)" />
      </svg>

      {/* Soft inner darkening so the golden brain reads against the sky.
          A whisper, not a vignette — just enough to keep highlights popping. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 75% 55% at center, rgba(80,50,30,0.10) 0%, rgba(80,50,30,0) 70%)",
        }}
      />

      <style>{`
        @keyframes tiedye-drift {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25%      { transform: translate(2vmax, -3vmax) scale(1.08); }
          50%      { transform: translate(-2vmax, 2vmax) scale(0.95); }
          75%      { transform: translate(3vmax, 1vmax) scale(1.05); }
        }
      `}</style>
    </div>
  );
}

/**
 * Neuron-shaped SVG loader. The dendrites trace themselves in repeatedly
 * while the swarm streams in; the soma breathes; a thin progress bar
 * underneath reports the byte-level state.
 *
 * Pure SVG + CSS keyframes (declared in src/index.css) — no canvas, no
 * framer-motion. Cheap to render and scales to any size.
 */
interface Props {
  /** Cells loaded so far. */
  loaded?: number;
  /** Total cells expected. When 0, we show an indeterminate loader. */
  total?: number;
  /** Optional caption shown above the percentage. */
  caption?: string;
  /** Tailwind colour for the strokes/glow. Default cyan-ish to match L2/3. */
  color?: string;
  /** Pixel size of the SVG glyph. */
  size?: number;
}

export default function NeuronLoader({
  loaded = 0,
  total = 0,
  caption,
  color = "#8edaff",
  size = 132,
}: Props) {
  const pct = total > 0 ? (loaded / total) * 100 : 0;
  const indeterminate = total === 0;

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 pointer-events-none px-6">
      {/* Soft halo behind the neuron */}
      <div className="relative" style={{ width: size, height: size * 1.5 }}>
        <div
          className="absolute inset-0 rounded-full opacity-30 blur-[24px]"
          style={{ background: color }}
        />
        <svg
          viewBox="0 0 200 280"
          className="relative w-full h-full"
          style={{ color, filter: `drop-shadow(0 0 6px ${color})` }}
          aria-hidden="true"
        >
          {/* Apical dendrite trunk + tuft — the trunk reaches up to the
              cortical surface; the tuft splays out at the top, like a real
              Layer-5 pyramidal. Drawn with stroke-dasharray so it sketches
              itself in. */}
          <g
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="neuron-loader-strokes"
          >
            {/* main trunk */}
            <path d="M100 168 L100 60" />
            {/* tuft */}
            <path d="M100 60 L82 30" />
            <path d="M100 60 L118 30" />
            <path d="M100 60 L72 42" />
            <path d="M100 60 L128 42" />
            {/* apical side branches */}
            <path d="M100 88 L74 58" />
            <path d="M100 92 L126 62" />
            <path d="M100 116 L70 96" />
            <path d="M100 122 L130 102" />
          </g>

          {/* Basal dendrites — radiating outward from below the soma. */}
          <g
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.9"
            className="neuron-loader-strokes neuron-loader-strokes-basal"
          >
            <path d="M88 196 L52 218" />
            <path d="M112 196 L148 218" />
            <path d="M100 200 L82 252" />
            <path d="M100 200 L118 252" />
            <path d="M84 192 L40 196" />
            <path d="M116 192 L160 196" />
          </g>

          {/* Soma — gentle breathing pulse. */}
          <ellipse
            cx="100"
            cy="184"
            rx="13"
            ry="12"
            fill="currentColor"
            className="neuron-loader-soma"
          />
        </svg>
      </div>

      <div className="flex flex-col items-center gap-2">
        {caption && (
          <p className="text-[10px] uppercase tracking-[0.4em] text-white/45">
            {caption}
          </p>
        )}
        <div className="relative w-44 h-[2px] bg-white/10 rounded overflow-hidden">
          {indeterminate ? (
            <div
              className="absolute top-0 h-full w-1/3 rounded neuron-loader-bar-indeterminate"
              style={{ background: color, boxShadow: `0 0 12px ${color}` }}
            />
          ) : (
            <div
              className="absolute top-0 left-0 h-full rounded transition-all duration-300"
              style={{
                width: `${pct}%`,
                background: color,
                boxShadow: `0 0 12px ${color}`,
              }}
            />
          )}
        </div>
        {total > 0 && (
          <div className="text-[11px] tracking-[0.25em] uppercase text-white/55 font-mono tabular-nums">
            {loaded} / {total}
          </div>
        )}
      </div>
    </div>
  );
}

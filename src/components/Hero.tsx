import { motion } from "framer-motion";
import { Link } from "react-router-dom";

export default function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
        className="text-xs uppercase tracking-[0.4em] text-white/50 mb-8"
      >
        Inner Cosmos
      </motion.p>

      <motion.h1
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.4, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        style={{ fontSize: "clamp(2rem, 7vw, 6.5rem)" }}
        className="font-display text-balance font-light leading-[1.05] max-w-5xl"
      >
        Explore the hidden world{" "}
        <span className="italic font-normal bg-gradient-to-r from-[var(--color-glow-cyan)] via-[var(--color-glow-violet)] to-[var(--color-glow-magenta)] bg-clip-text text-transparent">
          inside a brain.
        </span>
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.2, delay: 0.5, ease: "easeOut" }}
        style={{ fontSize: "clamp(0.95rem, 1.4vw, 1.25rem)" }}
        className="mt-8 max-w-xl text-balance text-white/65 font-light leading-relaxed"
      >
        Real connectomics data.{" "}
        <span className="whitespace-nowrap bg-gradient-to-r from-[#23baff] via-[#5b7cff] to-[#8aa6ff] bg-clip-text text-transparent font-normal">
          Real neurons.
        </span>{" "}
        Zoom from a whole brain down to a single synapse. No log-in.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, delay: 0.85, ease: "easeOut" }}
        className="mt-12 flex flex-col sm:flex-row items-center gap-4 pointer-events-auto"
      >
        <Link
          to="/explore"
          className="group relative px-8 py-3.5 rounded-full glass-strong text-white font-medium tracking-wide overflow-hidden transition-all duration-500 hover:scale-[1.03] active:scale-[0.99] cursor-pointer"
        >
          <span className="absolute inset-0 bg-gradient-to-r from-[var(--color-glow-cyan)]/20 via-[var(--color-glow-violet)]/20 to-[var(--color-glow-magenta)]/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <span className="absolute inset-0 rounded-full ring-1 ring-white/20 group-hover:ring-white/40 transition" />
          <span className="relative flex items-center gap-3">
            Explore
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="transition-transform group-hover:translate-x-0.5">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </Link>

        <Link
          to="/meet"
          className="text-sm text-white/55 hover:text-white/85 transition-colors px-4 py-2"
        >
          or meet a neuron →
        </Link>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2, delay: 2 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 text-[11px] uppercase tracking-[0.3em] text-white/35"
      >
        scroll
      </motion.div>
    </section>
  );
}

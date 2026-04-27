import { motion } from "framer-motion";
import { Link, useParams } from "react-router-dom";
import { getNeuronById, featuredNeurons, meshUrl } from "../data/neurons";
import RealNeuronModel from "../components/RealNeuronModel";

export default function MeetDetail() {
  const { id } = useParams<{ id: string }>();
  const neuron = id ? getNeuronById(id) : undefined;

  if (!neuron) {
    return (
      <main className="relative z-10 min-h-screen pt-40 px-6 text-center">
        <p className="text-white/60">Neuron not found.</p>
        <Link to="/meet" className="mt-6 inline-block text-white/80 underline">
          Back to the catalogue
        </Link>
      </main>
    );
  }

  const idx = featuredNeurons.findIndex((n) => n.id === neuron.id);
  const next = featuredNeurons[(idx + 1) % featuredNeurons.length];
  const prev = featuredNeurons[(idx - 1 + featuredNeurons.length) % featuredNeurons.length];

  return (
    <>
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(28,39,66,0.55) 0%, rgba(4,6,12,1) 70%)",
        }}
      />
      <div className="pointer-events-none fixed inset-x-0 top-0 h-40 z-[5] bg-gradient-to-b from-[var(--color-ink-950)] to-transparent" />
      <div className="pointer-events-none fixed inset-x-0 bottom-0 h-40 z-[5] bg-gradient-to-t from-[var(--color-ink-950)] to-transparent" />

      <main className="relative z-10 min-h-screen pt-28 pb-24 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            key={neuron.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center"
          >
            {/* 3D model — real EM-reconstructed mesh from MICrONS minnie65 */}
            <div className="relative aspect-square w-full max-w-[560px] mx-auto rounded-3xl overflow-hidden">
              <RealNeuronModel
                meshUrl={meshUrl(neuron)}
                color={neuron.color}
                className="absolute inset-0"
                cameraDistance={2.4}
                spinSpeed={0.14}
              />
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    "radial-gradient(ellipse at center, transparent 60%, rgba(4,6,12,0.45) 100%)",
                }}
              />
            </div>

            {/* Text */}
            <div>
              <p
                className="text-[11px] uppercase tracking-[0.35em] mb-3"
                style={{ color: neuron.color }}
              >
                {neuron.scientificType}
              </p>
              <h1
                style={{ fontSize: "clamp(2rem, 5vw, 4rem)" }}
                className="font-display font-light leading-[1.05]"
              >
                {neuron.nickname}
              </h1>
              <p className="mt-5 text-white/85 text-lg font-light leading-relaxed text-balance">
                {neuron.oneLiner}
              </p>

              <Section label="Shape">{neuron.shapeAnalogy}</Section>
              <Section label="What it does">{neuron.whatItDoes}</Section>
              <Section label="Why it matters">{neuron.whyItMatters}</Section>

              <div className="mt-8 pt-6 border-t border-white/10">
                <p className="text-[11px] text-white/35 font-mono leading-relaxed">
                  Real cell · MICrONS minnie65 · seg_m1300<br />
                  <span className="text-white/60">{neuron.segId}</span>
                </p>
              </div>
            </div>
          </motion.div>

          {/* Prev / Next */}
          <div className="mt-20 flex items-center justify-between text-sm">
            <Link
              to={`/meet/${prev.id}`}
              className="group flex items-center gap-3 text-white/55 hover:text-white transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M13 8H3M7 4l-4 4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>
                <span className="block text-[10px] uppercase tracking-[0.25em] text-white/35">
                  Previous
                </span>
                {prev.nickname}
              </span>
            </Link>

            <Link to="/meet" className="text-white/55 hover:text-white transition-colors">
              All six
            </Link>

            <Link
              to={`/meet/${next.id}`}
              className="group flex items-center gap-3 text-white/55 hover:text-white transition-colors text-right"
            >
              <span>
                <span className="block text-[10px] uppercase tracking-[0.25em] text-white/35">
                  Next
                </span>
                {next.nickname}
              </span>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-7">
      <p className="text-[10px] uppercase tracking-[0.3em] text-white/40 mb-2">
        {label}
      </p>
      <p className="text-white/75 leading-relaxed text-balance font-light">
        {children}
      </p>
    </div>
  );
}

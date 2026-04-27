import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import RealNeuronModel from "../components/RealNeuronModel";
import {
  featuredNeurons,
  meshUrl,
  CATEGORY_LABEL,
  CATEGORY_BLURB,
  type CellCategory,
  type FeaturedNeuron,
} from "../data/neurons";

const CATEGORY_ORDER: CellCategory[] = ["excitatory", "inhibitory", "other"];

function NeuronCard({ n, index }: { n: FeaturedNeuron; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.04 * index, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link
        to={`/meet/${n.id}`}
        className="group block rounded-2xl glass overflow-hidden hover:bg-white/[0.07] hover:ring-white/15 hover:-translate-y-0.5 transition-all duration-500"
      >
        <div className="aspect-[4/3] relative">
          <RealNeuronModel
            meshUrl={meshUrl(n)}
            color={n.color}
            className="absolute inset-0"
            spinSpeed={0.18}
          />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse at center, transparent 55%, rgba(4,6,12,0.6) 100%)",
            }}
          />
        </div>
        <div className="p-5">
          <p
            className="text-[10px] uppercase tracking-[0.3em] mb-1.5"
            style={{ color: n.color, opacity: 0.85 }}
          >
            {n.scientificType}
          </p>
          <h2 className="font-display text-2xl font-light leading-tight">
            {n.nickname}
          </h2>
          <p className="mt-2.5 text-[13px] text-white/55 leading-relaxed">
            {n.oneLiner}
          </p>
        </div>
      </Link>
    </motion.div>
  );
}

export default function Meet() {
  return (
    <>
      {/* Background */}
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(28,39,66,0.55) 0%, rgba(4,6,12,1) 70%)",
        }}
      />
      <div className="pointer-events-none fixed inset-x-0 top-0 h-40 z-[5] bg-gradient-to-b from-[var(--color-ink-950)] to-transparent" />
      <div className="pointer-events-none fixed inset-x-0 bottom-0 h-40 z-[5] bg-gradient-to-t from-[var(--color-ink-950)] to-transparent" />

      <main className="relative z-10 min-h-screen pt-32 pb-24 px-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="max-w-3xl mx-auto text-center mb-20"
        >
          <p className="text-xs uppercase tracking-[0.4em] text-white/45 mb-6">
            Meet a Neuron
          </p>
          <h1
            style={{ fontSize: "clamp(2rem, 5vw, 4rem)" }}
            className="font-display font-light leading-[1.1] text-balance"
          >
            Some shapes the brain keeps making.
          </h1>
          <p
            style={{ fontSize: "clamp(0.95rem, 1.2vw, 1.1rem)" }}
            className="mt-6 text-white/60 font-light leading-relaxed text-balance"
          >
            Six characters from mouse visual cortex, sorted by what they do — cells that push their neighbors toward firing, cells that hold them back, and the support cell that lives among them.
          </p>
        </motion.div>

        <div className="max-w-6xl mx-auto space-y-20">
          {CATEGORY_ORDER.map((cat) => {
            const cells = featuredNeurons.filter((n) => n.category === cat);
            if (cells.length === 0) return null;
            return (
              <section key={cat}>
                <div className="mb-8 flex items-baseline gap-4 flex-wrap">
                  <h2 className="font-display text-2xl md:text-3xl font-light">
                    {CATEGORY_LABEL[cat]}
                  </h2>
                  <p className="text-sm text-white/50 font-light max-w-xl">
                    {CATEGORY_BLURB[cat]}
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {cells.map((n, i) => (
                    <NeuronCard key={n.id} n={n} index={i} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </main>
    </>
  );
}

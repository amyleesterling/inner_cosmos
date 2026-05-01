import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { wonderFacts } from "../data/wonderFacts";

export default function WonderStrip() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % wonderFacts.length);
    }, 5500);
    return () => clearInterval(id);
  }, []);

  return (
    <section id="wonder" className="relative py-32 px-6 flex flex-col items-center">
      <p className="text-xs uppercase tracking-[0.4em] text-white/40 mb-10">Wonder</p>
      <div className="relative h-32 flex items-center justify-center max-w-3xl w-full">
        <AnimatePresence mode="wait">
          <motion.p
            key={wonderFacts[index].id}
            initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -12, filter: "blur(4px)" }}
            transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
            className="font-display text-3xl md:text-4xl font-light text-balance text-center text-white/85 leading-[1.25] absolute"
          >
            {wonderFacts[index].text}
          </motion.p>
        </AnimatePresence>
      </div>

      <div className="mt-8 flex gap-2 pointer-events-auto">
        {wonderFacts.map((f, i) => (
          <button
            key={f.id}
            onClick={() => setIndex(i)}
            aria-label={`Show fact ${i + 1}`}
            className={`h-1 rounded-full transition-all duration-500 ${
              i === index ? "w-8 bg-white/70" : "w-4 bg-white/20 hover:bg-white/40"
            }`}
          />
        ))}
      </div>
    </section>
  );
}

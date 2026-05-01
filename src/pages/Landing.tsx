import LandingNeurons from "../components/LandingNeurons";
import Hero from "../components/Hero";
import WonderStrip from "../components/WonderStrip";

export default function Landing() {
  return (
    <>
      {/* Cinematic background gradient — fixed, behind everything */}
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(28,39,66,0.55) 0%, rgba(4,6,12,1) 70%)",
        }}
      />

      {/* Real MICrONS cells drifting in the background — random selection per page load */}
      <LandingNeurons />

      {/* Top + bottom vignettes — fixed, on top of canvas, behind content */}
      <div className="pointer-events-none fixed inset-x-0 top-0 h-40 z-[5] bg-gradient-to-b from-[var(--color-ink-950)] to-transparent" />
      <div className="pointer-events-none fixed inset-x-0 bottom-0 h-40 z-[5] bg-gradient-to-t from-[var(--color-ink-950)] to-transparent" />
      {/* Soft central darkening so the headline stays legible if any cell
          drifts close to the middle. Sits between canvas and text. */}
      <div
        className="pointer-events-none fixed inset-0 z-[5]"
        style={{
          background:
            "radial-gradient(ellipse 55% 35% at center, rgba(4,6,12,0.78) 0%, rgba(4,6,12,0.45) 55%, rgba(4,6,12,0) 85%)",
        }}
      />

      {/* Foreground content. pointer-events-none lets drag/scroll fall
          through to the canvas behind; interactive elements (links,
          buttons, footer) opt back in via pointer-events-auto. */}
      <main className="relative z-10 min-h-screen overflow-x-hidden pointer-events-none">
        <Hero />
        <WonderStrip />

        <footer className="py-12 px-6 text-center text-xs text-white/35 tracking-wider pointer-events-auto">
          Data:{" "}
          <a className="hover:text-white/70 transition" href="https://www.microns-explorer.org/" target="_blank" rel="noreferrer">
            MICrONS
          </a>
          <span className="mx-2">·</span>
          <a className="hover:text-white/70 transition" href="https://www.flywire.ai/" target="_blank" rel="noreferrer">
            FlyWire
          </a>
          <span className="mx-2">·</span>
          Built with neuroglancer
        </footer>
      </main>
    </>
  );
}

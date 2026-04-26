import NeuronCanvas from "../components/NeuronCanvas";
import Hero from "../components/Hero";
import WonderStrip from "../components/WonderStrip";

export default function Landing() {
  const handleEnter = () => {
    // TODO: route to /explore
    window.alert("Explorer coming next — embedded Neuroglancer view of MICrONS minnie65.");
  };

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

      {/* Three.js neuron canvas — fixed, on top of gradient, behind content */}
      <NeuronCanvas />

      {/* Top + bottom vignettes — fixed, on top of canvas, behind content */}
      <div className="pointer-events-none fixed inset-x-0 top-0 h-40 z-[5] bg-gradient-to-b from-[var(--color-ink-950)] to-transparent" />
      <div className="pointer-events-none fixed inset-x-0 bottom-0 h-40 z-[5] bg-gradient-to-t from-[var(--color-ink-950)] to-transparent" />

      {/* Foreground content */}
      <main className="relative z-10 min-h-screen overflow-x-hidden">
        <Hero onEnter={handleEnter} />
        <WonderStrip />

        <footer className="py-12 px-6 text-center text-xs text-white/35 tracking-wider">
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

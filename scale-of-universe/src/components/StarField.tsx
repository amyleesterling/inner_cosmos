import { useEffect, useRef } from "react";

interface Star {
  x: number;
  y: number;
  r: number;
  phase: number;
  speed: number;
  hue: number;
}

// ~one star per 3500 px² of viewport, slow twinkle, no parallax. Sits
// behind everything at zIndex 0 — the explorer's category halo paints
// over it without erasing it (rgba alpha keeps stars peeking through).
export default function StarField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let stars: Star[] = [];
    let dpr = 1;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const N = Math.min(900, Math.floor((w * h) / 3500));
      stars = Array.from({ length: N }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.2 + 0.2,
        phase: Math.random() * Math.PI * 2,
        speed: 0.0004 + Math.random() * 0.0014,
        hue: 200 + Math.random() * 60,
      }));
    };
    resize();
    window.addEventListener("resize", resize);

    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const s of stars) {
        s.phase += s.speed * dt;
        const tw = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(s.phase));
        ctx.globalAlpha = tw * 0.9;
        ctx.fillStyle = `hsl(${s.hue}, 60%, 88%)`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
      aria-hidden
    />
  );
}

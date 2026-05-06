import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  SCALE_STOPS,
  CATEGORY_COLORS,
  formatScientific,
  nearestStopIndex,
  ZOOM_MIN,
  ZOOM_MAX,
  type ScaleStop,
} from "../data/scaleStops";

const FIRST = SCALE_STOPS[0];
const LAST = SCALE_STOPS[SCALE_STOPS.length - 1];

const SUP: Record<string, string> = {
  "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
  "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
};
function sup(n: number) {
  return String(n).split("").map((c) => SUP[c] ?? c).join("");
}
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// "Threshold" stops are the narrative beats — chemistry, life, visible world,
// etc. Bottom-bar pills jump straight to them.
const THRESHOLD_STOPS = SCALE_STOPS.filter((s) => s.threshold);

export default function ScaleExplorer() {
  const targetRef = useRef(FIRST.zoom);
  const [zoom, setZoom] = useState(FIRST.zoom);
  const stageRef = useRef<HTMLDivElement>(null);

  const [guided, setGuided] = useState(false);
  const [showInfo, setShowInfo] = useState(true);
  const [showPowers, setShowPowers] = useState(true);
  const [hasInteracted, setHasInteracted] = useState(false);

  const setTarget = useCallback((next: number | ((z: number) => number)) => {
    const v =
      typeof next === "function"
        ? (next as (z: number) => number)(targetRef.current)
        : next;
    targetRef.current = clamp(v, ZOOM_MIN, ZOOM_MAX);
  }, []);

  const interact = useCallback(() => setHasInteracted(true), []);

  // rAF: ease the visible zoom toward the target. This is what makes the
  // journey feel buttery instead of stepped.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setZoom((z) => {
        const dz = targetRef.current - z;
        if (Math.abs(dz) < 1e-4) return targetRef.current;
        return z + dz * 0.14;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Wheel — primary navigation
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const px = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      setTarget((z) => z + px * 0.0035);
      interact();
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, [setTarget, interact]);

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      const idx = nearestStopIndex(targetRef.current);
      if (e.key === "ArrowDown" || e.key === "ArrowRight" || e.key === "+" || e.key === "=") {
        e.preventDefault();
        setTarget(SCALE_STOPS[Math.min(SCALE_STOPS.length - 1, idx + 1)].zoom);
        interact();
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft" || e.key === "-" || e.key === "_") {
        e.preventDefault();
        setTarget(SCALE_STOPS[Math.max(0, idx - 1)].zoom);
        interact();
      } else if (e.key === "Home") {
        setTarget(FIRST.zoom);
        interact();
      } else if (e.key === "End") {
        setTarget(LAST.zoom);
        interact();
      } else if (e.key === " ") {
        e.preventDefault();
        setGuided((g) => !g);
        interact();
      } else if (e.key.toLowerCase() === "i") {
        setShowInfo((v) => !v);
      } else if (e.key.toLowerCase() === "p") {
        setShowPowers((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setTarget, interact]);

  // Pointer drag — vertical drag scrubs the zoom axis. HUD elements are
  // tagged data-hud and the drag handler ignores them.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let dragging = false;
    let lastY = 0;
    const onDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-hud]")) return;
      dragging = true;
      lastY = e.clientY;
      stage.style.cursor = "grabbing";
      try {
        stage.setPointerCapture?.(e.pointerId);
      } catch {
        /* ignore */
      }
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dy = e.clientY - lastY;
      lastY = e.clientY;
      // Drag down = move forward (toward larger), matching wheel direction.
      setTarget((z) => z + dy * 0.012);
      interact();
    };
    const onUp = () => {
      dragging = false;
      stage.style.cursor = "grab";
    };
    stage.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      stage.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [setTarget, interact]);

  // Guided autoplay — slowly drifts through the journey at ~0.4 decades/sec.
  useEffect(() => {
    if (!guided) return;
    let raf = 0;
    let last = performance.now();
    const SPEED = 0.4;
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const next = targetRef.current + dt * SPEED;
      if (next > LAST.zoom + 0.4) targetRef.current = FIRST.zoom;
      else targetRef.current = next;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [guided]);

  const currentIdx = nearestStopIndex(zoom);
  const current = SCALE_STOPS[currentIdx];
  const cat = CATEGORY_COLORS[current.category];

  const goTo = useCallback(
    (z: number) => {
      setTarget(z);
      interact();
    },
    [setTarget, interact],
  );

  return (
    <div
      ref={stageRef}
      className="fixed inset-0 overflow-hidden touch-none select-none cursor-grab"
      style={{ zIndex: 1 }}
    >
      <motion.div
        className="absolute inset-0 pointer-events-none"
        animate={{
          background: `radial-gradient(ellipse 75% 70% at center, ${cat.tint}0.20) 0%, ${cat.tint}0.06) 40%, rgba(4,6,12,0) 75%)`,
        }}
        transition={{ duration: 1.6, ease: "easeInOut" }}
        style={{ zIndex: 1 }}
      />

      <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 2 }}>
        {SCALE_STOPS.map((s) => (
          <ScaleObject key={s.id} stop={s} cameraZoom={zoom} onSelect={() => goTo(s.zoom)} />
        ))}
      </div>

      <CenterText stop={current} showInfo={showInfo} key={current.id} />

      <TopBar
        guided={guided}
        setGuided={setGuided}
        showInfo={showInfo}
        setShowInfo={setShowInfo}
        showPowers={showPowers}
        setShowPowers={setShowPowers}
      />

      {showPowers && <Ruler zoom={zoom} onJump={goTo} />}

      <BottomNav
        idx={currentIdx}
        onJump={goTo}
        onPrev={() => goTo(SCALE_STOPS[Math.max(0, currentIdx - 1)].zoom)}
        onNext={() =>
          goTo(SCALE_STOPS[Math.min(SCALE_STOPS.length - 1, currentIdx + 1)].zoom)
        }
      />

      <AnimatePresence>
        {!hasInteracted && <HeroOverlay onBegin={() => setHasInteracted(true)} />}
      </AnimatePresence>
    </div>
  );
}

// ─── Visual: a stop rendered as a glowing disk, sized by 10^(stopZoom − cameraZoom).
// The current stop sits at BASE_VMIN. Larger stops swell into halos that engulf
// the viewport; smaller stops shrink to a dot inside the current. We cull stops
// outside ±2.5 decades.

const BASE_VMIN = 22;

function ScaleObject({
  stop,
  cameraZoom,
  onSelect,
}: {
  stop: ScaleStop;
  cameraZoom: number;
  onSelect: () => void;
}) {
  const dz = stop.zoom - cameraZoom;
  if (dz < -2.2 || dz > 2.6) return null;
  const scale = Math.pow(10, dz);
  const sizeVMin = BASE_VMIN * scale;
  // peak at dz=0, soft falloff
  const fade = Math.max(0, 1 - Math.abs(dz) / 2.4);
  const opacity = Math.pow(fade, 1.4);
  if (opacity < 0.02) return null;

  const cat = CATEGORY_COLORS[stop.category];
  const isCurrent = Math.abs(dz) < 0.35;

  return (
    <div
      className="absolute pointer-events-auto"
      style={{
        width: `${sizeVMin}vmin`,
        height: `${sizeVMin}vmin`,
        opacity,
        transform: "translate(-50%, -50%)",
        left: "50%",
        top: "50%",
        transition: "opacity 0.3s ease",
        cursor: "pointer",
      }}
      onClick={onSelect}
      role="button"
      aria-label={stop.name}
    >
      <div
        className="w-full h-full rounded-full"
        style={{
          background: `radial-gradient(circle at 50% 50%, ${cat.tint}0.95) 0%, ${cat.tint}0.55) 30%, ${cat.tint}0.18) 55%, ${cat.tint}0) 80%)`,
          boxShadow: `0 0 ${sizeVMin * 0.6}vmin ${cat.tint}0.18), 0 0 ${sizeVMin * 0.2}vmin ${cat.tint}0.35)`,
        }}
      />
      {isCurrent && (
        <div
          className="absolute inset-[8%] rounded-full pointer-events-none"
          style={{
            border: `1px solid ${cat.tint}0.35)`,
            boxShadow: `inset 0 0 30px ${cat.tint}0.18)`,
          }}
        />
      )}
    </div>
  );
}

// ─── Centered text: name + category above the disk; size + description + why-it-matters below.
// Single column. The "info" toggle just hides description + why-it-matters; name + size always remain.

function CenterText({ stop, showInfo }: { stop: ScaleStop; showInfo: boolean }) {
  const sci = formatScientific(stop.sizeM);
  const cat = CATEGORY_COLORS[stop.category];
  const shadow = "0 2px 30px rgba(4,6,12,0.95), 0 0 16px rgba(4,6,12,0.75)";

  return (
    <>
      {/* Above the disk */}
      <motion.div
        key={`top-${stop.id}`}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.55, ease: "easeOut" }}
        className="absolute inset-x-0 px-6 flex flex-col items-center gap-3 text-center pointer-events-none"
        style={{
          zIndex: 4,
          top: "calc(50% - 16vmin)",
          transform: "translateY(-100%)",
          textShadow: shadow,
        }}
      >
        {stop.threshold && (
          <span
            className="text-[10px] sm:text-[11px] uppercase tracking-[0.5em]"
            style={{ color: cat.glow, opacity: 0.75 }}
          >
            {stop.threshold.title}
          </span>
        )}
        <span
          className="text-[10px] sm:text-[11px] uppercase tracking-[0.4em]"
          style={{ color: cat.glow, opacity: 0.7 }}
        >
          {stop.category}
        </span>
        <h1
          className="font-display font-light leading-[1.0] text-balance"
          style={{ fontSize: "clamp(2rem, 5.5vw, 5rem)" }}
        >
          {stop.name}
        </h1>
      </motion.div>

      {/* Below the disk */}
      <motion.div
        key={`bot-${stop.id}`}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: "easeOut", delay: 0.05 }}
        className="absolute inset-x-0 px-6 flex flex-col items-center gap-3 text-center pointer-events-none"
        style={{
          zIndex: 4,
          top: "calc(50% + 14vmin)",
          textShadow: shadow,
        }}
      >
        <div className="flex items-baseline gap-3" style={{ fontSize: "clamp(1rem, 1.8vw, 1.35rem)" }}>
          <span className="font-display tracking-tight text-white/90">
            {sci.mantissa} × 10{sup(sci.exponent)}
          </span>
          <span className="text-white/40 text-xs">m</span>
          <span className="text-white/40 text-xs hidden sm:inline">·</span>
          <span className="text-white/55 text-xs sm:text-sm hidden sm:inline">{stop.humanLabel}</span>
        </div>
        <div className="text-white/55 text-[11px] tracking-wide sm:hidden">{stop.humanLabel}</div>

        {showInfo && (
          <div
            className="mt-2 max-w-xl flex flex-col gap-2"
            style={{ textShadow: shadow }}
          >
            <p className="text-white/85 text-sm sm:text-[15px] leading-relaxed text-balance">
              {stop.description}
            </p>
            <p
              className="text-[12px] sm:text-[13px] leading-relaxed italic text-balance"
              style={{ color: `${cat.tint}0.85)` }}
            >
              {stop.whyItMatters}
            </p>
          </div>
        )}
      </motion.div>
    </>
  );
}

// ─── Top bar: minimal wordmark + toggle pills

function TopBar({
  guided, setGuided, showInfo, setShowInfo, showPowers, setShowPowers,
}: {
  guided: boolean; setGuided: (v: boolean | ((p: boolean) => boolean)) => void;
  showInfo: boolean; setShowInfo: (v: boolean | ((p: boolean) => boolean)) => void;
  showPowers: boolean; setShowPowers: (v: boolean | ((p: boolean) => boolean)) => void;
}) {
  return (
    <div
      data-hud
      className="absolute top-0 inset-x-0 px-5 sm:px-8 py-5 flex items-start justify-between"
      style={{ zIndex: 6 }}
    >
      <div className="flex flex-col gap-1 select-text">
        <span className="text-[10px] sm:text-[11px] uppercase tracking-[0.4em] text-white/45">
          Scale of the Universe
        </span>
        <span className="text-white/30 text-[10px] sm:text-[11px] tracking-wide hidden sm:inline">
          A journey through the powers of ten
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <Pill active={guided} onClick={() => setGuided((v) => !v)} title="Guided autoplay (space)">
          <PlayIcon playing={guided} />
          <span className="hidden sm:inline">Guided</span>
        </Pill>
        <Pill active={showInfo} onClick={() => setShowInfo((v) => !v)} title="Toggle info (i)">
          <InfoIcon />
          <span className="hidden sm:inline">Info</span>
        </Pill>
        <Pill active={showPowers} onClick={() => setShowPowers((v) => !v)} title="Toggle ruler (p)">
          <RulerIcon />
          <span className="hidden sm:inline">Ruler</span>
        </Pill>
      </div>
    </div>
  );
}

function Pill({ active, onClick, children, title }: { active: boolean; onClick: () => void; children: React.ReactNode; title?: string; }) {
  return (
    <button
      onClick={onClick}
      title={title}
      data-hud
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] tracking-wide transition-all duration-200 ${
        active
          ? "bg-white/8 text-white ring-1 ring-white/15"
          : "text-white/55 hover:text-white/85 hover:bg-white/5"
      }`}
    >
      {children}
    </button>
  );
}

// ─── Right-edge ruler: every integer power of ten, with stop dots.

function Ruler({ zoom, onJump }: { zoom: number; onJump: (z: number) => void }) {
  // The spine sits SPINE_PX from the right edge of the container; ticks
  // and labels live to its left, dots are centered on it.
  const SPINE_PX = 14;
  const min = ZOOM_MIN;
  const max = ZOOM_MAX;
  const range = max - min;
  const decades: number[] = [];
  for (let e = Math.ceil(min); e <= Math.floor(max); e++) decades.push(e);

  const t = (z: number) => ((z - min) / range) * 100;

  return (
    <div
      data-hud
      className="absolute right-2 sm:right-4 top-[7.5rem] bottom-[8.5rem] w-16 pointer-events-auto"
      style={{ zIndex: 5 }}
    >
      <div className="relative w-full h-full">
        {/* spine */}
        <div
          className="absolute top-0 bottom-0 w-px bg-white/10"
          style={{ right: SPINE_PX }}
        />

        {/* decade ticks (label + tick mark to the LEFT of the spine) */}
        {decades.map((e) => {
          const top = t(e);
          const isMajor = e % 5 === 0 || e === 0;
          const showLabel = isMajor;
          return (
            <button
              key={e}
              onClick={() => onJump(e)}
              data-hud
              className="absolute -translate-y-1/2 flex items-center gap-1.5 group"
              style={{ top: `${top}%`, right: SPINE_PX + 4 }}
              title={`10${sup(e)} m`}
            >
              <span
                className={`block text-[9px] tabular-nums tracking-tight transition-opacity ${
                  showLabel ? "text-white/40" : "text-white/0 group-hover:text-white/35"
                }`}
              >
                10{sup(e)}
              </span>
              <span
                className={`block bg-white/25 group-hover:bg-white/80 ${isMajor ? "w-2.5 h-px" : "w-1.5 h-px"}`}
              />
            </button>
          );
        })}

        {/* stop dots, centered on the spine */}
        {SCALE_STOPS.map((s) => {
          const top = t(s.zoom);
          const cat = CATEGORY_COLORS[s.category];
          const active = Math.abs(s.zoom - zoom) < 0.3;
          const size = active ? 9 : 5;
          return (
            <button
              key={s.id}
              onClick={() => onJump(s.zoom)}
              data-hud
              className="absolute rounded-full transition-all"
              style={{
                top: `${top}%`,
                right: SPINE_PX - size / 2,
                width: size,
                height: size,
                transform: "translateY(-50%)",
                background: cat.glow,
                boxShadow: active ? `0 0 12px ${cat.glow}` : "none",
                opacity: active ? 1 : 0.6,
              }}
              title={s.name}
              aria-label={s.name}
            />
          );
        })}

        {/* current camera bar — a thin glowing line that crosses the spine */}
        <div
          className="absolute h-px pointer-events-none transition-all"
          style={{
            top: `${t(zoom)}%`,
            right: SPINE_PX - 18,
            width: 36,
            transform: "translateY(-50%)",
            background: "linear-gradient(to right, transparent, rgba(255,255,255,0.95), transparent)",
            boxShadow: "0 0 14px rgba(255,255,255,0.65)",
          }}
        />
      </div>
    </div>
  );
}

// ─── Bottom nav: prev / next + jump-to-threshold pills

function BottomNav({
  idx, onJump, onPrev, onNext,
}: {
  idx: number; onJump: (z: number) => void; onPrev: () => void; onNext: () => void;
}) {
  const current = SCALE_STOPS[idx];
  const prev = SCALE_STOPS[Math.max(0, idx - 1)];
  const next = SCALE_STOPS[Math.min(SCALE_STOPS.length - 1, idx + 1)];

  return (
    <div
      data-hud
      className="absolute bottom-0 inset-x-0 px-5 sm:px-8 pb-5 sm:pb-7 pt-3 flex flex-col gap-3 items-center"
      style={{ zIndex: 6 }}
    >
      <div className="flex items-center gap-2 sm:gap-3 glass rounded-full px-2 py-1.5">
        <NavButton onClick={onPrev} disabled={idx === 0} dir="prev" label={prev.name} />
        <span className="px-3 text-[12px] sm:text-sm text-white/85 tabular-nums">
          <span className="text-white/40">{idx + 1}</span>
          <span className="text-white/25 mx-1.5">/</span>
          <span className="text-white/40">{SCALE_STOPS.length}</span>
          <span className="hidden sm:inline ml-3 text-white/85">{current.name}</span>
        </span>
        <NavButton onClick={onNext} disabled={idx === SCALE_STOPS.length - 1} dir="next" label={next.name} />
      </div>

      <div className="hidden sm:flex flex-wrap items-center justify-center gap-1.5 max-w-3xl">
        <span className="text-[10px] uppercase tracking-[0.35em] text-white/35 mr-2">Jump to</span>
        {THRESHOLD_STOPS.map((s) => {
          const cat = CATEGORY_COLORS[s.category];
          return (
            <button
              key={s.id}
              onClick={() => onJump(s.zoom)}
              data-hud
              className="px-3 py-1 rounded-full text-[11px] text-white/65 hover:text-white transition-all hover:bg-white/5"
              style={{ borderColor: `${cat.tint}0.25)` }}
              title={s.threshold!.line}
            >
              {s.threshold!.title.replace(/^Crossing into /i, "")}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NavButton({ onClick, disabled, dir, label }: { onClick: () => void; disabled: boolean; dir: "prev" | "next"; label: string; }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      data-hud
      title={label}
      className={`group flex items-center gap-1.5 px-2.5 py-1.5 rounded-full transition-all ${
        disabled ? "opacity-30 cursor-default" : "hover:bg-white/8 cursor-pointer"
      }`}
    >
      {dir === "prev" && (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      <span className="text-[11px] tracking-wide text-white/65 group-hover:text-white/95 hidden sm:inline">
        {dir === "prev" ? "Smaller" : "Larger"}
      </span>
      {dir === "next" && (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

// ─── Hero overlay: one-time intro that fades on first interaction.

function HeroOverlay({ onBegin }: { onBegin: () => void }) {
  return (
    <motion.div
      data-hud
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.9 } }}
      className="absolute inset-0 flex items-center justify-center px-6"
      style={{ zIndex: 10, background: "radial-gradient(ellipse at center, rgba(4,6,12,0.78) 0%, rgba(4,6,12,0.96) 60%, rgba(4,6,12,1) 100%)" }}
    >
      <div className="flex flex-col items-center text-center max-w-2xl">
        <motion.span
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.0, ease: "easeOut" }}
          className="text-[10px] sm:text-[11px] uppercase tracking-[0.5em] text-white/45 mb-7"
        >
          Scale of the Universe
        </motion.span>
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          style={{ fontSize: "clamp(2.2rem, 7vw, 6rem)" }}
          className="font-display font-light text-balance leading-[1.05]"
        >
          A journey through the{" "}
          <span className="italic font-normal bg-gradient-to-r from-[#7ee0ff] via-[#b78bff] to-[#ff7ee0] bg-clip-text text-transparent">
            powers of ten
          </span>{" "}
          — and the changing rules of reality.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, delay: 0.45, ease: "easeOut" }}
          className="mt-7 max-w-xl text-balance text-white/65 font-light leading-relaxed"
          style={{ fontSize: "clamp(0.95rem, 1.4vw, 1.2rem)" }}
        >
          Reality does not unfold at one size. It changes character as you move through it.
          Travel from a proton to the cosmic web — and watch new kinds of order appear at every scale.
        </motion.p>

        <motion.button
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.0, delay: 0.85, ease: "easeOut" }}
          onClick={onBegin}
          className="mt-10 group relative px-8 py-3.5 rounded-full glass text-white font-medium tracking-wide overflow-hidden cursor-pointer"
        >
          <span className="absolute inset-0 bg-gradient-to-r from-[#7ee0ff]/15 via-[#b78bff]/15 to-[#ff7ee0]/15 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <span className="absolute inset-0 rounded-full ring-1 ring-white/15 group-hover:ring-white/35 transition" />
          <span className="relative flex items-center gap-3 text-[14px]">
            Begin
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </motion.button>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.0, delay: 1.4 }}
          className="mt-12 text-[10px] uppercase tracking-[0.3em] text-white/30 flex items-center gap-3"
        >
          <span>scroll</span>
          <span className="w-px h-3 bg-white/20" />
          <span>drag</span>
          <span className="w-px h-3 bg-white/20" />
          <span>arrow keys</span>
        </motion.div>
      </div>
    </motion.div>
  );
}

// ─── Tiny icons

function PlayIcon({ playing }: { playing: boolean }) {
  return playing ? (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
      <rect x="2" y="1.5" width="2" height="7" rx="0.5" />
      <rect x="6" y="1.5" width="2" height="7" rx="0.5" />
    </svg>
  ) : (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
      <path d="M2.5 1.5l6 3.5-6 3.5z" />
    </svg>
  );
}
function InfoIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
      <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M6 5v3.5M6 3.5v.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
function RulerIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2">
      <path d="M2 2v8M5 2v3M8 2v5M11 2v8" strokeLinecap="round" />
    </svg>
  );
}

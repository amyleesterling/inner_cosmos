import "./style.css";
import { STOPS, expLabel } from "./stops";
import { allHeroes } from "./heroes";
import { renderCosmos } from "./cosmos";

// ─── Page scaffold ────────────────────────────────────────────────────────
//
// Layout in three fixed layers + one scrolling track:
//   1. .stage (z=5)   — fixed, full-viewport. All 8 hero SVGs are mounted
//      here once and never re-mounted. The scroll handler mutates each one's
//      transform/opacity to produce the continuous-zoom illusion.
//   2. .ladder (z=20) — fixed right edge. Eight rungs labelled with their
//      exponent + name; an indicator dot slides between them.
//   3. .scrim-* (z=8) — fixed top/bottom gradients keeping the masthead and
//      the sentence card legible against the hero behind them.
//   4. main.track (z=10, in flow) — eight 100vh sections; each holds the
//      sentence card. The first section is taller and acts as the intro.
//
// Scroll → continuous "current exponent". For each hero, we compute how far
// it is from the current exponent and pick scale + opacity accordingly. The
// effect is a hero growing in from outside the frame, settling at native
// size, then shrinking away as the camera "zooms past" it.

const root = document.getElementById("root")!;

const heroes = allHeroes();
const minExp = STOPS[0].exp;
const maxExp = STOPS[STOPS.length - 1].exp;

// Build DOM once.
root.innerHTML = `
  <div class="cosmos" aria-hidden="true">
    ${renderCosmos()}
  </div>

  <header class="masthead">
    <div class="brand">Explore the Universe</div>
    <div class="tag">v1</div>
  </header>

  <div class="stage" aria-hidden="true">
    ${heroes
      .map(
        ({ stop, svg }) => `
          <div class="hero" data-stop="${stop.id}" data-exp="${stop.exp}">
            ${svg}
          </div>
        `,
      )
      .join("")}
  </div>

  <div class="scrim-top"></div>
  <div class="scrim-bottom"></div>

  <aside class="ladder" aria-label="Scale ladder">
    <div class="rail"></div>
    ${STOPS.map((s, i) => {
      const top = (i / (STOPS.length - 1)) * 100;
      return `
        <button class="rung" data-index="${i}" style="top:${top}%">
          <span class="dot"></span>
          <span class="label">${expLabel(s.exp)} · ${s.name}</span>
        </button>
      `;
    }).join("")}
    <div class="indicator" style="top:0%"></div>
  </aside>

  <main class="track">
    <section class="stop intro">
      <div class="card">
        <p class="kicker">A journey through the powers of ten</p>
        <h1 class="sentence">…and the changing rules of reality.</h1>
        <p class="sub">From a single molecule to the cosmic web — eight stops where the rules of matter change beneath you. Scroll to fall through scale.</p>
        <div class="scroll-hint">Scroll</div>
      </div>
    </section>
    ${STOPS.map(
      (s) => `
        <section class="stop" data-stop="${s.id}">
          <div class="card">
            <p class="kicker">
              <span class="scale-num">${expLabel(s.exp)}</span>
              <span class="scale-name">${s.scaleLabel}</span>
            </p>
            <h2 class="sentence">${s.sentence}</h2>
            <p class="name">${s.name}</p>
            ${
              s.attribution
                ? `<p class="attribution">${
                    s.attribution.href
                      ? `<a href="${s.attribution.href}" target="_blank" rel="noreferrer">${s.attribution.text}</a>`
                      : s.attribution.text
                  }</p>`
                : ""
            }
          </div>
        </section>
      `,
    ).join("")}
  </main>

  <footer class="credit">
    Built for the love of scale ·
    <a href="https://github.com/amyleesterling/explore-the-universe" target="_blank" rel="noreferrer">source</a>
  </footer>
`;

// ─── Scroll-driven zoom ───────────────────────────────────────────────────

const stage = root.querySelector<HTMLElement>(".stage")!;
const heroEls = Array.from(stage.querySelectorAll<HTMLElement>(".hero"));
const ladder = root.querySelector<HTMLElement>(".ladder")!;
const rungs = Array.from(ladder.querySelectorAll<HTMLElement>(".rung"));
const indicator = ladder.querySelector<HTMLElement>(".indicator")!;
const sections = Array.from(root.querySelectorAll<HTMLElement>("section.stop"));

/** Scroll progress 0..1 across the entire track. */
function scrollProgress(): number {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  if (max <= 0) return 0;
  return Math.min(1, Math.max(0, window.scrollY / max));
}

/** Map progress to the journey's exponent, but only after the intro section
 *  is past — we want the molecule held steady while the title is on screen. */
function currentExp(progress: number): number {
  // The intro is sections[0]; stops are sections[1..N]. Each scroll-step
  // between sections of the track corresponds to one stop transition.
  const total = sections.length; // intro + 8
  // p in [0..1] across the *post-intro* track.
  const introFrac = 1 / total;
  const p = Math.min(1, Math.max(0, (progress - introFrac) / (1 - introFrac)));
  return minExp + p * (maxExp - minExp);
}

/** For a given hero exponent vs. current exponent, return scale + opacity.
 *  Continuous-zoom feel: the further the hero is from "now", the more it
 *  pulls into the distance (small + faded if behind, large + faded if ahead). */
function zoomFor(stopExp: number, nowExp: number): { scale: number; opacity: number } {
  const delta = stopExp - nowExp;
  // delta > 0 → stop is bigger than current view → it's emerging from outside
  //             the frame: appears scaled UP (>1), fades in as we approach.
  // delta < 0 → stop has been passed → it's shrunk away into the distance.
  // Tuned so that one full step (4-7 exp units) goes from native to ~0 opacity.
  const stepWidth = 3.5; // how many exp units between native and gone
  const d = delta / stepWidth;
  const scale = Math.pow(2.4, d);          // 2.4× per stepWidth in either direction
  const opacity = Math.max(0, 1 - Math.abs(d) ** 1.6 * 1.05);
  return { scale, opacity };
}

/** The active stop is whichever rung's exponent is closest to current. */
function activeIndex(nowExp: number): number {
  let best = 0;
  let bestD = Infinity;
  STOPS.forEach((s, i) => {
    const d = Math.abs(s.exp - nowExp);
    if (d < bestD) { bestD = d; best = i; }
  });
  return best;
}

let pendingFrame = 0;
function update() {
  pendingFrame = 0;
  const p = scrollProgress();
  const now = currentExp(p);

  for (const el of heroEls) {
    const exp = Number(el.dataset.exp);
    const { scale, opacity } = zoomFor(exp, now);
    if (opacity < 0.005) {
      // Cheap cull — also lets the breathe animation idle.
      el.style.opacity = "0";
      el.style.visibility = "hidden";
      continue;
    }
    el.style.visibility = "visible";
    el.style.opacity = String(opacity);
    // Note: the hero wrapper carries the translateY offset. Append the scale
    // so we don't fight that base transform.
    el.style.transform = `translateY(-7vh) scale(${scale.toFixed(4)})`;
  }

  const idx = activeIndex(now);
  rungs.forEach((r, i) => r.classList.toggle("active", i === idx));

  // Indicator slides continuously between rungs based on the post-intro
  // fraction (0 = first stop, 1 = last stop).
  const introFrac = 1 / sections.length;
  const postIntro = Math.min(1, Math.max(0, (p - introFrac) / (1 - introFrac)));
  indicator.style.top = `${(postIntro * 100).toFixed(2)}%`;
}

function schedule() {
  if (pendingFrame) return;
  pendingFrame = requestAnimationFrame(update);
}

window.addEventListener("scroll", schedule, { passive: true });
window.addEventListener("resize", schedule);

// ─── Click-a-rung-to-jump ─────────────────────────────────────────────────

rungs.forEach((rung, i) => {
  rung.addEventListener("click", () => {
    // Section index in the track is i+1 (intro is sections[0]).
    const target = sections[i + 1];
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

// ─── Keyboard nav ─────────────────────────────────────────────────────────

window.addEventListener("keydown", (e) => {
  if (e.target && (e.target as HTMLElement).tagName === "INPUT") return;
  const idx = activeIndex(currentExp(scrollProgress()));
  if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ") {
    e.preventDefault();
    sections[Math.min(sections.length - 1, idx + 2)]?.scrollIntoView({ behavior: "smooth" });
  } else if (e.key === "ArrowUp" || e.key === "PageUp") {
    e.preventDefault();
    sections[Math.max(0, idx)]?.scrollIntoView({ behavior: "smooth" });
  } else if (e.key === "Home") {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: "smooth" });
  } else if (e.key === "End") {
    e.preventDefault();
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
  }
});

// First paint.
update();

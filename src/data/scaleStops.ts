// Curated scale journey from proton to observable universe — 27 stops.
// `sizeM` is meters; `zoom` is log10(sizeM) and is what the explorer's
// continuous camera tracks. Order is editorial, not strictly monotonic
// (DNA helix-width is recorded smaller than a protein, which is fine —
// each stop names a different *kind* of object, not a strict sort).

export type ScaleCategory =
  | "Microscopic"
  | "Biological"
  | "Human"
  | "Planetary"
  | "Cosmic";

export interface Threshold {
  title: string;
  line: string;
}

export interface ScaleStop {
  id: string;
  name: string;
  sizeM: number;
  zoom: number;
  humanLabel: string;
  category: ScaleCategory;
  description: string;
  whyItMatters: string;
  threshold?: Threshold;
}

const stop = (
  s: Omit<ScaleStop, "zoom" | "humanLabel"> & { humanLabel?: string },
): ScaleStop => ({
  ...s,
  zoom: Math.log10(s.sizeM),
  humanLabel: s.humanLabel ?? humanizeMeters(s.sizeM),
});

function humanizeMeters(m: number): string {
  if (m < 1e-12) return `${(m * 1e15).toFixed(1)} fm`;
  if (m < 1e-9) return `${(m * 1e12).toFixed(1)} pm`;
  if (m < 1e-6) return `${(m * 1e9).toFixed(1)} nm`;
  if (m < 1e-3) return `${(m * 1e6).toFixed(1)} μm`;
  if (m < 1) return `${(m * 1e3).toFixed(1)} mm`;
  if (m < 1e3) return `${m.toFixed(1)} m`;
  if (m < 1e7) return `${(m / 1e3).toFixed(1)} km`;
  // Astronomical: prefer light-years above ~1 light-year (~9.46e15 m).
  if (m < 9.46e15) return `${(m / 1e9).toFixed(2)} Gm`;
  const ly = m / 9.461e15;
  if (ly < 1e3) return `${ly.toFixed(1)} light-years`;
  if (ly < 1e6) return `${(ly / 1e3).toFixed(1)} kly`;
  if (ly < 1e9) return `${(ly / 1e6).toFixed(1)} Mly`;
  return `${(ly / 1e9).toFixed(1)} Gly`;
}

export const SCALE_STOPS: ScaleStop[] = [
  stop({
    id: "proton",
    name: "Proton",
    sizeM: 1e-15,
    category: "Microscopic",
    description:
      "A compact pulse of charge at the heart of every atom.",
    whyItMatters:
      "Matter exists here as fundamental structure — before objects, surfaces, or life.",
  }),
  stop({
    id: "atom",
    name: "Atom",
    sizeM: 1e-10,
    category: "Microscopic",
    description:
      "The smallest unit that still carries the identity of an element.",
    whyItMatters:
      "Where matter becomes identity — different arrangements make radically different substances.",
    threshold: {
      title: "Crossing into chemistry",
      line: "Matter begins to bond, fold, and build.",
    },
  }),
  stop({
    id: "water-molecule",
    name: "Water Molecule",
    sizeM: 3e-10,
    category: "Microscopic",
    description:
      "Two hydrogens, one oxygen, and a geometry that makes water weird in all the right ways.",
    whyItMatters:
      "Where chemistry becomes behavior. The shape of a molecule can change the fate of worlds.",
  }),
  stop({
    id: "protein",
    name: "Protein",
    sizeM: 5e-9,
    category: "Microscopic",
    description:
      "A folded molecular machine that does most of the quiet work of life.",
    whyItMatters: "Where chemistry begins acting like machinery.",
  }),
  stop({
    id: "dna",
    name: "DNA Double Helix",
    sizeM: 2e-9,
    humanLabel: "2 nm wide",
    category: "Microscopic",
    description:
      "A long molecular code, packed inside cells with exquisite efficiency.",
    whyItMatters:
      "Information made physical — heredity, memory, and possibility written into matter.",
  }),
  stop({
    id: "virus",
    name: "Virus",
    sizeM: 1e-7,
    category: "Microscopic",
    description:
      "Genetic instructions wrapped in protein, alive only when borrowing a cell's machinery.",
    whyItMatters:
      "The blurry edge of what we call life.",
  }),
  stop({
    id: "bacterium",
    name: "Bacterium",
    sizeM: 1e-6,
    category: "Biological",
    description:
      "A complete single-celled organism — small, ancient, adaptable, everywhere.",
    whyItMatters:
      "Life does not begin with complexity. It begins with persistence.",
    threshold: {
      title: "Crossing into life",
      line: "Structure becomes metabolism, memory, and self-repair.",
    },
  }),
  stop({
    id: "animal-cell",
    name: "Animal Cell",
    sizeM: 1e-5,
    category: "Biological",
    description:
      "A bounded room where energy flows, molecules move, and life keeps itself going.",
    whyItMatters:
      "One of the first scales where life becomes visibly organized.",
  }),
  stop({
    id: "human-egg",
    name: "Human Egg",
    sizeM: 1e-4,
    category: "Biological",
    description:
      "A single cell carrying the opening move of an entire organism.",
    whyItMatters:
      "The largest cell most of us will ever come from.",
  }),
  stop({
    id: "hair",
    name: "Hair Width",
    sizeM: 7e-5,
    category: "Biological",
    description:
      "Surprisingly thick at microscopic scales — a landscape compared to cells.",
    whyItMatters:
      "A bridge between what we can see and what usually stays hidden.",
  }),
  stop({
    id: "ant",
    name: "Ant",
    sizeM: 5e-3,
    category: "Biological",
    description:
      "A small body running navigation, cooperation, and chemistry all at once.",
    whyItMatters:
      "At this size, brains and behavior are already doing extraordinary things.",
    threshold: {
      title: "Crossing into the visible world",
      line: "Evolution becomes shape.",
    },
  }),
  stop({
    id: "human",
    name: "Human",
    sizeM: 1.7,
    humanLabel: "1.7 m",
    category: "Human",
    description:
      "Large enough to shape tools and cities. Small enough to stand beneath stars.",
    whyItMatters:
      "The scale from which most of our intuition is measured.",
    threshold: {
      title: "Crossing into the human realm",
      line: "Now the world is navigated by bodies, tools, and minds.",
    },
  }),
  stop({
    id: "blue-whale",
    name: "Blue Whale",
    sizeM: 30,
    humanLabel: "30 m",
    category: "Biological",
    description:
      "The largest animal ever known to have lived on Earth.",
    whyItMatters:
      "Life can become enormous without losing elegance.",
  }),
  stop({
    id: "redwood",
    name: "Redwood Tree",
    sizeM: 100,
    humanLabel: "100 m",
    category: "Biological",
    description:
      "A vertical monument built from sunlight, water, and time.",
    whyItMatters:
      "Where living things begin to compete with architecture.",
  }),
  stop({
    id: "skyscraper",
    name: "Skyscraper",
    sizeM: 300,
    humanLabel: "300 m",
    category: "Human",
    description:
      "An engineered answer to gravity, density, and ambition.",
    whyItMatters:
      "Human scale stretched upward by collective effort.",
  }),
  stop({
    id: "city",
    name: "City",
    sizeM: 1e4,
    humanLabel: "10 km",
    category: "Human",
    description:
      "Infrastructure, motion, memory, and rhythm packed into space.",
    whyItMatters:
      "Where intelligence becomes collective.",
  }),
  stop({
    id: "country",
    name: "Country",
    sizeM: 1e6,
    humanLabel: "1,000 km",
    category: "Human",
    description:
      "A political shape laid across landscapes, languages, and histories.",
    whyItMatters:
      "Human boundaries become meaningful at scales the body cannot hold.",
  }),
  stop({
    id: "earth",
    name: "Earth",
    sizeM: 1.27e7,
    humanLabel: "12,742 km diameter",
    category: "Planetary",
    description:
      "A thin-skinned world of oceans, weather, rock, and life.",
    whyItMatters:
      "Where chemistry became biosphere.",
    threshold: {
      title: "Crossing into planets and stars",
      line: "Gravity takes the lead.",
    },
  }),
  stop({
    id: "jupiter",
    name: "Jupiter",
    sizeM: 1.4e8,
    humanLabel: "139,820 km diameter",
    category: "Planetary",
    description:
      "The giant of our solar system, massive enough to steer the motion of worlds.",
    whyItMatters:
      "Some planets are landscapes. Some are systems.",
  }),
  stop({
    id: "sun",
    name: "Sun",
    sizeM: 1.39e9,
    humanLabel: "1.39 million km diameter",
    category: "Planetary",
    description:
      "A self-sustaining sphere of fusion, converting hydrogen into light, heat, and the long patience life requires.",
    whyItMatters:
      "The scale at which matter shines.",
  }),
  stop({
    id: "solar-system",
    name: "Solar System",
    sizeM: 1e13,
    humanLabel: "~67 AU across",
    category: "Planetary",
    description:
      "A gravitational family of worlds, moons, comets, and cold dust at the margins.",
    whyItMatters:
      "Distance becomes the price of orbit.",
  }),
  stop({
    id: "oort-cloud",
    name: "Oort Cloud",
    sizeM: 1e16,
    humanLabel: "~1 light-year across",
    category: "Planetary",
    description:
      "A vast distant shell of icy bodies, marking the loose edge of the Sun's reach.",
    whyItMatters:
      "Our local neighborhood extends far beyond the planets we memorize in school.",
  }),
  stop({
    id: "milky-way",
    name: "Milky Way",
    sizeM: 1e21,
    humanLabel: "~100,000 light-years across",
    category: "Cosmic",
    description:
      "A rotating city of stars, gas, dust, dark matter, and long galactic weather.",
    whyItMatters:
      "What gravity builds when given enough matter and time.",
    threshold: {
      title: "Crossing into deep space",
      line: "Distance becomes architecture.",
    },
  }),
  stop({
    id: "local-group",
    name: "Local Group",
    sizeM: 1e22,
    humanLabel: "~10 million light-years across",
    category: "Cosmic",
    description:
      "The Milky Way's small family of galaxies, bound together by mutual pull.",
    whyItMatters:
      "Galaxies are not isolated islands. They gather, pull, and evolve together.",
  }),
  stop({
    id: "virgo-supercluster",
    name: "Virgo Supercluster",
    sizeM: 1e24,
    humanLabel: "~100 million light-years across",
    category: "Cosmic",
    description:
      "A regional structure of many galaxy groups, woven into larger patterns.",
    whyItMatters:
      "The universe has texture on scales that almost escape imagination.",
  }),
  stop({
    id: "cosmic-web",
    name: "Cosmic Web",
    sizeM: 1e26,
    humanLabel: "~10 billion light-years across",
    category: "Cosmic",
    description:
      "A network of filaments, clusters, and voids, sculpted by gravity over deep time.",
    whyItMatters:
      "At the grandest scale, the universe resembles structure more than emptiness.",
  }),
  stop({
    id: "observable-universe",
    name: "Observable Universe",
    sizeM: 8.8e26,
    humanLabel: "~93 billion light-years across",
    category: "Cosmic",
    description:
      "Every place whose light has had time to reach us since the beginning of cosmic expansion.",
    whyItMatters:
      "Not necessarily all that exists — only all we can see from here.",
  }),
];

export const CATEGORY_COLORS: Record<ScaleCategory, { core: string; glow: string; tint: string }> = {
  Microscopic: { core: "#7ee0ff", glow: "#7ee0ff", tint: "rgba(126,224,255," },
  Biological: { core: "#9affc8", glow: "#9affc8", tint: "rgba(154,255,200," },
  Human: { core: "#ffd9a8", glow: "#ffd9a8", tint: "rgba(255,217,168," },
  Planetary: { core: "#b78bff", glow: "#b78bff", tint: "rgba(183,139,255," },
  Cosmic: { core: "#ff7ee0", glow: "#ff7ee0", tint: "rgba(255,126,224," },
};

export function formatScientific(value: number): { mantissa: string; exponent: number } {
  if (value === 0) return { mantissa: "0", exponent: 0 };
  const exp = Math.floor(Math.log10(Math.abs(value)));
  const mantissa = value / Math.pow(10, exp);
  const rounded = Math.round(mantissa * 100) / 100;
  const mantissaStr = rounded === Math.floor(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return { mantissa: mantissaStr, exponent: exp };
}

export function nearestStopIndex(zoom: number): number {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < SCALE_STOPS.length; i++) {
    const d = Math.abs(SCALE_STOPS[i].zoom - zoom);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

export const ZOOM_MIN = SCALE_STOPS[0].zoom - 1;
export const ZOOM_MAX = SCALE_STOPS[SCALE_STOPS.length - 1].zoom + 1;

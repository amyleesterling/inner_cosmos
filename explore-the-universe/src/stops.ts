// The 8 stops of the v1 journey. Hand-picked to span 35 orders of magnitude
// from a single molecule to the cosmic web — and to mark the moments where
// the rules of reality change. Each stop carries one short kicker (scale +
// name) and one killer sentence. No paragraph copy. Whisper, don't lecture.

export type Stop = {
  id: string;
  name: string;
  /** log10 of size in meters. */
  exp: number;
  /** Human-readable scale: "1 nanometer", "100,000 light-years". */
  scaleLabel: string;
  /** The killer sentence — what changes at this scale. */
  sentence: string;
};

export const STOPS: Stop[] = [
  {
    id: "molecule",
    name: "Molecule",
    exp: -9,
    scaleLabel: "1 nanometer",
    sentence: "At this scale, chemistry becomes architecture.",
  },
  {
    id: "synapse",
    name: "Synapse",
    exp: -7,
    scaleLabel: "500 nanometers",
    sentence: "Where thought rides electricity across an impossibly small gap.",
  },
  {
    id: "neuron",
    name: "Pyramidal neuron",
    exp: -4,
    scaleLabel: "100 micrometers",
    sentence: "A single cell wide as a thought, deep as a memory.",
  },
  {
    id: "human",
    name: "Human",
    exp: 0,
    scaleLabel: "1.7 meters",
    sentence: "Where the universe first turns and asks itself what it is.",
  },
  {
    id: "earth",
    name: "Earth",
    exp: 7,
    scaleLabel: "12,742 kilometers",
    sentence: "A wet stone with weather and witnesses, lit on one side at a time.",
  },
  {
    id: "solar",
    name: "Solar system",
    exp: 13,
    scaleLabel: "9 billion kilometers",
    sentence: "Planets are where dust learns patience.",
  },
  {
    id: "galaxy",
    name: "Milky Way",
    exp: 21,
    scaleLabel: "100,000 light-years",
    sentence: "A river of suns turning once every quarter-billion years.",
  },
  {
    id: "web",
    name: "Cosmic web",
    exp: 26,
    scaleLabel: "the observable universe",
    sentence: "All the matter we know, hung in a glowing scaffold of nothing.",
  },
];

/** Pretty-print exponent as 10ⁿ with proper unicode superscripts. */
export function expLabel(exp: number): string {
  const supers: Record<string, string> = {
    "-": "⁻",
    "0": "⁰",
    "1": "¹",
    "2": "²",
    "3": "³",
    "4": "⁴",
    "5": "⁵",
    "6": "⁶",
    "7": "⁷",
    "8": "⁸",
    "9": "⁹",
  };
  const s = String(exp)
    .split("")
    .map((c) => supers[c] ?? c)
    .join("");
  return `10${s} m`;
}

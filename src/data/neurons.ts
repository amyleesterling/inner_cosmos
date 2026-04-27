export interface FeaturedNeuron {
  id: string;              // route slug
  segId: string;            // MICrONS minnie65 segment ID (placeholder until real ones wired)
  nickname: string;
  scientificType: string;
  morphologyPreset: "pyramidal" | "basket" | "chandelier" | "martinotti" | "stellate" | "astrocyte";
  color: string;            // hex
  shapeAnalogy: string;     // "Lightning Tree", "Coral Fan", etc.
  oneLiner: string;          // shown on card
  whatItDoes: string;        // longer, on detail page
  whyItMatters: string;
}

// Note: segId values are placeholders until we wire real MICrONS minnie65 IDs.
// The morphology shown is procedural — we'll swap in real meshes via DRACO loader later.
export const featuredNeurons: FeaturedNeuron[] = [
  {
    id: "lightning-tree",
    segId: "864691135761488438",
    nickname: "Lightning Tree",
    scientificType: "Layer 2/3 Pyramidal Neuron",
    morphologyPreset: "pyramidal",
    color: "#7ee0ff",
    shapeAnalogy: "A pyramid with a single tall trunk that splinters into a crown of thin branches.",
    oneLiner: "The brain's loudest voice — these cells shout when you see, hear, or remember.",
    whatItDoes:
      "Pyramidal neurons are the principal output cells of the cortex. They take in thousands of signals through their dendrites and fire long axons that reach far across the brain — the wiring of conscious thought.",
    whyItMatters:
      "About 80% of the cells in your cortex are pyramidal. When you see a face or learn a name, it's their forest of connections that holds the memory.",
  },
  {
    id: "coral-fan",
    segId: "864691135776431068",
    nickname: "Coral Fan",
    scientificType: "Parvalbumin Basket Cell",
    morphologyPreset: "basket",
    color: "#ff7ee0",
    shapeAnalogy: "A round cell body wrapped in a dense radial spray, like coral on the seafloor.",
    oneLiner: "The brain's metronome — keeps thousands of cells firing on the beat.",
    whatItDoes:
      "Basket cells are inhibitory: they wrap their axons around the bodies of pyramidal neurons and silence them in tight rhythm. They're how cortex stays in sync.",
    whyItMatters:
      "Without basket cells, the cortex would seize. With them, you get the gamma rhythms that bind perception together.",
  },
  {
    id: "candelabra",
    segId: "864691135864244281",
    nickname: "Candelabra",
    scientificType: "Chandelier Cell",
    morphologyPreset: "chandelier",
    color: "#b78bff",
    shapeAnalogy: "Vertical bundles of axons hanging straight down, like a candelabra.",
    oneLiner: "A neuron with the most precise switch in the brain.",
    whatItDoes:
      "Chandelier cells aim their axons at one specific spot — the axon initial segment of pyramidal neurons. This is the trigger zone where action potentials are born. They're a kill switch with millimeter-perfect aim.",
    whyItMatters:
      "Chandelier cells are unusually scarce and unusually powerful. Their dysfunction shows up in schizophrenia, autism, and epilepsy.",
  },
  {
    id: "reaching-hand",
    segId: "864691135438169986",
    nickname: "Reaching Hand",
    scientificType: "Martinotti Cell",
    morphologyPreset: "martinotti",
    color: "#9af5d8",
    shapeAnalogy: "A bipolar body with axons that arc upward toward the cortical surface.",
    oneLiner: "A long-distance whisperer that quiets neighbors above.",
    whatItDoes:
      "Martinotti cells send their axons up toward layer 1 of cortex, blanket-suppressing the apical dendrites of pyramidal cells across a wide area. They're how the brain says 'shhh, I'm focusing.'",
    whyItMatters:
      "These cells implement a kind of attention gate — without them, every input would shout at once.",
  },
  {
    id: "dust-star",
    segId: "864691135415498621",
    nickname: "Dust Star",
    scientificType: "Spiny Stellate Cell",
    morphologyPreset: "stellate",
    color: "#ffd9a8",
    shapeAnalogy: "A small round body with short, evenly-distributed dendrites in every direction.",
    oneLiner: "The first stop for messages from your senses.",
    whatItDoes:
      "Spiny stellate cells live in layer 4 of cortex — the layer that receives information from the thalamus. Every photon, sound wave, or touch starts its cortical journey here.",
    whyItMatters:
      "Stellate cells are the brain's sensory inbox. Without them, the world wouldn't reach the cortex.",
  },
  {
    id: "forest-floor",
    segId: "864691135509418251",
    nickname: "Forest Floor",
    scientificType: "Protoplasmic Astrocyte",
    morphologyPreset: "astrocyte",
    color: "#c2c8ff",
    shapeAnalogy: "Star-shaped, with a fluff of fine processes wrapping every nearby synapse.",
    oneLiner: "Not a neuron — but no neuron works without one.",
    whatItDoes:
      "Astrocytes wrap each synapse, listen in, and feed their neighbors energy. They tune signals, recycle neurotransmitter, and form the chemical climate of the brain.",
    whyItMatters:
      "For decades they were dismissed as glue. We now know astrocytes do half the work of thinking, and we are still discovering what.",
  },
];

export function getNeuronById(id: string): FeaturedNeuron | undefined {
  return featuredNeurons.find((n) => n.id === id);
}

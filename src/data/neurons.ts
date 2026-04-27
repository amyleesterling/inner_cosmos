export interface FeaturedNeuron {
  id: string;              // route slug
  segId: string;            // Real MICrONS minnie65 segment ID (sourced from microns-explorer.org/gallery-mm3)
  nickname: string;
  scientificType: string;
  morphologyPreset: "pyramidal" | "basket" | "chandelier" | "martinotti" | "stellate" | "astrocyte";
  color: string;            // hex
  shapeAnalogy: string;     // "Lightning Tree", "Coral Fan", etc.
  oneLiner: string;          // shown on card
  whatItDoes: string;        // longer, on detail page
  whyItMatters: string;
  /** filename in gs://microns-static-links/mm3/ — the curated gallery state file */
  galleryState: string;
}

/** Build a Neuroglancer URL that opens this cell's curated MICrONS gallery view. */
export function neuroglancerUrl(galleryState: string): string {
  return `https://ngl.microns-explorer.org/#!gs://microns-static-links/mm3/${galleryState}`;
}

/** Path to the cell's web-optimized GLB (extracted offline via scripts/extract-meshes.py). */
export function meshUrl(neuron: Pick<FeaturedNeuron, "id">): string {
  return `${import.meta.env.BASE_URL}meshes/${neuron.id}.glb`;
}

// All segIds are real MICrONS minnie65 cells curated by the MICrONS team for
// https://www.microns-explorer.org/gallery-mm3 . The 3D shapes shown on these
// cards are PROCEDURAL — same family of shape, same morphology preset, but
// generated for fast loading. Click "View the real cell" on the detail page
// to see the actual mapped neuron in Neuroglancer.
export const featuredNeurons: FeaturedNeuron[] = [
  {
    id: "lightning-tree",
    segId: "864691135572530981",
    galleryState: "layer5_thick_tufted.json",
    nickname: "Lightning Tree",
    scientificType: "Layer 5 Thick-Tufted Pyramidal",
    morphologyPreset: "pyramidal",
    color: "#7ee0ff",
    shapeAnalogy: "A pyramid soma with one tall trunk that splinters into a crown of thin branches at the top.",
    oneLiner: "The brain's loudest voice — these cells shout when you see, hear, or remember.",
    whatItDoes:
      "Pyramidal neurons are the principal output cells of the cortex. They take in thousands of signals through their dendrites and fire long axons that reach far across the brain — the wiring of conscious thought.",
    whyItMatters:
      "About 80% of the cells in your cortex are pyramidal. When you see a face or learn a name, it's their forest of connections that holds the memory.",
  },
  {
    id: "coral-fan",
    segId: "864691136662432990",
    galleryState: "basket_cells.json",
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
    segId: "864691135572094189",
    galleryState: "chandelier_cells.json",
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
    segId: "864691135919630768",
    galleryState: "martinotti_cells.json",
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
    segId: "864691135279086497",
    galleryState: "layer4_cells.json",
    nickname: "Dust Star",
    scientificType: "Layer 4 Cell",
    morphologyPreset: "stellate",
    color: "#ffd9a8",
    shapeAnalogy: "A small round body with short, evenly-distributed dendrites reaching in every direction.",
    oneLiner: "The first stop for messages from your senses.",
    whatItDoes:
      "Layer 4 cells are where the cortex first hears from the rest of the brain. Sensory information from the thalamus lands here before it spreads upward through the cortex. Every photon, sound wave, or touch begins its cortical journey on cells like this one.",
    whyItMatters:
      "Layer 4 is the brain's sensory inbox. Without it, the world wouldn't reach the cortex.",
  },
  {
    id: "forest-floor",
    segId: "864691135113162137",
    galleryState: "astrocytes.json",
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

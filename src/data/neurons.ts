export type CellCategory = "excitatory" | "inhibitory" | "other";

export interface FeaturedNeuron {
  id: string;              // route slug
  segId: string;            // Real MICrONS minnie65 segment ID (sourced from microns-explorer.org/gallery-mm3)
  nickname: string;
  scientificType: string;
  category: CellCategory;
  morphologyPreset: "pyramidal" | "basket" | "chandelier" | "martinotti" | "stellate" | "astrocyte";
  color: string;            // hex
  shapeAnalogy: string;     // "Lightning Tree", "Coral Fan", etc.
  oneLiner: string;          // shown on card
  whatItDoes: string;        // longer, on detail page
  whyItMatters: string;
  /** filename in gs://microns-static-links/mm3/ — the curated gallery state file.
   *  Optional: cells sourced from user-shared Spelunker states don't have one. */
  galleryState?: string;
}

export const CATEGORY_LABEL: Record<CellCategory, string> = {
  excitatory: "Excitatory",
  inhibitory: "Inhibitory",
  other: "Other",
};

export const CATEGORY_BLURB: Record<CellCategory, string> = {
  excitatory: "These cells push their targets toward firing — the cortex's signal carriers.",
  inhibitory: "These cells push their targets away from firing — the cortex's regulators and timekeepers.",
  other: "Not neurons. The cells around the cells.",
};

/** Build a Neuroglancer URL that opens this cell's curated MICrONS gallery view.
 *  Returns null if the cell has no associated gallery state. */
export function neuroglancerUrl(galleryState: string | undefined): string | null {
  if (!galleryState) return null;
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
    category: "excitatory",
    morphologyPreset: "pyramidal",
    color: "#8edaff",
    shapeAnalogy: "A pyramid soma with one thick apical dendrite rising toward the cortical surface and splintering into a tuft. Basal dendrites spread out near the soma.",
    oneLiner: "Tall apical dendrite, sprawling basal arbor. A major output cell of cortex.",
    whatItDoes:
      "Layer 5 thick-tufted pyramidal neurons are major output cells of cortex. They gather thousands of inputs across their dendrites and forward processed visual information to other regions of the brain.",
    whyItMatters:
      "These are some of the largest, longest-reaching cells in cortex. The mesh you're looking at is reconstructed straight from electron microscopy — every dendrite, every spine.",
  },
  {
    id: "coral-fan",
    segId: "864691136662432990",
    galleryState: "basket_cells.json",
    nickname: "Coral Fan",
    scientificType: "Parvalbumin Basket Cell",
    category: "inhibitory",
    morphologyPreset: "basket",
    color: "#c89cd0",
    shapeAnalogy: "A round cell body wrapped in a dense radial spray of axon collaterals, like coral on the seafloor.",
    oneLiner: "A fast inhibitory interneuron that helps cortex stay in time.",
    whatItDoes:
      "Parvalbumin basket cells target the cell body and proximal dendrites of nearby neurons. From that close-in spot they can strongly regulate when those cells fire.",
    whyItMatters:
      "They balance excitation in cortical circuits and coordinate the fast network rhythms cortex uses to organize itself.",
  },
  {
    id: "candelabra",
    segId: "864691135572094189",
    galleryState: "chandelier_cells.json",
    nickname: "Candelabra",
    scientificType: "Chandelier Cell",
    category: "inhibitory",
    morphologyPreset: "chandelier",
    color: "#ffd24a",
    shapeAnalogy: "Vertical rows of candle-like axon cartridges hanging down, hence the classic 'chandelier' name.",
    oneLiner: "An inhibitory interneuron that aims at the most powerful control point on its targets.",
    whatItDoes:
      "Chandelier cells contact the axon initial segment of pyramidal cells — the trigger zone where action potentials begin. Because of where they connect, they can strongly influence whether their targets send signals onward.",
    whyItMatters:
      "Among the most morphologically distinctive cells in cortex. Reconstructions like this one let us see those axon cartridges in three dimensions.",
  },
  {
    id: "reaching-hand",
    segId: "864691135919630768",
    galleryState: "martinotti_cells.json",
    nickname: "Reaching Hand",
    scientificType: "Martinotti Cell",
    category: "inhibitory",
    morphologyPreset: "martinotti",
    color: "#3ee0bc",
    shapeAnalogy: "A small soma with axons that reach upward toward superficial cortical layers.",
    oneLiner: "Less a stop sign at the cell body, more a dimmer switch on the branches.",
    whatItDoes:
      "Martinotti cells are somatostatin-associated inhibitory interneurons. They commonly target the distal dendrites of pyramidal neurons, regulating signals as they arrive on the dendritic tuft.",
    whyItMatters:
      "Their long, climbing axons let one cell shape activity across a wide swath of cortical column.",
  },
  {
    id: "dust-star",
    segId: "864691135279086497",
    galleryState: "layer4_cells.json",
    nickname: "Dust Star",
    scientificType: "Layer 4 Cell",
    category: "excitatory",
    morphologyPreset: "stellate",
    color: "#8edaff",
    shapeAnalogy: "A small round body with short, densely-branched dendrites reaching outward in every direction.",
    oneLiner: "From layer 4 — where sensory signals from the thalamus first arrive in cortex.",
    whatItDoes:
      "Layer 4 cells live in the layer especially involved in receiving and transforming sensory input in primary sensory cortex. In visual cortex, they participate in the early processing of visual signals arriving from the thalamus.",
    whyItMatters:
      "'Layer 4 cell' is a broad anatomical label that covers several subtypes — the safest description for this one is the layer, the volume, and the shape you can see in front of you.",
  },
  {
    id: "forest-floor",
    segId: "864691135113162137",
    galleryState: "astrocytes.json",
    nickname: "Forest Floor",
    scientificType: "Protoplasmic Astrocyte",
    category: "other",
    morphologyPreset: "astrocyte",
    color: "#c2c8ff",
    shapeAnalogy: "Star-shaped, with a fluff of fine processes that contact many nearby synapses at once.",
    oneLiner: "Not a neuron — a star-shaped glial cell that surrounds synapses and supports the circuit.",
    whatItDoes:
      "Protoplasmic astrocytes are gray-matter glial cells. They surround synapses, contact blood vessels, regulate the chemical environment around neurons, and help keep cortical circuits healthy.",
    whyItMatters:
      "For most of the last century these cells were dismissed as packing glue. We now know they're active partners in how the brain works — and we're still learning what they do.",
  },
  {
    id: "crown",
    segId: "864691135855890478",
    galleryState: "layer23_cells.json",
    nickname: "Crown",
    scientificType: "Layer 2/3 Pyramidal",
    category: "excitatory",
    morphologyPreset: "pyramidal",
    color: "#8edaff",
    shapeAnalogy: "A smaller pyramid soma whose apical dendrite reaches up to layer 1 and ends in a tuft like a small crown.",
    oneLiner: "The most numerous excitatory cell in cortex — smaller cousin of Lightning Tree.",
    whatItDoes:
      "Layer 2/3 pyramidal neurons live near the cortical surface and form most of the local connections within and between cortical columns.",
    whyItMatters:
      "Where Layer 5 thick-tufted cells send messages out of cortex, Layer 2/3 cells gossip laterally — between cortical regions, between hemispheres, between sensory modalities. They're the workhorse of within-cortex communication.",
  },
  {
    id: "spindle",
    segId: "864691135407923657",
    galleryState: "bipolar_cells.json",
    nickname: "Spindle",
    scientificType: "Bipolar Interneuron",
    category: "inhibitory",
    morphologyPreset: "martinotti", // closest visual analogue we already have for the per-card preview placeholder
    color: "#ffae3e",
    shapeAnalogy: "A small, narrow cell body with one dendrite reaching up and one reaching down — a slim, upright spindle.",
    oneLiner: "An inhibitory interneuron whose narrow vertical shape spans cortical layers.",
    whatItDoes:
      "Bipolar interneurons (often VIP-expressing) typically inhibit other inhibitory cells. The result is disinhibition: when they fire, the cells they suppress can't suppress pyramidals, so pyramidals get louder.",
    whyItMatters:
      "Interneurons that inhibit interneurons sound paradoxical, but they're how the cortex flexibly amplifies certain signals. They're a key gear in attention and learning.",
  },
  {
    id: "watcher",
    segId: "864691136194411734",
    galleryState: "microglia_set.json",
    nickname: "Watcher",
    scientificType: "Microglia",
    category: "other",
    morphologyPreset: "astrocyte", // closest visual analogue for the placeholder; real mesh shows distinct shape
    color: "#d4ff7e",
    shapeAnalogy: "A small body with thin, reaching arms that constantly extend and retract, sampling the tissue around it.",
    oneLiner: "Not a neuron — the brain's resident immune cell, always on patrol.",
    whatItDoes:
      "Microglia are the brain's macrophages. They survey their territory, eat debris, prune unused synapses during development, and respond to damage or infection.",
    whyItMatters:
      "Their fingertips touch every synapse in their neighborhood every few hours. They're not just defenders — they shape circuits across a lifetime.",
  },
  // Three cells from a user-shared Spelunker view of a single circuit motif —
  // a pyramidal cell with two of the inhibitory cells that contact it. Names
  // are provisional (chosen from morphology, not from a curated label).
  {
    id: "spire",
    segId: "864691135214123064",
    nickname: "Spire",
    scientificType: "Pyramidal Neuron",
    category: "excitatory",
    morphologyPreset: "pyramidal",
    color: "#8edaff",
    shapeAnalogy: "A pyramid soma with a single tall apical dendrite climbing upward — narrow at the base, opening into a tuft near the top.",
    oneLiner: "The center of its local circuit — every nearby inhibitory cell reaches toward it.",
    whatItDoes:
      "Pyramidal neurons are cortex's main excitatory cells. They gather inputs across a wide dendritic field and forward processed signals to other regions of the brain.",
    whyItMatters:
      "Cells like Spire are the anchors of cortical micro-circuits. The cells around it spend most of their effort regulating exactly when it fires.",
  },
  {
    id: "aura",
    segId: "864691135948123745",
    nickname: "Aura",
    scientificType: "Layer 5 Thick-Tufted Pyramidal",
    category: "excitatory",
    morphologyPreset: "pyramidal",
    color: "#8edaff",
    shapeAnalogy: "A pyramid soma with a tall, slender apical dendrite climbing toward the cortical surface, basal dendrites fanning out below.",
    oneLiner: "Another Layer 5 thick-tufted cell — and the cell whose synapse you'll see up close in a moment.",
    whatItDoes:
      "Like Lightning Tree, Aura is a major output cell of cortex. Each spine on its dendrites is a place where another neuron talks to it — thousands of contacts shaping when this cell fires.",
    whyItMatters:
      "Layer 5 cells are hubs. Even one of them gathers inputs from thousands of other neurons — and one of those inputs is exactly what you're about to look at.",
  },
  {
    id: "tendril",
    segId: "864691136195546856",
    nickname: "Tendril",
    scientificType: "Long-range Axon",
    category: "inhibitory",
    morphologyPreset: "martinotti",
    color: "#4a8bff",
    shapeAnalogy: "Mostly axon — a long thin cable threading across the tissue, with the cell body itself somewhere far outside this volume.",
    oneLiner: "Not a whole cell — just the axon of a distant neuron, reaching across cortex to make a synapse.",
    whatItDoes:
      "Many of the cables you see in a connectome don't belong to local cells — they're axons sent in from neurons whose somas live somewhere far away. This is one of those long axons. Its job is to deliver a signal to a specific contact point on a specific cell — and that contact is exactly what you see in the synapse stage.",
    whyItMatters:
      "Most of cortex is wires arriving from elsewhere. Cells like the one this axon belongs to are how distant brain regions stay connected — and tracing where each cable comes from is one of the things the connectome lets us do.",
  },
];

export function getNeuronById(id: string): FeaturedNeuron | undefined {
  return featuredNeurons.find((n) => n.id === id);
}

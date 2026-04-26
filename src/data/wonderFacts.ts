export interface WonderFact {
  id: string;
  text: string;
  source?: string;
}

export const wonderFacts: WonderFact[] = [
  { id: "f1", text: "A single neuron can connect to thousands of others." },
  { id: "f2", text: "Your thoughts emerge from a living electrical forest." },
  { id: "f3", text: "Stretched end to end, the wiring in one human brain reaches the moon — and back." },
  { id: "f4", text: "A piece of brain the size of a grain of rice contains about 50,000 neurons." },
  { id: "f5", text: "Each neuron speaks in tiny pulses — about 1/1000th of a second long." },
  { id: "f6", text: "We have mapped a cubic millimeter of mouse cortex, atom by atom of structure." },
  { id: "f7", text: "Some neurons branch like coral. Some like lightning. Some like a slow river." },
  { id: "f8", text: "The same forces that braid galaxies together also braid your neurons." },
];

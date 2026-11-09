/**
 * Gray Matter's scene library. Each treatment states what it is for and what produces it. build() turns
 * a planned scene and its measured timing into the props that treatment renders in compositions.jsx.
 */
const ANIMA = "anima@f0249c4 kit (geometry) + remotion (motion)";
const passData = ({ scene, from, duration }) => ({ treatment: scene.treatment, from, duration, ...scene.data });

export const SCENES = {
  "everyday-to-biology": { purposes: ["Tie an everyday behaviour to the structure involved"], background: "white", skill: "remotion, with a public-domain Gray's Anatomy plate", build: passData },
  "region-highlight": { purposes: ["Show exactly where a named region is and what it does"], background: "white", skill: "remotion, with a public-domain Gray's Anatomy plate", build: passData },
  "activity-compare": { purposes: ["Compare one region between two conditions, naming only the direction of change"], background: "white", skill: "remotion, with a public-domain Gray's Anatomy plate", build: passData },
  "neuron-to-spines": { purposes: ["Go from a whole neuron to a labelled synapse and show a structural change"], background: "white", skill: ANIMA, build: passData },
  "mechanism-rescue": { purposes: ["Show a causal test: the same process with and without the intervention"], background: "white", skill: ANIMA, build: passData },
  "evidence-ledger": { purposes: ["State what is established, associated, causal in animals, and uncertain"], background: "white", skill: ANIMA, build: passData },
};

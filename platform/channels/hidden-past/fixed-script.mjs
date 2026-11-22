/**
 * Written directly on the owner's instruction, from the verified claims in story.mjs, to get this video out
 * without waiting on the model providers' quotas. It did NOT pass through the script engine or its
 * independent critic. Set USE_FIXED to false to return this channel to the engine.
 */
export const USE_FIXED = true;
export const SENTENCES = [
  { text: "Whose arrest does a famous Sarajevo photograph really show?", scene: 0, claim_ids: ["c5"] },
  { text: "In June 1914, the archduke left city hall and was soon killed.", scene: 0, claim_ids: ["c1"] },
  { text: "Sarajevo is now in Bosnia and Herzegovina.", scene: 1, claim_ids: ["c2"] },
  { text: "Then, Austria-Hungary ruled it.", scene: 2, claim_ids: ["c3"] },
  { text: "Next day, The New York Times reported it.", scene: 3, claim_ids: ["c4"] },
  { text: "The photo is often called Gavrilo Princip's arrest.", scene: 4, claim_ids: ["c5"] },
  { text: "Scholars say it shows a bystander, Ferdinand Behr.", scene: 4, claim_ids: ["c5"] },
  { text: "The picture is real.", scene: 4, claim_ids: ["c5"] },
  { text: "The caption is in doubt.", scene: 4, claim_ids: ["c5", "c6"] },
];
export const METADATA = {
  title: "Whose Arrest Does This Famous 1914 Photo Really Show?",
  description: "A photograph from Sarajevo, 1914, is often captioned as the arrest of Gavrilo Princip. Several scholars say it shows a bystander, Ferdinand Behr. Sources and image credits are below.\n\n#Shorts #History #WW1 #Sarajevo #HiddenPast\n\nSources:\n- https://en.wikipedia.org/wiki/Assassination_of_Archduke_Franz_Ferdinand\n- https://commons.wikimedia.org/wiki/File:Ferdinand_Behr_arrested_in_Sarajevo_1914.jpg\n- The New York Times, 29 June 1914, via Wikimedia Commons / Internet Archive\n\nImages: Wikimedia Commons (Imperial War Museums and others).",
  tags: ["history", "Sarajevo 1914", "Gavrilo Princip", "Ferdinand Behr", "World War I", "historical photographs"],
};

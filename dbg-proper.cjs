const V = require("./scripts/validate-script-voice.cjs");
const RESEARCH = { named_entities: [{ name: "Jerome Powell", kind: "person" }, { name: "Federal Reserve", kind: "organization" }, { name: "Ohio", kind: "place" }] };
const sec = (o) => ({ sections: Object.entries(o).map(([id, voiceover]) => ({ id, voiceover })) });
const same = V.validateVoice(sec({ a: "The Fed cut rates in Ohio. The banks raised fees by 2%." }), RESEARCH);
console.log("rows:", JSON.stringify(same.rows.map((r) => ({ i: r.i, s: r.sentence, fails: r.fails })), null, 1));

// Hidden Past long-form, 16 Nov 2026: "Elizabeth I's Famous Speech: Did She Really Say It? (Tilbury, 1588)".
// STRUCTURE REFERENCE (not a fact source, not a visual source): Epic History TV, "The Greatest Speech in History? Alexander the Great and the Opis Mutiny" (RlKJDwViNKs)
// and "Napoleonic Wars: Battle of Austerlitz 1805" (bhQe2cjr5XQ), measured 16 Nov 2026 (channel-reverse/reports/EpichistoryTv.md). What we keep is the FORMULA only:
//   a famous primary-source speech told in the speaker's own reconstructed words -> an honesty note that the exact words are not known -> context on a map ->
//   chaptered, chronological beats -> a calm narrator, no direct address until the close -> a closing question. Everything else is ours: our script, our sources, our pictures.
// Not reused from the reference: its illustrations, its text, its map animation, its thumbnails, its title. All pictures below are public-domain or CC-licensed Commons files
// with the credit on screen; the speech text is the 1654 printed English of Leonel Sharp's version (public domain), quoted from the Wikipedia article.
// Facts: ONLY from the Wikipedia articles fetched 16 Nov 2026 (output/replicate-2026-11-16/hidden-past/sources/): Speech to the Troops at Tilbury, Spanish Armada, Elizabeth I.
// Where those articles disagree (the date of the speech) the narration says so and follows the article on the speech.
const A = (id) => `lf2/hidden-past/${id}.jpg`;
const C = { Tilbury: [0.3582, 51.4606], London: [-0.1275, 51.5072], Dunkirk: [2.3775, 51.0383], Calais: [1.8564, 50.9481], Gravelines: [2.1283, 50.9858], Plymouth: [-4.1422, 50.3714], Dover: [1.3089, 51.1295] };
const W = (t, slug) => ({ title: `Wikipedia: ${t}`, url: `https://en.wikipedia.org/wiki/${slug}`, retrieved: "2026-11-16" });

export const SOURCES = {
  SP: W("Speech to the Troops at Tilbury", "Speech_to_the_Troops_at_Tilbury"),
  AR: W("Spanish Armada", "Spanish_Armada"),
  EL: W("Elizabeth I", "Elizabeth_I"),
  COORDS: { title: "Coordinates: Wikipedia API (prop=coordinates) for Tilbury, London, Dunkirk, Calais, Gravelines, Plymouth, Dover", url: "https://en.wikipedia.org/w/api.php", retrieved: "2026-11-16" },
  COMMONS: { title: "Pictures via Wikimedia Commons (credits on screen; public/lf2/hidden-past/ATTRIBUTIONS.json)", url: "https://commons.wikimedia.org/", retrieved: "2026-11-16" },
  EOX: { title: "Sentinel-2 cloudless imagery by EOX (CC BY 4.0), contains modified Copernicus Sentinel data", url: "https://s2maps.eu", retrieved: "2026-11-16" },
  EPIC: { title: "Structure reference (not a fact source): Epic History TV, The Greatest Speech in History? Alexander the Great and the Opis Mutiny", url: "https://www.youtube.com/watch?v=RlKJDwViNKs", retrieved: "2026-11-16" },
};

const SOUTHEAST = { f: 0, center: [1.0, 51.1], zoom: 6.6, pitch: 0, bearing: 0 };
const THAMES = { f: 0, center: [0.9, 51.35], zoom: 8.2, pitch: 0, bearing: 0 };
const L = (at, text, kind, from, dx, dy) => ({ at, text, kind, from, dx, dy });
const SH = "Leonel Sharp's version, printed 1654 · as quoted in Wikipedia";

export const EPISODE = {
  channel: "hidden-past", slug: "tilbury", title: "Elizabeth I's Famous Speech: Did She Really Say It? (Tilbury, 1588)", target_minutes: 8,
  sound: { bed: "MUSIC_DOC_PASSING", bed_rel_db: -20, dip_scenes: [] },
  beats: [
    { id: "T01", part: "the words", ref: "RlKJDwViNKs 0:00: the speech first, in the speaker's own words", src: ["SP", "COMMONS"],
      vo: "“I know I have the body of a weak and feeble woman, but I have the heart and stomach of a king, and of a king of England too.” It is one of the most quoted speeches in English history. Queen Elizabeth the First is said to have given it to an army at Tilbury, in 1588. But the fleet that army was gathered to stop had already been driven away. And the most trusted version of those words was not printed until 1654.",
      scene: { type: "footage", image: A("tb-armada-portrait"), date: "TILBURY · 1588", grade: "warm", pos: "50% 30%", captions: [{ text: "“I have the heart and stomach of a king, and of a king of England too.”", source: SH, from: 40 }] } },
    { id: "T02", part: "the question", ref: "RlKJDwViNKs 0:00-0:43: the honesty note before the speech", src: ["SP", "COMMONS"],
      vo: "So what happened at Tilbury? Who heard her, what did she actually say, and why can nobody be sure? To answer that, we have to start with the fleet she was waiting for.",
      scene: { type: "footage", image: A("tb-tilbury-illus"), date: "TILBURY", grade: "warm", captions: [{ text: "Whether she used these words, we do not know.", source: "Historian David Loades, quoted in Wikipedia, 'Speech to the Troops at Tilbury'", from: 90 }] } },
    { id: "T03", part: "the Armada", ref: "bhQe2cjr5XQ 1:03: the campaign map before the battle", src: ["AR", "EL", "COORDS", "EOX"],
      vo: "In the summer of 1588 a great Spanish fleet, the Armada, set out for the English Channel. Its plan was to carry an invasion force under the Duke of Parma from the Netherlands to the south-east coast of England. When it left Lisbon, according to the article on the Armada, it had one hundred and forty-one ships, more than ten thousand sailors, and more than nineteen thousand soldiers.",
      scene: { type: "map", base: "s2", terrain: 0, date: "SUMMER 1588", views: [{ ...SOUTHEAST, zoom: 5.8 }, { ...SOUTHEAST, f: 300 }],
        points: [{ id: "pl", at: C.Plymouth, from: 40 }, { id: "ca", at: C.Calais, pulse: true, from: 70 }, { id: "du", at: C.Dunkirk, from: 90 }, { id: "lo", at: C.London, from: 110 }],
        labels: [L(C.Plymouth, "Plymouth", "place", 44, 18, -26), L(C.Calais, "Calais", "place", 74, 18, 30), L(C.Dunkirk, "Dunkirk", "place", 94, 18, -26), L(C.London, "London", "place", 114, -150, -10), L([-1.2, 49.6], "English Channel", "water", 30), L([4.6, 52.0], "Netherlands", "country", 60)],
        tags: [{ text: "141 ships · 10,138 sailors · 19,315 soldiers", x: 960, y: 280, from: 140 }] } },
    { id: "T04", part: "the Armada", ref: "bhQe2cjr5XQ 8:32: the battle, with the period picture", src: ["AR", "COMMONS"],
      vo: "An English fleet under Francis Drake and Charles Howard went out to meet it. The Armada reached Calais largely intact. Then, in the middle of the night of the seventh to the eighth of August, new style, the English set fireships alight and sent them downwind among the anchored Spanish ships. The Armada scattered, and it suffered further losses in the Battle of Gravelines.",
      scene: { type: "footage", image: A("tb-fireships"), date: "7–8 AUGUST 1588", grade: "warm", captions: [{ text: "English fireships launched at the Spanish Armada off Calais.", source: "Wikipedia, 'Spanish Armada' (Commons, public domain)", from: 100 }] } },
    { id: "T05", part: "the camp", ref: "bhQe2cjr5XQ 5:56: the move to the battlefield, on the map", src: ["AR", "SP", "COORDS", "EOX"],
      vo: "But England did not yet know. The result of the fireship attack and of Gravelines had not reached the country. So the Earl of Leicester assembled four and a half thousand militia at West Tilbury, in Essex, to guard the Thames estuary against any attack upriver towards London. The fear was that the Duke of Parma's army might still try to cross from Dunkirk.",
      scene: { type: "map", base: "s2", terrain: 0, date: "AUGUST 1588", views: [{ ...THAMES, zoom: 6.8 }, { ...THAMES, f: 280 }],
        points: [{ id: "ti", at: C.Tilbury, pulse: true, from: 40 }, { id: "lo", at: C.London, from: 70 }, { id: "du", at: C.Dunkirk, from: 90 }],
        lines: [{ id: "fear", coords: [C.Dunkirk, C.Tilbury], dash: [2, 1.5], from: 120, dur: 70, arrow: true }],
        labels: [L(C.Tilbury, "Tilbury", "place", 44, 18, 30), L(C.London, "London", "place", 74, -150, -26), L(C.Dunkirk, "Dunkirk", "place", 94, -110, 30), L([1.0, 51.9], "North Sea", "water", 30)],
        tags: [{ text: "4,500 militia at West Tilbury", x: 1080, y: 280, from: 150 }] } },
    { id: "T06", part: "the camp", ref: "RlKJDwViNKs: the named commander beside the speaker", src: ["SP", "COMMONS"],
      vo: "Leicester, Robert Dudley, was the Queen's lieutenant general, and he rode at her side on the day. In the speech, she tells the troops that he will command in her place, and that never had a prince commanded a more noble or worthy subject.",
      scene: { type: "footage", image: A("tb-leicester"), date: "ROBERT DUDLEY · EARL OF LEICESTER", grade: "warm", pos: "50% 25%", captions: [{ text: "“My lieutenant general shall be in my stead.”", source: SH, from: 90 }] } },
    { id: "T07", part: "the day", ref: "RlKJDwViNKs: the speaker arrives, shown, not told", src: ["SP", "COMMONS"],
      vo: "On the day of the speech, the Queen left her bodyguard before Tilbury Fort and went among her troops with an escort of just six men. She wore white, with a silver breastplate, and rode a grey gelding. One account, quoted by the historian J. E. Neale, says she passed like some Amazonian empress through all her army.",
      scene: { type: "footage", image: A("tb-bodleian"), date: "TILBURY", grade: "warm", pos: "50% 40%", captions: [{ text: "“She passed like some Amazonian empress through all her army.”", source: "Quoted by J. E. Neale; Wikipedia, 'Speech to the Troops at Tilbury'", from: 120 }] } },
    { id: "T08", part: "the date", ref: "RlKJDwViNKs 0:00: the honesty note, stated plainly", src: ["SP", "AR", "EL"],
      vo: "Even the date is not settled. The article on the speech gives the ninth of August in the old calendar, which is the nineteenth in ours. The article on the Armada says the eighteenth of August. The article on Elizabeth gives the eighth, old style. This video follows the article on the speech.",
      scene: { type: "figures", image: A("tb-fort"), title: "When was the speech? Wikipedia's articles disagree", rows: [{ value: "9 / 19 Aug", label: "Old Style / New Style", source: "Wikipedia, 'Speech to the Troops at Tilbury'" }, { value: "18 Aug", label: "Elizabeth went to Tilbury", source: "Wikipedia, 'Spanish Armada'" }, { value: "8 Aug", label: "Old Style, Leicester's invitation to inspect the troops", source: "Wikipedia, 'Elizabeth I'" }] } },
    { id: "T09", part: "the speech", ref: "RlKJDwViNKs: the speech in the speaker's words, illustrated, no narrator commentary", src: ["SP", "COMMONS"],
      vo: "Here is the version most historians trust. “My loving people. We have been persuaded by some that are careful of our safety, to take heed how we commit ourselves to armed multitudes, for fear of treachery. But I assure you, I do not desire to live to distrust my faithful and loving people. Let tyrants fear.”",
      scene: { type: "footage", image: A("tb-apothecaries"), date: "THE SPEECH · 1", grade: "warm", captions: [{ text: "“Let tyrants fear.”", source: SH, from: 120 }] } },
    { id: "T10", part: "the speech", ref: "RlKJDwViNKs: the line everyone remembers", src: ["SP", "COMMONS"],
      vo: "“I know I have the body but of a weak, feeble woman, but I have the heart and stomach of a king, and of a king of England too, and think foul scorn that Parma or Spain, or any prince of Europe, should dare to invade the borders of my realm.”",
      scene: { type: "footage", image: A("tb-armada-portrait"), date: "THE SPEECH · 2", grade: "warm", pos: "50% 22%", captions: [{ text: "“I have the heart and stomach of a king.”", source: SH, from: 100 }] } },
    { id: "T11", part: "the speech", ref: "RlKJDwViNKs: the promise to the soldiers", src: ["SP", "COMMONS"],
      vo: "“I myself will take up arms. I myself will be your general, judge, and rewarder of every one of your virtues in the field. We do assure you, on the word of a prince, that rewards shall be duly paid. We shall shortly have a famous victory over these enemies of my God, of my kingdom, and of my people.”",
      scene: { type: "footage", image: A("tb-tilbury-illus"), date: "THE SPEECH · 3", grade: "warm", captions: [{ text: "“I myself will be your general.”", source: SH, from: 110 }] } },
    { id: "T12", part: "the source", ref: "RlKJDwViNKs: where the words come from", src: ["SP"],
      vo: "Now the problem. That version comes from a letter by Leonel Sharp, who was attached to Leicester at Tilbury and later became chaplain to the Duke of Buckingham. Sharp wrote that he was ordered, the day after, to repeat the speech to the whole army. And he added: no man hath it but myself, and such as I have given it to. It was printed in 1654, in a book called Cabala, Mysteries of State. That is sixty-six years after Tilbury.",
      scene: { type: "figures", image: A("tb-gravelines"), title: "How the words reached us", rows: [{ value: "1588", label: "The speech at Tilbury", source: "Wikipedia, 'Speech to the Troops at Tilbury'" }, { value: "1654", label: "Sharp's version printed in 'Cabala, Mysteries of State'", source: "Wikipedia, 'Speech to the Troops at Tilbury'" }, { value: "66 years", label: "the gap between the two (our subtraction)", source: "1654 − 1588" }] } },
    { id: "T13", part: "other versions", ref: "bhQe2cjr5XQ: a second account that complicates the first", src: ["SP", "AR", "COMMONS"],
      vo: "There are other versions. A poet, James Aske, printed one in verse in 1588. In 1612 William Leigh recorded a very different one, full of scripture: what are these proud Philistines, that they should revile the host of the living God? The article on the Armada says the speech survives in at least six slightly different versions.",
      scene: { type: "footage", image: A("tb-bodleian"), date: "SIX VERSIONS", grade: "warm", pos: "50% 30%", captions: [{ text: "“What are these proud Philistines, that they should revile the host of the living God?”", source: "William Leigh's version, 1612 · as quoted in Wikipedia", from: 100 }] } },
    { id: "T14", part: "the verdict", ref: "RlKJDwViNKs: the claim, then its limits", src: ["SP"],
      vo: "So do historians believe it? Many do. J. E. Neale saw no serious reason to reject it. In 1997 Janet Green argued that substantial evidence exists for its being genuine. But David Loades wrote that we do not know whether she used these words, though they have an authentic, theatrical ring. And some, such as Miller Christy in 1919, doubted it.",
      scene: { type: "figures", image: A("tb-armada-portrait"), title: "Historians on the speech", rows: [{ value: "Neale", label: "“I see no serious reason for rejecting the speech.”", source: "J. E. Neale · quoted in Wikipedia" }, { value: "Green · 1997", label: "“Substantial evidence exists for believing the Tilbury oration is genuine.”", source: "Sixteenth Century Journal · quoted in Wikipedia" }, { value: "Loades", label: "“Whether she used these words, we do not know.”", source: "David Loades · quoted in Wikipedia" }, { value: "Christy · 1919", label: "Questioned its authenticity", source: "Wikipedia, 'Speech to the Troops at Tilbury'" }] } },
    { id: "T15", part: "what is certain", ref: "bhQe2cjr5XQ: the aftermath begins", src: ["SP"],
      vo: "What we can say is that a speech was given, and that people talked about it at once. On the tenth of August, one day after, a ballad describing the Queen's visit was registered by the London printer John Wolfe. It was written by Thomas Deloney, one of the most popular poets of the day.",
      scene: { type: "footage", image: A("tb-fort"), date: "10 AUGUST 1588", grade: "warm", captions: [{ text: "A ballad on the Queen at Tilbury was registered the next day.", source: "Wikipedia, 'Speech to the Troops at Tilbury'", from: 90 }] } },
    { id: "T16", part: "the day after", ref: "bhQe2cjr5XQ 14:25: the aftermath, in numbers", src: ["AR"],
      vo: "Then the effort was wound down. According to the article on the Armada, the day after her speech Elizabeth ordered the army disbanded; the article on the speech says the troops were discharged two days later. The camp at Tilbury was dissolved five days later, and the navy was discharged and sent home without pay. Typhus, scurvy and dysentery swept through the crews. Of one ship's crew of five hundred, more than two hundred died. In all, upwards of three thousand men perished.",
      scene: { type: "figures", image: A("tb-gravelines"), title: "After the speech", rows: [{ value: "Day after", label: "The army ordered disbanded", source: "Wikipedia, 'Spanish Armada'" }, { value: "Without pay", label: "The navy discharged and sent home", source: "Wikipedia, 'Spanish Armada'" }, { value: "200+ of 500", label: "Dead from the crew of the Bonaventure", source: "Wikipedia, 'Spanish Armada'" }, { value: "3,000+", label: "Men who perished in all", source: "Wikipedia, 'Spanish Armada'" }] } },
    { id: "T17", part: "the cost", ref: "RlKJDwViNKs: the speaker's promise against what followed", src: ["AR", "SP", "COMMONS"],
      vo: "The admiral, Lord Howard, wrote to the Queen's treasurer: it would grieve any man's heart to see them that have served so valiantly die so miserably. The speech promised the soldiers rewards, on the word of a prince. The sailors who had actually fought the Armada were sent home without pay. The defence had cost nearly four hundred thousand pounds.",
      scene: { type: "footage", image: A("tb-gravelines"), date: "AFTER THE ARMADA", grade: "warm", captions: [{ text: "“It would grieve any man's heart to see them that have served so valiantly die so miserably.”", source: "Lord Howard to Lord Burghley · quoted in Wikipedia, 'Spanish Armada'", from: 100 }] } },
    { id: "T18", part: "close", ref: "RlKJDwViNKs 7:11: the close, then a question", src: ["SP", "COMMONS"],
      vo: "So here is what is solid. A queen rode among her troops at Tilbury, in armour, after the danger had passed, and the story of it spread within a day. And here is what is not: her exact words. Does it matter whether she said them? Tell us what you think in the comments.",
      scene: { type: "footage", image: A("tb-armada-portrait"), date: "TILBURY · 1588", grade: "warm", pos: "50% 30%", captions: [{ text: "Whether she used these words, we do not know.", source: "David Loades, quoted in Wikipedia", from: 80 }] } },
  ],
  thumbs: [{ name: "thumb1-tilbury", big: "Did she\nsay it?", small: "Tilbury 1588", image: A("tb-armada-portrait") }],
};

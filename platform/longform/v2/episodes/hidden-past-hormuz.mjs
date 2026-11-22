// Hidden Past long form: "The Last Time the US Fought for the Strait of Hormuz" (the 1987-88 Tanker War, Operation Earnest Will, the Samuel B. Roberts mine, Operation Praying Mantis, Iran Air 655,
// and the 2026 Strait of Hormuz crisis that makes it matter now). Chosen with the topic gate in docs/longform/CONTENT-SPEC.md: a live trigger (the 2026 closure of the strait, the biggest disruption of the
// world oil market on record per Wikipedia), a one-sentence stake, forgotten history that fits the channel ("the events they didn't teach you"), lawful pictures (US Navy photographs and 1988 Navy news video,
// all public domain on Commons) and a measured winner pattern (geopolitics with a "why/last time" thesis: RealLifeLore top titles). Visual identity: RealLifeLore, "Why The Nepal Flood Was WAY Scarier Than You
// Think" (WiRLNEl-4bk): real footage and credited pictures first, stacked sourced figures, a pivot to the real question, maps after, caption boxes in the source's own words.
// Every narration line is built from the Wikipedia articles saved in data/longform/hidden-past/hormuz/ (Strait of Hormuz, Tanker War, Operation Earnest Will, Operation Praying Mantis, USS Samuel B. Roberts,
// Iran Air Flight 655, 2026 Strait of Hormuz crisis, 2026 Iran war). Contested matters (why Flight 655 was shot down) are given as the two governments' stated positions, as the article gives them.
const A = (id) => `lf2/hidden-past/${id}.jpg`;
const V = (id) => `lf2/hidden-past/clips/${id}.mp4`;
const CRED = "US Navy news video, 30 April 1988, via Wikimedia Commons · public domain";

export const SOURCES = {
  STR: { title: "Strait of Hormuz", url: "https://en.wikipedia.org/wiki/Strait_of_Hormuz", retrieved: "2026-11-14" },
  TW: { title: "Tanker war", url: "https://en.wikipedia.org/wiki/Tanker_war", retrieved: "2026-11-14" },
  EW: { title: "Operation Earnest Will", url: "https://en.wikipedia.org/wiki/Operation_Earnest_Will", retrieved: "2026-11-14" },
  PM: { title: "Operation Praying Mantis", url: "https://en.wikipedia.org/wiki/Operation_Praying_Mantis", retrieved: "2026-11-14" },
  SBR: { title: "USS Samuel B. Roberts (FFG-58)", url: "https://en.wikipedia.org/wiki/USS_Samuel_B._Roberts_(FFG-58)", retrieved: "2026-11-14" },
  F655: { title: "Iran Air Flight 655", url: "https://en.wikipedia.org/wiki/Iran_Air_Flight_655", retrieved: "2026-11-14" },
  CRISIS: { title: "2026 Strait of Hormuz crisis", url: "https://en.wikipedia.org/wiki/2026_Strait_of_Hormuz_crisis", retrieved: "2026-11-14" },
  NAVY: { title: "Navy News This Week, 30 April 1988: Operation Praying Mantis (US Navy, public domain)", url: "https://commons.wikimedia.org/wiki/File:Navy_News_This_Week_-_30_April_1988_-_Operation_Praying_Mantis.webm", retrieved: "2026-11-14" },
  COMMONS: { title: "US Navy photographs on Wikimedia Commons (see public/lf2/hidden-past/ATTRIBUTIONS.json)", url: "https://commons.wikimedia.org/", retrieved: "2026-11-14" },
  EOX: { title: "Sentinel-2 cloudless imagery by EOX (CC BY 4.0), contains modified Copernicus Sentinel data", url: "https://s2maps.eu", retrieved: "2026-11-14" },
};

// coordinates from the Wikipedia articles (Strait of Hormuz, Bahrain, Kharg Island, Kuwait City, Bandar Abbas). The mine position is "65 miles (105 km) east of Bahrain": drawn as an approximate point.
const STRAIT = [56.5, 26.6], BAHRAIN = [50.55, 26.08], KHARG = [50.31, 29.245], KUWAIT = [47.98, 29.37], BANDAR = [56.29, 27.2];
const MINE = [BAHRAIN[0] + 105 / (111.2 * Math.cos((BAHRAIN[1] * Math.PI) / 180)), BAHRAIN[1]];

export const EPISODE = {
  channel: "hidden-past", slug: "hormuz-1988", title: "The Last Time the US Fought for the Strait of Hormuz", target_minutes: 6,
  beats: [
    // ---- COLD OPEN: the stake in the first sentence, a real photograph, the source's own words
    { id: "Z01", part: "cold open", ref: "WiRLNEl-4bk 0:00: the authentic picture first, the credit on screen, a caption box in the source's words", src: ["SBR", "EW", "PM", "COMMONS"], frames: [100],
      vo: "In April 1988, a mine that cost an estimated fifteen hundred dollars nearly sank a United States Navy frigate. It blew a fifteen-foot hole in her hull, flooded her engine room and broke her keel. Four days later, the US Navy fought the largest of its five major surface battles since the Second World War.",
      scene: { type: "footage", image: A("hz-roberts-damage"), date: "APRIL 1988", captions: [{ text: "The mine that nearly sank Samuel B. Roberts had an estimated cost of $1,500.", source: "Wikipedia, 'USS Samuel B. Roberts (FFG-58)'", from: 40 }] } },
    { id: "Z02", part: "cold open", ref: "WiRLNEl-4bk 1:24: the stakes as stacked, sourced figures", src: ["CRISIS", "COMMONS"], frames: [150],
      vo: "That was in the Strait of Hormuz, and this year Iran has largely blocked it. Before the war, a quarter of the world's seaborne oil and a fifth of its liquefied natural gas passed through. By April, the International Maritime Organization counted about two thousand ships and twenty thousand sailors stranded in the Persian Gulf.",
      scene: { type: "figures", image: A("hz-convoy"), title: "The Strait of Hormuz, 2026", rows: [{ value: "25%", label: "of the world's seaborne oil passed through before the war" }, { value: "20%", label: "of its liquefied natural gas" }, { value: "2,000", label: "ships stranded in the Persian Gulf by 21 April (IMO)" }, { value: "20,000", label: "mariners stranded with them", source: "Source: Wikipedia, '2026 Strait of Hormuz crisis'" }] } },
    { id: "Z03", part: "cold open", ref: "WiRLNEl-4bk 2:40: the pivot to the real question", src: ["CRISIS", "NAVY"], frames: [60],
      vo: "Wikipedia calls it the largest disruption to world energy supply since the 1970s, and the largest in the history of the world oil market. But it is not the first time the United States was pulled into a fight over this strait. Few people remember the last time.",
      scene: { type: "footage", video: V("hz-ship-a"), videoLen: 8, credit: CRED, captions: [{ text: "…the largest disruption to world energy supply since the 1970s energy crisis as well as the largest in the history of the world oil market.", source: "Wikipedia, '2026 Strait of Hormuz crisis'", from: 20 }] } },
    // ---- THE PLACE
    { id: "Z04", part: "the strait", ref: "RealLifeLore map: the place on a terrain map with small uppercase labels", src: ["STR", "EOX"], frames: [150],
      vo: "The strait is a hundred and sixty-seven kilometres long, and at its narrowest, only thirty-nine kilometres wide. It is the only sea passage from the Persian Gulf to the open ocean.",
      scene: { type: "map", base: "s2", terrain: 0, views: [{ f: 0, center: [53.5, 27.2], zoom: 5.4, pitch: 0, bearing: 0 }, { f: 260, center: [56.4, 26.5], zoom: 7.6, pitch: 20, bearing: 0 }],
        points: [{ id: "st", at: STRAIT, pulse: true, from: 70 }, { id: "ba", at: BANDAR, from: 90 }], labels: [{ at: STRAIT, text: "Strait of Hormuz", kind: "water", dx: 20, dy: 40, from: 74 }, { at: BANDAR, text: "Bandar Abbas", kind: "place", dx: -130, dy: -26, from: 94 }, { at: [52.2, 27.6], text: "Persian Gulf", kind: "water", from: 30 }, { at: [58.3, 25.2], text: "Gulf of Oman", kind: "water", from: 40 }, { at: [55.6, 28.4], text: "Iran", kind: "country", from: 20 }, { at: [56.3, 25.9], text: "Musandam (Oman)", kind: "place", from: 100 }],
        tags: [{ text: "167 km long · 39 km at its narrowest", x: 1120, y: 300, from: 120 }] } },
    // ---- THE TANKER WAR
    { id: "Z05", part: "the tanker war", ref: "WiRLNEl-4bk: unfamiliar scale as measured figures", src: ["TW"], frames: [150],
      vo: "In 1981, in the middle of the Iran-Iraq war, Iraq began attacking ships in the Gulf, and Iran struck back at the ships of Iraq's partners. Over seven years, Iraq made two hundred and eighty-three attacks on merchant ships, and Iran a hundred and sixty-eight.",
      scene: { type: "figures", image: A("hz-convoy"), title: "The tanker war, 1981-1988", rows: [{ value: "283", label: "attacks on merchant ships by Iraq" }, { value: "168", label: "attacks by Iran" }, { value: "100+", label: "sailors killed", source: "Source: Wikipedia, 'Tanker war'" }] } },
    { id: "Z06", part: "the tanker war", ref: "RealLifeLore: the motive explained on the map", src: ["TW", "EW", "EOX"], frames: [180],
      vo: "In 1984, Iraq attacked Iran's oil terminal at Kharg Island. Its aim, the sources say, was to provoke Iran into extreme measures such as closing the Strait of Hormuz, which would bring in the Americans. Iran did not close the strait. It attacked the tankers of Kuwait and other Gulf states that backed Iraq.",
      scene: { type: "map", base: "s2", terrain: 0, date: "1984", views: [{ f: 0, center: [52.5, 28.0], zoom: 5.8, pitch: 0, bearing: 0 }, { f: 300, center: [51.0, 28.2], zoom: 6.6, pitch: 15, bearing: 0 }],
        points: [{ id: "kh", at: KHARG, pulse: true, from: 40 }, { id: "ku", at: KUWAIT, from: 70 }, { id: "st", at: STRAIT, from: 100 }], labels: [{ at: KHARG, text: "Kharg Island", kind: "place", dx: 100, dy: 20, from: 44 }, { at: KUWAIT, text: "Kuwait", kind: "place", dx: -70, dy: -26, from: 74 }, { at: STRAIT, text: "Strait of Hormuz", kind: "water", dy: 40, from: 104 }],
        tags: [{ text: "Iraq's aim: to provoke Iran into closing the strait", x: 1100, y: 640, from: 150 }] } },
    { id: "Z07", part: "the tanker war", ref: "WiRLNEl-4bk: a source's words in a caption box", src: ["TW", "EW"], frames: [100],
      vo: "Kuwait asked the United States for protection. It proposed that its tankers be reflagged as American ships, so that the US Navy could escort them. The Reagan administration agreed on the seventh of March, 1987.",
      scene: { type: "footage", image: A("hz-convoy"), date: "7 MARCH 1987", captions: [{ text: "They asked the United States if they could reflag Kuwaiti tankers as American and receive the protection of the U.S. Navy.", source: "Stephen Phillips, quoted in Wikipedia, 'Tanker war'", from: 40 }] } },
    { id: "Z08", part: "the tanker war", ref: "WiRLNEl-4bk: the human cost stated plainly with its source", src: ["EW", "COMMONS"], frames: [100],
      vo: "Ten weeks later, on the seventeenth of May, an Iraqi jet fired two Exocet missiles at the frigate USS Stark. Thirty-seven American sailors died. Iraq said the pilot had mistaken the ship for an Iranian tanker.",
      scene: { type: "footage", image: A("hz-stark"), date: "17 MAY 1987", captions: [{ text: "On 17 May 1987, an Iraqi jet fired two Exocet missiles at the guided missile frigate USS Stark, killing 37 sailors and injuring 21. Iraqi officials said that the targeting of the U.S. warship was accidental.", source: "Wikipedia, 'Operation Earnest Will'", from: 60 }] } },
    // ---- EARNEST WILL
    { id: "Z09", part: "the escorts", ref: "WiRLNEl-4bk: the event, then the number", src: ["EW", "COMMONS"], frames: [100],
      vo: "On the twenty-fourth of July, 1987, Operation Earnest Will began, the largest naval convoy operation since the Second World War. On its very first escort mission, the reflagged tanker Bridgeton struck an Iranian mine.",
      scene: { type: "footage", image: A("hz-convoy"), date: "24 JULY 1987", captions: [{ text: "…accompanied by US navy warships, struck an Iranian underwater mine … damaging the ship, but causing no injuries.", source: "Wikipedia, 'Operation Earnest Will'", from: 90 }] } },
    { id: "Z10", part: "the mine", ref: "RealLifeLore: the place of the event on the map, small uppercase label", src: ["EW", "SBR", "EOX"], frames: [180],
      vo: "On the fourteenth of April, 1988, about a hundred and five kilometres east of Bahrain, the frigate Samuel B. Roberts struck a mine, in water she had crossed safely a few days earlier. Ten sailors were hurt. The crew fought fire and flooding for five hours, and saved the ship.",
      scene: { type: "map", base: "s2", terrain: 0, date: "14 APRIL 1988", views: [{ f: 0, center: [52.5, 26.8], zoom: 6.0, pitch: 0, bearing: 0 }, { f: 300, center: [51.6, 26.3], zoom: 8.2, pitch: 20, bearing: 0 }],
        points: [{ id: "bah", at: BAHRAIN, from: 30 }, { id: "mine", at: MINE, pulse: true, from: 90 }], labels: [{ at: BAHRAIN, text: "Bahrain", kind: "place", dx: -90, dy: -20, from: 34 }, { at: MINE, text: "Mine strike, about 105 km east of Bahrain (approximate)", kind: "zone", dx: 20, dy: 42, from: 96 }],
        tags: [{ text: "10 sailors injured · the ship was saved", x: 1180, y: 700, from: 170 }] } },
    { id: "Z11", part: "the mine", ref: "WiRLNEl-4bk: authentic evidence with the source's words", src: ["SBR", "COMMONS"], frames: [100],
      vo: "The blast knocked both gas turbines off their mounts and broke the ship's keel, damage that is almost always fatal to a vessel. It took thirteen months to repair her.",
      scene: { type: "footage", image: A("hz-roberts-hole"), date: "APRIL 1988", captions: [{ text: "The blast also broke the keel of the ship; such structural damage is almost always fatal to a vessel.", source: "Wikipedia, 'USS Samuel B. Roberts (FFG-58)'", from: 40 }] } },
    // ---- PRAYING MANTIS
    { id: "Z12", part: "the battle", ref: "RealLifeLore: the military move shown on the map", src: ["PM", "EW", "NAVY"], frames: [60],
      vo: "On the eighteenth of April, the United States launched Operation Praying Mantis. Its targets were Iranian warships and two oil platforms in the Sirri and Sassan fields that Iran's Revolutionary Guard used as bases.",
      scene: { type: "footage", video: V("hz-map"), videoLen: 6, credit: CRED, date: "18 APRIL 1988", captions: [{ text: "Praying Mantis was the largest of the U.S. Navy's five major surface engagements since World War II.", source: "Wikipedia, 'Operation Praying Mantis'", from: 80 }] } },
    { id: "Z13", part: "the battle", ref: "WiRLNEl-4bk: the footage carries the moment, the caption the source", src: ["PM", "NAVY"], frames: [60],
      vo: "By the end, American forces had destroyed Iranian facilities on both platforms, and sunk three armed speedboats, an Iranian frigate and a fast attack boat.",
      scene: { type: "footage", video: V("hz-platform"), videoLen: 10, credit: CRED, captions: [{ text: "…sunk at least three armed Iranian Boghammer speedboats, one Iranian frigate, and one fast attack missile boat.", source: "Wikipedia, 'Operation Praying Mantis'", from: 90 }] } },
    { id: "Z14", part: "the battle", ref: "WiRLNEl-4bk: a firsts-and-numbers beat", src: ["PM", "NAVY"], frames: [60],
      vo: "It was the Navy's first exchange of anti-ship missiles with opposing ships, and, by then, its only sinking of a major surface warship since the Second World War.",
      scene: { type: "footage", video: V("hz-fire"), videoLen: 8, credit: CRED, captions: [{ text: "It saw the U.S. Navy's first exchange of anti-ship missiles with opposing ships, and by then its only sinking of a major surface combatant, since World War II.", source: "Wikipedia, 'Operation Praying Mantis'", from: 40 }] } },
    { id: "Z15", part: "the battle", ref: "RealLifeLore: a later consequence tied to the present", src: ["PM", "COMMONS"], frames: [100],
      vo: "The frigate Sahand burns in this photograph. The other Iranian frigate hit that day, the Sabalan, was repaired in 1989 and returned to service, until she was sunk during this year's war.",
      scene: { type: "footage", image: A("hz-sahand"), date: "18 APRIL 1988", fit: "contain", captions: [{ text: "Sabalan was repaired in 1989 and returned to service, until she was sunk during the 2026 Iran war.", source: "Wikipedia, 'Operation Praying Mantis'", from: 130 }] } },
    // ---- FLIGHT 655
    { id: "Z16", part: "the tragedy", ref: "WiRLNEl-4bk 1:24: the human cost, stated plainly", src: ["F655", "EW", "COMMONS"], frames: [100],
      vo: "In July, the cruiser USS Vincennes shot down Iran Air Flight 655 over the strait. All two hundred and ninety people aboard were killed, sixty-five of them children or infants. The United States said the crew had mistaken the airliner for a fighter jet. Iran said the shootdown was reckless.",
      scene: { type: "footage", image: A("hz-vincennes"), date: "3 JULY 1988", captions: [{ text: "All 290 passengers and aircrew aboard the Airbus A300B2 died, including 65 children or infants.", source: "Wikipedia, 'Operation Earnest Will'", from: 110 }] } },
    { id: "Z17", part: "the tragedy", ref: "WiRLNEl-4bk: the outcome stated with its source", src: ["F655"], frames: [150],
      vo: "President Reagan sent Iran a written note expressing deep regret, but the United States never issued a formal apology. In 1996, the two governments settled the case at the International Court of Justice. The US agreed to pay sixty-one point eight million dollars to the families of the victims, without admitting liability.",
      scene: { type: "figures", image: A("hz-vincennes"), title: "After the shootdown", rows: [{ value: "290", label: "people killed, including 65 children or infants" }, { value: "$61.8m", label: "paid to the families in 1996, with no admission of liability", source: "Source: Wikipedia, 'Iran Air Flight 655'" }] } },
    { id: "Z18", part: "the tragedy", ref: "WiRLNEl-4bk: the ending of the first story", src: ["EW", "NAVY"], frames: [60],
      vo: "Two weeks later, on the eighteenth of July, Iran agreed to a ceasefire. One account says those two events, Praying Mantis and the airliner's downing, helped convince it.",
      scene: { type: "footage", video: V("hz-ship-b"), videoLen: 8, credit: CRED, captions: [{ text: "The two effects of Earnest Will — Praying Mantis and the airliner's downing — helped convince Iran to agree to a ceasefire on 18 July 1988.", source: "Wikipedia, 'Operation Earnest Will'", from: 40 }] } },
    // ---- THE ECHO
    { id: "Z19", part: "2026", ref: "WiRLNEl-4bk: stacked figures, each with its source", src: ["CRISIS", "COMMONS"], frames: [150],
      vo: "In 2026, the same pieces are back. Iran laid sea mines in the strait. In May, the US launched Operation Project Freedom, a mission to escort merchant ships out of the Gulf. In August, US officials said the Navy had cleared mines from the shipping lanes, after underwater drones found more than a hundred suspected mines.",
      scene: { type: "figures", image: A("hz-roberts-hole"), title: "Hormuz, 2026", rows: [{ value: "Mines", label: "laid by Iran's Revolutionary Guard in the strait" }, { value: "4 May", label: "Operation Project Freedom: US Navy escorts for merchant ships" }, { value: "100+", label: "suspected mines found by underwater drones, US officials said in August", source: "Source: Wikipedia, '2026 Strait of Hormuz crisis'" }] } },
    { id: "Z20", part: "ending", ref: "WiRLNEl-4bk: the close returns to the opening image, no sponsor", src: ["SBR", "COMMONS"], frames: [90],
      vo: "In 1988, a mine that cost an estimated fifteen hundred dollars nearly sank a warship. Nearly four decades later, mines were laid in the strait again.",
      scene: { type: "footage", image: A("hz-roberts-damage"), date: "APRIL 1988", captions: [{ text: "The mine that nearly sank Samuel B. Roberts had an estimated cost of $1,500.", source: "Wikipedia, 'USS Samuel B. Roberts (FFG-58)'", from: 20 }] } },
  ],
  transitions: [
    { name: "tx1-photo-to-figures", a: "Z01", b: "Z02", kind: "dissolve", dur: 20, aAt: 300, note: "the damaged frigate dissolves into the 2026 figures" },
    { name: "tx2-map-to-photo", a: "Z10", b: "Z11", kind: "dissolve", dur: 20, aAt: 300, note: "the map point dissolves into the hull" },
    { name: "tx3-footage-wipe", a: "Z14", b: "Z15", kind: "wipe", dur: 18, aAt: 200, note: "wipe from the firing to the burning frigate" },
  ],
  thumbs: [
    { name: "thumb1-mine", big: "A $1,500\nmine", small: "vs a US warship", image: A("hz-roberts-damage") },
    { name: "thumb2-forgotten", big: "The war\nwe forgot", small: "Hormuz, 1988", image: A("hz-sahand") },
    { name: "thumb3-route", big: "Last time\nthey fought\nfor Hormuz", small: "1988", map: { views: [{ f: 0, center: [54.5, 26.8], zoom: 5.8, pitch: 0, bearing: 0 }], base: "s2", terrain: 0 } },
  ],
};

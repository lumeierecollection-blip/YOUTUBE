// Faceless breakout experiment, pilot B (stick-figure hypothetical), 20 Nov 2026. ORIGINAL story and characters (fx.jsx "Pegs").
// Format learned from ConChaser (faceless-breakout-experiment/formulas/stick-figure-formula.md): first person, in medias res embarrassment, "let me explain",
// rules found by experiment, escalation across settings, a twist the number did not predict, a lesson line, a light CTA. No line, character or picture is copied.
// Fiction, except two research facts, both said with their source on screen:
//   SER: Serota, Levine & Boster (2010), "The Prevalence of Lying in America", Human Communication Research: 1,000 US adults, mean 1.65 lies/day,
//        about 60% reported no lies that day, almost half of all lies told by about 5% of people.
//   DEP: DePaulo et al. (1996), "Lying in Everyday Life", JPSP: students lied in about one in three social interactions (diary study, 77 students).
export const SOURCES = {
  SER: { title: "Serota, Levine & Boster (2010), The Prevalence of Lying in America: Three Studies of Self-Reported Lies, Human Communication Research 36(1)", url: "https://oakland.edu/Assets/upload/docs/News/2014/Serota-et-al-Prevalence-of-Lying-2010.pdf", retrieved: "2026-11-20" },
  DEP: { title: "DePaulo, Kashy, Kirkendol, Wyer & Epstein (1996), Lying in Everyday Life, Journal of Personality and Social Psychology 70(5)", url: "https://smg.media.mit.edu/library/DePauloEtAl.LyingEverydayLife.pdf", retrieved: "2026-11-20" },
  FIC: { title: "Fiction: the story is invented for this video", url: "", retrieved: "2026-11-20" },
};
const B = (value, tone, from = 10, to) => ({ value: String(value), label: "lies", tone, from, ...(to ? { to: { ...to, value: String(to.value) } } : {}) });
const tone = (n) => (n === 0 ? "high" : n < 4 ? "mid" : "low");
const C = (id, x, o = {}) => ({ id, x, ...o });
// 20 Nov rebuild: scenes use the measured ConChaser grammar (fx-stick.jsx "fxk"): badges become pill tags ("3 LIES"), the bedroom/kitchen/classroom/street sets
// keep their names, and school corridor shots use the hallway set.
const tagOf = (b) => b && { text: `${b.value} ${b.value === "1" ? "LIE" : "LIES"}`.replace("? LIES", "?"), tone: b.tone, from: b.from, ...(b.to ? { to: { text: `${b.to.value} ${b.to.value === "1" ? "LIE" : "LIES"}`, tone: b.to.tone || (Number(b.to.value) === 0 ? "high" : Number(b.to.value) < 4 ? "mid" : "low"), at: b.to.at } } : {}) };
let si = 0; const SHOT1 = ["medium", "close", "wide"], SHOT2 = ["wide", "medium"];   // measured: ConChaser shots are mostly wide/medium-wide; close-ups punctuate
const room = (room, cast, o = {}) => ({ type: "fxk", room, shot: cast.length === 1 ? SHOT1[si++ % 3] : cast.length === 2 ? SHOT2[si++ % 2] : "wide", cast: cast.map(({ badge, ...m }) => ({ ...m, tag: tagOf(badge) })), ...o });
let k = 0; const beat = (vo, scene, src = ["FIC"]) => ({ id: `B${String(++k).padStart(2, "0")}`, part: "story", src, vo, scene });

export const EPISODE = {
  channel: "fx-stick", slug: "lie-counter", title: "What If You Could See How Many Lies Everyone Told Today?", target_minutes: 9,
  blurb: ["One morning, a number appears above everyone's head: how many lies they have told today. Including yours.", "", "Animated story. The two research figures on screen come from the studies credited in the video."],
  sound: { bed: null },
  thumb: { type: "fxroom", room: "kitchen", cast: [C("mom", 620, { pose: "wave", mood: "happy", badge: B(0, "high", 0) }), C("dad", 1260, { pose: "shrug", mood: "smug", flip: -1, badge: B(14, "low", 0) })] },
  beats: [
    // ---- cold open: the embarrassment
    beat("My best friend Mia just tasted my birthday cake, smiled, and said: this is amazing. And the number above her head went from zero to one.",
      room("kitchen", [C("me", 640, { pose: "stand", mood: "happy", look: 1 }), C("mia", 1180, { pose: "point", pose2: "stand", poseAt: 120, mood: "happy", flip: -1, badge: B(0, "high", 20, { value: 1, tone: "mid", at: 150 }) })], { name: { text: "Mia · best friend, 6 years", from: 30 } })),
    beat("Which means the cake is not amazing. Which means I baked a bad cake. And now I know that she knows that it's bad, and she doesn't know that I know.",
      room("kitchen", [C("me", 640, { pose: "facepalm", mood: "sad" }), C("mia", 1180, { pose: "stand", mood: "happy", flip: -1, badge: B(1, "mid", 0) })])),
    beat("And she's still eating it. Bite two. Mm, so good. Two.",
      room("kitchen", [C("me", 640, { pose: "shrug", mood: "shock", look: 1 }), C("mia", 1180, { pose: "point", mood: "happy", flip: -1, badge: B(1, "mid", 0, { value: 2, tone: "mid", at: 90 }), say: { text: "Mm, so good!", from: 50 } })])),
    beat("Okay. Let me explain how I got here.", { type: "fxtitle", text: "That morning", sub: "6:58 a.m." }),
    // ---- the power
    beat("This morning I woke up, brushed my teeth, and saw it in the mirror. A little badge floating over my head, with a zero on it.",
      room("bedroom", [C("me", 960, { pose: "think", mood: "shock", badge: B(0, "high", 60) })])),
    beat("I poked it. My hand went straight through. I waved at it. Nothing. It just hung there, like a price tag on my soul.",
      room("bedroom", [C("me", 960, { pose: "wave", pose2: "shrug", poseAt: 160, mood: "neutral", badge: B(0, "high", 0) })])),
    beat("Then my dad shouted up the stairs: I'll be ready in five minutes! And above his head, I saw it. A one.",
      room("kitchen", [C("dad", 960, { pose: "wave", mood: "happy", badge: B(0, "high", 10, { value: 1, tone: "mid", at: 110 }), say: { text: "Five minutes!", from: 40 } })])),
    beat("He was ready in forty.", room("kitchen", [C("dad", 960, { pose: "shrug", mood: "smug", badge: B(1, "mid", 0) })], { caption: "40 minutes later" })),
    // ---- rules by experiment
    beat("So I ran some tests. Rule one: the badge counts lies said out loud, today only. My mom asked if I'd done my homework. I said yes. My badge went to one.",
      room("kitchen", [C("mom", 700, { pose: "point", mood: "neutral", badge: B(0, "high", 0) }), C("me", 1240, { pose: "stand", pose2: "facepalm", poseAt: 170, mood: "smug", flip: -1, badge: B(0, "high", 0, { value: 1, tone: "mid", at: 150 }) })])),
    beat("Rule two: mistakes don't count. At breakfast my dad said Tuesday was the eleventh. It was the twelfth. No change. He wasn't lying, he was just wrong.",
      room("kitchen", [C("dad", 760, { pose: "point", mood: "neutral", badge: B(1, "mid", 0) }), C("me", 1200, { pose: "think", mood: "neutral", flip: -1, badge: B(1, "mid", 0) })])),
    beat("Rule three, and this is the scary one: nobody else can see them. I asked my mom what the number over my head said. She checked my forehead for a fever.",
      room("kitchen", [C("mom", 760, { pose: "point", pose2: "think", poseAt: 120, mood: "sad", look: 1, badge: B(0, "high", 0) }), C("me", 1200, { pose: "shrug", mood: "shock", flip: -1, badge: B(1, "mid", 0) })])),
    beat("And rule four: it resets at midnight. Every day, everyone starts clean.", { type: "fxchart", kind: "list", title: "The rules", bars: [{ label: "Only lies said out loud, today", tone: "mid" }, { label: "Mistakes don't count", tone: "high" }, { label: "Nobody else can see the badges", tone: "low" }, { label: "Everything resets at midnight", tone: "mid" }] }),
    // ---- school
    beat("Then I got to school, and I stopped breathing for a second. Because the numbers were everywhere.",
      room("street", [C("me", 300, { pose: "stand", mood: "shock", walk: { from: 0, to: 760, dur: 120 } }), C("kid1", 1200, { pose: "stand", mood: "happy", badge: B(3, "mid", 40) }), C("kid2", 1560, { pose: "wave", mood: "smug", flip: -1, badge: B(9, "low", 50) })])),
    beat("Most of them were small. A one here, a zero there. But Jordan, the most popular guy in our year, was already on nine. It was eight-fifteen in the morning.",
      room("hallway", [C("kid2", 960, { pose: "cheer", mood: "smug", badge: B(9, "low", 10) }), C("kid1", 520, { pose: "stand", mood: "happy", badge: B(0, "high", 20) }), C("me", 1420, { pose: "shrug", mood: "shock", flip: -1, badge: B(1, "mid", 20) })], { name: { text: "Jordan · most popular in our year", from: 20 } })),
    beat("By lunch he was on twenty-two. I watched him tell three different people that he'd been invited to the same party they had.",
      room("classroom", [C("kid2", 960, { pose: "point", mood: "happy", badge: B(21, "low", 0, { value: 22, at: 160 }) }), C("kid1", 1420, { pose: "stand", mood: "happy", flip: -1, badge: B(0, "high", 0) })])),
    beat("So I looked it up. And here's the weird part: real research says Jordan is normal in a very specific way.", room("library", [C("me", 900, { pose: "think", pose2: "point", poseAt: 120, mood: "neutral", badge: B(1, "mid", 0) })], { shot: "wide" }), ["FIC"]),
    beat("In a 2010 survey of a thousand American adults, people reported an average of about one and a half lies a day. But around sixty percent said they told no lies at all that day.",
      { type: "fxchart", kind: "bars", title: "Lies told yesterday (1,000 US adults)", bars: [{ label: "none", v: 0.6, tone: "high" }, { label: "the rest", v: 0.4, tone: "mid" }], note: "Serota, Levine & Boster (2010), Human Communication Research" }, ["SER"]),
    beat("Almost half of all the lies came from about five percent of people. A few prolific liars carry most of the total.",
      { type: "fxchart", kind: "bars", title: "Who tells the lies", bars: [{ label: "top 5% of people", v: 0.48, tone: "low" }, { label: "the other 95%", v: 0.52, tone: "mid" }], note: "Serota, Levine & Boster (2010): almost half of all lies, about 5% of people" }, ["SER"]),
    beat("So the badges weren't showing me a world of liars. They were showing me a world of mostly honest people, and a handful of Jordans.",
      room("classroom", [C("kid1", 400, { pose: "stand", mood: "happy", badge: B(0, "high", 10) }), C("teacher", 760, { pose: "point", mood: "neutral", badge: B(0, "high", 16) }), C("kid2", 1140, { pose: "cheer", mood: "smug", badge: B(22, "low", 22) }), C("mia", 1520, { pose: "stand", mood: "happy", flip: -1, badge: B(0, "high", 28) })])),
    beat("Then I looked at Mia. Zero. All morning, zero. She told the teacher she hadn't finished the reading, which nobody ever admits. She told Jordan his party sounded boring, to his face.",
      room("classroom", [C("mia", 760, { pose: "shrug", mood: "smug", badge: B(0, "high", 10) }), C("kid2", 1200, { pose: "stand", mood: "shock", flip: -1, badge: B(22, "low", 10) })])),
    beat("I'd known Mia for six years, and I'd never realised she was basically the most honest person I knew. The badge didn't make her honest. It just showed me what was already there.",
      room("classroom", [C("me", 640, { pose: "think", mood: "happy", look: 1, badge: B(1, "mid", 0) }), C("mia", 1200, { pose: "wave", mood: "happy", flip: -1, badge: B(0, "high", 0) })])),
    beat("Which made the cake thing later even worse, by the way. Mia only lies for one reason. To protect somebody's feelings. Mine. About a cake.",
      room("kitchen", [C("mia", 960, { pose: "shrug", mood: "happy", badge: B(2, "mid", 10) })], { caption: "Later that evening" })),
    // ---- teachers and students
    beat("Then our teacher, Mr Okafor, handed back the tests and said: I'm not angry, I'm just disappointed. Badge stayed at zero. He meant it. That was worse.",
      room("classroom", [C("teacher", 960, { pose: "shrug", mood: "sad", badge: B(0, "high", 10), say: { text: "I'm not angry...", from: 40 } })], { name: { text: "Mr Okafor · maths", from: 10 } })),
    beat("And a kid in the back said: my dog ate my homework. One. Of course.",
      room("classroom", [C("kid1", 960, { pose: "shrug", mood: "smug", badge: B(0, "high", 0, { value: 1, at: 80 }), say: { text: "My dog ate it.", from: 30 } })])),
    beat("Students in one old diary study lied in about one out of every three conversations. I believed it now. I'd been counting.",
      { type: "fxchart", kind: "bars", title: "Conversations with a lie (students)", bars: [{ label: "with a lie", v: 0.33, tone: "low" }, { label: "without", v: 0.67, tone: "high" }], note: "DePaulo et al. (1996), Journal of Personality and Social Psychology: diary study, 77 students" }, ["DEP"]),
    // ---- the street
    beat("After school I walked through town, and it was like someone had turned on subtitles for the whole city.",
      room("street", [C("me", 200, { pose: "stand", mood: "shock", walk: { from: 0, to: 900, dur: 200 }, badge: B(1, "mid", 0) })])),
    beat("A man outside the phone shop told a woman this deal ends today. Thirty-one. It was four in the afternoon. That deal had ended thirty-one times.",
      room("street", [C("dad", 700, { pose: "point", mood: "happy", badge: B(30, "low", 10, { value: 31, at: 120 }), say: { text: "Ends today!", from: 90 } }), C("mom", 1200, { pose: "think", mood: "neutral", flip: -1, badge: B(0, "high", 20) })])),
    beat("A little kid told his mum he didn't touch the cookies. He had chocolate on his entire face. One. Fair enough.",
      room("street", [C("kid1", 760, { s: 0.7, pose: "shrug", mood: "smug", badge: B(0, "high", 0, { value: 1, at: 100 }) }), C("mom", 1180, { pose: "facepalm", mood: "neutral", flip: -1, badge: B(0, "high", 0) })])),
    beat("And then I saw an old man on a bench, sitting completely alone, on zero. I sat down next to him. He said: you look like you've seen a ghost. I said: no, I'm fine.",
      room("street", [C("teacher", 760, { pose: "sit", mood: "happy", y: 900, badge: B(0, "high", 10) }), C("me", 1180, { pose: "stand", mood: "sad", flip: -1, badge: B(1, "mid", 0, { value: 2, at: 260 }) })])),
    beat("Two. He couldn't see it. But I could. And for the first time I felt my own number land on me, like a little weight.",
      room("street", [C("me", 960, { pose: "slump", mood: "sad", badge: B(2, "mid", 0) })])),
    beat("I tried to test one more rule on the way home. Does it count if you lie to yourself? I said, out loud, to nobody: I am going to start revising tonight.",
      room("street", [C("me", 960, { pose: "point", mood: "smug", badge: B(2, "mid", 0, { value: 3, at: 200 }) })])),
    beat("Three. Yes. It counts. The badge knows me better than I do.",
      room("street", [C("me", 960, { pose: "facepalm", mood: "sad", badge: B(3, "mid", 0) })])),
    // ---- the zero day
    beat("So I made a decision. For the rest of the day, I would tell zero more lies. How hard could it be?",
      { type: "fxtitle", text: "Rest of the day: zero more lies", sub: "How hard could it be?" }),
    beat("Very hard. My aunt called to ask if I liked the sweater she sent. I said: honestly, it's itchy, and it's orange.",
      room("bedroom", [C("me", 960, { pose: "think", mood: "neutral", badge: B(3, "mid", 0), say: { text: "It's itchy. And orange.", from: 120 } })])),
    beat("She went quiet for a very long time. Then she said: okay. And hung up. My badge stayed on three. I felt terrible anyway.",
      room("bedroom", [C("me", 960, { pose: "facepalm", mood: "sad", badge: B(3, "mid", 0) })])),
    beat("A neighbour asked how I was doing. I told him. All of it. The badges, the cake, the sweater. He backed away slowly, and crossed the road.",
      room("street", [C("me", 640, { pose: "shrug", mood: "shock", badge: B(3, "mid", 0) }), C("dad", 1200, { pose: "stand", mood: "shock", flip: -1, walk: { from: 140, to: 1700, dur: 140 }, badge: B(0, "high", 0) })])),
    beat("That's when I understood something the research hints at too. Most people aren't lying all day. But the few small lies they do tell are often the ones that keep things smooth.",
      room("street", [C("me", 960, { pose: "think", mood: "neutral", badge: B(3, "mid", 0) })], { caption: "Most people: 0 to 2 a day" }), ["SER"]),
    beat("I don't love that. I just noticed it. Zero, it turns out, is a very lonely number to aim for.",
      room("street", [C("me", 960, { pose: "slump", mood: "sad", badge: B(3, "mid", 0) })])),
    // ---- home
    beat("When I got home, something was off. My mom was on four. My mom, the woman who once returned a pen to a bank.",
      room("kitchen", [C("mom", 760, { pose: "stand", mood: "happy", badge: B(4, "low", 20) }), C("me", 1240, { pose: "think", mood: "shock", flip: -1, badge: B(3, "mid", 10) })])),
    beat("And my dad was on eleven. Eleven. Where were you, I asked. Just at work, he said. Twelve.",
      room("kitchen", [C("dad", 760, { pose: "shrug", mood: "smug", badge: B(11, "low", 0, { value: 12, at: 140 }), say: { text: "Just at work.", from: 110 } }), C("me", 1240, { pose: "point", mood: "angry", flip: -1, badge: B(3, "mid", 0) })])),
    beat("I spent the whole evening building theories. A second family. A secret debt. A crime. Every time they whispered, a number went up.",
      room("bedroom", [C("me", 960, { pose: "think", pose2: "facepalm", poseAt: 150, mood: "sad", badge: B(3, "mid", 0) })])),
    beat("I couldn't take it. I walked into the kitchen and said: I know you're both lying to me. And my mom started crying.",
      room("kitchen", [C("me", 400, { pose: "point", mood: "angry", walk: { from: 0, to: 640, dur: 60 }, badge: B(3, "mid", 0) }), C("mom", 1100, { pose: "facepalm", mood: "sad", flip: -1, badge: B(4, "low", 0) }), C("dad", 1480, { pose: "shrug", mood: "shock", flip: -1, badge: B(12, "low", 0) })])),
    // ---- twist
    beat("Then the lights came on, and twenty people jumped out from behind the sofa. Surprise.",
      room("kitchen", [C("kid1", 300, { pose: "cheer", mood: "happy", from: 10 }), C("mia", 620, { pose: "cheer", mood: "happy", from: 14, badge: B(2, "mid", 30) }), C("dad", 1000, { pose: "cheer", mood: "happy", from: 6 }), C("mom", 1340, { pose: "cheer", mood: "happy", flip: -1, from: 8 }), C("kid2", 1640, { pose: "cheer", mood: "happy", flip: -1, from: 12 })], { caption: "SURPRISE!" })),
    beat("My birthday party. Every lie my dad told today was about where he'd been: buying decorations, picking up my grandma, hiding the cake.",
      room("kitchen", [C("dad", 760, { pose: "wave", mood: "happy", badge: B(12, "low", 0) }), C("me", 1240, { pose: "facepalm", mood: "happy", flip: -1, badge: B(3, "mid", 0) })])),
    beat("The cake I baked myself, it turned out, was the backup. And it was bad. Mia confirmed it twice.",
      room("kitchen", [C("mia", 760, { pose: "shrug", mood: "smug", badge: B(2, "mid", 0) }), C("me", 1240, { pose: "stand", mood: "happy", flip: -1, badge: B(3, "mid", 0) })])),
    // ---- the lesson
    beat("So here's what a whole day of lie counters taught me. The number tells you how many. It never tells you why.",
      { type: "fxtitle", text: "How many, never why" }),
    beat("Jordan's twenty-two were for himself. My dad's twelve were for me. Same badge, same colour. Completely different people.",
      room("classroom", [C("kid2", 640, { pose: "cheer", mood: "smug", badge: B(22, "low", 10) }), C("dad", 1280, { pose: "wave", mood: "happy", flip: -1, badge: B(12, "low", 20) })])),
    beat("At midnight, every badge in the house rolled back to zero. Mine lasted about a minute. Mia called to ask if I'd forgiven her about the cake. And I said yes.",
      room("bedroom", [C("me", 960, { pose: "stand", pose2: "think", poseAt: 150, mood: "smug", badge: B(0, "high", 0, { value: 1, tone: "mid", at: 190 }) })], { caption: "00:01" })),
    beat("If you could see one hidden number above everyone's head, which one would you pick? Tell me, and it might be the next video.",
      room("street", [C("me", 960, { pose: "wave", mood: "happy", badge: B("?", "mid", 20) })])),
  ],
};

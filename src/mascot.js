/* ============================================================
   MAGICAL.EXE — mascot.js  (T5)
   The mascot is a fusion of the player's 3 favorite animals.
   Art is CURATED (not freely AI-generated). This module: the curated
   ASCII library, the mystical name pool, and the deterministic fusion
   rules that pick a base + name + voice.

   ART note: the original kaomoji used full-width CJK punctuation and
   combining marks that don't sit on the monospace grid (they looked
   broken in the panel). This set is monospace-safe — ASCII faces plus
   only confirmed single-width decorations (✦ ☆ ♡ · *), so every base
   aligns cleanly in JetBrains Mono. The <pre> is centered, so line
   lengths may vary.
   ============================================================ */

export const ART = {
  // blob — round, soft, big-eyed (rabbit/hamster/seal/cat/frog/chick)
  blob_small: `( o   o )
 \\  w  /`,
  blob_large: ` · ✦ · ☆ · ✦ ·
   ( o   o )
    \\  w  /
   ·  ✦ ♡ ✦  ·`,

  // catflick — cat/fox, ears + tail-flick
  catflick_small: ` /\\_/\\
( =w= )`,
  catflick_large: `   ·  ✦  ·
   /\\_/\\
  ( =w= )
  ( >w< )~
   ·  ✦  ·`,

  // peek — shy/curious, peeking with little paws
  peek_small: `( o w o )
 c(   )o`,
  peek_large: ` ·  ✦  ☆  ✦  ·
   ( o w o )
   c(   )o
   ·  ✦  ♡  ·`,

  // bean — tiny upright sprout-bean
  bean_small: `( ^ - ^ )`,
  bean_large: `  ·  ✦  ·
 ( ^ - ^ )
  ( '-' )
  ·  ✦  ·`,

  // wing — winged sprite (moth/bird/dragonfly)
  wing_small: `<( o v o )>`,
  wing_large: `  ·  ✦  ☆  ✦  ·
 <( o v o )>
   '  \\v/  '
   ·  ✦  ·`,

  // loaf — content loaf pose (cat/seal/hamster/hedgehog)
  loaf_small: `( =^.^= )
[_______]`,
  loaf_large: `  ·  ✦  ☆  ✦  ·
   ( =^.^= )
  [_________]
   ·  ✦  ♡  ·`,

  // deer — antlered (deer/goat/elk/reindeer/cow)
  deer_small: ` \\|/
(o.o)`,
  deer_large: `  ·  ✦  ·
   \\|/
  (o.o)
  · ✦ ♡ ·`,

  // aqua — little aquatic one (fish/axolotl/dolphin/turtle/otter-ish)
  aqua_small: ` · ·
>(o)>`,
  aqua_large: `  ·  ✦  ·
   · ·
  >(o)>
  · ✦ ♡ ·`,

  // fluff — very round + fuzzy (sheep/alpaca/poodle/cloudy ones)
  fluff_small: `((^.^))`,
  fluff_large: `  ·  ✦  ·
  ((^.^))
  · ✦ ♡ ·`,

  // Shared celebration pose — used on happy beats (tier-ups, boss wins).
  star_small: `\\( ^o^ )/`,
  star_large: `  ✦ · ☆ · ✦
  \\( ^o^ )/
   /  |  \\
  ☆ · ✦ · ☆`,

  // T19 — Virtuous Ascension: the mascot becomes its own guardian-animal deity.
  // A crowned, radiant elevation of the celebration pose.
  deity_large: ` ☆  ·  ✦  ·  ☆
  .  \\( ^o^ )/  .
 ✦ ──( ♡♡♡ )── ✦
  '  /  |||  \\  '
 ☆  ·  ✦  ·  ☆`,
};

/* ---- T19 — Eldritch Merge: corrupt the player's OWN mascot art ----
   A DETERMINISTIC corruption (no randomness — same mascot always corrupts the same
   way, so the horror is recognizably *yours*): glyphs are mapped to broken/eldritch
   ones and the symmetry is eaten by position. Used only on the merge ending. */
const GLITCH = {
  o: "x", O: "X", w: "#", v: "#", "^": "#", "-": "~", "=": "≠",
  ".": ",", "*": "×", "✦": "✗", "☆": "▓", "♡": "†", "\\": "/", "/": "\\",
};
export function corruptArt(art) {
  let i = 0;
  return String(art)
    .split("\n")
    .map((line) =>
      [...line]
        .map((ch) => {
          i++;
          if (ch === " " || ch === "\t") return i % 7 === 0 ? "." : ch; // pock the negative space
          const g = GLITCH[ch];
          if (g === undefined) return i % 5 === 0 ? "▒" : ch;
          return i % 3 === 0 ? "▓" : g; // sometimes obliterate the feature entirely
        })
        .join("")
    )
    .join("\n");
}

/* ---- Animation frame variants per base (T-anim, mascotAnim.js) ----
   Same line-count + width as the matching `${base}_small` so swapping a frame
   never shifts the monospace grid. `blink` is the idle blink; `speak`/`hit` are
   one-shot reaction poses. The neutral/open frame is just ART[`${base}_small`];
   the shared happy pose is ART.star_small. Curated, not generated — same ethos
   as the art library. */
export const FRAMES = {
  blob: {
    blink: `( -   - )
 \\  w  /`,
    speak: `( o   o )
 \\  o  /`,
    hit: `( >   < )
 \\  o  /`,
  },
  catflick: {
    blink: ` /\\_/\\
( -w- )`,
    speak: ` /\\_/\\
( =o= )`,
    hit: ` /\\_/\\
( >w< )`,
  },
  peek: {
    blink: `( - w - )
 c(   )o`,
    speak: `( o o o )
 c(   )o`,
    hit: `( > w < )
 c(   )o`,
  },
  bean: {
    blink: `( - - - )`,
    speak: `( ^ o ^ )`,
    hit: `( x - x )`,
  },
  wing: {
    blink: `<( - v - )>`,
    speak: `<( o o o )>`,
    hit: `<( > v < )>`,
  },
  loaf: {
    blink: `( =-.-= )
[_______]`,
    speak: `( =^o^= )
[_______]`,
    hit: `( =>.<= )
[_______]`,
  },
  deer: {
    blink: ` \\|/
(-.-)`,
    speak: ` \\|/
(ooo)`,
    hit: ` \\|/
(>.<)`,
  },
  aqua: {
    blink: ` · ·
>(-)>`,
    speak: ` · ·
>(O)>`,
    hit: ` · ·
>(x)>`,
  },
  fluff: {
    blink: `((-.-))`,
    speak: `((^o^))`,
    hit: `((>.<))`,
  },
};

/* ---- Mystical / cosmos name pool. 'Sable' excluded: reserved rival name. ---- */
export const MASCOT_NAMES = [
  // soft / cute
  "Pip", "Vell", "Sora", "Nim", "Luru", "Bibi", "Pippin", "Yumo", "Reki", "Wisp",
  "Pero", "Suki", "Fae", "Bubu", "Pim", "Roro", "Fizz", "Tibbs", "Yune",
  // cosmos / celestial
  "Nova", "Stella", "Comet", "Aster", "Vesper", "Halo", "Astra", "Auri", "Celes",
  "Lumi", "Glim", "Mira", "Vega", "Lyra", "Caelum", "Orin",
  // mystical / arcane (a couple of softly-shadowed names hint the corruption route)
  "Tindra", "Runa", "Faye", "Zephyr", "Eir", "Selene", "Ondine", "Eos", "Iri", "Lune", "Nyx",
  // more soft / cute
  "Momo", "Tofu", "Pudding", "Mochi", "Dotty", "Pebble", "Clover", "Biscuit", "Niko", "Poppy",
  "Tama", "Coco", "Yuki", "Mimi", "Bao", "Plum", "Bramble", "Maple", "Twig", "Sprout",
  // more cosmos / celestial
  "Echo", "Solis", "Polaris", "Nebula", "Sirius", "Vela", "Rigel", "Estel", "Cielo", "Dawn",
  "Zenith", "Stardust", "Cosmo", "Selena", "Astrid",
  // more mystical / arcane
  "Sol", "Wren", "Onyx", "Mistral", "Brume", "Sylph", "Indra", "Calyx", "Vesna", "Yara",
];

/* ---- Fusion: animal -> base style (mascots.md fusion rules) ---- */
const ANIMAL_BASE = {
  // round / soft -> blob
  rabbit: "blob", bear: "blob", panda: "blob", pig: "blob", koala: "blob",
  hippo: "blob", wombat: "blob", quokka: "blob", chinchilla: "blob",
  // tailed / eared -> catflick
  cat: "catflick", fox: "catflick", wolf: "catflick", dog: "catflick",
  weasel: "catflick", tiger: "catflick", lion: "catflick", squirrel: "catflick",
  ferret: "catflick", lynx: "catflick", leopard: "catflick", cheetah: "catflick",
  coyote: "catflick", husky: "catflick", shiba: "catflick", corgi: "catflick",
  // shy / curious -> peek
  mouse: "peek", owl: "peek", otter: "peek", raccoon: "peek", rat: "peek",
  chipmunk: "peek", lemur: "peek", meerkat: "peek", possum: "peek", gerbil: "peek",
  // tiny / content -> bean
  chick: "bean", frog: "bean", bunny: "bean", duckling: "bean", bee: "bean",
  duck: "bean", gosling: "bean", tadpole: "bean", ladybug: "bean", cricket: "bean",
  // winged -> wing
  moth: "wing", butterfly: "wing", bird: "wing", dragonfly: "wing", bat: "wing",
  sparrow: "wing", robin: "wing", crow: "wing", dove: "wing", swallow: "wing",
  finch: "wing", magpie: "wing", hawk: "wing", eagle: "wing", parrot: "wing",
  swan: "wing", goose: "wing", falcon: "wing", wren: "wing", hummingbird: "wing",
  // round-loafing -> loaf
  hamster: "loaf", seal: "loaf", hedgehog: "loaf", penguin: "loaf", capybara: "loaf",
  "guinea pig": "loaf", quail: "loaf", pufferfish: "loaf",
  // antlered / horned -> deer
  deer: "deer", goat: "deer", elk: "deer", reindeer: "deer", moose: "deer",
  cow: "deer", antelope: "deer", gazelle: "deer", ram: "deer", stag: "deer",
  // aquatic -> aqua
  fish: "aqua", axolotl: "aqua", dolphin: "aqua", whale: "aqua", shark: "aqua",
  octopus: "aqua", seahorse: "aqua", jellyfish: "aqua", turtle: "aqua", crab: "aqua",
  koi: "aqua", goldfish: "aqua", manatee: "aqua", narwhal: "aqua",
  // very round + fuzzy -> fluff
  sheep: "fluff", lamb: "fluff", alpaca: "fluff", llama: "fluff", poodle: "fluff",
};

/* ---- Animal -> a one-word vibe, for the mascot voice ---- */
const ANIMAL_VIBE = {
  cat: "curious", fox: "clever", owl: "wise", rabbit: "gentle", wolf: "loyal",
  dog: "earnest", mouse: "shy", deer: "graceful", otter: "playful", bear: "warm",
  moth: "dreamy", butterfly: "whimsical", bird: "bright", dragonfly: "quick",
  hamster: "cozy", seal: "mellow", frog: "cheerful", chick: "sweet", raccoon: "mischievous",
  hedgehog: "guarded", penguin: "steadfast", bee: "busy", bat: "secretive",
  // expanded roster
  tiger: "bold", lion: "proud", squirrel: "scrappy", weasel: "sly", ferret: "impish",
  lynx: "watchful", leopard: "sleek", cheetah: "swift", corgi: "sunny", husky: "spirited",
  panda: "easygoing", koala: "sleepy", pig: "good-natured", hippo: "unbothered",
  wombat: "sturdy", quokka: "beaming", chinchilla: "soft-hearted",
  chipmunk: "chattery", lemur: "wide-eyed", meerkat: "alert", possum: "quirky",
  duck: "unflappable", tadpole: "hopeful", ladybug: "lucky", cricket: "musical",
  sparrow: "plucky", robin: "kindly", crow: "knowing", dove: "tender", swan: "serene",
  goose: "feisty", hawk: "keen", eagle: "valiant", parrot: "talkative", hummingbird: "restless",
  goat: "stubborn", elk: "noble", reindeer: "merry", moose: "gentle-giant", cow: "placid",
  fish: "calm", axolotl: "guileless", dolphin: "joyful", whale: "old-souled", turtle: "patient",
  octopus: "ingenious", crab: "prickly", koi: "serene", narwhal: "wondrous",
  sheep: "soft", lamb: "innocent", alpaca: "goofy", llama: "aloof", poodle: "prim",
  capybara: "unflappable", "guinea pig": "squeaky", quail: "homey",
};

const norm = (a) => String(a || "").trim().toLowerCase().replace(/s$/, "");

/** Choose a base style from the player's animals (dominant = first match). */
export function chooseBase(animals = []) {
  for (const a of animals) {
    const base = ANIMAL_BASE[norm(a)];
    if (base) return base;
  }
  return "blob"; // soft default
}

function buildVoice(animals = []) {
  const vibes = animals.map((a) => ANIMAL_VIBE[norm(a)]).filter(Boolean);
  if (vibes.length >= 3) return `${vibes[0]}, ${vibes[1]}, and a little ${vibes[2]}`;
  if (vibes.length === 2) return `${vibes[0]} and ${vibes[1]}`;
  if (vibes.length === 1) return `${vibes[0]}, warm, and quietly in your corner`;
  return "gentle, stubbornly encouraging, and a little sleepy";
}

/** Pick `n` distinct random names from the pool. */
export function randomNames(n = 3) {
  const pool = [...MASCOT_NAMES];
  const out = [];
  while (out.length < n && pool.length) {
    const i = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}

/** Build the mascot state object from the chosen animals + name. */
export function fuseMascot(animals = [], name = "Pip") {
  const base = chooseBase(animals);
  return {
    name,
    animals: animals.slice(0, 3),
    artKeySmall: `${base}_small`,
    artKeyLarge: `${base}_large`,
    voice: buildVoice(animals),
    injured: false,
    present: true,
    dimmed: false, // T19: bound + light-guttered in the Dark Ascension ending
  };
}

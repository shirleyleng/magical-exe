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

  // Shared celebration pose — used on happy beats (tier-ups, boss wins).
  star_small: `\\( ^o^ )/`,
  star_large: `  ✦ · ☆ · ✦
  \\( ^o^ )/
   /  |  \\
  ☆ · ✦ · ☆`,
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
];

/* ---- Fusion: animal -> base style (mascots.md fusion rules) ---- */
const ANIMAL_BASE = {
  // round / soft -> blob
  rabbit: "blob", bear: "blob", panda: "blob", pig: "blob", sheep: "blob",
  koala: "blob", hippo: "blob",
  // tailed / eared -> catflick
  cat: "catflick", fox: "catflick", wolf: "catflick", dog: "catflick",
  weasel: "catflick", tiger: "catflick", lion: "catflick", squirrel: "catflick",
  // shy / curious -> peek
  mouse: "peek", owl: "peek", otter: "peek", raccoon: "peek", deer: "peek", rat: "peek",
  // tiny / content -> bean
  chick: "bean", frog: "bean", bunny: "bean", duckling: "bean", bee: "bean",
  // winged -> wing
  moth: "wing", butterfly: "wing", bird: "wing", dragonfly: "wing", bat: "wing",
  sparrow: "wing", robin: "wing", crow: "wing", dove: "wing",
  // round-loafing -> loaf
  hamster: "loaf", seal: "loaf", hedgehog: "loaf", penguin: "loaf", capybara: "loaf",
};

/* ---- Animal -> a one-word vibe, for the mascot voice ---- */
const ANIMAL_VIBE = {
  cat: "curious", fox: "clever", owl: "wise", rabbit: "gentle", wolf: "loyal",
  dog: "earnest", mouse: "shy", deer: "graceful", otter: "playful", bear: "warm",
  moth: "dreamy", butterfly: "whimsical", bird: "bright", dragonfly: "quick",
  hamster: "cozy", seal: "mellow", frog: "cheerful", chick: "sweet", raccoon: "mischievous",
  hedgehog: "guarded", penguin: "steadfast", bee: "busy", bat: "secretive",
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
  if (vibes.length === 1) return `${vibes[0]} and warmly encouraging`;
  return "gentle, encouraging, a little sleepy";
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

/* ============================================================
   MAGICAL.EXE — creation.js  (T4 + the T5 reveal)
   Stepped character creation in the terminal. Two kinds of step:
     - kind:"text"  -> typed into the input line (name, city, animals…)
     - kind:"menu"  -> a huh-style list navigated with ↑/↓ + Enter
                       (number keys jump). The input line is hidden.
   Answers accumulate in ui.creation.draft, then commit() writes them
   into model.character and fuses the mascot (T5) at the reveal.

   City *description* is a placeholder here (flagged as flavor); the
   AI-generated version is swapped in later (PROMPTS.md > E, Phase 4).
   ============================================================ */

import { pushLine, pronounsFor, properNoun } from "./state.js";
import { fuseMascot, randomNames, ART } from "./mascot.js";
import { aiAvailable } from "./ai.js";
import { track } from "./analytics.js";

/* ---- Map a free-toy answer to a recognizable magical weapon object ---- */
function toyToWeapon(toy) {
  const t = (toy || "").toLowerCase();
  if (/chess/.test(t)) return { fromToy: toy, object: "the white knight piece", found: false };
  if (/card|poker|tarot|uno/.test(t)) return { fromToy: toy, object: "a single shining card", found: false };
  if (/plush|teddy|stuffed|doll/.test(t)) return { fromToy: toy, object: "the beloved plush itself", found: false };
  if (/lego|block|brick/.test(t)) return { fromToy: toy, object: "a keystone brick", found: false };
  if (/yo-?yo/.test(t)) return { fromToy: toy, object: "a humming yo-yo", found: false };
  if (/marble/.test(t)) return { fromToy: toy, object: "a glass marble that holds a galaxy", found: false };
  if (/kite/.test(t)) return { fromToy: toy, object: "a kite that catches impossible winds", found: false };
  return { fromToy: toy, object: "a shard of pure, humming light", found: false };
}

/* ---- Step definitions ---- */
const STEPS = [
  {
    key: "name",
    kind: "text",
    prompt: () => ["First — and this matters more than you'd think — what name do you go by?"],
    apply: (d, v) => { if (!v.trim()) return false; d.name = v.trim(); return true; },
  },
  {
    key: "difficulty",
    kind: "menu",
    prompt: () => ["And how hard a road do you want to walk? No wrong answer — the work counts either way. (you can change your mind later in settings)"],
    options: () => [
      { label: "Gentle (Easy) — the world goes easier on you; kinder foes, richer rewards", value: "easy" },
      { label: "Standard (Normal) — the world as it actually is, teeth and all", value: "normal" },
    ],
    apply: (d, v) => { d.difficulty = v; return true; },
  },
  {
    key: "gender",
    kind: "menu",
    prompt: () => ["And how do you move through the world — what should the word ‘magical’ sit in front of?"],
    options: () => [
      { label: "Girl", value: "girl" },
      { label: "Boy", value: "boy" },
      { label: "Person", value: "person" },
    ],
    apply: (d, v) => { d.gender = v; return true; },
  },
  {
    key: "occupation",
    kind: "menu",
    prompt: () => ["What's been filling your ordinary days — the life that's about to get a great deal less ordinary?"],
    options: () => [
      { label: "Working — out earning your keep", value: "working" },
      { label: "High school — almost out the other side", value: "highschool" },
      { label: "University — lectures, instant noodles, big questions", value: "university" },
      { label: "Post-graduate studies — in far too deep to stop now", value: "grad" },
    ],
    apply: (d, v) => { d.occupation = v; return true; },
  },
  {
    key: "job",
    kind: "text",
    when: (d) => d.occupation === "working",
    prompt: () => ["Where do you spend those hours? (a café? a bookshop? the night shift somewhere? name it — I want to picture it)"],
    apply: (d, v) => { d.job = v.trim() || FALLBACK_WORKPLACE; return true; },
  },
  {
    key: "p1",
    kind: "menu",
    prompt: () => ["At a party you don't know anyone at — do you find the quiet corner, or the loudest table?"],
    options: () => [
      { label: "Reserved", value: 0.3 },
      { label: "Balanced", value: 0.5 },
      { label: "Adventurous", value: 0.7 },
    ],
    apply: (d, v) => { d.reservedAdventurous = v; return true; },
  },
  {
    key: "p2",
    kind: "menu",
    prompt: () => ["And how do you carry yourself — buttoned-up and proper, or easy and come-as-you-are?"],
    options: () => [
      { label: "Formal", value: 0.3 },
      { label: "Balanced", value: 0.5 },
      { label: "Casual", value: 0.7 },
    ],
    apply: (d, v) => { d.formalCasual = v; return true; },
  },
  {
    key: "p3",
    kind: "menu",
    prompt: () => ["Last one of these, I promise — when the ice looks thin, do you test it first, or just go?"],
    options: () => [
      { label: "Cautious", value: 0.3 },
      { label: "Balanced", value: 0.5 },
      { label: "Bold", value: 0.7 },
    ],
    apply: (d, v) => { d.cautiousBold = v; return true; },
  },
  {
    key: "city",
    kind: "text",
    prompt: () => ["Now — where's home? The city or town that made you. What's it called?"],
    apply: (d, v) => { if (!v.trim()) return false; d.city = v.trim(); return true; },
  },
  {
    key: "animals",
    kind: "text",
    prompt: () => ["Here's a fun one. Three animals you love most — don't overthink it, just the first three that make you smile. (this is going to matter, but I won't say how yet)"],
    hint: "e.g.  cat, owl, fox",
    apply: (d, v) => {
      const list = v.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 3);
      if (!list.length) return false;
      d.animals = list;
      return true;
    },
  },
  {
    key: "toy",
    kind: "text",
    prompt: () => ["And the thing you loved most when you were small — the toy or game you'd have run back into a burning house for. What was it?"],
    apply: (d, v) => { if (!v.trim()) return false; d.toy = v.trim(); return true; },
  },
  {
    key: "secret",
    kind: "text",
    prompt: () => ["One more. Somewhere secret — the place you went when the world got too loud, the one that was only ever yours. Where was it?"],
    apply: (d, v) => { if (!v.trim()) return false; d.secret = v.trim(); return true; },
  },
  {
    key: "mascotName",
    kind: "menu",
    prompt: () => ["Oh — oh, hold on, here I come. Your companion's about to wake. What should it be called? (a few names feel right; or give it your own)"],
    options: (d) => {
      if (!d._nameChoices) d._nameChoices = randomNames(3);
      return [
        ...d._nameChoices.map((n) => ({ label: n, value: n })),
        { label: "✎ Type my own…", value: "__custom__" },
      ];
    },
    apply: (d, v) => { d.mascotName = v.trim() || (d._nameChoices && d._nameChoices[0]) || "Pip"; return true; },
  },
];

/* ---- Flow control ---- */

function firstApplicableStep(draft, fromIndex) {
  for (let i = fromIndex; i < STEPS.length; i++) {
    const step = STEPS[i];
    if (!step.when || step.when(draft)) return i;
  }
  return -1;
}

function printStep(state, index) {
  const step = STEPS[index];
  const c = state.ui.creation;
  pushLine(state, "");
  step.prompt(c.draft).forEach((l) => pushLine(state, l, "mascot"));

  if (step.kind === "menu") {
    state.ui.menu = { active: true, kind: "creation", options: step.options(c.draft), index: 0 };
    c.hint = "";
  } else {
    state.ui.menu = null;
    c.hint = step.hint || "";
  }
}

function advance(state) {
  const c = state.ui.creation;
  const next = firstApplicableStep(c.draft, c.index + 1);
  if (next === -1) { commit(state); return; }
  c.index = next;
  printStep(state, next);
}

/** Begin the creation flow (mutates the cloned state). */
export function beginCreation(state) {
  state.ui.flow = "creation";
  state.ui.creation = { index: 0, draft: {}, hint: "" };
  pushLine(state, "A small voice, bright as a struck bell, somewhere very close to your ear:", "system");
  pushLine(state, "\"There you are — oh, FINALLY there you are. I've been looking for ages, you have no idea. Don't be scared; this is the good part. Let's find out who you are.\"", "mascot");
  printStep(state, 0);
}

/** Handle a typed line during creation (text steps, or custom mascot name). */
export function handleCreationInput(state, text) {
  const c = state.ui.creation;
  const step = STEPS[c.index];

  // Ignore stray typing on menu steps unless we're capturing a custom value.
  if (step.kind === "menu" && !c.textCapture) return state;

  const ok = step.apply(c.draft, text);
  if (!ok) {
    pushLine(state, "Hmm — let's try that again:", "system");
    if (step.hint) pushLine(state, step.hint, "hint");
    return state;
  }
  c.textCapture = false;
  advance(state);
  return state;
}

/** Handle Enter on the active menu (mutates the cloned state). */
export function handleMenuSelect(state) {
  const c = state.ui.creation;
  const m = state.ui.menu;
  if (!c || !m || !m.active) return state;

  const opt = m.options[m.index];
  pushLine(state, opt.label, "echo");

  // "Type my own…" -> drop the menu, switch the same step to text capture.
  if (opt.value === "__custom__") {
    state.ui.menu = null;
    c.textCapture = true;
    c.hint = "";
    pushLine(state, "Go on, then — name me. Make it a good one:", "mascot");
    return state;
  }

  STEPS[c.index].apply(c.draft, opt.value);
  advance(state);
  return state;
}

/* ---- Commit: write draft -> model.character, fuse mascot, reveal ---- */
function commit(state) {
  const d = state.ui.creation.draft;
  const ch = state.model.character;

  ch.name = properNoun(d.name);
  ch.created = true;
  ch.gender = d.gender;
  ch.pronouns = pronounsFor(d.gender);
  ch.occupation = { type: d.occupation, detail: d.job || null };
  ch.personality = {
    reservedAdventurous: d.reservedAdventurous ?? 0.5,
    formalCasual: d.formalCasual ?? 0.5,
    cautiousBold: d.cautiousBold ?? 0.5,
  };
  ch.city = properNoun(d.city);
  ch.secretPlace = properNoun(d.secret);
  ch.magicalWeapon = toyToWeapon(properNoun(d.toy));

  // Difficulty (T20) — model-level, defaults to Normal; tunable later in settings.
  state.model.difficulty = d.difficulty || "normal";

  // Fuse the mascot (T5).
  const mascot = fuseMascot(d.animals, properNoun(d.mascotName));
  state.model.mascot = mascot;

  // ---- Reveal ----
  pushLine(state, "");
  pushLine(state, `The light gathers, folds, and settles into something small and breathing. Standing before you — paws planted, ridiculously pleased with itself — is ${mascot.name}.`, "system");
  pushLine(state, ART[mascot.artKeyLarge] || ART.blob_large, "mascot");
  pushLine(state, `The creatures you love, stitched into one impossible shape: ${mascot.animals.join(", ")}. ${cap(mascot.voice)} — all at once, somehow.`, "system");
  pushLine(state, `"Nice to FINALLY meet you properly, ${ch.name}. This is ${ch.city} — your ${ch.city} — isn't it? Good. Good. Then we know exactly where to start."`, "mascot");

  // City description: AI-generated (PROMPTS.md E) when available, with the
  // deterministic placeholder as the instant + offline fallback. The AI call runs
  // as an effect (main.js) and appends via update.js > onAIResult ("city").
  const placeholder = cityPlaceholder(ch.city, ch.occupation);
  if (aiAvailable()) {
    pushLine(state, `"${ch.city}… mm. Let me tell you what I see when I look at it."`, "mascot");
    state.ui.effect = {
      type: "ai",
      kind: "city",
      vars: { cityName: ch.city, occupation: occLabel(ch.occupation), fallback: placeholder },
    };
  } else {
    pushLine(state, placeholder, "system");
    pushLine(state, "(city flavor — not a factual claim.)", "hint");
  }

  pushLine(state, "");
  pushLine(state, `Welcome, magical ${labelFor(d.gender)}. Whatever the city is about to ask of you — it begins here, on Day 1.`, "banner");
  pushLine(state, "Type /help any time. Try: train power · rest · status", "hint");

  // Leave creation; resume normal play in the hub.
  state.ui.flow = null;
  state.ui.creation = null;
  state.ui.menu = null;
  state.model.mode = "hub";

  track("character_created", {
    gender: ch.gender,
    occupation: ch.occupation.type,
    difficulty: state.model.difficulty,
    animals: (mascot.animals || []).join(","),
    mascotArt: mascot.artKey || null,
  });
}

function labelFor(gender) {
  return gender === "girl" ? "girl" : gender === "boy" ? "boy" : "person";
}

/** Capitalize the first letter (mascot voice descriptors are stored lowercase). */
function cap(s) {
  s = String(s || "");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* The cozy fallback for a job the player left blank — never a generic
   "company," always a small, warm, lived-in place. */
const FALLBACK_WORKPLACE = "the corner shop you more or less run by now";

/** Readable occupation string for the AI city prompt (PROMPTS.md E). */
function occLabel(occupation) {
  switch (occupation.type) {
    case "working": return `working at ${occupation.detail || FALLBACK_WORKPLACE}`;
    case "highschool": return "in your last years of high school";
    case "university": return "muddling through university";
    case "grad": return "deep in grad school, half-asleep on good coffee";
    default: return "living an ordinary, unhurried life";
  }
}

function cityPlaceholder(city, occupation) {
  const where =
    occupation.type === "working"
      ? `walking home from ${occupation.detail || FALLBACK_WORKPLACE}`
      : occupation.type === "highschool"
      ? "walking home from school with your bag half-open"
      : occupation.type === "university"
      ? "drifting home between lectures"
      : "trudging home after a long day bent over your work";
  return `${city} is the kind of place that hums to itself when no one's listening — narrow streets that know your footsteps, windows gone gold at supper-time, a sky that softens to bruise-blue and lets the first stars through. It's ${where}, thinking about nothing in particular, that everything is about to change.`;
}

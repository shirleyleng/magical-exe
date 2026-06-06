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

import { pushLine, pronounsFor } from "./state.js";
import { fuseMascot, randomNames, ART } from "./mascot.js";

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
  return { fromToy: toy, object: `your ${toy || "old toy"}, remade in light`, found: false };
}

/* ---- Step definitions ---- */
const STEPS = [
  {
    key: "name",
    kind: "text",
    prompt: () => ["First — what name do you go by?"],
    apply: (d, v) => { if (!v.trim()) return false; d.name = v.trim(); return true; },
  },
  {
    key: "gender",
    kind: "menu",
    prompt: () => ["How do you present in the world?"],
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
    prompt: () => ["What fills your ordinary days?"],
    options: () => [
      { label: "Working", value: "working" },
      { label: "High school", value: "highschool" },
      { label: "University", value: "university" },
      { label: "Post-graduate studies", value: "grad" },
    ],
    apply: (d, v) => { d.occupation = v; return true; },
  },
  {
    key: "job",
    kind: "text",
    when: (d) => d.occupation === "working",
    prompt: () => ["Where do you work? (a café? a bookshop? name it)"],
    apply: (d, v) => { d.job = v.trim() || "a little shop in town"; return true; },
  },
  {
    key: "p1",
    kind: "menu",
    prompt: () => ["Are you more reserved or adventurous?"],
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
    prompt: () => ["Are you more formal or casual?"],
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
    prompt: () => ["Are you more cautious or bold?"],
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
    prompt: () => ["What's the name of your city or town?"],
    apply: (d, v) => { if (!v.trim()) return false; d.city = v.trim(); return true; },
  },
  {
    key: "animals",
    kind: "text",
    prompt: () => ["Name your three favorite animals (comma-separated)."],
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
    prompt: () => ["What was your most beloved childhood toy or game?"],
    apply: (d, v) => { if (!v.trim()) return false; d.toy = v.trim(); return true; },
  },
  {
    key: "secret",
    kind: "text",
    prompt: () => ["Name a secret or special place from your life."],
    apply: (d, v) => { if (!v.trim()) return false; d.secret = v.trim(); return true; },
  },
  {
    key: "mascotName",
    kind: "menu",
    prompt: () => ["Your companion stirs. What is its name?"],
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
  pushLine(state, "A small voice, bright as a struck bell:", "system");
  pushLine(state, "\"There you are! I've been waiting. Let's find out who you are.\"", "mascot");
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
    pushLine(state, "Type a name for your companion:", "mascot");
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

  ch.name = d.name;
  ch.created = true;
  ch.gender = d.gender;
  ch.pronouns = pronounsFor(d.gender);
  ch.occupation = { type: d.occupation, detail: d.job || null };
  ch.personality = {
    reservedAdventurous: d.reservedAdventurous ?? 0.5,
    formalCasual: d.formalCasual ?? 0.5,
    cautiousBold: d.cautiousBold ?? 0.5,
  };
  ch.city = d.city;
  ch.secretPlace = d.secret;
  ch.magicalWeapon = toyToWeapon(d.toy);

  // Fuse the mascot (T5).
  const mascot = fuseMascot(d.animals, d.mascotName);
  state.model.mascot = mascot;

  // ---- Reveal ----
  pushLine(state, "");
  pushLine(state, `The light settles. Standing before you is ${mascot.name}.`, "system");
  pushLine(state, ART[mascot.artKeyLarge] || ART.blob_large, "mascot");
  pushLine(state, `A fusion of ${mascot.animals.join(", ")} — ${mascot.voice}.`, "system");
  pushLine(state, `"Nice to finally meet you, ${ch.name}. This is ${ch.city}, isn't it?"`, "mascot");

  pushLine(state, cityPlaceholder(ch.city, ch.occupation), "system");
  pushLine(state, "(city flavor — not a factual claim; richer description comes later.)", "hint");

  pushLine(state, "");
  pushLine(state, `Welcome, magical ${labelFor(d.gender)}. Your story begins on Day 1.`, "banner");
  pushLine(state, "Type /help any time. Try: train power · rest · status", "hint");

  // Leave creation; resume normal play in the hub.
  state.ui.flow = null;
  state.ui.creation = null;
  state.ui.menu = null;
  state.model.mode = "hub";
}

function labelFor(gender) {
  return gender === "girl" ? "girl" : gender === "boy" ? "boy" : "person";
}

function cityPlaceholder(city, occupation) {
  const where =
    occupation.type === "working"
      ? `on your way home from ${occupation.detail || "work"}`
      : occupation.type === "highschool"
      ? "on your way home from school"
      : occupation.type === "university"
      ? "between lectures"
      : "after a long day of study";
  return `${city} is the kind of place that hums quietly — narrow streets, warm windows, a sky that goes soft at dusk. It's ${where} that everything is about to change.`;
}

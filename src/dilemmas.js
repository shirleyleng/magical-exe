/* ----------------------------------------------------------------------------
   dilemmas.js — push-model moral events (DESIGN §9.5, T19).

   Where errands are an opt-in activity, dilemmas come TO you: a crisis surfaces
   at rest and you must choose. Each is one-shot (latched in flags.dilemmasSeen).
   Outcomes are deliberately AMBIGUOUS — no numbers, no clean "that was good/bad";
   the easy option only reads a little off in tone. Hope (and sometimes Corruption)
   move silently. The inaction/expedient branch is how hope can quietly LEAK.

   maybeDilemma() is called once per rest (after the rival tick) and may open a
   menu (kind "dilemma"); resolveDilemma() applies the chosen branch.
   ---------------------------------------------------------------------------- */
import { CONFIG } from "../config.js";
import { pushLine } from "./state.js";
import { adjustHope } from "./hope.js";
import { adjustAlignment } from "./alignment.js";
import { adjustVisibility } from "./visibility.js";

/* Authored pool. Each choice's deltas are applied silently; only `outcome` prints.
   Keep the "off" option's tone faintly wrong, never labelled as the bad one. */
const DILEMMAS = [
  {
    id: "lost_child",
    setup: [
      "On your way in, a small child sits crying on the curb — lost, clutching a coat too big for them. They can only half-remember an address.",
      "A well-dressed stranger crouches beside you, smiling kindly. \"I can take them from here, if you're busy. I know the neighbourhood.\"",
    ],
    choices: [
      { label: "Walk them home yourself, however long it takes", hope: 5, virtue: 3,
        outcome: "It eats the whole evening, street by street. Then a door opens and a parent's face just — breaks, with relief. Some things really are that simple." },
      { label: "Let the stranger take them — you're needed elsewhere", corruption: 6, hope: -3,
        outcome: "The stranger takes the small hand and is gone before you think to ask a name. You tell yourself it was fine. You never do find out. Some nights you still wonder." },
    ],
  },
  {
    id: "weird_noise",
    setup: [
      "Past midnight, something thuds in the alley behind your building — wrong, and wet, and deliberate.",
      "You are so tired. The blanket is warm. It's probably nothing.",
    ],
    choices: [
      { label: "Go down and look", hope: 4, virtue: 2,
        outcome: "Someone is down there who needed finding. You stay until they can stand on their own. The night feels a little less heavy after." },
      { label: "Pull the blanket up and pretend you didn't hear", hope: -4,
        outcome: "In the morning there's tape across the mouth of the alley and two officers talking low. You don't go closer. You don't really want to know." },
    ],
  },
  {
    id: "shuttered_pharmacy",
    setup: [
      "An old man stands shaking outside a shuttered pharmacy — his medicine is locked inside and the owner is nowhere.",
      "You could force the shutter with a thread of the dark. Quick. Clean. No one hurt. Probably.",
    ],
    choices: [
      { label: "Track down the owner and do it right, slow as that is", hope: 4, virtue: 2,
        outcome: "It costs you an hour you didn't have, knocking on doors. But the old man gets his medicine, and you got it the way you can live with." },
      { label: "Force the shutter with a little forbidden power", corruption: 6, hope: 1,
        outcome: "The lock gives with a sound like a held breath. He gets his medicine. The power leaves a residue in you that doesn't quite rinse off." },
    ],
  },
];

/** Offer a dilemma at rest, maybe. One-shot; only when nothing else has grabbed
    control (no combat, no open menu). Opens a kind:"dilemma" menu when it fires. */
export function maybeDilemma(state) {
  const model = state.model;
  if (model.mode !== "hub") return state;                 // rival duel etc. took the turn
  if (state.ui.menu && state.ui.menu.active) return state; // a menu is already up
  const cfg = CONFIG.dilemmas || {};
  if ((model.day || 1) < (cfg.minDay || 1)) return state;
  const flags = model.world.flags;
  if (!flags.dilemmasSeen) flags.dilemmasSeen = [];
  const pool = DILEMMAS.filter((d) => !flags.dilemmasSeen.includes(d.id));
  if (!pool.length) return state;
  if (Math.random() > (cfg.chancePerRest ?? 0.35)) return state;

  const d = pool[Math.floor(Math.random() * pool.length)];
  flags.dilemmasSeen.push(d.id); // latch on offer — the moment comes once
  pushLine(state, "—", "hint");
  for (const line of d.setup) pushLine(state, line, "system");
  const options = d.choices.map((c, i) => ({ label: c.label, value: String(i) }));
  state.ui.menu = { active: true, kind: "dilemma", dilemmaId: d.id, options, index: 0 };
  return state;
}

/** Apply the chosen branch. Deltas are silent; only the ambiguous outcome prints. */
export function resolveDilemma(state, dilemmaId, choiceIndex) {
  const d = DILEMMAS.find((x) => x.id === dilemmaId);
  if (!d) return state;
  const c = d.choices[Number(choiceIndex)];
  if (!c) return state;
  const ch = state.model.character;
  if (c.virtue || c.corruption) adjustAlignment(ch, { virtue: c.virtue || 0, corruption: c.corruption || 0 });
  if (c.fame || c.unmasking) adjustVisibility(ch, { fame: c.fame || 0, unmasking: c.unmasking || 0 });
  if (c.hope) adjustHope(ch, c.hope);
  pushLine(state, c.outcome, "system");
  return state;
}

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
import { track } from "./analytics.js";

/* Authored pool. Each choice's deltas are applied silently; only `outcome` prints.
   Keep the "off" option's tone faintly wrong, never labelled as the bad one. */
const DILEMMAS = [
  {
    id: "lost_child",
    setup: [
      "On your way in, a small child sits crying on the curb — lost, clutching a coat three sizes too big, the way you clutch a thing when it's the last warm thing you have. They can only half-remember an address, and keep getting the street name wrong.",
      "A well-dressed stranger crouches down beside you, smiling a smile with very good teeth. \"I can take them from here, if you're busy. I know the neighbourhood like the back of my hand.\"",
    ],
    choices: [
      { label: "Walk them home yourself, however long it takes", hope: 5, virtue: 3, tiring: true,
        outcome: "It eats the whole evening, one wrong street at a time, the small hand sweaty in yours. Then a door opens and a parent's face just — comes apart, with relief, the way faces do when the worst thing didn't happen after all. Some things really are that simple. You forget that, sometimes." },
      { label: "Let the stranger take them — you're needed elsewhere", corruption: 6, hope: -3,
        outcome: "The stranger folds the small hand into his and is gone around the corner before it occurs to you to ask either of them a name. It was fine. You tell yourself it was fine, walking home. You never do find out. And some nights, years from now, you'll still be lying awake wondering." },
    ],
  },
  {
    id: "weird_noise",
    setup: [
      "Past midnight, something thuds in the alley behind your building — once, then again, wrong and wet and unmistakably deliberate. Not a cat. Not the wind.",
      "You are so tired. Bone-tired, the kind sleep barely touches. The blanket is warm and the floor will be cold and it's probably, almost certainly, nothing at all.",
    ],
    choices: [
      { label: "Go down and look", hope: 4, virtue: 2, tiring: true,
        outcome: "Someone is down there who needed finding, and hadn't dared hope anyone would come. You stay — past cold, past tired — until they can stand on their own two feet again. The walk back up feels lighter than the walk down. The whole night does." },
      { label: "Pull the blanket up and pretend you didn't hear", hope: -4,
        outcome: "In the morning there's tape strung across the mouth of the alley, and two officers talking low, and the particular silence of neighbours not asking. You don't go closer. You keep your eyes on your shoes. You don't, you tell yourself firmly, really want to know." },
    ],
  },
  {
    id: "shuttered_pharmacy",
    setup: [
      "An old man stands shaking outside a shuttered pharmacy, hands working at nothing — his medicine is locked behind the grille, the kind you don't skip, and the owner is nowhere and not answering.",
      "You could force the shutter with one thin thread of the dark. Quick. Clean. Nobody hurt, nothing broken that matters. Probably. Almost certainly.",
    ],
    choices: [
      { label: "Track down the owner and do it right, slow as that is", hope: 4, virtue: 2, tiring: true,
        outcome: "It costs you an hour you absolutely did not have, knocking on the wrong doors until you find the right one. But the old man gets his medicine pressed into his shaking hands, and you got it for him the only way you'll be able to live with at three in the morning." },
      { label: "Force the shutter with a little forbidden power", corruption: 6, hope: 1,
        outcome: "The lock gives with a soft sound, like a held breath finally let out. He gets his medicine; he even thanks you, which is somehow worse. The power you used leaves a faint residue behind your ribs that doesn't quite rinse off in the morning. You'll get used to that. That's the part that should worry you." },
    ],
  },
];

/** Offer a dilemma at rest, maybe. One-shot; only when nothing else has grabbed
    control (no combat, no open menu). Opens a kind:"dilemma" menu when it fires. */
export function maybeDilemma(state) {
  const model = state.model;
  if (model.mode !== "hub") return state;                 // rival duel etc. took the turn
  if (model.rivalTalk && model.rivalTalk.active) return state; // mid-conversation with Sable
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
  track("dilemma_resolved", {
    dilemmaId,
    choiceIndex: Number(choiceIndex),
    day: state.model.day,
    path: ch.path,
  });
  pushLine(state, c.outcome, "system");
  // Staying up to do the good deed costs you the night's rest — you wake only half-restored.
  // (rest already topped Stamina to full before the dilemma fired; this spends it back down.)
  if (c.tiring) {
    const stats = ch.stats;
    stats.stamina = Math.floor(stats.maxStamina / 2);
    pushLine(state, `You gave the night away, and morning comes too soon. (Stamina ${stats.stamina}/${stats.maxStamina})`, "hint");
  }
  return state;
}

/* ============================================================
   MAGICAL.EXE — endgame.js  (T19, DESIGN §9.5)
   The finale resolver. After the two-phase final fight ends (combat.js sets
   ui.finaleResolve), this owns the BRINK: a dramatized choice ("answer with the
   hope you've gathered" / "seize the despair's power") followed by a fuel-check
   gate WITH TEETH. The 2×2 of {reach × enough-fuel} decides which of four endings
   plays. This is deliberately NOT handleBossDefeat — the brink is richer than a
   tier threshold, and it consumes the hidden Hope tally + the Virtue/Corruption
   path, with Fame lowering the hope you personally need.

   Gate (config.finale):
     effHopeThreshold = clamp(base − fame·relief, floor, base)
     enoughHope  = hopeTally >= effHopeThreshold
     enoughSeize = path === "corrupt" || corruption >= seizeCorrThreshold

       reach "hope"  + enoughHope   -> Virtuous Ascension (you + guardian-deity mascot)
       reach "hope"  + short        -> Quiet Tragedy      (survive hollow; replayable)
       reach "seize" + enoughSeize  -> Dark Ascension      (dark deity, self intact)
       reach "seize" + short        -> Eldritch Merge      (you + mascot become the horror)

   Horror is reserved for HUBRIS (grasping power you can't hold), never for trying
   for hope and falling short — so a gentle non-optimizer who reaches and misses
   gets the quiet tragedy, not the merge.
   ============================================================ */

import { CONFIG } from "../config.js";
import { pushLine } from "./state.js";
import { refreshSlotsMax } from "./hub.js";
import { ART, corruptArt } from "./mascot.js";

const mascotName = (state) => (state.model.mascot && state.model.mascot.name) || "your mascot";

/** The mascot's OWN Virtuous Ascension deity art (per-base), or the generic one. */
function deityArt(state) {
  const k = state.model.mascot && state.model.mascot.artKeyLarge;
  const base = k ? k.replace(/_large$/, "") : "";
  return ART[`${base}_deity`] || ART.deity_large;
}
const rivalName = (state) => ((state.model.rivals && state.model.rivals[0] && state.model.rivals[0].name) || "Sable");

/** The hope you personally need to hold an ascension, lowered by Fame (the city's
    belief carries you; a hidden hero needs more). clamp(base − fame·relief, floor, base). */
export function effHopeThreshold(ch) {
  const F = CONFIG.finale;
  const raw = Math.round(F.hopeThresholdBase - (ch.fame || 0) * F.fameThresholdRelief);
  return Math.max(F.hopeThresholdFloor, Math.min(F.hopeThresholdBase, raw));
}

/** Called from update.js afterCombat when ui.finaleResolve is set. Plays the brink
    narration and opens the choice menu (kind "brink"); the gate runs on selection. */
export function handleFinaleResolve(state) {
  if (!state.ui.finaleResolve) return state;
  state.ui.finaleResolve = null;
  const m = mascotName(state);

  pushLine(state, "", "system");
  pushLine(state, "THE BRINK", "banner");
  pushLine(state, "The Despair kneels before you, beaten and yet somehow not gone, vast and grey and waiting — and for one long held breath the whole world seems to wait with it, to hold still on the point of what you choose to do next. You can feel two roads open under your feet, as real as cold ground.", "system");
  pushLine(state, `One: open your hands and answer all that sorrow with everything the city has poured back into you — every errand walked, every small promise kept, every face that learned how to believe again because of you. Give it all away at once, and trust, with no proof at all, that it's enough.`, "system");
  pushLine(state, `The other: close your fist around the Despair itself and TAKE it — all that vast and ancient power, yours, with no one's leave to ask and no one left to stop you. Quicker. Surer. A colder, simpler kind of forever.`, "system");
  pushLine(state, `${m}, pressed warm against your shoulder, says nothing at all. It just stays. This one was always going to be yours alone — and it isn't going to leave you to it.`, "mascot");

  state.ui.menu = {
    active: true,
    kind: "brink",
    options: [
      { label: "Answer it with the hope you've gathered", value: "hope" },
      { label: "Seize the Despair's power for yourself", value: "seize" },
    ],
    index: 0,
  };
  return state;
}

/** Apply the chosen road through the fuel-check gate, then play the ending. */
export function resolveBrink(state, choice) {
  const ch = state.model.character;
  const F = CONFIG.finale;
  const enoughHope = (ch.hopeTally || 0) >= effHopeThreshold(ch);
  const enoughSeize = ch.path === "corrupt" || (ch.corruption || 0) >= F.seizeCorrThreshold;

  if (choice === "hope") {
    return enoughHope ? virtuousAscension(state) : quietTragedy(state);
  }
  // seize
  return enoughSeize ? darkAscension(state) : eldritchMerge(state);
}

/* ---- shared tails ---- */

/** Land the player back in the world (changed or not) after an ending plays. */
function returnHome(state) {
  const model = state.model;
  model.combat = null;
  model.mode = "hub";
  model.world.currentLocation = "homebase";
  model.world.currentRoom = null;
}

/** Both ascensions: you cross into the final tier. (+the milestone slot.) */
function becomeAscended(state) {
  const model = state.model;
  model.character.transformationTier = "ascended";
  model.world.flags.ascended = true;
  const before = model.hub.slotsMax;
  refreshSlotsMax(model);
  return model.hub.slotsMax - before;
}

/** The credits-ish coda after a WIN — enumerate what fed back, then point to prestige. */
function ascensionCoda(state, slotGain) {
  const r = rivalName(state);
  pushLine(state, "", "system");
  pushLine(state, "And it held — because none of it was ever only you:", "system");
  pushLine(state, "  · the city believed (every Fame you ever paid for in risk),", "system");
  pushLine(state, "  · the hope you carried back to it, errand by quiet errand,", "system");
  pushLine(state, `  · the bond that wouldn't let go of you,`, "system");
  pushLine(state, `  · and ${r}, who fought at your shoulder to the last.`, "system");
  if (slotGain > 0) pushLine(state, `(You stand fully realized now — ${state.model.hub.slotsMax} activity slots.)`, "hint");
  pushLine(state, "", "system");
  pushLine(state, "✦ Your watch over this city is done. Sleep, hero. You've more than earned it. ✦", "banner");
  pushLine(state, "(There are always other cities, other mornings that need someone. When you're ready to lay this life down and begin again — stronger, into a harder world — type prestige. Until then: thank you, truly, for playing MAGICAL.EXE.)", "hint");
}

/* ---- the four endings ---- */

/** Reach for hope, with the fuel to hold it. The best end. */
function virtuousAscension(state) {
  const m = mascotName(state);
  const slotGain = becomeAscended(state);
  pushLine(state, "", "system");
  pushLine(state, "VIRTUOUS ASCENSION", "banner");
  pushLine(state, "You open your hands. It should be far too little against something so vast — and it isn't, because it was never just yours to give. The whole city pours through you at once, warm and unbearable and bright, and the grey doesn't fight it so much as finally, gratefully let go.", "system");
  pushLine(state, deityArt(state), "mascot");
  pushLine(state, `Beside you ${m} blazes up past anything it has ever been — no longer a small bright voice but its own true thing, a guardian-spirit of this place, haloed and enormous and laughing. "We did it. We actually—" Its voice breaks, all light. "Look at them. Look at them remembering how."`, "mascot");
  pushLine(state, "Above you the clouds thin for the first time in longer than anyone will admit, and somewhere far below a whole city looks up.", "system");
  ascensionCoda(state, slotGain);
  returnHome(state);
  return state;
}

/** Seize the despair, with the corruption to keep yourself whole inside it. */
function darkAscension(state) {
  const m = mascotName(state);
  const slotGain = becomeAscended(state);
  if (state.model.mascot) state.model.mascot.dimmed = true; // bound, light guttered to an ember
  pushLine(state, "", "system");
  pushLine(state, "DARK ASCENSION", "banner");
  pushLine(state, "You close your fist. The Despair comes into you like cold water into a held breath — and you do not drown. You stay, all of you, every stubborn edge intact; it's the power that bends, not you. When you stand it's as something the old stories would have run from. A god, of a darker make. But yours. Chosen. Yours.", "system");
  pushLine(state, `${m} does not leave you. That's almost the worst of it — it stays, bound to the thing you've become, its small light guttered down to a wary ember. It still answers when you call. It just flinches first now, every time.`, "mascot");
  pushLine(state, "The grey breaks because you tell it to. The city is saved, and safe, and very quiet about its new protector.", "system");
  ascensionCoda(state, slotGain);
  returnHome(state);
  return state;
}

/** Reach for hope and fall short. Bittersweet, NOT horror — and replayable. */
function quietTragedy(state) {
  const m = mascotName(state);
  pushLine(state, "", "system");
  pushLine(state, "A QUIET ENDURING", "banner");
  pushLine(state, "You open your hands and give everything you gathered — and it is enough to hold the line, and not enough to break it. The Despair doesn't win. It doesn't lose either. It thins to something the city can live alongside, the way you live alongside an old grief: greyer mornings, longer winters, a weight that never quite lifts.", "system");
  pushLine(state, `You walk home on your own feet, ${m} tucked against your collar, both of you alive and hollowed out and quietly, fiercely not done.`, "mascot");
  pushLine(state, `${m}, very soft: "It wasn't enough yet. *Yet.* They need more time to believe — and so we give them more time. We come back. We always come back."`, "mascot");
  pushLine(state, "", "system");
  pushLine(state, "(The Heart of the Grey is still open to you. Keep bringing the city hope — errands, dilemmas, every life you lift — and return when more of it believes. Some endings have to be earned twice.)", "hint");
  returnHome(state);
  return state;
}

/** Seize what you couldn't hold. Horror — reserved for hubris. Your own mascot, corrupted. */
function eldritchMerge(state) {
  const model = state.model;
  const m = mascotName(state);
  pushLine(state, "", "system");
  pushLine(state, "ELDRITCH MERGE", "banner");
  pushLine(state, "You close your fist on power you have no purchase to hold, and it closes right back. There's no pain — that would require a you to feel it. There's only the Despair pouring in and finding nothing strong enough to stay itself, and so it keeps everything: your shape, your name, the small warm thing that loved you and came too close at the end.", "system");
  pushLine(state, `${m} reaches you a half-second too late, or perhaps exactly on time — and is taken in too, folded into the new shape with you, the way two colours of paint become a third that is neither.`, "mascot");

  // The curated-art payoff: the player's OWN mascot ASCII, deterministically corrupted.
  const baseArt = (model.mascot && ART[model.mascot.artKeyLarge]) || ART.blob_large;
  pushLine(state, corruptArt(baseArt), "mascot");

  pushLine(state, "What stands up where you stood is the next thing the corruption will wear into the next grey city, and somewhere deep inside the new shape, very quietly, it remembers that it used to want to help. That memory is the cruelest part of it. It always is.", "system");
  pushLine(state, "", "system");
  pushLine(state, "✦ This is where your story ends — or where, in another life, you reach instead for something light enough to carry. ✦", "banner");
  pushLine(state, "(That other life is yours to take. Type prestige to lay this one down and begin again — changed, and knowing now what you know.)", "hint");
  returnHome(state);
  return state;
}

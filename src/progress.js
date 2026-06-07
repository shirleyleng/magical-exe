/* ============================================================
   MAGICAL.EXE — progress.js  (T9)
   Transformation-tier progression. When a story boss is defeated
   (state.ui.justDefeatedBoss), check whether its tier's requirements
   are now met and, if so, transform the player and play the reveal.
   Tiers are gated by a boss AND a threshold (config.tiers).

   v1 slice implements Novice -> Soldier (Boss #1 + the alliance
   reveal). Knight/Awakened/Ascended reveals arrive in T16+.
   ============================================================ */

import { CONFIG } from "../config.js";
import { pushLine } from "./state.js";
import { ART } from "./mascot.js";
import { refreshSlotsMax } from "./hub.js";
import { armRivalForBoss } from "./rival.js";
import { adjustHope } from "./hope.js";

const TIER_ORDER = ["novice", "soldier", "knight", "awakened", "ascended"];

const mascotName = (state) => (state.model.mascot && state.model.mascot.name) || "Your mascot";

const TIER_REVEAL = {
  soldier(state) {
    const m = mascotName(state);
    pushLine(state, ART.star_large, "mascot");
    pushLine(state, "Light pours up through you — you rise to MAGICAL SOLDIER!", "banner");
    pushLine(state, `${m}: "You did it! …There's something I should tell you now."`, "mascot");
    pushLine(
      state,
      `${m}: "We aren't alone. Across the world there's an alliance of magical people, sworn to drive back corruption and keep cities whole — but there are far too few of us for every city. That's why we can travel from one to the next."`,
      "mascot"
    );
  },
  knight(state) {
    const m = mascotName(state);
    const path = state.model.character.path;
    const flavor =
      path === "virtuous"
        ? "Clean light hardens around you like armor — every edge of you turned to shelter for others."
        : path === "corrupt"
        ? "The light comes edged and hungry, a darker steel — power that protects, and tempts."
        : "Light folds into something tempered and sure — neither soft nor cruel, simply ready.";
    pushLine(state, ART.star_large, "mascot");
    pushLine(state, "You rise again — MAGICAL KNIGHT!", "banner");
    pushLine(state, flavor, "system");
    pushLine(state, `${m}: "A Knight. I knew you'd reach this. The alliance will want to hear of it."`, "mascot");
  },
  awakened(state) {
    const m = mascotName(state);
    const path = state.model.character.path;
    const flavor =
      path === "virtuous"
        ? "The light that fills you is wholly your own now — not borrowed, not feared. It knows your name."
        : path === "corrupt"
        ? "The dark and the light in you stop warring and simply answer to you. Whatever you've become, it's finally, fully yours."
        : "Doubt and certainty settle into the same hand. You stop asking whether you're enough. You just are.";
    pushLine(state, ART.star_large, "mascot");
    pushLine(state, "The weapon answers your grip — and something long asleep in you opens its eyes. You AWAKEN!", "banner");
    pushLine(state, flavor, "system");
    pushLine(state, `${m}: "There you are. The real you. …Now — let's go finish what we started."`, "mascot");
  },
};

/* T18: defeating the secret-place doubt recovers your magical weapon and your
   mascot. Called before the tier gate so the Awakened reqWeaponFound passes. */
function recoverWeaponAndMascot(state) {
  const model = state.model;
  const ch = model.character;
  const m = mascotName(state);
  ch.magicalWeapon.found = true;
  pushLine(state, "The doubt wearing your face shudders, thins, and finally lets go.", "banner");
  pushLine(state, `Where it stood, the small light steadies into something solid: ${ch.magicalWeapon.object}. Your weapon. You'd know it anywhere.`, "system");
  pushLine(state, `Curled around it, ${m} stirs — battered, faint, but breathing. Its eyes find yours. "…You came back for me. You wonderful idiot."`, "mascot");
  if (model.mascot) { model.mascot.present = true; model.mascot.injured = false; }
  model.world.flags.mascotGone = false; // training reopens (sparring stays — its own flag)
}

/* Narrative beats that fire when a boss falls, regardless of whether a tier-up
   happens — this is how the player learns corruption's deeper nature (DESIGN §8).
   Each fires at most once (latched in world.flags.storyBeats). */
const BOSS_BEAT = {
  boss2(state) {
    const m = mascotName(state);
    pushLine(state, `${m}: "These aren't wild spawns. Something is *commanding* the corruption — a big boss, hidden, pulling it toward your city on purpose."`, "mascot");
    pushLine(state, `${m}: "Beat back its champions and we'll find it. …Though something about all this still doesn't sit right with me."`, "mascot");
  },
  boss3(state) {
    const m = mascotName(state);
    pushLine(state, `${m}: "I've started to understand. The corruption grows thickest where people have given up — it *feeds* on hopelessness."`, "mascot");
    pushLine(state, `${m}: "Every errand you run, every person you give hope back to — that may be the truer fight. Remember that."`, "mascot");
  },
  // T18: the Boss #4 rematch (now winnable as Awakened) — the rival pays her dues
  // and resumes challenging you, this time as an equal.
  boss4(state) {
    const rival = (state.model.rivals && state.model.rivals[0]) || { name: "Sable" };
    pushLine(state, "The Grief Herald comes apart at last — not banished so much as *answered*. The long rain finally stops.", "banner");
    pushLine(state, `${rival.name} is waiting when you return, and for once she doesn't bother hiding the grin. "You went back. You won. …I had a whole speech ready about not throwing your life away. Guess I'll keep it."`, "mascot");
    pushLine(state, `"You're the real thing now. I'll keep coming for you — but as an equal. Someone has to keep an Awakened honest." She holds out a hand.`, "mascot");
    rival.disposition = "respectful";
  },
};

/** React to a boss defeat: fire its story beat, then maybe advance a tier. */
export function handleBossDefeat(state) {
  const bossId = state.ui.justDefeatedBoss;
  if (!bossId) return state;
  state.ui.justDefeatedBoss = null;

  const ch = state.model.character;
  const flags = state.model.world.flags;

  // A boss win quietly brings the city hope (hidden tally — no callout).
  adjustHope(ch, (CONFIG.errands && CONFIG.errands.passiveHopePerBoss) || 0);

  // Story beat (corruption's deeper nature), latched so it never repeats.
  if (!flags.storyBeats) flags.storyBeats = [];
  if (BOSS_BEAT[bossId] && !flags.storyBeats.includes(bossId)) {
    flags.storyBeats.push(bossId);
    BOSS_BEAT[bossId](state);
  }

  // Arm the rival schedule off this boss (meets after #2, returns after #3).
  armRivalForBoss(state, bossId);

  // T18: the secret-place doubt — recover the weapon + mascot so the Awakened
  // gate (reqWeaponFound) can pass below.
  if (bossId === "secretPlace") recoverWeaponAndMascot(state);

  // Which tier does this boss gate?
  const tierName = Object.keys(CONFIG.tiers).find((t) => CONFIG.tiers[t].reqBoss === bossId);
  if (!tierName) return state;

  // Only advance to the immediate next tier.
  const curIdx = TIER_ORDER.indexOf(ch.transformationTier);
  if (TIER_ORDER.indexOf(tierName) !== curIdx + 1) return state;

  // Threshold gates.
  const reqs = CONFIG.tiers[tierName];
  const staminaPct = ch.stats.stamina / ch.stats.maxStamina;
  if (reqs.reqMinStaminaPct && staminaPct < reqs.reqMinStaminaPct) {
    pushLine(state, "You feel a threshold just out of reach — recover your Stamina and return.", "hint");
    return state;
  }
  if (reqs.reqWeaponFound && !ch.magicalWeapon.found) return state;
  if (reqs.reqMinHopeTally && ch.hopeTally < reqs.reqMinHopeTally) return state;

  // Transform!
  ch.transformationTier = tierName;
  const before = state.model.hub.slotsMax;
  refreshSlotsMax(state.model); // a tier milestone grants +1 slot

  const reveal = TIER_REVEAL[tierName];
  if (reveal) reveal(state);

  if (state.model.hub.slotsMax > before) {
    pushLine(state, `(A new path opens — you now have ${state.model.hub.slotsMax} activity slots.)`, "hint");
  }
  return state;
}

/* ---- T17: the Knight->Awakened low point ----
   Reacts to the scripted Boss #4 story-loss (state.ui.justLostStoryBoss, set in
   combat.js). The mascot is already injured + gone by now; here we play the quiet
   aftermath and the rival's pivot — she names the alliance, reveals the Awakened
   tier exists and that it's the only road back for your mascot, and unlocks
   Sparring to replace the training the mascot used to give you. Sets up T18. */
export function handleStoryLoss(state) {
  const which = state.ui.justLostStoryBoss;
  if (!which) return state;
  state.ui.justLostStoryBoss = null;

  const model = state.model;
  const flags = model.world.flags;
  flags.mascotGone = true;       // gates: training disabled + HUD MASCOT panel (lifted when the mascot returns)
  flags.sparringUnlocked = true; // gates: sparring available (stays unlocked even after the mascot returns)
  const m = mascotName(state);
  const rival = (model.rivals && model.rivals[0]) || { name: "Sable" };

  // The quiet aftermath — the hopelessness theme, made personal.
  pushLine(state, "", "system");
  pushLine(state, `The house keeps ${m}'s shape in every corner: the worn perch, the half-taught lessons, the small bright voice that isn't there.`, "system");
  pushLine(state, `You couldn't save the one who saved you. The doubt you've carried since the beginning finally says it plainly — am I good enough to be a magical girl at all? Can someone like me truly end the corruption?`, "system");

  // The rival pivots: the thread of hope, and the road to T18.
  pushLine(state, "", "system");
  pushLine(state, `A knock. ${rival.name} lets herself in, takes one look at the empty room, and goes very still. "...So it took your mascot. I'm sorry. They don't come back from that on their own."`, "banner");
  pushLine(state, `"Listen. Hitting that thing head-on was never the answer — ${m} knew it, that's why it stepped in. Stop fighting the way they tell you to and ASK the alliance for a better one. There's a war they're losing quietly."`, "mascot");
  pushLine(state, `"And there's a tier past Knight. Awakened. You reach it by finding what you were before any of this — and if anything can wake ${m} again, it's that. Go to the alliance. Then come back to me."`, "mascot");
  pushLine(state, `"I can't train you the way your mascot did. But I can make you bleed for it. Spar with me — type ‘spar’ — and don't you dare give up." For once, there's no smirk.`, "mascot");
  pushLine(state, "(Training is gone with your mascot. You can SPAR with " + rival.name + " now — a harder road, but the only one left. Type spar.)", "hint");
  return state;
}

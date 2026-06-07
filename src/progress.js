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
    pushLine(state, "Light pours up through you like sunrise through a cracked door — you rise to MAGICAL SOLDIER!", "banner");
    pushLine(state, `${m} does a delighted little loop in the air. "You DID it! Okay — okay, I was going to wait, but you've earned the truth now."`, "mascot");
    pushLine(
      state,
      `${m}: "We were never alone in this. All over the world there's an alliance — magical people like you, sworn to push back the corruption and keep cities whole. There just aren't enough of us; never have been. One soul to a city, sometimes less. That's why we go where we're needed, you and I."`,
      "mascot"
    );
  },
  knight(state) {
    const m = mascotName(state);
    const path = state.model.character.path;
    const flavor =
      path === "virtuous"
        ? "Clean light hardens around you like armor poured warm and set cool — every sharp edge of you turned outward, into shelter for someone else."
        : path === "corrupt"
        ? "The light comes in edged and hungry, a darker steel that hums against your teeth — power that guards you and wants you, in equal, uneasy measure."
        : "The light folds into something tempered and certain — neither soft nor cruel, just a blade that knows its own weight at last.";
    pushLine(state, ART.star_large, "mascot");
    pushLine(state, "You rise again — MAGICAL KNIGHT!", "banner");
    pushLine(state, flavor, "system");
    pushLine(state, `${m}: "A Knight. I knew you had it in you — I've known since before you did. The alliance is going to want to hear about this one."`, "mascot");
  },
  awakened(state) {
    const m = mascotName(state);
    const path = state.model.character.path;
    const flavor =
      path === "virtuous"
        ? "The light that fills you is wholly your own now — not borrowed from the alliance, not flinched away from. It rises when you call it, and it knows your name."
        : path === "corrupt"
        ? "The dark and the light in you stop their long war and turn, together, to face the same way: yours. Whatever you've made of yourself, it's finally, wholly, unmistakably you."
        : "Doubt and certainty come to rest in the same open hand. You stop asking whether you were ever enough for this. The question just — quiets. You are.";
    pushLine(state, ART.star_large, "mascot");
    pushLine(state, "The weapon answers your grip — and something that's been asleep in you since long before any of this opens its eyes. You AWAKEN!", "banner");
    pushLine(state, flavor, "system");
    pushLine(state, `${m}, voice thick: "There you are. The real you. I never doubted it — well. Maybe once, in the dark. …Come on. Let's go finish what we started, you and me."`, "mascot");
  },
};

/* T18: defeating the secret-place doubt recovers your magical weapon and your
   mascot. Called before the tier gate so the Awakened reqWeaponFound passes. */
function recoverWeaponAndMascot(state) {
  const model = state.model;
  const ch = model.character;
  const m = mascotName(state);
  ch.magicalWeapon.found = true;
  pushLine(state, "The doubt wearing your own face shudders, thins, and — at last, like a held breath finally let go — releases its grip on you.", "banner");
  pushLine(state, `Where it stood, a small light gathers and hardens into something solid, something real: ${ch.magicalWeapon.object}. Your weapon. After all these years you'd know it in the pitch dark, by weight alone.`, "system");
  pushLine(state, `And curled around it, half-buried in its own faint glow, ${m} stirs — battered, dimmed almost to nothing, but breathing. Its eyes crack open and find yours, and fill. "…You came back. For me. You absolute, wonderful idiot. I knew you would. I told myself you would the whole time."`, "mascot");
  if (model.mascot) { model.mascot.present = true; model.mascot.injured = false; }
  model.world.flags.mascotGone = false; // training reopens (sparring stays — its own flag)
  if (state.ui) state.ui.mascotReact = "hurt"; // it's back, but battered — the hurt animation plays

}

/* Narrative beats that fire when a boss falls, regardless of whether a tier-up
   happens — this is how the player learns corruption's deeper nature (DESIGN §8).
   Each fires at most once (latched in world.flags.storyBeats). */
const BOSS_BEAT = {
  boss2(state) {
    const m = mascotName(state);
    pushLine(state, `${m} lands on your shoulder, fur prickling. "Okay. That wasn't a wild spawn — that thing had a *purpose*. Something's commanding the corruption. A big one, hidden somewhere, reeling it toward your city on a line like it's fishing."`, "mascot");
    pushLine(state, `${m}: "Knock down its champions and it'll have to show its face eventually. …Though." A pause, uncharacteristically long. "Something about the shape of all this still doesn't sit right in me. Never mind. Later."`, "mascot");
  },
  boss3(state) {
    const m = mascotName(state);
    pushLine(state, `${m} is quiet for a moment, watching the grey thin from the air. "I think I've started to understand it. The corruption grows thickest exactly where people have stopped hoping. It doesn't just spread *near* despair. It *feeds* on it."`, "mascot");
    pushLine(state, `${m}: "Which means every errand you run, every person you hand a little hope back to — that might be the truer fight. The one that actually wins. Hold onto that. Promise me you'll hold onto that."`, "mascot");
  },
  // T18: the Boss #4 rematch (now winnable as Awakened) — the rival pays her dues
  // and resumes challenging you, this time as an equal.
  boss4(state) {
    const rival = (state.model.rivals && state.model.rivals[0]) || { name: "Sable" };
    pushLine(state, "The Grief Herald comes apart at last — not beaten so much as finally *answered*, the way grief lets go when someone at last says the right thing to it. The long rain over the spire stops. The sky, for once, holds its breath.", "banner");
    pushLine(state, `${rival.name} is waiting when you come down, and for once she doesn't bother hiding the grin spreading across her face. "You went back up there. And you WON. …I had a whole speech ready, you know. Something cutting about not throwing your life away. Guess I'll just have to keep it."`, "mascot");
    pushLine(state, `"You're the real thing now — no asterisk. I'll keep coming for you, same as always. But as an equal, from here on. Somebody's got to keep an Awakened honest." She holds out a hand, and means it.`, "mascot");
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
  if (state.ui) state.ui.mascotReact = "happy"; // a tier-up is the mascot's proudest beat

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
  pushLine(state, `The house keeps ${m}'s shape in every corner — the worn dent on the perch, the lessons left half-taught, the small bright voice that should be filling the quiet and isn't. You keep turning to say something to it. There's no one to say it to.`, "system");
  pushLine(state, `You couldn't save the one who saved you. The doubt you've carried since the very beginning finally says it plainly, in your own tired voice — was I ever enough for this? Can someone like me truly be the one to end the corruption?`, "system");

  // The rival pivots: the thread of hope, and the road to T18.
  pushLine(state, "", "system");
  pushLine(state, `A knock. ${rival.name} lets herself in without waiting, takes one look at the empty room and the way you're sitting in it, and goes very still. The usual edge drops clean off her. "...So it took your mascot. I'm sorry. Truly. They don't come back from that on their own — I won't lie to you about that part."`, "banner");
  pushLine(state, `"So listen to me. Hitting that thing head-on was never going to work — ${m} knew it, that's the whole reason it stepped in front of you. Stop fighting the way they trained you to and ASK the alliance for a better way. There's a war they're losing very, very quietly, and nobody up top wants to say so out loud."`, "mascot");
  pushLine(state, `"And there's a tier past Knight. Awakened. You reach it by going back to find what you were before any of this got its hands on you — and if anything in this world can wake ${m} again, it's that. Go to the alliance. Then come back to me."`, "mascot");
  pushLine(state, `"I can't train you the way your mascot did — I don't have that kind of gentle in me. But I can make you bleed for every inch, and right now that might be exactly what you need. Spar with me. Type ‘spar.’ And don't you DARE give up on me." For once, there's no smirk anywhere on her face.`, "mascot");
  pushLine(state, "(Training is gone with your mascot. You can SPAR with " + rival.name + " now — a harder road, but the only one left. Type spar.)", "hint");
  return state;
}

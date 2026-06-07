/* ============================================================
   MAGICAL.EXE — rival.js  (T16)
   The rival arc (DESIGN §8). Sable is seeded in model.rivals and
   scheduled off the day cycle:
     - A few days after Boss #2: Sable appears at the hub and challenges
       you to a (winnable) duel — initial motive: beat you.
     - A few days after Boss #3: Sable returns as a dialogue scene with
       the "not everything is what it seems" hint, then resumes
       challenging you with respect.

   `armRivalForBoss` is called from the boss-defeat handler to set the
   timers; `tickRival` is called once per new day (from the rest/lie-low
   day rollover) to fire whichever beat is due.
   ============================================================ */
import { CONFIG } from "../config.js";
import { pushLine } from "./state.js";
import { startCombat } from "./combat.js";

const rivalOf = (model) => (model.rivals && model.rivals[0]) || { name: "Sable" };

/** Arm the rival schedule when a story boss falls. Idempotent per boss. */
export function armRivalForBoss(state, bossId) {
  const flags = state.model.world.flags;
  const day = state.model.day;
  const cfg = CONFIG.rival || {};
  if (bossId === "boss2" && !flags.metRival && flags.rivalChallengeDay == null) {
    flags.rivalChallengeDay = day + (cfg.daysAfterBoss2 ?? 2);
  }
  if (bossId === "boss3" && !flags.rivalReturned && flags.rivalReturnDay == null) {
    flags.rivalReturnDay = day + (cfg.daysAfterBoss3 ?? 2);
  }
}

/** Fire whichever rival beat is due on this new day. Call after the day advances. */
export function tickRival(state) {
  const model = state.model;
  const flags = model.world.flags;
  const day = model.day;
  const rival = rivalOf(model);

  // The challenge (after Boss #2) — a hub scene that drops straight into a duel.
  if (!flags.metRival && flags.rivalChallengeDay != null && day >= flags.rivalChallengeDay) {
    flags.metRival = true;
    flags.rivalChallengeDay = null;
    rival.disposition = "challenger";
    rival.scheduleState = "met";
    pushLine(state, `A figure is waiting at your door, arms crossed. "So you're the one everyone's whispering about."`, "banner");
    pushLine(state, `"${rival.name}. Alliance, same as you — but I don't take new talent on faith. Show me what you've got."`, "mascot");
    pushLine(state, "(A duel! Win or lose, it's only a measure — fight as you would any foe.)", "hint");
    return startCombat(state, "rival_sable", { returnMode: "hub", fromSlot: false });
  }

  // The return (after Boss #3) — a dialogue scene, no fight.
  if (flags.metRival && !flags.rivalReturned && flags.rivalReturnDay != null && day >= flags.rivalReturnDay) {
    flags.rivalReturned = true;
    flags.rivalReturnDay = null;
    rival.disposition = "respectful";
    rival.scheduleState = "returned";
    pushLine(state, `${rival.name} is leaning against your gate again — but the smirk is gone.`, "banner");
    pushLine(state, `"You've gotten strong. Strong enough that I'll tell you this: not everything about the corruption is what your mascot says it is."`, "mascot");
    pushLine(state, `"I'm still alliance. But I've seen things higher up doesn't talk about. Keep winning — and keep your eyes open."`, "mascot");
    pushLine(state, `"…I'll keep challenging you. Someone has to keep you sharp." She almost smiles.`, "mascot");
    return state;
  }

  return state;
}

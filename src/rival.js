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
import { beginRivalTalk } from "./rivaltalk.js";

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
    pushLine(state, `A figure is waiting at your door, arms crossed, leaning like they've been there a while and aren't bothered about it. "So. You're the one the whole city's been whispering about. Smaller than I pictured."`, "banner");
    pushLine(state, `"${rival.name}. Alliance, same as you — but I don't take new talent on faith, and I don't clap for potential. Potential gets people killed. Show me what you can actually do."`, "mascot");
    pushLine(state, "(A duel! Win or lose, it's only a measure — fight as you would any foe.)", "hint");
    return startCombat(state, "rival_sable", { returnMode: "hub", fromSlot: false });
  }

  // The return (after Boss #3) — a dialogue scene, no fight.
  if (flags.metRival && !flags.rivalReturned && flags.rivalReturnDay != null && day >= flags.rivalReturnDay) {
    flags.rivalReturned = true;
    flags.rivalReturnDay = null;
    rival.disposition = "respectful";
    rival.scheduleState = "returned";
    pushLine(state, `${rival.name} is leaning against your gate again — but the smirk's gone, and they're not quite meeting your eye.`, "banner");
    pushLine(state, `"You've gotten strong. Properly strong — strong enough that I'll trust you with something I shouldn't. Not everything about the corruption is the way your mascot tells it. They're not lying to you. They just don't have the whole shape of it either."`, "mascot");
    pushLine(state, `"I'm still alliance, before you ask. But I've seen things the people higher up don't put in the briefings. Keep winning. And for both our sakes — keep your eyes open while you do it."`, "mascot");
    pushLine(state, `"…And I'll keep coming for you. Somebody's got to keep you sharp, and clearly it's going to have to be me." They almost smile. It's a near thing.`, "mascot");
    return beginRivalTalk(state, "return"); // she lingers — you can talk to her now
  }

  return state;
}

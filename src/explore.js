/* ============================================================
   MAGICAL.EXE — explore.js  (T7)
   Exploration mode: room-to-room navigation through a dungeon graph.
   Stamina (not slots) is the limiter — each move costs Stamina, and
   running out forces a retreat to the hub. Items picked up move from
   the room into the inventory; room contents are tracked in
   model.world.roomItems so the static dungeon data stays pristine.
   Encounters (room.encounter) and the boss room are wired here but
   resolve to real combat in T8 / the boss fight in T9.
   ============================================================ */

import { CONFIG } from "../config.js";
import { pushLine, markStoryActivity } from "./state.js";
import { DUNGEONS, getRoom, BOSS_ENEMY, unlockedDungeons, resolveDungeon } from "./dungeons.js";
import { startCombat } from "./combat.js";
import { requestNarration } from "./narrate.js";
import { maybeMascotReturnPraise } from "./hub.js";
import { track } from "./analytics.js";

/** Narrate a room the first time it's entered (T12). Skips re-visits to limit
 *  cost and repetition; only fires while still exploring (no combat triggered). */
function maybeNarrateRoom(state) {
  const model = state.model;
  if (model.mode !== "exploration") return;
  const roomId = model.world.currentRoom;
  if (!model.world.visited) model.world.visited = {};
  if (model.world.visited[roomId]) return;
  model.world.visited[roomId] = true;
  const r = currentRoom(model);
  if (!r) return;
  requestNarration(state, {
    scene: `${r.name} — ${roomDesc(model, r)}`,
    resolved: `you step into the ${r.name.toLowerCase()} and take it in`,
    mood: model.world.currentLocation === "forest" ? "hushed, moonlit, a little eerie" : "atmospheric",
  });
}

function currentRoom(model) {
  return getRoom(model.world.currentLocation, model.world.currentRoom);
}

/** Resolve a room's description — some are (model) => string (toy-aware / cleared-state). */
function roomDesc(model, r) {
  return typeof r.desc === "function" ? r.desc(model) : r.desc;
}

/** Fire a room's one-time lore beat the first time it's peacefully taken in (no
 *  encounter/boss interrupting). Latched in world.flags.roomBeats so it never repeats. */
function maybeRoomBeat(state) {
  const model = state.model;
  const r = currentRoom(model);
  if (!r || !r.roomBeat) return;
  const flags = model.world.flags;
  if (!flags.roomBeats) flags.roomBeats = [];
  if (flags.roomBeats.includes(model.world.currentRoom)) return;
  flags.roomBeats.push(model.world.currentRoom);
  pushLine(state, r.roomBeat, "system");
}

/** Live (mutable, per-playthrough) item list for a room, seeded from data. */
function liveItems(model, roomId) {
  if (!model.world.roomItems) model.world.roomItems = {};
  if (!model.world.roomItems[roomId]) {
    const r = getRoom(model.world.currentLocation, roomId);
    model.world.roomItems[roomId] = [...((r && r.items) || [])];
  }
  return model.world.roomItems[roomId];
}

/** `explore` with no/unknown target -> a chooser of currently-unlocked dungeons. */
export function openExploreMenu(state) {
  const model = state.model;
  const beaten = model.world.flags.bossesDefeated || [];
  const unlocked = unlockedDungeons(model);
  const options = unlocked.map((d) => {
    const boss = bossOf(d);
    const done = boss && beaten.includes(boss) ? "  ✓ cleared" : "";
    return { label: `${d.name}${done}`, value: d.id };
  });
  options.push({ label: "Cancel", value: "__cancel__" });
  pushLine(state, "Where will you venture? (Stamina is the price out there, not daylight — go until your legs give out.)", "system");
  state.ui.menu = { active: true, kind: "explore", options, index: 0 };
  return state;
}

/** The boss id a dungeon ends with (for the "cleared" marker), or null. */
function bossOf(d) {
  for (const r of Object.values(d.rooms)) if (r.boss) return r.boss;
  return null;
}

export function enterDungeon(state, dungeonId = "forest") {
  const d = DUNGEONS[dungeonId];
  if (!d) { pushLine(state, "There's nowhere like that to explore.", "system"); return state; }
  const model = state.model;
  // You can't walk back into the place that took your companion — not while they're
  // still gone. Offer the alliance's road instead (lifts once they're recovered).
  if (dungeonId === "spire" && model.world.flags.mascotGone) {
    const m = (model.mascot && model.mascot.name) || "your companion";
    const rival = (model.rivals && model.rivals[0] && model.rivals[0].name) || "Sable";
    pushLine(state, `You set foot on the first rain-worn step of the Sorrowing Spire — and stop dead. Your body simply will not climb it. Not back up there. Not to the place that took ${m}, and not as you are now.`, "system");
    pushLine(state, `${rival}'s words come back to you, quiet and certain: stop fighting the way you were trained to, and ASK the alliance for a better way. There's nothing for you at the top of that spire yet — only the same grief, waiting.`, "mascot");
    state.ui.menu = { active: true, kind: "spireBlock", options: [
      { label: "Reach out to the alliance", value: "alliance" },
      { label: "Turn back for now", value: "__turnback__" },
    ], index: 0 };
    return state;
  }
  if (model.character.stats.stamina <= 0) {
    pushLine(state, "You're too exhausted to set out. Rest to recover Stamina first.", "system");
    return state;
  }
  model.mode = "exploration";
  markStoryActivity(model); // venturing out breaks the training rut
  model.world.currentLocation = dungeonId;
  model.world.currentRoom = d.entrance;
  track("dungeon_entered", {
    dungeonId,
    day: model.day,
    tier: model.character.transformationTier,
    path: model.character.path,
  });
  if (dungeonId === "secret") {
    const place = model.character.secretPlace;
    pushLine(state, place
      ? `The mist takes the shape of somewhere you'd know in your sleep — ${place}.`
      : "The mist takes the shape of somewhere you'd know in your sleep.", "system");
  } else {
    pushLine(state, `You slip away to the ${d.name}.`, "system");
  }
  describeRoom(state);
  maybeRoomBeat(state);
  maybeNarrateRoom(state);
  return state;
}

export function describeRoom(state) {
  const model = state.model;
  const r = currentRoom(model);
  if (!r) { pushLine(state, "You're nowhere in particular.", "system"); return state; }

  pushLine(state, `— ${r.name} —`, "banner");
  pushLine(state, roomDesc(model, r), "system");

  const items = liveItems(model, model.world.currentRoom);
  if (items.length) pushLine(state, "You see: " + items.join(", ") + ".", "system");

  const exits = Object.keys(r.exits || {});
  pushLine(
    state,
    exits.length ? "Exits: " + exits.join(", ") + "." : "There's no way on from here — only back.",
    "hint"
  );
  return state;
}

export function lookRoom(state) {
  return describeRoom(state);
}

export function moveDir(state, dir) {
  const model = state.model;
  const r = currentRoom(model);
  if (!r) { pushLine(state, "You can't go anywhere from here.", "system"); return state; }

  const dest = r.exits && r.exits[dir];
  if (!dest) { pushLine(state, `You can't go ${dir} from here.`, "system"); return state; }

  const cost = CONFIG.exploration.staminaPerMove;
  const stats = model.character.stats;
  if (stats.stamina < cost) {
    pushLine(state, "You're too exhausted to press on. You retreat to safety.", "system");
    return retreat(state, true);
  }

  stats.stamina = Math.max(0, stats.stamina - cost);
  model.world.currentRoom = dest;
  pushLine(state, `You head ${dir}.`, "hint");
  describeRoom(state);

  // Exhaustion forces a retreat even on arrival.
  if (stats.stamina <= 0) {
    pushLine(state, "Your legs give out — Stamina spent. You retreat to the hub.", "system");
    return retreat(state, true);
  }

  const nr = currentRoom(model);
  if (nr && nr.boss) {
    // T19 finale: ONE continuous fight, two winnable phases (combat.js), then the
    // brink resolver (endgame.js). The mascot soft-warns — about belief, never the
    // hidden number. You enter when you choose; your hope/path here is your ending.
    if (nr.boss === "finale") {
      if (model.world.flags.ascended) {
        pushLine(state, "The Heart of the Grey is quiet now — just an empty hollow where something terrible used to live, and far above it, a city slowly, clumsily, learning how to be a city again.", "system");
        return state;
      }
      const m = (model.mascot && model.mascot.name) || "Your mascot";
      pushLine(state, `${m} presses close against your cheek, trembling — not with fear, exactly. Something more like awe. "This is it. The real one. Everything that's been steering all of this, all this time… it's right down there, waiting for you."`, "mascot");
      pushLine(state, `${m}: "Listen to me. Really listen, because it matters now more than anything I've ever told you: you can't out-hit this. Not at the end. The city has to believe in you — and you have to believe right back at it, hard as you can. …Do you feel it? Out there, under everything? Do you feel them starting to believe?"`, "mascot");
      const rival = (model.rivals && model.rivals[0]) || { name: "Sable" };
      pushLine(state, `${rival.name} draws their blade and sets their shoulder firm against yours, close as a promise. "I'm right here. Where I've always ended up. Don't you dare try to do this alone."`, "mascot");
      return startCombat(state, CONFIG.finale.phases[0], {
        returnMode: "exploration",
        returnRoom: dest,
        bossId: "finale",
        finale: true,
        phases: [...CONFIG.finale.phases],
      });
    }
    if (model.world.flags.bossesDefeated.includes(nr.boss)) {
      pushLine(state, "This place is still and clean now — whatever the corruption left here, you've already swept it out. Only quiet remains.", "system");
      return state;
    }
    // Boss #4 is a scripted story-loss until you've recovered your magical weapon
    // (T18). Telegraph it heavily so the loss never reads as a bug. After the weapon
    // is found it becomes a normal, winnable Awakened-tier fight.
    const storyLoss =
      nr.boss === "boss4" &&
      CONFIG.combat.storyLoss.enabled &&
      !model.character.magicalWeapon.found;
    if (storyLoss) {
      const m = (model.mascot && model.mascot.name) || "Your mascot";
      pushLine(state, `${m}: "...No. No, not this one — turn back, turn back right now, please!"`, "mascot");
      pushLine(state, `${m}: "I have never felt corruption like this in my whole long life. Whatever happens up here — whatever it does — do NOT let it take you. Promise me. PROMISE me."`, "mascot");
    } else if (nr.boss === "boss4") {
      // The rematch: companion is back, you're Awakened — no fear in it now.
      const m = (model.mascot && model.mascot.name) || "Your mascot";
      const weapon = model.character.magicalWeapon && model.character.magicalWeapon.fromToy;
      const wphrase = weapon ? `${weapon} in your hand` : "your true weapon in hand";
      pushLine(state, `${m} flares bright at your shoulder — steady this time, not a tremor in it. "There it is. The Grief Herald. Last time it had us before we'd even begun." `, "mascot");
      pushLine(state, `${m}: "But look at you now. AWAKENED — stronger than it has any idea, ${wphrase}, and abilities it has never once had to answer for. Call them up the moment you need them. We finish this together. Let's go take back what it took."`, "mascot");
    } else {
      pushLine(state, "The corruption draws itself together out of the dark, up and up into a single towering shape...", "mascot");
    }
    return startCombat(state, BOSS_ENEMY[nr.boss], {
      returnMode: "exploration",
      returnRoom: dest,
      bossId: nr.boss,
      storyLoss,
    });
  }

  // Random encounter on entering an uncleared room.
  if (nr && nr.encounter && !model.world.cleared[dest] && Math.random() < nr.encounter.chance) {
    return startCombat(state, nr.encounter.monster, { returnMode: "exploration", returnRoom: dest });
  }
  maybeRoomBeat(state);    // no encounter — surface any lore beat, then narrate
  maybeNarrateRoom(state);
  return state;
}

export function takeItem(state, target) {
  const model = state.model;
  const r = currentRoom(model);
  if (!r) { pushLine(state, "There's nothing to take.", "system"); return state; }

  const items = liveItems(model, model.world.currentRoom);
  if (!items.length) { pushLine(state, "There's nothing here to take.", "system"); return state; }

  let idx = 0;
  if (target) idx = items.findIndex((it) => it.toLowerCase().includes(target.toLowerCase()));
  if (idx === -1) { pushLine(state, `There's no ${target} here.`, "system"); return state; }

  const item = items.splice(idx, 1)[0];
  model.character.inventory.push(item);
  pushLine(state, `You take the ${item}.`, "system");
  return state;
}

/** Entities the player can refer to right now in exploration: exits + room items.
 *  Used to build context for the AI fallback parser (T12). */
export function explorationEntities(model) {
  const r = currentRoom(model);
  if (!r) return [];
  const exits = Object.keys(r.exits || {});
  const items = liveItems(model, model.world.currentRoom);
  return [...exits, ...items];
}

export function retreat(state, forced = false) {
  const model = state.model;
  model.mode = "hub";
  model.world.currentLocation = "homebase";
  model.world.currentRoom = null;
  if (!forced) pushLine(state, "You slip back home, the city quiet around you.", "system");
  maybeMascotReturnPraise(state); // Sable greets you the first time home with the recovered companion
  pushLine(state, "(You're back at the hub.)", "hint");
  return state;
}

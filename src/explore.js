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
import { pushLine } from "./state.js";
import { DUNGEONS, getRoom, BOSS_ENEMY, unlockedDungeons, resolveDungeon } from "./dungeons.js";
import { startCombat } from "./combat.js";
import { requestNarration } from "./narrate.js";

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
    scene: `${r.name} — ${r.desc}`,
    resolved: `you step into the ${r.name.toLowerCase()} and take it in`,
    mood: model.world.currentLocation === "forest" ? "hushed, moonlit, a little eerie" : "atmospheric",
  });
}

function currentRoom(model) {
  return getRoom(model.world.currentLocation, model.world.currentRoom);
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
  pushLine(state, "Where will you venture?", "system");
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
  if (model.character.stats.stamina <= 0) {
    pushLine(state, "You're too exhausted to set out. Rest to recover Stamina first.", "system");
    return state;
  }
  model.mode = "exploration";
  model.world.currentLocation = dungeonId;
  model.world.currentRoom = d.entrance;
  pushLine(state, `You slip away to the ${d.name}.`, "system");
  describeRoom(state);
  maybeNarrateRoom(state);
  return state;
}

export function describeRoom(state) {
  const model = state.model;
  const r = currentRoom(model);
  if (!r) { pushLine(state, "You're nowhere in particular.", "system"); return state; }

  pushLine(state, `— ${r.name} —`, "banner");
  pushLine(state, r.desc, "system");

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
    if (model.world.flags.bossesDefeated.includes(nr.boss)) {
      pushLine(state, "The heart of the wood is still and clean now.", "system");
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
      pushLine(state, `${m}: "...No. No, not this one — turn back!"`, "mascot");
      pushLine(state, `${m}: "I've never felt corruption like this. Whatever happens, do NOT let it take you."`, "mascot");
    } else {
      pushLine(state, "The corruption draws together into a towering shape...", "mascot");
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
  maybeNarrateRoom(state); // no encounter — narrate the new room
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
  pushLine(state, "(You're back at the hub.)", "hint");
  return state;
}

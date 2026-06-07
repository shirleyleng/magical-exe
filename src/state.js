/* ============================================================
   MAGICAL.EXE — state.js
   The Model. One serializable object = one save slot (DESIGN > State
   Shape). `freshModel()` builds defaults from config.js so all balance
   stays in one file. `createState()` wraps the saved model with the
   transient runtime fields (scrollback log + ephemeral UI) that are
   NOT persisted.
   ============================================================ */

import { CONFIG } from "../config.js";
import { derivePath } from "./alignment.js";

export const SCHEMA_VERSION = 1;

const MAX_LOG = 500; // cap scrollback so saves/memory stay bounded

/** Append a line to the scrollback. Mutates the (already-cloned) state. */
export function pushLine(state, text = "", kind = "system") {
  state.log.push({ text, kind });
  if (state.log.length > MAX_LOG) {
    state.log.splice(0, state.log.length - MAX_LOG);
  }
}

/** Derive pronouns from a gender presentation. */
export function pronounsFor(gender) {
  switch (gender) {
    case "girl": return { subj: "she", obj: "her", poss: "her" };
    case "boy":  return { subj: "he",  obj: "him", poss: "his" };
    default:     return { subj: "they", obj: "them", poss: "their" };
  }
}

/** A default character. Character creation (T4) overwrites the flavor
 *  fields; stats/meters come from config so balance is tunable. */
function freshCharacter() {
  return {
    name: "???",
    created: false,                 // set true once character creation (T4) completes
    gender: null,
    pronouns: pronounsFor(null),
    occupation: { type: null, detail: null },
    personality: { reservedAdventurous: 0.5, formalCasual: 0.5, cautiousBold: 0.5 },
    city: null,
    secretPlace: null,
    magicalWeapon: { fromToy: null, object: null, found: false },
    path: "balanced",
    transformationTier: "novice",
    stats: { ...CONFIG.startingStats },
    corruption: CONFIG.startingMeters.corruption,
    purity: CONFIG.startingMeters.purity,
    fame: CONFIG.startingMeters.fame,
    unmasking: CONFIG.startingMeters.unmasking,
    hopeTally: CONFIG.startingMeters.hopeTally,
    inventory: [],
    abilities: ["light bolt", "guard"],
    coins: CONFIG.economy.startingCoins,
  };
}

/** The full savable game model (DESIGN > State Shape). */
export function freshModel(opts = {}) {
  return {
    saveSlotName: opts.saveSlotName || "Run 1",
    createdAt: opts.createdAt || new Date().toISOString(),
    schemaVersion: SCHEMA_VERSION,
    difficulty: opts.difficulty || "normal",
    prestigeCount: 0,
    mode: "hub",
    day: 1,
    character: freshCharacter(),
    mascot: null,                   // assigned at creation (T5)
    hub: {
      slotsMax: CONFIG.hub.startingSlots,
      slotsUsedToday: { training: 0, combat: 0, errand: 0, sparring: 0 },
    },
    world: {
      currentLocation: "homebase",
      currentRoom: null,
      roomItems: {},   // per-playthrough mutable room contents (keyed by room id)
      cleared: {},     // rooms whose encounter has been beaten (keyed by room id)
      flags: { metRival: false, rivalChallengeDay: null, bossesDefeated: [] },
    },
    combat: null,      // active fight state, or null (set by combat.js)
    rivals: [
      { name: "Sable", power: 14, corruption: 50, scheduleState: "dormant", disposition: "unmet" },
    ],
    questFlags: {},
  };
}

/** Wrap a model (loaded or fresh) with transient runtime state.
 *  `log` (scrollback) and `ui` are deliberately NOT persisted — the
 *  save is the model only, matching DESIGN's "one serializable object". */
export function createState(model) {
  const m = model || freshModel();
  // `path` is derived from the slider; recompute on entry so loaded/older saves are correct
  // (during play, adjustAlignment keeps it fresh).
  if (m.character) m.character.path = derivePath(m.character);
  return {
    model: m,
    log: [],                        // [{ text, kind }]
    ui: { booted: false, turn: 0 }, // turn drives the rotating example prompt
  };
}

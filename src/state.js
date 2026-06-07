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
  // Let the HUD mascot mouth along when it speaks (consumed once in render).
  if (kind === "mascot" && state.ui) state.ui.mascotSpoke = true;
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
    virtue: CONFIG.startingMeters.virtue,
    fame: CONFIG.startingMeters.fame,
    unmasking: CONFIG.startingMeters.unmasking,
    unmaskingTierSeen: "none",      // highest Unmasking event tier already fired (T15)
    mustLieLow: false,              // high-threshold lock: no public skirmishes until heat drops (T15)
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
      errandsDoneToday: [],           // errand vignette ids done today (reset each day)
      pendingDamageControl: false,    // T15: a mid-tier investigator costs a slot next day
    },
    world: {
      currentLocation: "homebase",
      currentRoom: null,
      roomItems: {},   // per-playthrough mutable room contents (keyed by room id)
      cleared: {},     // rooms whose encounter has been beaten (keyed by room id)
      townsfolk: {},   // recurring-errand relationship progress (keyed by npc id)
      flags: {
        metRival: false, rivalChallengeDay: null, rivalReturnDay: null, rivalReturned: false,
        bossesDefeated: [], storyBeats: [],
        boss4Attempted: false, mascotGone: false, sparringUnlocked: false,
        allianceVisited: false, secretPlaceUnlocked: false,
        dilemmasSeen: [],
        ascended: false, // T19: set once the finale resolves into an ascension win
      },
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
  if (m.character) {
    // The Purity meter was renamed to Virtue — migrate older saves before deriving path.
    if (m.character.virtue === undefined) m.character.virtue = m.character.purity || 0;
    if ("purity" in m.character) delete m.character.purity;
    m.character.path = derivePath(m.character);
    // Backfill T15 fields for older saves so events/locks read correctly.
    if (m.character.unmaskingTierSeen === undefined) m.character.unmaskingTierSeen = "none";
    if (m.character.mustLieLow === undefined) m.character.mustLieLow = false;
  }
  // Backfill T16 story-beat + rival-schedule tracking for older saves.
  if (m.world && m.world.flags) {
    const f = m.world.flags;
    if (f.storyBeats === undefined) f.storyBeats = [];
    if (f.rivalReturnDay === undefined) f.rivalReturnDay = null;
    if (f.rivalReturned === undefined) f.rivalReturned = false;
    // Backfill T17 (Boss #4 story-loss / mascot-gone) flags.
    if (f.boss4Attempted === undefined) f.boss4Attempted = false;
    if (f.mascotGone === undefined) f.mascotGone = false;
    // Sparring stays unlocked once earned, even after the mascot returns (T18);
    // for pre-T18 saves, infer it from whether the mascot had gone.
    if (f.sparringUnlocked === undefined) f.sparringUnlocked = !!f.mascotGone;
    // Backfill T18 (alliance / secret-place) flags.
    if (f.allianceVisited === undefined) f.allianceVisited = false;
    if (f.secretPlaceUnlocked === undefined) f.secretPlaceUnlocked = false;
    // Backfill T19 (dilemma events) tracking.
    if (f.dilemmasSeen === undefined) f.dilemmasSeen = [];
    // Backfill T19 finale flag.
    if (f.ascended === undefined) f.ascended = false;
    // Backfill recurring-errand relationship progress (living-town errands).
    if (m.world.townsfolk === undefined) m.world.townsfolk = {};
  }
  // Backfill the per-day errand offer tracker.
  if (m.hub && m.hub.errandsDoneToday === undefined) m.hub.errandsDoneToday = [];
  // Backfill T17 mascot presence fields for saves made before the mascot could leave.
  if (m.mascot) {
    if (m.mascot.present === undefined) m.mascot.present = true;
    if (m.mascot.injured === undefined) m.mascot.injured = false;
    if (m.mascot.dimmed === undefined) m.mascot.dimmed = false; // T19: bound/dimmed in the Dark Ascension
  }
  return {
    model: m,
    log: [],                        // [{ text, kind }]
    ui: { booted: false, turn: 0 }, // turn drives the rotating example prompt
  };
}

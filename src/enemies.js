/* ============================================================
   MAGICAL.EXE — enemies.js  (T8)
   Enemy definitions as data. Base stats here; difficulty multipliers
   and prestige scaling are applied at spawn time (combat.js) from
   config.js, so balance stays tunable in one place.
   ============================================================ */

export const ENEMIES = {
  dust_sprite: {
    id: "dust_sprite",
    name: "dust sprite",
    maxHp: 12, power: 4, defense: 1, speed: 7, dodge: 4,
    coins: 3,
    loot: [],
  },
  shadow_imp: {
    id: "shadow_imp",
    name: "shadow imp",
    maxHp: 18, power: 6, defense: 2, speed: 5, dodge: 3,
    coins: 5,
    loot: ["dew vial"],
  },
  // Boss #1 — a tougher fight (used in T9).
  grove_warden: {
    id: "grove_warden",
    name: "Grove Warden",
    maxHp: 60, power: 10, defense: 4, speed: 6, dodge: 2,
    coins: 25,
    loot: ["moonstone shard"],
    isBoss: true,
  },

  // ---- T16: Dungeon #2 (Drowned Harbor) ----
  brine_lurker: {
    id: "brine_lurker",
    name: "brine lurker",
    maxHp: 26, power: 9, defense: 3, speed: 6, dodge: 4,
    coins: 7,
    loot: ["dew vial"],
  },
  // Boss #2 — meet-the-rival gate.
  tideheart_wraith: {
    id: "tideheart_wraith",
    name: "Tideheart Wraith",
    maxHp: 92, power: 14, defense: 6, speed: 7, dodge: 3,
    coins: 40,
    loot: ["moonstone shard"],
    isBoss: true,
  },

  // ---- T16: Dungeon #3 (Hollow Clocktower) ----
  gear_wretch: {
    id: "gear_wretch",
    name: "gear wretch",
    maxHp: 34, power: 11, defense: 4, speed: 5, dodge: 3,
    coins: 9,
    loot: ["moonstone shard"],
  },
  // Boss #3 — Soldier -> Knight gate.
  hour_warden: {
    id: "hour_warden",
    name: "Hour Warden",
    maxHp: 130, power: 18, defense: 8, speed: 6, dodge: 2,
    coins: 60,
    loot: ["moonstone shard", "moonstone shard"],
    isBoss: true,
  },

  // ---- T17: Dungeon #4 (Sorrowing Spire) — the Knight->Awakened low point ----
  grief_wisp: {
    id: "grief_wisp",
    name: "grief wisp",
    maxHp: 40, power: 13, defense: 5, speed: 6, dodge: 4,
    coins: 11,
    loot: ["dew vial"],
  },
  // Boss #4 — the scripted story-loss (combat.js storyLoss). Stats are tuned for a
  // real Awakened-tier rematch later (T18); the first encounter is unwinnable by script.
  grief_herald: {
    id: "grief_herald",
    name: "Grief Herald",
    maxHp: 200, power: 24, defense: 14, speed: 13, dodge: 4,
    coins: 100,
    loot: ["moonstone shard", "moonstone shard"],
    isBoss: true,
  },

  // ---- T18: the secret-place "boss" — your own doubt, fought at Knight tier.
  //      Beating it recovers the weapon + mascot and triggers Awakened. ----
  doubt_echo: {
    id: "doubt_echo",
    name: "the Hollow Doubt",
    maxHp: 120, power: 17, defense: 7, speed: 8, dodge: 3,
    coins: 0,
    loot: [],
    isBoss: true,
  },

  // ---- T16: the rival, Sable — a winnable duel, NOT a story boss (no bossId). ----
  rival_sable: {
    id: "rival_sable",
    name: "Sable",
    maxHp: 80, power: 15, defense: 5, speed: 8, dodge: 5,
    coins: 0,
    loot: [],
    isRival: true,
  },
};

export function getEnemy(id) {
  return ENEMIES[id] || null;
}

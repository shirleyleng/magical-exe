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
};

export function getEnemy(id) {
  return ENEMIES[id] || null;
}

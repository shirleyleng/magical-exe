/* ============================================================
   MAGICAL.EXE — dungeons.js  (T7)
   Room graphs as DATA, keyed by id, so content is editable without
   touching logic (DESIGN > State Shape). Static definition only —
   per-playthrough mutable bits (items taken) live in model.world, not
   here, so picking something up never mutates these constants.
   ============================================================ */

export const DUNGEONS = {
  forest: {
    id: "forest",
    name: "Moonlit Forest",
    entrance: "forest_entrance",
    // Baseline environment tags for the whole dungeon (T13 plausibility judge).
    // Rooms add their own `tags` on top; together they tell the judge what the
    // player can plausibly improvise with.
    env: ["forest", "trees", "moonlit", "night", "undergrowth"],
    rooms: {
      forest_entrance: {
        name: "Moonlit Edge",
        desc: "The treeline breathes cool air. A deer-path winds north into the silver dark.",
        exits: { north: "forest_clearing" },
        items: [],
        encounter: null,
        tags: ["treeline", "open path", "cool air"],
      },
      forest_clearing: {
        name: "Moonlit Clearing",
        desc: "Silver light pools between the trees. Something rustles to the north; water glints to the east.",
        exits: { south: "forest_entrance", north: "forest_den", east: "forest_pond" },
        items: ["dew vial"],
        encounter: { monster: "shadow_imp", chance: 0.5 },
        tags: ["clearing", "open", "grass", "loose stones"],
      },
      forest_pond: {
        name: "Still Pond",
        desc: "A round pond holds a perfect, trembling moon. Something gleams at its muddy edge.",
        exits: { west: "forest_clearing" },
        items: ["moonstone shard"],
        encounter: null,
        tags: ["water", "pond", "mud", "reeds"],
      },
      forest_den: {
        name: "Bramble Den",
        desc: "Thorns arch overhead and the air turns thick and watchful. A darker hollow yawns to the north.",
        exits: { south: "forest_clearing", north: "forest_heart" },
        items: [],
        encounter: { monster: "shadow_imp", chance: 0.6 },
        tags: ["thorns", "brambles", "cramped", "dark"],
      },
      forest_heart: {
        name: "Heart of the Wood",
        desc: "The trees fall away around a ring of pale standing stones. The corruption here is almost a sound.",
        exits: { south: "forest_den" },
        items: [],
        encounter: null,
        boss: "boss1",
        tags: ["standing stones", "ring", "thick corruption", "open ground"],
      },
    },
  },
};

export function getRoom(dungeonId, roomId) {
  const d = DUNGEONS[dungeonId];
  return d ? d.rooms[roomId] : null;
}

// Which enemy embodies each story boss.
export const BOSS_ENEMY = {
  boss1: "grove_warden",
};

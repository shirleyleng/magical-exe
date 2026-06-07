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

  // ---- T16: Dungeon #2 — unlocks after Boss #1 (Soldier). ----
  harbor: {
    id: "harbor",
    name: "Drowned Harbor",
    entrance: "harbor_pier",
    unlockReqBoss: "boss1",
    env: ["harbor", "docks", "saltwater", "fog", "tide", "rotting wood"],
    rooms: {
      harbor_pier: {
        name: "Fogbound Pier",
        desc: "Black water laps at warped planks. Salt fog swallows the lamplight; the boardwalk runs north along the quay.",
        exits: { north: "harbor_market" },
        items: [],
        encounter: null,
        tags: ["pier", "wet planks", "fog", "lamplight"],
      },
      harbor_market: {
        name: "Drowned Fish Market",
        desc: "Stalls sag under brine and barnacles. Something slithers between the overturned crates; a gangway leads east, the deep docks lie north.",
        exits: { south: "harbor_pier", east: "harbor_tidepool", north: "harbor_deep" },
        items: ["dew vial"],
        encounter: { monster: "brine_lurker", chance: 0.55 },
        tags: ["stalls", "barnacles", "crates", "slick stone"],
      },
      harbor_tidepool: {
        name: "Glass Tidepool",
        desc: "A still pool mirrors the drowned moon, ringed by salt-bright stones. Something gleams beneath the surface.",
        exits: { west: "harbor_market" },
        items: ["moonstone shard"],
        encounter: null,
        tags: ["tidepool", "saltwater", "smooth stones", "reflection"],
      },
      harbor_deep: {
        name: "The Deep Docks",
        desc: "The fog thins over open black water. A drowned shape uncoils from the harbor's heart, trailing kelp like robes.",
        exits: { south: "harbor_market" },
        items: [],
        encounter: null,
        boss: "boss2",
        tags: ["open water", "deep dock", "kelp", "thick corruption"],
      },
    },
  },

  // ---- T16: Dungeon #3 — unlocks after Boss #2; clears the Soldier->Knight gate. ----
  clocktower: {
    id: "clocktower",
    name: "Hollow Clocktower",
    entrance: "clock_landing",
    unlockReqBoss: "boss2",
    env: ["clocktower", "brass", "dust", "stopped time", "stairs", "gears"],
    rooms: {
      clock_landing: {
        name: "Stopped Landing",
        desc: "A spiral of brass stairs climbs into dust and silence. Every clock-face here is frozen at the same dead hour. The stairs wind up.",
        exits: { up: "clock_gallery" },
        items: [],
        encounter: null,
        tags: ["brass stairs", "dust", "stopped clocks", "narrow"],
      },
      clock_gallery: {
        name: "Gear Gallery",
        desc: "Great toothed wheels hang motionless overhead. Something skitters along a stalled axle; a catwalk runs across, the belfry waits above.",
        exits: { down: "clock_landing", across: "clock_vault", up: "clock_belfry" },
        items: ["dew vial"],
        encounter: { monster: "gear_wretch", chance: 0.6 },
        tags: ["gears", "catwalk", "axles", "high drop"],
      },
      clock_vault: {
        name: "Pendulum Vault",
        desc: "A vast pendulum hangs dead-center, swallowed in cobweb. Brass glints in the dust at its foot.",
        exits: { across: "clock_gallery" },
        items: ["moonstone shard"],
        encounter: null,
        tags: ["pendulum", "cobweb", "brass", "still air"],
      },
      clock_belfry: {
        name: "The Dead Bell",
        desc: "The great bell hangs cracked and silent. The corruption has wound itself into the works — and now the works wind toward you.",
        exits: { down: "clock_gallery" },
        items: [],
        encounter: null,
        boss: "boss3",
        tags: ["great bell", "cracked brass", "thick corruption", "open floor"],
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
  boss2: "tideheart_wraith",
  boss3: "hour_warden",
};

/** Dungeons the player can currently enter: a dungeon unlocks once its
    `unlockReqBoss` (if any) is in world.flags.bossesDefeated. */
export function unlockedDungeons(model) {
  const beaten = model.world.flags.bossesDefeated || [];
  return Object.values(DUNGEONS).filter((d) => !d.unlockReqBoss || beaten.includes(d.unlockReqBoss));
}

/** Resolve a free-text explore target to a dungeon id (by id or name), or null. */
export function resolveDungeon(target) {
  if (!target) return null;
  const t = target.toLowerCase();
  const d = Object.values(DUNGEONS).find(
    (d) => d.id === t || d.name.toLowerCase() === t || d.name.toLowerCase().includes(t)
  );
  return d ? d.id : null;
}

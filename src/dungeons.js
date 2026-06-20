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
        encounter: { monster: "drowned_sailor", chance: 0.3 },
        roomBeat: "Someone has carved names into the tide-board by the steps — dozens, then hundreds, the oldest worn soft by salt. Not a memorial. A guest list. The harbor keeps everyone it takes, and it seems to remember them kindly.",
        tags: ["pier", "wet planks", "fog", "lamplight"],
      },
      harbor_market: {
        name: "Drowned Fish Market",
        desc: "Stalls sag under brine and barnacles. Something slithers between the overturned crates; a gangway leads east, the chapel lies north.",
        exits: { south: "harbor_pier", east: "harbor_tidepool", north: "harbor_chapel" },
        items: ["dew vial"],
        encounter: { monster: "brine_lurker", chance: 0.55 },
        tags: ["stalls", "barnacles", "crates", "slick stone"],
      },
      harbor_chapel: {
        name: "The Sunken Chapel",
        desc: "A little chapel rests below the waterline, candles somehow still lit and swaying in the current. Pews sit in patient rows beneath the green dark. The way down to the deep docks opens to the north.",
        exits: { south: "harbor_market", north: "harbor_deep" },
        items: ["dew vial"],
        encounter: { monster: "drowned_sailor", chance: 0.55 },
        roomBeat: "You understand it all at once. The harbor didn't drown by accident. When the corruption came up the coast, the whole town walked down into the cold together — rather than be taken one by one, screaming — and the water has been holding them ever since, gentle and grieving, every candle still lit.",
        tags: ["chapel", "pews", "candlelight", "deep water", "hush"],
      },
      harbor_tidepool: {
        name: "Glass Tidepool",
        desc: "A still pool mirrors the drowned moon, ringed by salt-bright stones. Something gleams on the lip of it — sea-worn glass, a charm shaped by years of tide. But the surface is too still, and your reflection in it has begun to move on its own.",
        exits: { west: "harbor_market" },
        items: ["tideglass charm"],
        encounter: { monster: "glass_warden", chance: 0.85 },
        tags: ["tidepool", "saltwater", "smooth stones", "reflection"],
      },
      harbor_deep: {
        name: "The Deep Docks",
        desc: "The fog thins over open black water. A drowned shape uncoils from the harbor's heart, trailing kelp like robes.",
        exits: { south: "harbor_chapel" },
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
        encounter: { monster: "brass_moth", chance: 0.3 },
        roomBeat: "Every clock here died at the same minute — 3:11. Not stopped. Died, their hands locked mid-tick, like each one was holding something far too precious to let move on.",
        tags: ["brass stairs", "dust", "stopped clocks", "narrow"],
      },
      clock_gallery: {
        name: "Gear Gallery",
        desc: "Great toothed wheels hang motionless overhead. Something skitters along a stalled axle; a catwalk runs across, and the stairs climb on up.",
        exits: { down: "clock_landing", across: "clock_vault", up: "clock_archive" },
        items: ["dew vial"],
        encounter: { monster: "gear_wretch", chance: 0.6 },
        tags: ["gears", "catwalk", "axles", "high drop"],
      },
      clock_vault: {
        name: "Pendulum Vault",
        desc: "A vast pendulum hangs dead-center, swallowed in cobweb. At its foot, half-buried in dust, a single brass cog rests apart from all the others — and the dust around it is undisturbed, as though something has been standing very still, waiting, for a very long time.",
        exits: { across: "clock_gallery" },
        items: ["stopped-hour cog"],
        encounter: { monster: "stopped_sentinel", chance: 0.85 },
        tags: ["pendulum", "cobweb", "brass", "still air"],
      },
      clock_archive: {
        name: "The Hour-Keeper's Room",
        desc: "A narrow bed, a cold teapot, a child's drawing pinned above a desk. Someone lived up here among the gears. The last stair rises to the belfry.",
        exits: { down: "clock_gallery", up: "clock_belfry" },
        items: ["dew vial"],
        encounter: { monster: "brass_moth", chance: 0.55 },
        roomBeat: "The hour-keeper didn't run when the sickness reached the tower. They stopped the clocks — all of them — and bought the whole city one endless 3:11 to say the things you only say when time is running out. The corruption ate the silence that came after.",
        tags: ["small room", "cold teapot", "drawing", "still air"],
      },
      clock_belfry: {
        name: "The Dead Bell",
        desc: "The great bell hangs cracked and silent. The corruption has wound itself into the works — and now the works wind toward you.",
        exits: { down: "clock_archive" },
        items: [],
        encounter: null,
        boss: "boss3",
        tags: ["great bell", "cracked brass", "thick corruption", "open floor"],
      },
    },
  },

  // ---- T17: Dungeon #4 — the Knight->Awakened low point. Unlocks after Boss #3
  //      AND at Knight tier; ends in the scripted story-loss vs the Grief Herald.
  spire: {
    id: "spire",
    name: "Sorrowing Spire",
    entrance: "spire_steps",
    unlockReqBoss: "boss3",
    unlockReqTier: "knight",
    env: ["rain", "grief", "grey light", "stone", "rising stair", "thick corruption"],
    rooms: {
      spire_steps: {
        name: "Rain-Worn Steps",
        desc: "A black spire claws at a sky that won't stop weeping. The steps are slick and endless; every face you pass on the way up has stopped trying. The stair climbs.",
        exits: { up: "spire_landing" },
        items: [],
        encounter: null,
        tags: ["rain", "wet stone", "steep stair", "grey light"],
      },
      spire_landing: {
        name: "The Listening Hall",
        desc: "A long hall of broken windows. The wind carries voices through them — every doubt you've ever swallowed, said back to you in your own tone. Something drifts between the panes.",
        exits: { down: "spire_steps", up: "spire_apex" },
        items: ["dew vial"],
        encounter: { monster: "grief_wisp", chance: 0.6 },
        tags: ["broken windows", "echoing voices", "draught", "grief"],
      },
      spire_apex: {
        name: "The Weeping Apex",
        desc: "The top of the spire opens to the rain. The corruption here doesn't rage — it grieves, vast and patient, and at its heart something immense turns to regard you.",
        exits: { down: "spire_landing" },
        items: [],
        encounter: null,
        boss: "boss4",
        tags: ["open sky", "rain", "thick corruption", "no cover"],
      },
    },
  },

  // ---- T18: the secret place — a misted dungeon of memory, unlocked by the
  //      alliance (flags.secretPlaceUnlocked). Its heart holds your own doubt;
  //      beating it recovers the magical weapon + the mascot and ignites Awakened.
  secret: {
    id: "secret",
    name: "the Misted Place",
    entrance: "secret_threshold",
    unlockReqFlag: "secretPlaceUnlocked",
    env: ["mist", "memory", "childhood", "hush", "soft light", "doubt"],
    rooms: {
      secret_threshold: {
        name: "The Threshold",
        desc: "The mist thins, and the ground underfoot is suddenly, impossibly familiar — the place you used to go when the world was too much. It's smaller than you remember, and softer. A path leads deeper in.",
        exits: { in: "secret_hollow" },
        items: [],
        encounter: null,
        tags: ["mist", "familiar ground", "soft light"],
      },
      secret_hollow: {
        name: "The Remembering",
        desc: "Memories hang in the mist like washing on a line: the mascot teaching you to stand, to breathe, to try again. Among them, half-seen, the shape of a beloved old toy turns slowly, just out of reach. The mist deepens ahead.",
        exits: { out: "secret_threshold", in: "secret_heart" },
        items: ["dew vial"],
        encounter: { monster: "grief_wisp", chance: 0.4 },
        tags: ["memory", "childhood", "mist", "old toy"],
      },
      secret_heart: {
        name: "The Still Heart",
        desc: "At the center of everything, the mascot lies sleeping, curled around a small object that gives off its own quiet light. Between you and them stands a figure wearing your own face — and your own worst doubt.",
        exits: { out: "secret_hollow" },
        items: [],
        encounter: null,
        boss: "secretPlace",
        tags: ["hush", "soft light", "doubt", "no cover"],
      },
    },
  },

  // ---- T19: the finale — the Heart of the Grey. Unlocks once the Awakened Boss #4
  //      rematch is won (unlockReqBoss "boss4"). You enter when YOU choose: your
  //      hope/path at that moment is your ending. Its heart holds the apparent
  //      source of the corruption — and then the twist (combat.js phases).
  source: {
    id: "source",
    name: "the Heart of the Grey",
    entrance: "source_descent",
    unlockReqBoss: "boss4",
    env: ["ash", "grey light", "stillness", "vast hollow", "thick corruption", "open ground"],
    rooms: {
      source_descent: {
        name: "The Long Descent",
        desc: "The alliance pointed you here, and the city held its breath as you went. The way down is wide and silent, ash falling like grey snow. Something enormous waits at the bottom — you can feel it the way you feel weather coming. The path leads down.",
        exits: { down: "source_approach" },
        items: [],
        encounter: null,
        tags: ["ash", "wide stair", "grey light", "descent"],
      },
      source_approach: {
        name: "The Threshold of the Grey",
        desc: "A vast hollow opens out, big enough to lose a sky in. Sable falls into step beside you without a word; somewhere above, the city is still trying to believe. Ahead, the grey gathers itself into a shape that has been steering all of this from the shadows. One way on — forward.",
        exits: { down: "source_descent", in: "source_heart" },
        items: [],
        encounter: null,
        tags: ["vast hollow", "ash", "open ground", "no cover"],
      },
      source_heart: {
        name: "The Beating Heart of the Grey",
        desc: "The center of everything. The corruption stops pretending to be many small things and becomes one towering, deliberate presence — and it knows your name. This is what you came for. This is where it ends, one way or another.",
        exits: { out: "source_approach" },
        items: [],
        encounter: null,
        boss: "finale",
        tags: ["heart of the grey", "thick corruption", "open ground", "no cover"],
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
  boss4: "grief_herald",
  secretPlace: "doubt_echo",
  // T19 finale: the first phase. The full phase list lives in CONFIG.finale.phases;
  // this entry is just so the cleared-marker / lookup stays consistent.
  finale: "grey_sovereign",
};

const TIER_ORDER = ["novice", "soldier", "knight", "awakened", "ascended"];

/** Has the player reached at least `tier`? */
function meetsTier(model, tier) {
  if (!tier) return true;
  return TIER_ORDER.indexOf(model.character.transformationTier) >= TIER_ORDER.indexOf(tier);
}

/** Dungeons the player can currently enter: a dungeon unlocks once its
    `unlockReqBoss` (if any) is in world.flags.bossesDefeated AND its
    `unlockReqTier` (if any) has been reached. */
export function unlockedDungeons(model) {
  const beaten = model.world.flags.bossesDefeated || [];
  const flags = model.world.flags || {};
  return Object.values(DUNGEONS).filter(
    (d) =>
      (!d.unlockReqBoss || beaten.includes(d.unlockReqBoss)) &&
      meetsTier(model, d.unlockReqTier) &&
      (!d.unlockReqFlag || flags[d.unlockReqFlag])
  );
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

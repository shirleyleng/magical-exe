// MAGICAL.EXE — balance & difficulty config
// Copy to `config.js`. ALL tunable knobs live here so balance is one-file editable.
// Balance comes from playtesting these numbers, not from theory. Tune freely.

export const CONFIG = {
  // ---- meta ----
  // buildStamp is replaced with the deploy date by scripts/build-config.js at build
  // time; left as the placeholder (or "dev") it reads as a local build (version.js).
  meta: { buildStamp: "__BUILD_STAMP__" },

  // ---- difficulty ----
  // Applied as multipliers. Easy = forgiving; Normal = standard.
  difficulty: {
    easy:   { enemyStatMult: 0.85, enemyDamageMult: 0.8, lootMult: 1.2, prestigeScalesEnemies: false },
    normal: { enemyStatMult: 1.0,  enemyDamageMult: 1.0, lootMult: 1.0, prestigeScalesEnemies: true  },
  },

  // ---- hub / activity slots ----
  hub: {
    startingSlots: 6,
    // +1 slot at each of these milestones (whichever are met, summed):
    slotUnlocks: {
      staminaThresholds: [40, 60, 80],          // +1 slot per threshold of maxStamina reached
      transformationTiers: ["soldier", "knight", "awakened", "ascended"], // +1 slot per tier reached
    },
    shopCostsSlot: false,                         // shopping is free
  },

  // ---- training (direct stat growth, no XP) ----
  training: {
    gainPerSession: { power: 1, spirit: 1, defense: 1, speed: 1, dodge: 1, maxHp: 3, maxStamina: 2 },
    // optional soft cap so a single stat can't run away early; null = no cap
    softCap: { power: null, spirit: null, defense: null, speed: null, dodge: 30, maxHp: null, maxStamina: 120 },
  },

  // ---- sparring (T17: replaces training once the mascot is gone) ----
  // A risk/reward grind with the rival. Reuses training.gainPerSession as the
  // base, scaled by the rolled outcome's mult; a rough spar yields nothing and
  // costs HP. Higher variance and lower expected value than the mascot's gentle
  // coaching — the low point should feel like a hard road.
  sparring: {
    hpCostOnRough: 6,           // a bad spar leaves a mark (HP, floored at 1 in the hub)
    outcomes: [                 // weighted; mult scales the base training gain
      { key: "breakthrough", weight: 25, mult: 2 },
      { key: "solid",        weight: 45, mult: 1 },
      { key: "rough",        weight: 30, mult: 0 },
    ],
  },

  // ---- errands (T19 hope layer) ----
  // Pull errands: an opt-in hub activity that brings people hope. Archetypes
  // TRADE axes (they don't all stack), so Virtue / Fame / Hope stay independent
  // ending inputs. Bigger errands cost more slots but give a BETTER hope-per-slot
  // rate (commitment pays). Hope is a HIDDEN tally — never shown as a number; the
  // player only feels the city's mood shift. Per-axis keys are optional and routed
  // to the right mutator (virtue/corruption -> alignment; fame/unmasking ->
  // visibility; hope -> the hidden tally). `public: true` is gated while cover is hot.
  errands: {
    passiveHopePerBoss: 3,   // quiet hope a boss win brings the city (hidden)
    archetypes: [
      { id: "kindness",  label: "A quiet kindness", blurb: "sit with someone the world forgot",     slots: 1, hope: 2, virtue: 1 },
      { id: "service",   label: "A day of service", blurb: "give the whole day away, dawn to dusk",  slots: 2, hope: 6, virtue: 3 },
      { id: "rescue",    label: "A public rescue",  blurb: "save someone out in the open",           slots: 1, hope: 3, fame: 6, unmasking: 4, public: true },
      { id: "expedient", label: "Cut a corner",     blurb: "help the fast way, not the right way",   slots: 1, hope: 1, corruption: 6 },
    ],
  },

  // ---- dilemmas (T19 push events) ----
  // Moral events that surface at rest (one-shot, latched in flags.dilemmasSeen).
  // Branches are authored in src/dilemmas.js; outcomes are ambiguous (no numbers).
  dilemmas: {
    chancePerRest: 0.35, // probability a dilemma fires on a given rest (when one is available)
    minDay: 2,           // don't pester the player on day 1
  },

  // ---- the Unmasking crisis (T20 high-threshold reveal-or-hide fork) ----
  // One-shot forced story crisis the first time Unmasking crosses `high`: someone
  // is in danger in the open and the only way to save them is to act as your
  // magical self in front of the city. Surfaces back at the hub right after the
  // public win that exposed you (never mid-combat). Latched in flags.unmaskingCrisisSeen.
  // Magnitudes feed the finale hope gate (endgame.js effHopeThreshold = clamp(50 −
  // fame·0.2, 30, 50)): a big Fame swing from `reveal` lowers the hope you'll need.
  unmaskingCrisis: {
    // REVEAL — tear off the mask, save them in the open. Permanent one-way door.
    //   Fame = axes.fame.gainSaveCivilian + revealFameBonus (a famous, witnessed choice).
    reveal:  { revealFameBonus: 24, hope: 8 },
    // STAY HIDDEN — save them quietly, at a cost. Retreat into the shadows.
    hide:    { hope: -6, unmaskingShed: 30 },  // keeps mustLieLow until heat falls below mid
    // CLOUD THEIR MEMORY (virtuous-only) — keep the secret kindly; it drains your magic.
    cloud:   { hope: 3, spiritCost: 2, unmaskingShed: 18 },
    // SILENCE THE WITNESS (corrupt-only) — keep the secret by force; conspicuous + dark.
    silence: { corruption: 10, unmasking: 6, hope: -4 },
  },

  // ---- starting character stats ----
  startingStats: {
    hp: 30, maxHp: 30, power: 6, spirit: 6, defense: 4,
    speed: 6, dodge: 4, stamina: 20, maxStamina: 20,
  },
  // virtue/corruption start at 0/0 — a centered, unwritten alignment your choices shape
  // (the slider reads from the gap between them; see axes.alignment).
  startingMeters: { corruption: 0, virtue: 0, fame: 0, unmasking: 0, hopeTally: 0 },

  // ---- economy ----
  // currencySymbol is shown next to coin counts everywhere. Swap freely:
  //   "¤" scarab/generic · "§" double-S · "₷" spesmilo · "✦" etc.
  economy: {
    currencySymbol: "¤",
    startingCoins: 20,
    // Shop catalog. type drives what `use <item>` does (combat uses these):
    //   heal -> restores `amount` HP · stamina -> restores `amount` Stamina · material -> sell-only
    shop: [
      { id: "healing_draught", name: "healing draught", price: 8, sell: 4, type: "heal", amount: 20 },
      { id: "stamina_tonic",   name: "stamina tonic",   price: 6, sell: 3, type: "stamina", amount: 15 },
      { id: "moonstone_shard", name: "moonstone shard", price: 12, sell: 6, type: "material" },
    ],
    // Non-shop items: loot drops + the signature find from each dungeon. `use <item>`
    // reads `type` exactly like the shop catalog (findItem searches both). The goth-cozy
    // flavour for each lives in hub.useItem.
    //   restore -> tops up BOTH HP (`hp`) and Stamina (`stamina`); a big number means "to full".
    items: [
      { id: "dew_vial", name: "dew vial", type: "heal", amount: 12 },
      // Drowned Harbor — a panic-heal wrung from sea-glass.
      { id: "tideglass_charm", name: "tideglass charm", type: "restore", hp: 30, stamina: 12 },
      // Hollow Clocktower — gives the road behind you back; a long second wind.
      { id: "stopped_hour_cog", name: "stopped-hour cog", type: "restore", hp: 10, stamina: 999 },
    ],
  },

  // ---- crafting ----
  // Moonstone shards forge a PERMANENT stat boost at the shop (free, no slot). Gather enough
  // shards (combat loot / purchase) and the shopkeep works one into your bones. softCaps from
  // `training` still apply (e.g. dodge, max stamina).
  crafting: {
    moonstone: {
      material: "moonstone shard",
      shardsPerBoost: 3,
      boost: { power: 2, spirit: 2, defense: 2, speed: 2, dodge: 2, maxHp: 6, maxStamina: 4 },
    },
  },

  // ---- exploration ----
  exploration: {
    staminaPerMove: 2, // Stamina spent per room move; hitting 0 forces a retreat to the hub
  },

  // ---- combat ----
  combat: {
    dodgeChancePerPoint: 0.015,   // dodge stat * this = evade probability (cap below)
    dodgeChanceCap: 0.5,
    defenseMitigationPerPoint: 0.8, // flat damage reduced per defense point
    guardMitigation: 0.5,         // guard halves incoming damage that turn
    storyLoss: {
      // Boss #4 scripted unwinnable fight: telegraphed, ends in narrative loss.
      enabled: true,
      maxPlayerTurnsBeforeIntervene: 5,
      bossHpVisibleDrainPerHit: 0.01, // boss HP "barely moves" so loss reads as scripted
    },
    // T13: freeform creative combat actions, gated by the AI plausibility judge
    // (PROMPTS.md B). The AI only proposes an effect TYPE + MAGNITUDE; these knobs
    // turn that into real numbers. minor/moderate scale each effect.
    judge: {
      maxTurns: 2,                              // hard cap on an effect's duration
      missChance:    { minor: 0.4, moderate: 0.7 },  // blind/distract: enemy miss chance
      powerDownPct:  { minor: 0.2, moderate: 0.35 }, // slow: enemy damage reduction
      defenseDownPct:{ minor: 0.3, moderate: 0.5 },  // expose: enemy defense reduction
      dmgReduction:  { minor: 0.3, moderate: 0.5 },  // defend: incoming-damage reduction (self)
      burnDamage:    { minor: 4,   moderate: 8 },    // burn: flat damage per enemy turn
      hubEnvTags: ["quiet street", "lamplight", "night", "pavement"], // tags for hub skirmishes
    },
  },

  // ---- axes ----
  axes: {
    corruption: {
      burstDamageMult: 1.6,        // burst attack damage = this * effective Power
      burstCorruptionGain: 8,      // a burst deepens your corruption by this much
      // high corruption warps stats (multipliers; the HIGHEST threshold reached wins).
      // spiritMult is reserved (it would warp Spirit, the magical-strength stat) — not wired yet.
      warpThresholds: [
        { at: 40, powerMult: 1.10, hpMult: 0.95, spiritMult: 0.95 },
        { at: 70, powerMult: 1.25, hpMult: 0.85, spiritMult: 0.85 },
      ],
    },
    // high VIRTUE warps the OTHER way — a "grace" boon: resilient support (Defense up, healing
    // up), mirroring the corruption warp. Since the two ends are coupled, only one side is ever
    // active. This is what makes committing to VIRTUE pay off structurally, not just via abilities.
    virtue: {
      graceThresholds: [
        { at: 40, defenseMult: 1.15, healMult: 1.15 },
        { at: 70, defenseMult: 1.35, healMult: 1.30 },
      ],
    },
    // Virtue & Corruption read as ONE coupled slider: gaining one end drains the other by
    // `couplingDrain` * the gain. `path` (virtuous/balanced/corrupt) comes from the gap between them.
    alignment: {
      pathGap: 25,                 // |virtue - corruption| >= this => virtuous / corrupt; else balanced
      couplingDrain: 0.5,          // a +10 corruption gain also removes 5 virtue (and vice versa)
      mercyVirtueGain: 8,          // sparing a beaten, non-boss foe
      finishCorruptionGain: 4,     // landing the killing blow instead
      spareEnemyHpPct: 0.25,       // you may `spare` once enemy HP <= this fraction of its max
      fizzlePerGapPoint: 0.012,    // opposed-ability fizzle chance per point you're into the wrong end
      fizzleChanceCap: 0.6,        // ...capped here
    },
    unmasking: {
      gainPublicBattle: 6,
      gainCorruptAction: 4,       // corruption-flavored actions raise unmasking faster
      coolPerRestDay: 2,          // passive cooling per rested day
      residualFloor: 5,           // once publicly known (fame>0), cooling never drops below this
      relocateHubCostDays: 2,     // relocating home consumes all slots, takes 2 days
      thresholds: { low: 25, mid: 55, high: 85 },  // event tiers
      lieLowReduction: 12,        // `lie low` (spends the day) sheds this much heat
      misdirectionReduction: 8,   // misdirection errand (spends a slot) sheds this much
    },
    fame: {
      gainPublicWin: 5,
      gainVisibleQuest: 8,
      gainSaveCivilian: 6,
    },
  },

  // ---- abilities (combat kit) ----
  // align: neutral | virtuous | corrupt  → gates learning + drives soft-fizzle when you've
  //   drifted to the OPPOSITE end of the slider (chance scales with how far; see axes.alignment).
  // kind: damage | heal | lifesteal. nudge: slider movement when used (coupled, like any gain).
  // learn: prereqs to learn it in training (omit `learn` => innate from the start). reqTier =
  //   transformation tier reached; reqCorruption = raw corruption >=; reqGapVirtue = virtue-corruption >=.
  // NOTE: abilities cost NO resource to cast — Spirit is the character's magical strength, and it
  //   SCALES an ability's damage and healing (combat.js). `mult` multiplies effective Spirit.
  abilities: {
    "light bolt": { align: "neutral", kind: "damage", mult: 1.6,
                    verb: "hurl a bolt of light at" },
    "mend":       { align: "virtuous", kind: "heal", healPct: 0.30,
                    verb: "fold a soft, mending light around yourself",
                    nudge: { virtue: 4 },
                    learn: { reqTier: "novice", reqGapVirtue: 15, slotCost: 1, blurb: "a healing light (Virtue)" } },
    "drain":      { align: "corrupt", kind: "lifesteal", mult: 1.2, lifestealPct: 0.5,
                    verb: "siphon the living warmth out of",
                    nudge: { corruption: 4 },
                    learn: { reqTier: "novice", reqCorruption: 40, slotCost: 1, blurb: "a life-siphon (Corrupt)" } },
    // Virtue kit: corruption tempts with raw burst damage; virtue rewards control + safety + sustain.
    // applyFx installs a status effect (same magnitudes as combat.judge); reuses the T13 fx engine.
    "radiance":   { align: "virtuous", kind: "damage", mult: 1.3,
                    verb: "call down a lance of radiance on",
                    applyFx: { kind: "blind", magnitude: "moderate", turns: 1 }, // dazzles -> it misses
                    nudge: { virtue: 4 },
                    learn: { reqTier: "novice", reqGapVirtue: 15, slotCost: 1, blurb: "a dazzling light strike (Virtue)" } },
    "ward":       { align: "virtuous", kind: "buff",
                    verb: "wreathe yourself in warding light",
                    applyFx: { kind: "defend", magnitude: "moderate", turns: 2 }, // incoming damage cut
                    nudge: { virtue: 3 },
                    learn: { reqTier: "novice", reqGapVirtue: 30, slotCost: 1, blurb: "a protective ward (Virtue)" } },
    "purify":     { align: "virtuous", kind: "purify",
                    verb: "breathe out a cleansing light",
                    shedCorruption: 10, healPct: 0.10, // climb back from the brink (fizzle-exempt)
                    learn: { reqTier: "novice", reqCorruption: 10, slotCost: 1, blurb: "cleanse + shed Corruption (Virtue)" } },
    // T18: the Awakened signature — your recovered magical weapon. Neutral (no
    // fizzle), heavy hit that staggers the foe (skips its next turn). Learnable
    // only once Awakened (reqTier), so it never appears before the weapon is found.
    "true strike": { align: "neutral", kind: "damage", mult: 2.0,
                     verb: "bring your awakened weapon down on",
                     applyFx: { kind: "stagger", magnitude: "minor", turns: 1 },
                     learn: { reqTier: "awakened", slotCost: 1, blurb: "a staggering strike with your true weapon (Awakened)" } },
  },

  // ---- transformation tiers ----
  // Gated by story beat (boss) AND a stat/stamina threshold.
  tiers: {
    novice:   { reqBoss: null,  reqMinStaminaPct: 0.0 },
    soldier:  { reqBoss: "boss1", reqMinStaminaPct: 0.0 },
    knight:   { reqBoss: "boss3", reqMinStaminaPct: 0.5 },
    awakened: { reqBoss: "secretPlace", reqWeaponFound: true },
    ascended: { reqBoss: "finalPhase2", reqMinHopeTally: 50 }, // hope fuels ascension
  },

  // ---- the finale (T19, DESIGN §9.5) ----
  // One continuous fight (two winnable phases) then the brink: a dramatized choice
  // ("answer with hope" / "seize the despair") plus a fuel-check gate WITH TEETH.
  // The 2×2 of {reach × enough-fuel} decides the ending. Hope is the hidden tally;
  // its threshold is LOWERED by Fame (the city's belief carries you). Seizing needs
  // raw Corruption (or a corrupt path). Horror is reserved for hubris — grasping
  // power you can't hold — never for trying for hope and falling short.
  finale: {
    phases: ["grey_sovereign", "city_despair"], // P1 apparent source → P2 manifested despair
    hopeThresholdBase: 50,    // hope needed to hold an ascension at zero Fame
    hopeThresholdFloor: 30,   // ...but never more forgiving than this
    fameThresholdRelief: 0.2, // each point of Fame lowers the hope threshold by this
    seizeCorrThreshold: 50,   // raw Corruption that counts as "enough" to seize (path==="corrupt" also qualifies)
    assistHpPct: 0.4,         // once per phase, when your HP dips below this, Sable + the mascot step in
    assistHealPct: 0.18,      // the mascot's clutch heal (fraction of max HP) — tuned down from 0.25 so the finale rewards using your kit (sim: button-masher ~51% vs tactician ~100%)
  },

  // ---- rival arc (T16) ----
  // Sable's schedule ticks off the day cycle (at rest / lie low). Days are counted
  // from the day the gating boss falls.
  rival: {
    daysAfterBoss2: 2,   // days after Boss #2 before Sable shows up to challenge you (duel)
    daysAfterBoss3: 2,   // days after Boss #3 before Sable returns with the hint (dialogue)
  },

  // ---- prestige / clean-slate ----
  prestige: {
    statMultiplier: 0.5,          // halve current stats
    enemyScalePerPrestigeNormal: 0.1, // +10% enemy strength per prestige on Normal
    enemyScalePerPrestigeEasy: 0.0,
  },

  // ---- AI / cost guards (mirrored server-side in the Supabase Edge Function) ----
  ai: {
    model: "claude-haiku-4-5-20251001",
    anonDailyCallCap: 50,         // per anonymous session
    accountDailyCallCap: 200,     // signed-in
    globalDailyKillSwitch: 5000,  // total across all users; over -> deterministic-only
    enablePromptCaching: true,
    narrationOptional: true,      // skip narration on trivial turns to save tokens
  },

  // ---- Supabase (AI proxy backend) ----
  // Public, client-safe values from your Supabase project (Settings -> API).
  // The anon key is protected by Row-Level Security; safe to ship in the browser.
  supabase: {
    url: "https://YOUR_PROJECT_REF.supabase.co",
    anonKey: "YOUR_SUPABASE_ANON_PUBLIC_KEY",
    functionName: "ai-proxy",
  },

  // ---- Mixpanel analytics ----
  // Project token (public, browser-safe). Leave the placeholder to disable
  // tracking entirely; players can also opt out from Settings → Analytics.
  // In deploys, the build script substitutes MIXPANEL_TOKEN from the env.
  analytics: {
    mixpanelToken: "YOUR_MIXPANEL_TOKEN",
    superProps: {},
  },

  // ---- Turnstile (human-check on first AI use; T11b "Option B") ----
  // The ai-proxy Edge Function requires a Cloudflare Turnstile token before the FIRST paid
  // AI call per browser, blocking bots from burning the Anthropic budget. Only the PUBLIC
  // site key goes here. The SECRET key lives in Supabase, never in the client:
  //   supabase secrets set CLOUDFLARE_TURNSTILE_SECRET=<your-secret>
  // Get keys at dash.cloudflare.com > Turnstile (allowlist your domains, incl. localhost).
  // For local dev you can use Cloudflare's always-pass TEST key "1x00000000000000000000AA"
  // (secret "1x0000000000000000000000000000000AA"). Leave the placeholder to disable the
  // check (the game still runs; a bot could then mint paid calls — set a real key to ship).
  turnstile: {
    siteKey: "YOUR_TURNSTILE_SITE_KEY",
    scriptUrl: "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit",
  },
};

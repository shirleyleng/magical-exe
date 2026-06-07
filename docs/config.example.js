// MAGICAL.EXE — balance & difficulty config
// Copy to `config.js`. ALL tunable knobs live here so balance is one-file editable.
// Balance comes from playtesting these numbers, not from theory. Tune freely.

export const CONFIG = {
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

  // ---- starting character stats ----
  startingStats: {
    hp: 30, maxHp: 30, power: 6, spirit: 6, defense: 4,
    speed: 6, dodge: 4, stamina: 20, maxStamina: 20,
  },
  startingMeters: { corruption: 0, purity: 50, fame: 0, unmasking: 0, hopeTally: 0 },

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
    spiritCostDefault: 3,         // default ability Spirit cost
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
      burstDamageMult: 1.6,       // spending corruption for a burst attack
      // high corruption warps stats (applied as multipliers above these thresholds):
      warpThresholds: [
        { at: 40, powerMult: 1.10, hpMult: 0.95, spiritMult: 0.95 },
        { at: 70, powerMult: 1.25, hpMult: 0.85, spiritMult: 0.85 },
      ],
    },
    unmasking: {
      gainPublicBattle: 6,
      gainCorruptAction: 4,       // corruption-flavored actions raise unmasking faster
      coolPerRestDay: 2,          // passive cooling
      relocateHubCostDays: 2,     // relocating home consumes all slots, takes 2 days
      thresholds: { low: 25, mid: 55, high: 85 },  // event tiers
    },
    fame: {
      gainPublicWin: 5,
      gainVisibleQuest: 8,
      gainSaveCivilian: 6,
    },
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

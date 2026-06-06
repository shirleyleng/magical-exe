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
};

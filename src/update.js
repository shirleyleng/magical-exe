/* ============================================================
   MAGICAL.EXE — update.js
   The Update. A single (effectively) pure function:
       update(state, event) -> newState
   Every change flows through here — no scattered mutation. We clone
   the incoming state (structuredClone) so the input is never mutated,
   then build and return the next state.

   T3: input is routed through the deterministic parser (parser.js).
   Many verbs return placeholder responses because the systems they
   touch (hub shop, exploration rooms, combat) arrive in T6–T8. The
   parser plumbing and routing is what T3 establishes.
   ============================================================ */

import { CONFIG } from "../config.js";
import { freshModel, pushLine } from "./state.js";
import { parse, HELP } from "./parser.js";
import { beginCreation, handleCreationInput, handleMenuSelect } from "./creation.js";
import { aiAvailable, parseAIJson } from "./ai.js";
import { THEMES, themeName } from "./theme.js";
import {
  refreshSlotsMax, trainCommand, openTrainMenu, openShopMenu,
  sellCommand, useItem, doRest, handleHubMenu, slotsFree,
  doLieLow, doMisdirect, sparCommand, openSparMenu, visitAlliance,
  errandCommand, openErrandMenu,
} from "./hub.js";
import { enterDungeon, openExploreMenu, moveDir, lookRoom, takeItem, retreat, explorationEntities } from "./explore.js";
import { unlockedDungeons, resolveDungeon, DUNGEONS } from "./dungeons.js";
import { tickRival } from "./rival.js";
import { maybeDilemma, resolveDilemma } from "./dilemmas.js";
import {
  startCombat, playerAttack, playerGuard, playerBurst, playerSpare, combatUse, combatLook, playerFlee,
  applyJudgedAction,
} from "./combat.js";
import { handleBossDefeat, handleStoryLoss } from "./progress.js";
import { handleFinaleResolve, resolveBrink } from "./endgame.js";
import { openPrestigeMenu, doPrestige } from "./prestige.js";
import { listSlots, deleteSlot, hasSlot } from "./persist.js";

/* Resolve story reactions a combat turn may have triggered: a boss falling
   (tier-up + reveal), the scripted Boss #4 story-loss (mascot gone + hooks), or
   the T19 finale reaching its brink (the ascension resolver). */
function afterCombat(out) {
  if (out.ui.justDefeatedBoss) return handleBossDefeat(out);
  if (out.ui.justLostStoryBoss) return handleStoryLoss(out);
  if (out.ui.finaleResolve) return handleFinaleResolve(out);
  return out;
}

export function update(state, event) {
  const s = structuredClone(state);

  switch (event.type) {
    case "boot":
      return onBoot(s, event);
    case "input":
      return onInput(s, event);
    case "menuMove": {
      const m = s.ui.menu;
      if (m && m.active) {
        m.index = nextSelectable(m.options, m.index, event.dir); // wraps, skips headers
        if (m.kind === "theme") s.ui.effect = themePreviewEffect(m);
      }
      return s;
    }
    case "menuJump": {
      const m = s.ui.menu;
      if (m && m.active && event.index >= 0 && event.index < m.options.length) {
        const target = m.options[event.index];
        m.index = isSelectable(target) ? event.index : nextSelectable(m.options, event.index, 1);
        if (m.kind === "theme") s.ui.effect = themePreviewEffect(m);
      }
      return s;
    }
    case "menuSelect": {
      const m = s.ui.menu;
      if (!m || !m.active) return s;
      if (!isSelectable(m.options[m.index])) return s; // ignore section headers
      if (m.kind === "creation") return handleMenuSelect(s);
      if (m.kind === "load") {
        const opt = m.options[m.index];
        pushLine(s, opt.label, "echo");
        s.ui.menu = null;
        if (opt.value === "__cancel__") { pushLine(s, "(cancelled)", "hint"); return s; }
        return requestLoad(s, opt.value);
      }
      if (m.kind === "settings") {
        const opt = m.options[m.index];
        pushLine(s, opt.label, "echo");
        s.ui.menu = null;
        if (opt.value === "__cancel__") return s;
        if (opt.value === "theme") return openThemeMenu(s);
        if (opt.value === "difficulty") return openDifficultyMenu(s);
        if (opt.value === "about") return showAbout(s);
        return s;
      }
      if (m.kind === "theme") {
        const opt = m.options[m.index];
        pushLine(s, opt.label, "echo");
        const original = m.original;
        s.ui.menu = null;
        if (opt.value === "__cancel__") {
          s.ui.effect = { type: "theme", id: original, preview: true }; // undo live preview
          pushLine(s, "(kept current theme)", "hint");
          return s;
        }
        s.ui.effect = { type: "theme", id: opt.value }; // commit: main.js applies + persists
        pushLine(s, `Theme set to ${themeName(opt.value)}.`, "system");
        return s;
      }
      if (m.kind === "explore") {
        const opt = m.options[m.index];
        pushLine(s, opt.label, "echo");
        s.ui.menu = null;
        if (opt.value === "__cancel__") { pushLine(s, "(never mind)", "hint"); return s; }
        return enterDungeon(s, opt.value);
      }
      if (m.kind === "dilemma") {
        const opt = m.options[m.index];
        pushLine(s, opt.label, "echo");
        const dilemmaId = m.dilemmaId;
        s.ui.menu = null;
        return resolveDilemma(s, dilemmaId, opt.value);
      }
      if (m.kind === "brink") {
        const opt = m.options[m.index];
        pushLine(s, opt.label, "echo");
        s.ui.menu = null;
        return resolveBrink(s, opt.value); // T19 finale: fuel-check gate → one of four endings
      }
      if (m.kind === "prestige") {
        const opt = m.options[m.index];
        pushLine(s, opt.label, "echo");
        s.ui.menu = null;
        if (opt.value === "__cancel__") { pushLine(s, "(You hold on to this run — for now.)", "hint"); return s; }
        return doPrestige(s);
      }
      if (m.kind === "difficulty") {
        const opt = m.options[m.index];
        pushLine(s, opt.label, "echo");
        s.ui.menu = null;
        if (opt.value === "__cancel__") return s;
        s.model.difficulty = opt.value;
        pushLine(s, `Difficulty set to ${opt.value === "easy" ? "Gentle (Easy)" : "Standard (Normal)"}.`, "system");
        return s;
      }
      return handleHubMenu(s, m.kind, m.options[m.index]);
    }
    case "loaded":
      return onLoaded(s, event);
    case "ai-result":
      return onAIResult(s, event);
    case "menuCancel": {
      const m = s.ui.menu;
      // creation + the finale brink are not escapable (the brink has no take-back).
      if (m && m.active && m.kind !== "creation" && m.kind !== "brink") {
        if (m.kind === "theme") s.ui.effect = { type: "theme", id: m.original, preview: true }; // undo preview
        s.ui.menu = null;
        pushLine(s, "(cancelled)", "hint");
      }
      return s;
    }
    default:
      console.warn("[update] unknown event:", event);
      return s;
  }
}

function onBoot(s, event) {
  pushLine(s, "✦ MAGICAL.EXE ✦", "banner");
  pushLine(s, "");
  s.ui.booted = true;

  if (!s.model.character.created) {
    // Fresh game (or a save from mid-creation) -> run character creation.
    pushLine(s, "A cozy, ordinary evening. On your way home, you hear a cry for help…", "system");
    beginCreation(s);
    return s;
  }

  refreshSlotsMax(s.model); // keep slot count correct on load
  const place = s.model.character.city || "your city";
  pushLine(s, `Welcome back to ${place}. (save loaded — Day ${s.model.day})`, "system");
  pushLine(s, "Type /help to see your commands.", "hint");
  pushLine(s, "");
  return s;
}

function onInput(s, event) {
  const raw = (event.text || "").trim();
  if (!raw) return s;
  pushLine(s, raw, "echo");
  s.ui.turn = (s.ui.turn || 0) + 1; // advances the rotating example prompt

  // Dev-only escape hatch (not a real game verb).
  if (raw.toLowerCase() === "reset") {
    const ns = { model: freshModel(), log: s.log, ui: { ...s.ui, booted: true, flow: null, creation: null } };
    pushLine(ns, "New game — state reset. Reload to begin again, or keep typing.", "system");
    return ns;
  }

  // Character creation captures input until it completes.
  if (s.ui.flow === "creation") {
    return handleCreationInput(s, raw);
  }

  const cmd = parse(raw);
  if (!cmd.matched) {
    // Deterministic parser missed. Fall back to AI if available; otherwise nudge.
    // In a fight the fallback is the plausibility JUDGE (freeform creative actions,
    // PROMPTS.md B); elsewhere it's the intent PARSER (A). Both run as an effect
    // (main.js) and return as an "ai-result" event handled by onAIResult.
    if (aiAvailable()) {
      s.ui.busy = true;
      if (s.model.mode === "combat" && s.model.combat) {
        s.ui.effect = { type: "ai", kind: "judge", raw, vars: buildJudgeContext(s, raw) };
        pushLine(s, "(weighing it…)", "hint");
      } else {
        s.ui.effect = { type: "ai", kind: "parse", raw, vars: buildParseContext(s, raw) };
        pushLine(s, "(thinking…)", "hint");
      }
      return s;
    }
    pushLine(s, "Hmm, I didn't quite catch that.", "system");
    pushLine(s, "Type /help for the list of commands.", "hint");
    return s;
  }

  const out = route(s, cmd);
  // A boss may have fallen during this turn -> resolve tier-up + reveal.
  return afterCombat(out);
}

/* ---- save-slot helpers ---- */
function openLoadMenu(s) {
  const slots = listSlots();
  if (!slots.length) { pushLine(s, "No saved games found yet.", "system"); return s; }
  const options = slots.map((sl) => ({
    label: `${sl.name} — Day ${sl.day}, ${sl.tier} (${sl.who})`,
    value: sl.name,
  }));
  options.push({ label: "Cancel", value: "__cancel__" });
  pushLine(s, "Your saved games:", "system");
  s.ui.menu = { active: true, kind: "load", options, index: 0 };
  return s;
}

/** Settings home — a discoverable menu of player preferences (theme · difficulty · about). */
function openSettingsMenu(s) {
  const current = document.documentElement.dataset.theme || "lipgloss";
  const options = [
    { label: `Theme — ${themeName(current)}`, value: "theme" },
    { label: `Difficulty — ${difficultyLabel(s.model.difficulty)}`, value: "difficulty" },
    { label: "About & credits", value: "about" },
    { label: "Close", value: "__cancel__" },
  ];
  pushLine(s, "Settings:", "system");
  s.ui.menu = { active: true, kind: "settings", options, index: 0 };
  return s;
}

const difficultyLabel = (d) => (d === "easy" ? "Gentle (Easy)" : "Standard (Normal)");

/** Easy/Normal picker. Writes model.difficulty; takes effect on the next enemy spawned. */
function openDifficultyMenu(s) {
  const cur = s.model.difficulty || "normal";
  const options = [
    { label: `Gentle (Easy)${cur === "easy" ? " (current)" : ""} — kinder foes, richer rewards`, value: "easy" },
    { label: `Standard (Normal)${cur === "normal" ? " (current)" : ""} — the world as it's meant to be`, value: "normal" },
    { label: "Cancel", value: "__cancel__" },
  ];
  pushLine(s, "How hard a road?", "system");
  s.ui.menu = { active: true, kind: "difficulty", options, index: cur === "easy" ? 0 : 1 };
  return s;
}

/** About / credits — aesthetic homages only (no vendored code); see themes.css + DESIGN.md. */
function showAbout(s) {
  const lines = [
    "MAGICAL.EXE — a cozy terminal magical-girl game.",
    "Made with love by Red Mint Studio.",
    "Enjoying it? Support development → https://ko-fi.com/shirleyleng ♥",
    "Aesthetic homage only — no vendored code:",
    "  · Lip Gloss / Charm — https://charm.sh",
    "  · Cotton Candy / Compute Cuter — sailorhg, https://computecuter.com",
    "  · Rosé Pine — https://rosepinetheme.com",
  ];
  lines.forEach((l) => pushLine(s, l, "system"));
  return s;
}

/** Theme switcher — palettes grouped into Dark / Light sections (non-selectable headers).
   Moving the highlight previews the theme live (applied but not persisted); enter keeps it,
   cancel/esc reverts to where you started. */
function openThemeMenu(s) {
  const current = document.documentElement.dataset.theme || "lipgloss";
  const options = [];
  let startIndex = -1;
  for (const group of [
    { mode: "dark", label: "── Dark themes ──" },
    { mode: "light", label: "── Light themes ──" },
  ]) {
    options.push({ header: true, label: group.label });
    for (const t of THEMES.filter((t) => t.mode === group.mode)) {
      if (t.id === current) startIndex = options.length;
      options.push({
        label: `${t.name}${t.id === current ? " (current)" : ""} — ${t.note}`,
        value: t.id,
      });
    }
  }
  options.push({ label: "Cancel", value: "__cancel__" });
  if (startIndex < 0) startIndex = firstSelectableIndex(options);
  pushLine(s, "Choose a theme:", "system");
  pushLine(s, "(scroll to preview live · enter to keep · esc to revert)", "hint");
  // `original` lets cancel/esc revert the live preview to the palette we opened with.
  s.ui.menu = { active: true, kind: "theme", options, index: startIndex, original: current };
  return s;
}

/** Preview effect for the theme menu's currently-highlighted option. The Cancel row (and
   any header) previews the original — so highlighting it shows what "keep current" looks like. */
function themePreviewEffect(m) {
  const opt = m.options[m.index];
  const id = !opt || opt.header || opt.value === "__cancel__" ? m.original : opt.value;
  return { type: "theme", id, preview: true };
}

/* ---- menu navigation helpers (headers are non-selectable, skipped while moving) ---- */
function isSelectable(opt) { return !!opt && !opt.header; }
function firstSelectableIndex(options) {
  const i = options.findIndex(isSelectable);
  return i < 0 ? 0 : i;
}
function nextSelectable(options, from, dir) {
  const n = options.length;
  let idx = from;
  for (let k = 0; k < n; k++) {
    idx = (idx + dir + n) % n;
    if (isSelectable(options[idx])) return idx;
  }
  return from;
}

/** Request a slot load — the actual model swap is an effect main.js runs. */
function requestLoad(s, name) {
  if (!hasSlot(name)) { pushLine(s, `There's no save named "${name}".`, "system"); return s; }
  s.ui.effect = { type: "load", name };
  pushLine(s, `Loading "${name}"…`, "system");
  return s;
}

/** Greet the player after a slot has been loaded (state already swapped). */
function onLoaded(s, event) {
  pushLine(s, "✦ MAGICAL.EXE ✦", "banner");
  pushLine(s, "");
  refreshSlotsMax(s.model);
  const c = s.model.character;
  pushLine(s, `Loaded "${event.name}" — ${c.name}, Day ${s.model.day}, ${c.transformationTier}.`, "system");
  pushLine(s, "Type /help for commands.", "hint");
  pushLine(s, "");
  return s;
}

/* ---- AI fallback parser (T12) ----
   Build the context the AI parser needs (PROMPTS.md A): the legal verbs this turn
   and the entities the player can refer to. Keep allowedActions in sync with the
   route() switches below. */
function buildParseContext(s, raw) {
  const m = s.model;
  const mode = m.mode;
  const inv = m.character.inventory || [];

  if (mode === "exploration") {
    return {
      mode,
      allowedActions: ["move", "look", "take", "use", "retreat"],
      presentEntities: [...explorationEntities(m), ...inv],
      rawText: raw,
    };
  }

  // hub
  return {
    mode,
    allowedActions: [
      "train", "spar", "alliance", "errand", "rest", "shop", "buy", "sell", "explore",
      "prestige", "use", "attack", "look", "status", "inventory",
    ],
    presentEntities: [
      "power", "spirit", "defense", "speed", "dodge", "hp", "stamina", // train targets
      ...CONFIG.economy.shop.map((it) => it.name),                     // shop / sell targets
      ...inv,
      "forest",                                                        // explore target
    ],
    rawText: raw,
  };
}

/* ---- AI combat judge (T13, PROMPTS.md B) ----
   Context for a freeform creative combat action: what's around to improvise with,
   what the player can actually do, and who they're fighting. The judge approves a
   grounded effect TYPE + MAGNITUDE only — the engine (combat.js) sets the numbers. */
function buildJudgeContext(s, raw) {
  const m = s.model;
  const c = m.combat || {};
  return {
    environmentTags: c.envTags || [],
    abilities: m.character.abilities || [],
    transformationTier: m.character.transformationTier,
    enemyName: c.enemy ? c.enemy.name : "the enemy",
    rawText: raw,
  };
}

/** Validate + normalize a judge verdict (PROMPTS.md B schema). Returns a clean
 *  verdict object, or null if the reply is unusable (engine disposes, AI proposes). */
const JUDGE_EFFECTS = new Set([
  "none", "blind", "stagger", "slow", "expose", "defend", "burn", "douse", "distract",
]);
function normalizeVerdict(data) {
  if (!data || typeof data !== "object") return null;
  if (typeof data.approved !== "boolean") return null;
  const effect = JUDGE_EFFECTS.has(data.effect) ? data.effect : "none";
  const turns = Number.isFinite(data.turns) ? Math.max(0, Math.trunc(data.turns)) : 0;
  const cost = Number.isFinite(data.corruptionCost) ? Math.max(0, Math.trunc(data.corruptionCost)) : 0;
  return {
    approved: data.approved,
    reason: typeof data.reason === "string" && data.reason.trim() ? data.reason.trim() : null,
    effect,
    target: data.target === "self" ? "self" : "enemy",
    turns,
    magnitude: data.magnitude === "moderate" ? "moderate" : "minor",
    corruptionCost: cost,
  };
}

/** Tidy AI prose for the terminal: drop a leading markdown heading (the model
 *  sometimes titles the city with "# Name") and trim. */
function cleanProse(text) {
  return String(text || "").replace(/^\s*#{1,6}\s+.*(?:\r?\n)+/, "").trim();
}

/** Friendly message when the AI parser couldn't be used (gated / offline). */
function aiUnavailableLine(reason) {
  if (reason === "resting" || reason === "limit") {
    return "The mascot's a little tuckered out — sticking to plain commands for now.";
  }
  return "Hmm, I didn't quite catch that.";
}

/* Handle the AI's reply. kind:"parse" -> validate + route a command;
   kind:"city"|"narrate" -> append the prose (or a fallback). */
function onAIResult(s, event) {
  s.ui.busy = false;
  const { kind, res, vars, raw } = event;

  if (kind === "city") {
    const text = res && res.ok ? cleanProse(res.text) : "";
    pushLine(s, text || vars.fallback, "system");
    pushLine(s, "(city flavor — not a factual claim.)", "hint");
    return s;
  }

  if (kind === "narrate") {
    const text = res && res.ok ? cleanProse(res.text) : "";
    if (text) pushLine(s, text, "mascot");
    return s;
  }

  if (kind === "judge") {
    // The fight may have ended while the call was in flight (it can't, since input
    // is locked — but guard anyway). If so, just drop the reply.
    if (s.model.mode !== "combat" || !s.model.combat) return s;
    if (!res || !res.ok) {
      pushLine(s, aiUnavailableLine(res && res.reason), "system");
      pushLine(s, "In a fight you can always: attack · guard · use <ability> · flee.", "hint");
      return s;
    }
    const verdict = normalizeVerdict(parseAIJson(res.text));
    if (!verdict) {
      pushLine(s, "You hesitate — that didn't come together.", "system");
      pushLine(s, "Try: attack · guard · use <ability> · flee.", "hint");
      return s;
    }
    if (verdict.reason) pushLine(s, verdict.reason, "mascot");
    if (!verdict.approved) {
      // Rejected ideas don't cost a turn — try something else.
      pushLine(s, "(Try: attack · guard · use <ability> · flee.)", "hint");
      return s;
    }
    const out = applyJudgedAction(s, verdict);
    return afterCombat(out);
  }

  // kind === "parse"
  if (!res || !res.ok) {
    pushLine(s, aiUnavailableLine(res && res.reason), "system");
    pushLine(s, "Type /help for the list of commands.", "hint");
    return s;
  }

  const data = parseAIJson(res.text);
  const verb = data && typeof data.action === "string" ? data.action : null;
  const allowed = (vars && vars.allowedActions) || [];
  if (!verb || verb === "unknown" || !allowed.includes(verb)) {
    const why = data && typeof data.reason === "string" ? data.reason : null;
    pushLine(s, why ? `Hmm — ${why}` : "Hmm, I didn't quite catch that.", "system");
    pushLine(s, "Type /help for the list of commands.", "hint");
    return s;
  }

  const target = data.target != null ? String(data.target) : null;
  const cmd = {
    matched: true,
    verb,
    target: target ? target.toLowerCase() : null,
    targetRaw: target,
    modifier: data.modifier != null ? String(data.modifier) : null,
    raw: raw || res.text,
  };
  const out = route(s, cmd);
  return afterCombat(out);
}

/* ---- command router ----
   Universal verbs first, then dispatch to the mode-specific router. */
function route(s, cmd) {
  const { verb, target } = cmd;
  const name = cmd.targetRaw; // original-case for save-slot names

  switch (verb) {
    case "help":
      HELP.forEach((line) => pushLine(s, line, "system"));
      return s;

    case "status": {
      const c = s.model.character;
      pushLine(s, `Day ${s.model.day} · ${s.model.mode} · ${c.transformationTier} (${c.path}).`, "system");
      pushLine(s, "Full stats are in the STATUS panel →", "hint");
      return s;
    }

    case "inventory": {
      const inv = s.model.character.inventory;
      if (!inv.length) pushLine(s, "Your satchel is empty.", "system");
      else pushLine(s, "You carry: " + inv.join(", ") + ".", "system");
      return s;
    }

    case "examine":
      pushLine(s, target ? `You study the ${target}, but nothing reveals itself.` : "Examine what?", "system");
      return s;

    case "save": {
      if (name) {
        s.model.saveSlotName = name; // "save as" — autosave (dispatch) writes the new slot
        pushLine(s, `Saved as "${name}". (this run now records to that slot)`, "system");
      } else {
        pushLine(s, `Saved to "${s.model.saveSlotName}".`, "system");
      }
      return s;
    }

    case "load":
      return name ? requestLoad(s, name) : openLoadMenu(s);

    case "saves":
      return openLoadMenu(s);

    case "delete": {
      if (!name) { pushLine(s, "Delete which save? Type saves to see them.", "system"); return s; }
      if (name === s.model.saveSlotName) {
        pushLine(s, "You can't delete the run you're currently playing.", "system");
        return s;
      }
      if (!hasSlot(name)) { pushLine(s, `There's no save named "${name}".`, "system"); return s; }
      deleteSlot(name);
      pushLine(s, `Deleted save "${name}".`, "system");
      return s;
    }

    case "map":
      pushLine(s, "You don't have a map yet.", "system");
      return s;

    case "theme":
      return openThemeMenu(s);

    case "settings":
      return openSettingsMenu(s);
  }

  if (s.model.mode === "combat") return routeCombat(s, cmd);
  return s.model.mode === "exploration" ? routeExplore(s, cmd) : routeHub(s, cmd);
}

/* ---- combat-mode verbs ---- */
function routeCombat(s, cmd) {
  const { verb, target } = cmd;
  switch (verb) {
    case "attack":
      return playerAttack(s);
    case "guard":
      return playerGuard(s);
    case "burst":
      return playerBurst(s);
    case "spare":
      return playerSpare(s);
    case "use":
      return combatUse(s, target);
    case "retreat":
      return playerFlee(s);
    case "look":
      return combatLook(s);
    case "move":
      pushLine(s, "No wandering off mid-fight — try flee.", "system");
      return s;
    default:
      pushLine(s, "You're in a fight! (attack · guard · use <ability> · use <item> · flee)", "system");
      return s;
  }
}

/* ---- hub-mode verbs ---- */
function routeHub(s, cmd) {
  const { verb, target } = cmd;
  switch (verb) {
    case "train":
      return target ? trainCommand(s, target) : openTrainMenu(s);
    case "spar":
      return target ? sparCommand(s, target) : openSparMenu(s);
    case "alliance":
      return visitAlliance(s);
    case "errand":
      return target ? errandCommand(s, target) : openErrandMenu(s);
    case "rest":
      return maybeDilemma(tickRival(doRest(s)));
    case "lielow":
      return tickRival(doLieLow(s));
    case "misdirect":
      return doMisdirect(s);
    case "shop":
    case "buy":
      return openShopMenu(s);
    case "sell":
      return sellCommand(s, target);
    case "prestige":
      return openPrestigeMenu(s);
    case "explore": {
      if (!target) return openExploreMenu(s);
      const id = resolveDungeon(target);
      if (!id) { pushLine(s, `You don't know a way to "${target}". Type explore to see where you can go.`, "system"); return s; }
      if (!unlockedDungeons(s.model).some((d) => d.id === id)) {
        pushLine(s, `The way to the ${DUNGEONS[id].name} isn't open to you yet.`, "system");
        return s;
      }
      return enterDungeon(s, id);
    }
    case "use":
      return useItem(s, target);

    case "attack": {
      // A hub-area skirmish for loot — costs a combat slot.
      if (s.model.character.mustLieLow) {
        pushLine(s, "Not in public — your cover is too hot right now. Lie low or run a misdirection errand first.", "system");
        return s;
      }
      if (slotsFree(s.model) <= 0) {
        pushLine(s, "You're out of activity slots for today. Rest first.", "system");
        return s;
      }
      s.model.hub.slotsUsedToday.combat += 1;
      return startCombat(s, "dust_sprite", { returnMode: "hub", fromSlot: true });
    }

    case "look":
      pushLine(s, "You're at home base — cozy and familiar. Type explore to venture out, or fight to spar.", "system");
      return s;
    case "move":
      pushLine(s, "There's nowhere to wander from here. Try explore to set out.", "system");
      return s;
    case "take":
      pushLine(s, "There's nothing here to take.", "system");
      return s;
    case "guard":
      pushLine(s, "You raise your guard at nothing in particular.", "system");
      return s;
    case "talk":
      pushLine(s, "There's no one here to talk to right now.", "system");
      return s;
    case "retreat":
      pushLine(s, "You're already home.", "system");
      return s;
    default:
      pushLine(s, "You can't do that here.", "system");
      return s;
  }
}

/* ---- exploration-mode verbs ---- */
function routeExplore(s, cmd) {
  const { verb, target } = cmd;
  switch (verb) {
    case "move":
      return moveDir(s, target);
    case "look":
      return lookRoom(s);
    case "take":
      return takeItem(s, target);
    case "use":
      return useItem(s, target);
    case "retreat":
      return retreat(s, false);

    case "attack":
      pushLine(s, "Nothing here to fight just now — keep exploring.", "system");
      return s;
    case "guard":
      pushLine(s, "You steady yourself, watchful.", "system");
      return s;
    case "talk":
      pushLine(s, "The wood doesn't answer.", "system");
      return s;

    case "train":
    case "spar":
    case "alliance":
    case "errand":
    case "rest":
    case "shop":
    case "buy":
    case "sell":
    case "explore":
    case "prestige":
      pushLine(s, "Not while you're out exploring — retreat to the hub first.", "system");
      return s;
    default:
      pushLine(s, "You can't do that out here.", "system");
      return s;
  }
}

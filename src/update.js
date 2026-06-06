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

import { freshModel, pushLine } from "./state.js";
import { parse, HELP } from "./parser.js";
import { beginCreation, handleCreationInput, handleMenuSelect } from "./creation.js";
import {
  refreshSlotsMax, trainCommand, openTrainMenu, openShopMenu,
  sellCommand, useItem, doRest, handleHubMenu, slotsFree,
} from "./hub.js";
import { enterDungeon, moveDir, lookRoom, takeItem, retreat } from "./explore.js";
import {
  startCombat, playerAttack, playerGuard, combatUse, combatLook, playerFlee,
} from "./combat.js";
import { handleBossDefeat } from "./progress.js";
import { listSlots, deleteSlot, hasSlot } from "./persist.js";

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
        const n = m.options.length;
        m.index = (m.index + event.dir + n) % n; // wrap around
      }
      return s;
    }
    case "menuJump": {
      const m = s.ui.menu;
      if (m && m.active && event.index >= 0 && event.index < m.options.length) {
        m.index = event.index;
      }
      return s;
    }
    case "menuSelect": {
      const m = s.ui.menu;
      if (!m || !m.active) return s;
      if (m.kind === "creation") return handleMenuSelect(s);
      if (m.kind === "load") {
        const opt = m.options[m.index];
        pushLine(s, opt.label, "echo");
        s.ui.menu = null;
        if (opt.value === "__cancel__") { pushLine(s, "(cancelled)", "hint"); return s; }
        return requestLoad(s, opt.value);
      }
      return handleHubMenu(s, m.kind, m.options[m.index]);
    }
    case "loaded":
      return onLoaded(s, event);
    case "menuCancel": {
      const m = s.ui.menu;
      if (m && m.active && m.kind !== "creation") {
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
    pushLine(s, "Hmm, I didn't quite catch that.", "system");
    pushLine(s, "Type /help for the list of commands.", "hint");
    return s;
  }

  const out = route(s, cmd);
  // A boss may have fallen during this turn -> resolve tier-up + reveal.
  return out.ui.justDefeatedBoss ? handleBossDefeat(out) : out;
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
    case "rest":
      return doRest(s);
    case "shop":
    case "buy":
      return openShopMenu(s);
    case "sell":
      return sellCommand(s, target);
    case "explore":
      return enterDungeon(s, "forest");
    case "use":
      return useItem(s, target);

    case "attack": {
      // A hub-area skirmish for loot — costs a combat slot.
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
    case "rest":
    case "shop":
    case "buy":
    case "sell":
    case "explore":
      pushLine(s, "Not while you're out exploring — retreat to the hub first.", "system");
      return s;
    default:
      pushLine(s, "You can't do that out here.", "system");
      return s;
  }
}

/* ============================================================
   MAGICAL.EXE — main.js (entry point, ES module)
   Wires the loop: input -> event -> update -> render, and autosaves
   the model after every change.
       dispatch(event):  state = update(state, event)
                         saveModel(state.model)   // autosave
                         render(state)
   ============================================================ */

import { createState } from "./state.js";
import { update } from "./update.js";
import { render, initDom, setRenderSpeed, finishTyping } from "./render.js";
import { initMascotAnim } from "./mascotAnim.js";
import { saveModel, loadActive, loadSlot } from "./persist.js";
import { callAI, setCaptchaProvider } from "./ai.js";
import { getCaptchaToken } from "./captcha.js";
import { applyTheme, getStoredTheme, setStoredTheme, setStoredTextSpeed } from "./theme.js";
import { versionLabel } from "./version.js";
import { CONFIG } from "../config.js";

let state;
let inputEl = null;       // the command field (set in boot); used to restore focus
let menuWasActive = false; // tracks selection-menu transitions for focus restore

function dispatch(event) {
  state = update(state, event);
  saveModel(state.model); // autosave to the active slot
  render(state);
  if (state.ui.effect) applyEffect();
  restoreFocusIfMenuClosed();
}

/* When a selection menu closes, the text input reappears — put the caret back in it so the
   player can keep typing without clicking (the menu hides the field while it's open). */
function restoreFocusIfMenuClosed() {
  const menuActive = !!(state.ui.menu && state.ui.menu.active);
  if (menuWasActive && !menuActive && inputEl) inputEl.focus();
  menuWasActive = menuActive;
}

/** Run a deferred side-effect requested by update (e.g. swapping saves, AI calls). */
async function applyEffect() {
  const effect = state.ui.effect;
  if (!effect) return;

  if (effect.type === "load") {
    const model = loadSlot(effect.name);
    if (model) {
      state = createState(model); // fresh session for the loaded run
      render(state);
      dispatch({ type: "loaded", name: effect.name });
    } else {
      state.ui.effect = null;
      render(state);
    }
    return;
  }

  if (effect.type === "ai") {
    state.ui.effect = null; // consume before awaiting
    const res = await callAI(effect.kind, effect.vars);
    dispatch({ type: "ai-result", kind: effect.kind, raw: effect.raw, vars: effect.vars, res });
    return;
  }

  if (effect.type === "theme") {
    state.ui.effect = null;
    applyTheme(effect.id);
    if (!effect.preview) setStoredTheme(effect.id); // preview = apply only; commit = persist
    render(state);
    return;
  }

  if (effect.type === "textspeed") {
    state.ui.effect = null;
    setStoredTextSpeed(effect.id);
    setRenderSpeed(effect.id); // live, no reload
    render(state);
    return;
  }
}

/* The human-check provider handed to ai.js. Invoked only when the proxy asks for a token
   (first AI use per browser). Mounts the inline Turnstile widget in #captcha — outside the
   reconciled scrollback — and resolves the token. Any failure (no key, blocked CDN, unsolved)
   returns null, and the game keeps running deterministic-only. */
function makeCaptchaProvider() {
  const box = document.getElementById("captcha");
  const widget = document.getElementById("captcha-widget");
  return async () => {
    const siteKey = CONFIG.turnstile && CONFIG.turnstile.siteKey;
    if (!siteKey || siteKey.includes("YOUR_") || !box || !widget) return null;
    box.hidden = false;
    widget.innerHTML = "";
    try {
      return await getCaptchaToken(widget, siteKey, { scriptUrl: CONFIG.turnstile.scriptUrl });
    } catch (e) {
      console.warn("[captcha] token unavailable:", e);
      return null;
    } finally {
      box.hidden = true;
      widget.innerHTML = "";
    }
  };
}

function boot() {
  initDom();
  // Start the HUD mascot animator (single interval; targets the live <pre>).
  initMascotAnim(() => document.querySelector("#mascot-panel .mascot-art"));
  setCaptchaProvider(makeCaptchaProvider());
  applyTheme(getStoredTheme()); // restore the saved palette before first paint

  // Stamp the real version into the titlebar (replaces the hardcoded "v0.1").
  const hint = document.querySelector(".titlebar__hint");
  if (hint) hint.textContent = `${versionLabel()} · terminal shell`;

  const loaded = loadActive();
  state = createState(loaded);
  render(state); // paint panels before the boot banner

  dispatch({ type: "boot", loaded: !!loaded });

  // ---- input wiring ----
  const form = document.getElementById("input-form");
  const input = document.getElementById("input");
  inputEl = input; // module ref for focus restore after a menu closes

  // Terminal-style command history. Up = older entries, Down = newer,
  // Down past the newest clears the line. Kept here (not in game state)
  // because it's pure input-field behavior.
  const history = [];
  let histIndex = null; // null = not navigating (live draft)

  function setInput(value) {
    input.value = value;
    const n = value.length;
    requestAnimationFrame(() => input.setSelectionRange(n, n)); // caret to end
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    finishTyping(); // acting completes any still-typing text from the previous turn
    if (state.ui.busy) return; // an AI call is in flight — ignore input until it resolves
    const text = input.value;
    input.value = "";
    histIndex = null;
    // Record gameplay commands only — not character-creation answers.
    const inCreation = state.ui.flow === "creation";
    if (text.trim() && !inCreation && history[history.length - 1] !== text) {
      history.push(text);
    }
    dispatch({ type: "input", text });
  });

  document.addEventListener("keydown", (e) => {
    const menu = state.ui.menu;

    // When a selection menu is active, arrows/enter/numbers drive the menu.
    if (menu && menu.active) {
      if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        dispatch({ type: "menuMove", dir: -1 });
      } else if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        dispatch({ type: "menuMove", dir: 1 });
      } else if (e.key === "Enter") {
        e.preventDefault();
        dispatch({ type: "menuSelect" });
      } else if (/^[1-9]$/.test(e.key)) {
        e.preventDefault();
        dispatch({ type: "menuJump", index: Number(e.key) - 1 });
      } else if (e.key === "Escape" && menu.kind !== "creation") {
        e.preventDefault();
        dispatch({ type: "menuCancel" });
      }
      return;
    }

    // Otherwise: command-history recall on the text input.
    if (document.activeElement !== input) return;
    if (e.key === "ArrowUp") {
      if (!history.length) return;
      e.preventDefault();
      histIndex = histIndex === null ? history.length - 1 : Math.max(0, histIndex - 1);
      setInput(history[histIndex]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (histIndex === null) { setInput(""); return; }
      histIndex += 1;
      if (histIndex >= history.length) { histIndex = null; setInput(""); }
      else setInput(history[histIndex]);
    }
  });

  // Keep focus on the input when clicking empty space (not while selecting,
  // and not while a menu is taking over the input line).
  document.addEventListener("click", () => {
    finishTyping(); // a tap anywhere skips the typewriter to the end
    if (state.ui.menu && state.ui.menu.active) return;
    if (window.getSelection().toString() === "") input.focus();
  });

  input.focus();
}

boot();

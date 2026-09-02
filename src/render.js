/* ============================================================
   MAGICAL.EXE — render.js
   The View. render(state) paints the DOM from state.

   The scrollback is conceptually part of state (state.log), so the
   View stays a function of state — but repainting a growing log every
   turn would be wasteful and lose scroll position. So renderLog()
   reconciles: it appends only the lines not yet in the DOM, and does a
   full repaint only when the log shrank (reset/load). The small panels
   repaint fully each call.
   ============================================================ */

import { exampleFor } from "./prompts.js";
import { ART } from "./mascot.js";
import { syncMascot, reactMascot, idleFrame } from "./mascotAnim.js";
import { CONFIG } from "../config.js";
import { slotsUsed } from "./hub.js";
import { effectiveStats, isWarped, isGraced } from "./alignment.js";
import { unmaskingTier } from "./visibility.js";
import { getStoredTextSpeed, textSpeedCps } from "./theme.js";

let els = null;
let renderedCount = 0;

/* ---- typewriter (text speed) ----
   New non-echo output lines reveal character-by-character at `currentCps` chars/second
   ("instant" => Infinity => no animation). A single rAF loop drains a queue; a generation
   counter guarantees only one loop runs even across rapid turns. */
let currentCps = Infinity;
let typeQueue = [];
let typing = false;
let typeGen = 0;
// Scroll policy (see anchorScroll): true = follow new output down to the bottom;
// false = the reader has parked above and we leave their position alone.
let stickBottom = true;

export function initDom() {
  els = {
    output: document.getElementById("output"),
    menu: document.getElementById("menu"),
    example: document.getElementById("example-prompt"),
    form: document.getElementById("input-form"),
    stat: document.getElementById("stat-panel"),
    mascot: document.getElementById("mascot-panel"),
    layout: document.querySelector(".layout"),
    panels: document.querySelector(".panels"),
  };
  els.output.innerHTML = "";
  renderedCount = 0;
  currentCps = textSpeedCps(getStoredTextSpeed());
  typeQueue = [];
  typing = false;
  typeGen++;
  stickBottom = true;
  // Re-engage / disengage the auto-follow as the reader scrolls (chat-style):
  // scroll to the bottom and new output keeps following; scroll up to read and it
  // stops yanking you down. Bound once.
  if (!els.output.dataset.scrollBound) {
    els.output.dataset.scrollBound = "1";
    els.output.addEventListener("scroll", () => { stickBottom = isPinnedToBottom(); }, { passive: true });
  }
}

/** Live-update the reveal speed (settings change). Switching to instant flushes anything mid-type. */
export function setRenderSpeed(id) {
  currentCps = textSpeedCps(id);
  if (!Number.isFinite(currentCps)) finishTyping();
}

/** Reveal everything queued immediately (skip the animation). */
export function finishTyping() {
  typeGen++;                 // invalidate any running loop
  typing = false;
  for (const job of typeQueue) { job.shownSpan.textContent = job.text; job.restSpan.remove(); }
  typeQueue = [];
  if (stickBottom && els && els.output) els.output.scrollTop = els.output.scrollHeight;
}

/* Drive the reveal with setTimeout (not rAF): it keeps ticking even in a backgrounded/
   unfocused tab, so output never gets stuck hidden — and a generation counter ensures a
   single live loop. A fractional accumulator lets "slow" actually be slow. */
const TYPE_TICK_MS = 1000 / 60;
function startTyping() {
  if (typing) return;
  typing = true;
  const myGen = ++typeGen;
  let acc = 0;
  let last = performance.now();
  const tick = () => {
    if (myGen !== typeGen) return;            // superseded by a flush or a newer loop
    if (!typeQueue.length) { typing = false; return; }
    const now = performance.now();
    acc += currentCps * ((now - last) / 1000); // real elapsed → robust to timer throttling
    last = now;
    let take = Math.floor(acc);
    if (take >= 1) {
      acc -= take;
      while (take > 0 && typeQueue.length) {
        const job = typeQueue[0];
        const n = Math.min(job.text.length - job.shown, take);
        job.shown += n; take -= n;
        // Move characters from the invisible remainder into the shown span. Total
        // text is unchanged, so the line never reflows and the scroll anchor holds.
        job.shownSpan.textContent = job.text.slice(0, job.shown);
        job.restSpan.textContent = job.text.slice(job.shown);
        if (job.shown >= job.text.length) { job.restSpan.remove(); typeQueue.shift(); }
      }
      if (stickBottom) els.output.scrollTop = els.output.scrollHeight;
    }
    if (typeQueue.length) setTimeout(tick, TYPE_TICK_MS);
    else typing = false;
  };
  setTimeout(tick, TYPE_TICK_MS);
}

/** Re-pin the scrollback to the newest line (used after the viewport resizes —
    e.g. the on-screen keyboard opening — so the latest output stays in view).
    Respects the reader's parked scroll position. */
export function pinScrollBottom() {
  if (!els || !els.output || !stickBottom) return;
  els.output.scrollTop = els.output.scrollHeight;
}

/** Honour the OS "reduce motion" setting — no typewriter, text appears at once. */
function prefersReducedMotion() {
  return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}

/** On mobile, flip back to the Play tab so the player sees the output/menu. */
export function switchToTerminalTab() {
  if (!els) return;
  const layout = els.layout;
  if (!layout || layout.dataset.mobileTab === "terminal") return;
  layout.dataset.mobileTab = "terminal";
  for (const t of layout.querySelectorAll(".mobile-tabs__tab")) {
    t.classList.toggle("mobile-tabs__tab--active", t.dataset.tab === "terminal");
  }
}

export function render(state) {
  renderHud(state.model);
  renderLog(state.log);
  renderMenu(state.ui);
  renderExample(state.model, state.ui);
  renderStats(state.model);
  renderMascot(state.model);
  consumeMascotReactions(state.ui);
  // Re-pin after layout settles (fonts, menu toggling the input height) — but only
  // when the reader is already following at the bottom; otherwise leave them be.
  requestAnimationFrame(() => {
    if (els && stickBottom) els.output.scrollTop = els.output.scrollHeight;
  });
}

/* Fire any one-shot mascot reaction requested this turn (transient ui flags set
   by combat/progress/pushLine). Priority: a happy beat beats a hit beats speech. */
function consumeMascotReactions(ui) {
  if (!ui) return;
  if (ui.mascotReact === "happy") reactMascot("happy");
  else if (ui.mascotReact === "hit") reactMascot("hit");
  else if (ui.mascotSpoke) reactMascot("speak");
  ui.mascotReact = null;
  ui.mascotSpoke = false;
}

/* ---- HUD reveal: show STATUS + MASCOT once the player has met their mascot.
   Plays the entrance animation once, on the transition from hidden -> shown. */
function renderHud(model) {
  const created = !!(model.character && model.character.created);
  const wasHidden = els.layout.classList.contains("hud-hidden");
  els.layout.classList.toggle("hud-hidden", !created);
  if (wasHidden && created) {
    els.panels.classList.add("panels--reveal");
    els.panels.addEventListener(
      "animationend",
      () => els.panels.classList.remove("panels--reveal"),
      { once: true }
    );
  }
}

/* ---- scroll policy ----
   New output parks its FIRST line at the top of the viewport so the reader can move
   down at their own pace — capped at the bottom, so short turns (combat, one-liners)
   still settle fully in view. We only auto-follow the typewriter to the bottom when
   the reader is already pinned there; scrolling up to re-read disengages the follow. */
const BOTTOM_SLACK = 24; // px tolerance for "counts as at the bottom"

function isPinnedToBottom() {
  const o = els.output;
  return o.scrollHeight - o.scrollTop - o.clientHeight <= BOTTOM_SLACK;
}

function anchorScroll(firstNewEl, repainted) {
  const o = els.output;
  const maxScroll = Math.max(0, o.scrollHeight - o.clientHeight);
  if (repainted || !firstNewEl) {      // load/reset, or a no-new-lines re-render → newest in view
    o.scrollTop = maxScroll;
    stickBottom = true;
    return;
  }
  // Top of the new block, but never past the bottom of the scroll range.
  const target = Math.min(firstNewEl.offsetTop, maxScroll);
  o.scrollTop = target;
  stickBottom = maxScroll - target <= BOTTOM_SLACK; // short turn landed at the bottom → keep following
}

/* ---- huh-style selection menu ---- */
function renderMenu(ui) {
  const m = ui.menu;
  if (!m || !m.active) {
    els.menu.hidden = true;
    els.menu.innerHTML = "";
    els.form.style.display = "";
    return;
  }
  // Menu takes over: hide the text input line + ensure terminal tab is visible.
  switchToTerminalTab();
  // Blur first so phones dismiss the on-screen keyboard — a tap-to-select menu
  // needs the screen the keyboard would otherwise be covering.
  if (els.form.contains(document.activeElement)) document.activeElement.blur();
  els.form.style.display = "none";
  els.menu.hidden = false;
  els.menu.innerHTML = "";
  m.options.forEach((opt, i) => {
    if (opt.header) {
      const h = document.createElement("div");
      h.className = "menu__header";
      h.setAttribute("role", "presentation");
      h.textContent = opt.label;
      els.menu.appendChild(h);
      return;
    }
    const row = document.createElement("div");
    const active = i === m.index;
    row.className = "menu__item" + (active ? " menu__item--active" : "");
    row.setAttribute("role", "option");
    row.setAttribute("aria-selected", String(active));
    row.dataset.index = i;
    row.textContent = (active ? "▸ " : "  ") + opt.label;
    els.menu.appendChild(row);
  });
  // Live detail line for the highlighted option (e.g. shop item effect + prices).
  const activeOpt = m.options[m.index];
  if (activeOpt && activeOpt.detail) {
    const detail = document.createElement("div");
    detail.className = "menu__detail";
    detail.setAttribute("role", "presentation");
    detail.textContent = activeOpt.detail;
    els.menu.appendChild(detail);
  }
}

/* ---- rotating example prompt / contextual controls ---- */
function renderExample(model, ui) {
  if (ui.menu && ui.menu.active) {
    const cancel = ui.menu.kind === "creation" ? "" : " · esc to cancel";
    els.example.textContent = `↑/↓ to move · enter to select · or press a number${cancel}`;
    return;
  }
  if (ui.flow === "creation") {
    const hint = ui.creation && ui.creation.hint;
    els.example.textContent = hint ? `(${hint})` : "";
    return;
  }
  const ex = exampleFor(model.mode, ui.turn || 0);
  els.example.textContent = `try:  ${ex}`;
}

/* ---- scrollback (append-only reconciliation) ---- */
function renderLog(log) {
  let repainted = false;
  if (log.length < renderedCount) {
    // log shrank (reset/load) -> repaint from scratch
    finishTyping(); // any in-flight reveal belongs to a now-discarded log
    els.output.innerHTML = "";
    renderedCount = 0;
    repainted = true;
  }
  let firstNewEl = null;
  for (let i = renderedCount; i < log.length; i++) {
    const entry = log[i];
    const el = lineEl(entry);
    els.output.appendChild(el);
    if (!firstNewEl) firstNewEl = el;
    // Typewriter: reveal new prose char-by-char. Echo lines (the player's own command)
    // appear instantly, as does everything when speed is "instant" or reduce-motion is on.
    // The full text is laid out from the start (a shown span + an invisible remainder),
    // so the line never reflows as it types and the scroll anchor stays put.
    if (Number.isFinite(currentCps) && !prefersReducedMotion() && entry.kind !== "echo" && entry.text) {
      el.textContent = "";
      const shownSpan = document.createElement("span");
      const restSpan = document.createElement("span");
      restSpan.className = "tw-rest";
      restSpan.textContent = entry.text;
      el.appendChild(shownSpan);
      el.appendChild(restSpan);
      typeQueue.push({ shownSpan, restSpan, text: entry.text, shown: 0 });
    }
  }
  renderedCount = log.length;
  anchorScroll(firstNewEl, repainted);
  if (typeQueue.length) startTyping();
}

function lineEl({ text, kind }) {
  const p = document.createElement("p");
  p.className = `line line--${kind || "system"}`;
  if (kind === "echo") {
    const mark = document.createElement("span");
    mark.className = "prompt-mark";
    mark.textContent = ">";
    p.appendChild(mark);
    p.appendChild(document.createTextNode(text));
  } else {
    p.textContent = text;
  }
  return p;
}

/* ---- STATUS panel ---- */
/* Compact alignment slider: a marker on a Virtue←→Corrupt line, from the gap between
   virtue and corruption (left = virtuous, right = corrupt, centered = balanced). */
function alignmentBar(c) {
  const cells = 7;
  const mid = (cells - 1) / 2;
  const gap = (c.virtue || 0) - (c.corruption || 0); // + leans virtuous (left), - leans corrupt (right)
  const idx = Math.max(0, Math.min(cells - 1, Math.round(mid - (gap / 100) * mid)));
  let bar = "";
  for (let i = 0; i < cells; i++) bar += i === idx ? "◆" : "·";
  return bar;
}

function renderStats(model) {
  const c = model.character;
  const s = c.stats;
  const eff = effectiveStats(c);          // warp: Power up / HP down · grace: Defense up
  const mark = isWarped(c) ? "  ⚠" : isGraced(c) ? "  ✦" : "";
  // One stat per line; labels padded to a fixed width so the values line up.
  const row = (label, value) => `${label.padEnd(8)}${value}`;

  const statusLine =
    model.mode === "hub"
      ? `Slots ${slotsUsed(model)}/${model.hub.slotsMax}`
      : model.mode === "combat" && model.combat
      ? `VS ${model.combat.enemy.name} ${model.combat.enemy.hp}/${model.combat.enemy.maxHp}`
      : `Location: ${model.world.currentLocation}`;

  const prestigeTag = model.prestigeCount > 0 ? ` · ✦${model.prestigeCount}` : "";
  const block = [
    `${c.name}  ·  ${c.path}`,
    `Day ${model.day} · ${model.mode} · ${c.transformationTier}${prestigeTag}`,
    statusLine,
    ``,
    row("HP", `${s.hp}/${eff.maxHp}`),
    row("Stamina", `${s.stamina}/${s.maxStamina}`),
    row("Power", eff.power),
    row("Spirit", s.spirit),
    row("Defense", eff.defense),
    row("Speed", s.speed),
    row("Dodge", s.dodge),
    row("Coins", `${CONFIG.economy.currencySymbol}${c.coins ?? 0}`),
    `──────────────`,
    `Virtue ${alignmentBar(c)} Corr${mark}`,
  ].join("\n");

  els.stat.innerHTML = "";
  const pre = document.createElement("pre");
  pre.className = "stat-block";
  pre.textContent = block;
  els.stat.appendChild(pre);

  // Meters carry colour (the Unmasking danger bar reddens as it climbs), so they
  // go in their own element rather than the monochrome textContent block above.
  const meters = document.createElement("pre");
  meters.className = "stat-block meter-block";
  meters.innerHTML = metersHtml(c);
  els.stat.appendChild(meters);
}

/* Danger bar for Unmasking (T15): fills toward red across thresholds, paired
   with a Fame readout. Threshold ticks sit at low/mid/high cell boundaries. */
function unmaskingBar(c) {
  const cells = 10;
  const t = CONFIG.axes.unmasking.thresholds;
  const u = c.unmasking || 0;
  const filled = Math.round((Math.max(0, Math.min(100, u)) / 100) * cells);
  const ticks = new Set([t.low, t.mid, t.high].map((v) => Math.round((v / 100) * cells)));
  let bar = "";
  for (let i = 0; i < cells; i++) {
    if (i < filled) bar += ticks.has(i) ? "▒" : "▓"; // tick cells read as a seam in the fill
    else bar += ticks.has(i) ? "┊" : "░";            // ...or a faint gate ahead
  }
  return bar;
}

const UNMASK_LABEL = { none: "hidden", low: "rumors", mid: "hunted", high: "EXPOSED" };

function metersHtml(c) {
  // Once the mask is off for good, the Unmasking danger bar is meaningless — the
  // city already knows your face. Swap it for a quiet "public hero" readout.
  if (c.identityRevealed) {
    return (
      `Fame   ${c.fame || 0}\n` +
      `Unmask <span class="unmask unmask--revealed">— known to the city</span>`
    );
  }
  const tier = unmaskingTier(c.unmasking || 0);
  const warn = tier === "mid" || tier === "high" ? "⚠ " : "";
  const label = UNMASK_LABEL[tier];
  // Bar + tier label are generated entirely from code/numbers — safe to inject.
  return (
    `Fame   ${c.fame || 0}\n` +
    `Unmask <span class="unmask unmask--${tier}">${unmaskingBar(c)}</span> ${c.unmasking || 0} ${warn}${label}`
  );
}

/* ---- MASCOT panel (placeholder until T5 fusion/art) ----
   The <pre> is built once and reused: the animator (main.js) holds a live
   reference to it and ticks ~7×/s, so rebuilding it every turn churned DOM and
   handed the animator a fresh node each paint. We now only swap class/text. */
function renderMascot(model) {
  let pre = els.mascot.querySelector(".mascot-art");
  let caption = els.mascot.querySelector(".panel__body--muted");
  if (!pre) {
    pre = document.createElement("pre");
    pre.className = "mascot-art";
    pre.setAttribute("aria-hidden", "true");
    caption = document.createElement("p");
    caption.className = "panel__body--muted";
    els.mascot.appendChild(pre);
    els.mascot.appendChild(caption);
  }
  // Reset the per-state modifiers; the active branch re-adds what it needs.
  pre.classList.remove("mascot-art--gone", "mascot-art--dimmed");

  // Base style key (e.g. "catflick") drives which animation frames apply.
  const base = baseOf(model.mascot);

  if (model.mascot && model.mascot.name && model.mascot.present === false) {
    // T17: injured and gone (Knight->Awakened low point). An empty perch.
    pre.classList.add("mascot-art--gone");
    pre.textContent = ART.gone_small || "   .  ·  .\n   ·     ·\n  (   …   )\n   `-----'";
    caption.textContent = `${model.mascot.name} — missing`;
    syncMascot({ base, status: "gone" }); // somber; animator stays out
  } else if (model.mascot && model.mascot.name && model.mascot.dimmed) {
    // T19: Dark Ascension — present but bound, its light guttered down.
    pre.classList.add("mascot-art--dimmed");
    pre.textContent = ART[model.mascot.artKeySmall] || ART.blob_small;
    caption.textContent = `${model.mascot.name} — bound`;
    syncMascot({ base, status: "dimmed" }); // bound; no perky motion
  } else if (model.mascot && model.mascot.name && model.world && model.world.flags && model.world.flags.ascended) {
    // T19: Virtuous Ascension — the companion stands in its guardian-deity form.
    // (Dark Ascension is caught above by the dimmed branch.)
    pre.textContent = ART[`${base}_deity`] || ART.blob_deity;
    caption.textContent = `${model.mascot.name} — ascended`;
    syncMascot({ base, status: "ascended" }); // static radiant pose; animator stays out
  } else if (model.mascot && model.mascot.name) {
    pre.textContent = idleFrame(base); // animator's geometry; it takes over live
    caption.textContent = model.mascot.name;
    syncMascot({ base, status: "present" });
  } else {
    pre.textContent = ART.blob_small;
    caption.textContent = "awaiting fusion…";
    syncMascot({ base: "blob", status: "none" });
  }
}

/** The base style id from a mascot's artKeySmall (e.g. "catflick_small" -> "catflick"). */
function baseOf(mascot) {
  if (mascot && mascot.artKeySmall) return mascot.artKeySmall.replace(/_small$/, "");
  return "blob";
}

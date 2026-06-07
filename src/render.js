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
import { CONFIG } from "../config.js";
import { slotsUsed } from "./hub.js";
import { effectiveStats, isWarped, isGraced } from "./alignment.js";
import { unmaskingTier } from "./visibility.js";

let els = null;
let renderedCount = 0;

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
}

export function render(state) {
  renderHud(state.model);
  renderLog(state.log);
  renderMenu(state.ui);
  renderExample(state.model, state.ui);
  renderStats(state.model);
  renderMascot(state.model);
  scrollToBottom();
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

/* ---- always keep the newest line in view ---- */
function scrollToBottom() {
  els.output.scrollTop = els.output.scrollHeight;
  // ...and again after layout settles (fonts, menu toggling form height).
  requestAnimationFrame(() => {
    els.output.scrollTop = els.output.scrollHeight;
  });
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
  // Menu takes over: hide the text input line.
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
    row.textContent = (active ? "▸ " : "  ") + opt.label;
    els.menu.appendChild(row);
  });
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
  if (log.length < renderedCount) {
    // log shrank (reset/load) -> repaint from scratch
    els.output.innerHTML = "";
    renderedCount = 0;
  }
  for (let i = renderedCount; i < log.length; i++) {
    els.output.appendChild(lineEl(log[i]));
  }
  renderedCount = log.length;
  els.output.scrollTop = els.output.scrollHeight;
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
/* Compact alignment slider: a marker on a Pure←→Corrupt line, from the gap between
   purity and corruption (left = pure, right = corrupt, centered = balanced). */
function alignmentBar(c) {
  const cells = 7;
  const mid = (cells - 1) / 2;
  const gap = (c.purity || 0) - (c.corruption || 0); // + leans pure (left), - leans corrupt (right)
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
  const pad = (n, w = 3) => String(n).padEnd(w);

  const statusLine =
    model.mode === "hub"
      ? `Slots ${slotsUsed(model)}/${model.hub.slotsMax}`
      : model.mode === "combat" && model.combat
      ? `VS ${model.combat.enemy.name} ${model.combat.enemy.hp}/${model.combat.enemy.maxHp}`
      : `Location: ${model.world.currentLocation}`;

  const block = [
    `${c.name}  ·  ${c.path}`,
    `Day ${model.day} · ${model.mode} · ${c.transformationTier}`,
    statusLine,
    ``,
    `HP    ${s.hp}/${eff.maxHp}`,
    `PWR ${pad(eff.power)} SPR ${pad(s.spirit)}`,
    `DEF ${pad(eff.defense)} SPD ${pad(s.speed)}`,
    `DODGE ${s.dodge}`,
    `STA   ${s.stamina}/${s.maxStamina}`,
    `Coins ${CONFIG.economy.currencySymbol}${c.coins ?? 0}`,
    `──────────────`,
    `Pure ${alignmentBar(c)} Corr${mark}`,
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
  const tier = unmaskingTier(c.unmasking || 0);
  const warn = tier === "mid" || tier === "high" ? "⚠ " : "";
  const label = UNMASK_LABEL[tier];
  // Bar + tier label are generated entirely from code/numbers — safe to inject.
  return (
    `Fame   ${c.fame || 0}\n` +
    `Unmask <span class="unmask unmask--${tier}">${unmaskingBar(c)}</span> ${c.unmasking || 0} ${warn}${label}`
  );
}

/* ---- MASCOT panel (placeholder until T5 fusion/art) ---- */
function renderMascot(model) {
  els.mascot.innerHTML = "";

  const pre = document.createElement("pre");
  pre.className = "mascot-art";
  pre.setAttribute("aria-hidden", "true");

  const caption = document.createElement("p");
  caption.className = "panel__body--muted";

  if (model.mascot && model.mascot.name) {
    pre.textContent = ART[model.mascot.artKeySmall] || ART.blob_small;
    caption.textContent = model.mascot.name;
  } else {
    pre.textContent = ART.blob_small;
    caption.textContent = "awaiting fusion…";
  }

  els.mascot.appendChild(pre);
  els.mascot.appendChild(caption);
}

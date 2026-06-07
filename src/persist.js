/* ============================================================
   MAGICAL.EXE — persist.js  (T10)
   Multi-slot localStorage saves. Each slot is keyed by its name; an
   "active" pointer remembers which slot to resume on reload. The save
   is the MODEL only (never the transient log/ui). A `lastSaved`
   timestamp is added to the stored copy for slot listings.
   ============================================================ */

import { SCHEMA_VERSION } from "./state.js";

const PREFIX = "magicalexe:slot:";
const ACTIVE = "magicalexe:active";
const RECAP = "magicalexe:recap:";
const slotKey = (name) => PREFIX + name;
const recapKey = (name) => RECAP + name;

/* The scrollback (state.log) is deliberately NOT part of the save. To give a returning
   player their bearings, we separately persist a short tail of recent lines per slot and
   replay it on load. Stored as a plain string[] (already formatted for display). */
export function saveRecap(name, lines) {
  try {
    if (!name || !Array.isArray(lines) || !lines.length) return;
    localStorage.setItem(recapKey(name), JSON.stringify(lines.slice(-8)));
  } catch { /* private mode / quota — skip silently */ }
}

export function loadRecap(name) {
  try {
    const raw = name && localStorage.getItem(recapKey(name));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch { return []; }
}

/** Save the model to its own named slot and mark it active. Never throws. */
export function saveModel(model) {
  try {
    const data = { ...model, lastSaved: new Date().toISOString() };
    localStorage.setItem(slotKey(model.saveSlotName), JSON.stringify(data));
    localStorage.setItem(ACTIVE, model.saveSlotName);
    return true;
  } catch (e) {
    console.warn("[persist] save failed:", e);
    return false;
  }
}

/** Load a named slot's model, or null if absent/corrupt/incompatible. */
export function loadSlot(name) {
  try {
    const raw = localStorage.getItem(slotKey(name));
    if (!raw) return null;
    const model = JSON.parse(raw);
    if (!model || typeof model !== "object") return null;
    if (model.schemaVersion !== SCHEMA_VERSION) {
      console.warn(`[persist] slot "${name}" schemaVersion ${model.schemaVersion} != ${SCHEMA_VERSION}; ignoring.`);
      return null;
    }
    return model;
  } catch (e) {
    console.warn("[persist] load failed:", e);
    return null;
  }
}

export function getActiveName() {
  try { return localStorage.getItem(ACTIVE); } catch { return null; }
}

/** Load the most-recently-active slot (used on boot). */
export function loadActive() {
  const name = getActiveName();
  return name ? loadSlot(name) : null;
}

/** List all saved slots with light metadata, newest first. */
export function listSlots() {
  const out = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(PREFIX)) continue;
      try {
        const m = JSON.parse(localStorage.getItem(k));
        if (!m) continue;
        out.push({
          name: m.saveSlotName || k.slice(PREFIX.length),
          day: m.day,
          tier: m.character?.transformationTier,
          who: m.character?.name,
          lastSaved: m.lastSaved || null,
        });
      } catch { /* skip corrupt slot */ }
    }
  } catch (e) {
    console.warn("[persist] list failed:", e);
  }
  out.sort((a, b) => (b.lastSaved || "").localeCompare(a.lastSaved || ""));
  return out;
}

export function hasSlot(name) {
  try { return localStorage.getItem(slotKey(name)) != null; } catch { return false; }
}

export function deleteSlot(name) {
  try {
    localStorage.removeItem(slotKey(name));
    localStorage.removeItem(recapKey(name));
    if (getActiveName() === name) localStorage.removeItem(ACTIVE);
    return true;
  } catch (e) {
    console.warn("[persist] delete failed:", e);
    return false;
  }
}

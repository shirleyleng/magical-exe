/* MAGICAL.EXE — theme registry + persistence (UI preference)
 *
 * Themes are pure CSS token sets (themes.css) selected via a data-theme attribute
 * on <html>. The choice is a UI preference (not part of the game save), so it
 * persists in its own localStorage key and applies across all save slots.
 * Credits for each palette are in themes.css and the in-game about/credits.
 */
// `mode` ("dark" | "light") groups the palettes in the theme picker. Light themes are the
// ones that set --terminal-veil in themes.css (lighten rather than darken the terminal).
export const THEMES = [
  { id: "lipgloss",     name: "Lip Gloss",      note: "Charm homage · deep purple", mode: "dark" },
  { id: "moonlit",      name: "Moonlit",        note: "magical night",              mode: "dark" },
  { id: "phosphor",     name: "Phosphor",       note: "retro green CRT",            mode: "dark" },
  { id: "rosepine",     name: "Rosé Pine",      note: "rosepinetheme.com",          mode: "dark" },
  { id: "cottoncandy",  name: "Cotton Candy",   note: "Compute Cuter · kawaii pastel", mode: "light" },
  { id: "matcha",       name: "Matcha",         note: "cozy cream + sage",          mode: "light" },
  { id: "rosepinedawn", name: "Rosé Pine Dawn", note: "rosepinetheme.com",          mode: "light" },
];

const KEY = "magicalexe.theme";
const DEFAULT = "lipgloss";
const IDS = new Set(THEMES.map((t) => t.id));

export function getStoredTheme() {
  try {
    const v = localStorage.getItem(KEY);
    return IDS.has(v) ? v : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

export function setStoredTheme(id) {
  if (!IDS.has(id)) return;
  try { localStorage.setItem(KEY, id); } catch { /* private mode — apply for the session only */ }
}

export function applyTheme(id) {
  document.documentElement.dataset.theme = IDS.has(id) ? id : DEFAULT;
}

export function themeName(id) {
  const t = THEMES.find((t) => t.id === id);
  return t ? t.name : id;
}

/* ---- text speed (typewriter reveal of new output) ----
   Another UI preference (not part of the save). `cps` = characters revealed per second;
   "instant" disables the typewriter entirely. render.js reads these. */
export const TEXT_SPEEDS = [
  { id: "slow",    name: "Slow",    note: "savour every line", cps: 35 },
  { id: "medium",  name: "Medium",  note: "a steady patter",   cps: 110 },
  { id: "fast",    name: "Fast",    note: "brisk",             cps: 320 },
  { id: "instant", name: "Instant", note: "no animation",      cps: Infinity },
];

const SPEED_KEY = "magicalexe.textspeed";
const SPEED_DEFAULT = "medium";
const SPEED_IDS = new Set(TEXT_SPEEDS.map((s) => s.id));

export function getStoredTextSpeed() {
  try {
    const v = localStorage.getItem(SPEED_KEY);
    return SPEED_IDS.has(v) ? v : SPEED_DEFAULT;
  } catch {
    return SPEED_DEFAULT;
  }
}

export function setStoredTextSpeed(id) {
  if (!SPEED_IDS.has(id)) return;
  try { localStorage.setItem(SPEED_KEY, id); } catch { /* private mode — session only */ }
}

export function textSpeedName(id) {
  const s = TEXT_SPEEDS.find((s) => s.id === id);
  return s ? s.name : id;
}

export function textSpeedCps(id) {
  const s = TEXT_SPEEDS.find((s) => s.id === id);
  return s ? s.cps : Infinity;
}

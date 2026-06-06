/* MAGICAL.EXE — theme registry + persistence (UI preference)
 *
 * Themes are pure CSS token sets (themes.css) selected via a data-theme attribute
 * on <html>. The choice is a UI preference (not part of the game save), so it
 * persists in its own localStorage key and applies across all save slots.
 * Credits for each palette are in themes.css and the in-game about/credits.
 */
export const THEMES = [
  { id: "lipgloss",     name: "Lip Gloss",      note: "Charm homage · deep purple" },
  { id: "cottoncandy",  name: "Cotton Candy",   note: "Compute Cuter · kawaii pastel" },
  { id: "moonlit",      name: "Moonlit",        note: "magical-girl night" },
  { id: "matcha",       name: "Matcha",         note: "cozy cream + sage" },
  { id: "phosphor",     name: "Phosphor",       note: "retro green CRT" },
  { id: "rosepine",     name: "Rosé Pine",      note: "rosepinetheme.com · dark" },
  { id: "rosepinedawn", name: "Rosé Pine Dawn", note: "rosepinetheme.com · light" },
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

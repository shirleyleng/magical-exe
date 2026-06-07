/* ============================================================
   MAGICAL.EXE — version.js  (T21)
   Single source of truth for the displayed version + repo link. Bump
   VERSION on each release. The per-deploy BUILD stamp is injected into
   config.js at deploy time (scripts/build-config.js → CONFIG.meta.buildStamp);
   read it via buildStamp() so a local/dev build degrades gracefully.
   ============================================================ */

import { CONFIG } from "../config.js";

export const VERSION = "1.0.0";
export const REPO_URL = "https://github.com/shirleyleng/magical-exe";

/** The deploy build stamp, or null for a local/dev build (placeholder unsubstituted). */
export function buildStamp() {
  const s = CONFIG.meta && CONFIG.meta.buildStamp;
  if (!s || s === "__BUILD_STAMP__" || s === "dev") return null;
  return s;
}

/** Short label for the titlebar, e.g. "v1.0.0". */
export function versionLabel() {
  return `v${VERSION}`;
}

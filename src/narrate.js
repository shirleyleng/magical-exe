/* MAGICAL.EXE — narration helper (T12, PROMPTS.md C)
 *
 * Narration is FLAVOR for what the engine already decided — it never changes
 * truth. requestNarration sets a deferred "narrate" AI effect (run by main.js);
 * the resulting prose is appended after the scene's deterministic lines by
 * update.js > onAIResult("narrate"). It blocks input briefly (ui.busy) so the
 * prose lands in order, and is only used on infrequent beats (new rooms, fight
 * outcomes). Silently no-ops when AI is unavailable -> deterministic-only play.
 */
import { aiAvailable } from "./ai.js";

export function requestNarration(state, { scene, resolved, mood }) {
  if (!aiAvailable()) return;
  if (state.ui.effect) return; // don't clobber a pending effect (e.g. a load)
  const p = (state.model.character && state.model.character.pronouns) || {};
  const pronouns = `${p.subj || "they"}/${p.obj || "them"}/${p.poss || "their"}`;
  state.ui.effect = { type: "ai", kind: "narrate", vars: { pronouns, scene, resolved, mood } };
  state.ui.busy = true;
}

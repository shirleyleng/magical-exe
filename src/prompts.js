/* ============================================================
   MAGICAL.EXE — prompts.js
   Rotating, context-aware example prompts shown near the input. This
   is how players discover available commands (and, later, that the
   freeform-AI feature exists). One list per mode; render rotates by
   the turn counter.
   ============================================================ */

export const EXAMPLE_PROMPTS = {
  hub: [
    "train power",
    "train hp",
    "rest",
    "status",
    "shop",
    "/help",
  ],
  exploration: [
    "north",
    "look",
    "take the dew vial",
    "examine the door",
    "inventory",
    "rest",
  ],
  combat: [
    "attack",
    "guard",
    "use light bolt",
    "throw sand in its eyes",
    "status",
  ],
};

/** Pick the example for the current mode + turn. */
export function exampleFor(mode, turn = 0) {
  const list = EXAMPLE_PROMPTS[mode] || EXAMPLE_PROMPTS.hub;
  return list[turn % list.length];
}

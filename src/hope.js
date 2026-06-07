/* ----------------------------------------------------------------------------
   hope.js — the hidden Hope tally (DESIGN §9.5, T19).

   Hope is the secret accumulator that (with the Virtue/Corruption path and Fame)
   decides the ending. It is NEVER shown as a number — the player only feels the
   city's mood drift across coarse bands. Errands are the main source; bosses and
   (later) dilemma events also feed it. The only mutator is adjustHope().

   Side-effect-free helpers over the character object.
   ---------------------------------------------------------------------------- */

/** Apply a hope change (can be negative). Floors at 0; no upper cap. Returns the
    actual delta applied. Callers must NOT surface the number — hope stays hidden. */
export function adjustHope(ch, delta = 0) {
  const before = ch.hopeTally || 0;
  ch.hopeTally = Math.max(0, before + delta);
  return ch.hopeTally - before;
}

/* Coarse mood bands — the only signal the player gets, and deliberately vague so
   the hidden number can't be reverse-engineered (you feel the trend, not the value). */
export function hopeBand(h = 0) {
  if (h <= 0) return 0;
  if (h < 15) return 1;
  if (h < 30) return 2;
  if (h < 50) return 3;
  return 4;
}

const MOOD_LINES = [
  "The city feels grey and far away lately — everyone moving with their eyes down and their collars up, as if bad weather were a thing you could outwalk.",
  "Here and there a light stays on a little longer than it has to. A curtain twitches. Someone hums, badly, on a stairwell. Small things. But you've started noticing them.",
  "People nod to each other on the street again — strangers, even. Hold a door. Say the spare kind word they used to swallow. It isn't much. It is very much not nothing.",
  "There's a warmth moving through the city these days, low and steady as a pilot light. You can feel folks letting themselves want things again, out loud.",
  "The whole city leans toward the light now, the way a room full of plants turns to a window — like it has remembered, all at once, how to believe in the morning.",
];

/** Ambient city-mood line for the current hope band (the "felt" trend). */
export function hopeMoodLine(ch) {
  return MOOD_LINES[hopeBand(ch.hopeTally || 0)];
}

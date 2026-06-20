/* ----------------------------------------------------------------------------
   rivaltalk.js — talking with Sable (DESIGN §8, T20).

   Sable's encounters used to be one-way: she'd say her piece and the scene closed.
   Now, after the challenge duel and after the return scene, she LINGERS and you can
   actually talk to her until you say "leave" (or take another action). It's a
   HYBRID dialogue: a handful of authored topics (deterministic, in her voice, and
   lore-safe — the corruption hint stays exactly as canon intends) plus free-text
   that routes to the AI narrator wearing a tightly-bounded "Sable" persona. As ever
   the AI only adds flavor; nothing here changes game truth.

   Flow: beginRivalTalk() drops you into talk mode (model.rivalTalk). update.js
   intercepts input while it's active → handleRivalTalk() answers (a topic, or an
   AI effect), and endRivalTalk() closes the scene. Free-text degrades to a curated
   deflection when the AI is off.
   ---------------------------------------------------------------------------- */
import { pushLine } from "./state.js";
import { aiAvailable } from "./ai.js";

/* Authored topics, per scene. `keys` are matched as substrings of the lowercased
   input (cheap intent match before we ever spend an AI call). `answer` is Sable's
   own voice — clipped, dry, a near-smile she'd never admit to. */
const TOPICS = {
  challenge: [
    { id: "name", keys: ["your name", "who are you", "what's your name", "whats your name", "introduce"],
      answer: `"Sable. That's all you get for now — names are cheap and I'm not in the habit of handing things out cheap."` },
    { id: "why", keys: ["what do you want", "why challenge", "why are you here", "why me", "what's this about", "whats this about", "your deal", "point of this"],
      answer: `"What do I want? To see if the whispers are worth the breath. The city's been saying your name like it means something. I needed to know if it does — and now I do. Don't let it go to your head."` },
    { id: "alliance", keys: ["alliance", "are you with", "same side", "team", "work for"],
      answer: `"Same alliance as you, before you get ideas about us being enemies. Doesn't mean I'll go easy. The ones who'll actually have your back are the ones who'll also knock you down in training — remember that."` },
    { id: "corruption", keys: ["corruption", "the grey", "the dark", "monsters", "enemy"],
      answer: `"The corruption?" A shrug, a little too careless. "Fight it, win, don't die. That's the briefing version. …Ask me again sometime when you've earned a longer answer."` },
    { id: "rematch", keys: ["again", "rematch", "next time", "come back", "see you", "fight again"],
      answer: `"Oh, I'll be back. Count on it. Next time I won't be measuring — I'll be trying. Be ready, or don't bother showing up."` },
  ],
  return: [
    { id: "corruption", keys: ["corruption", "the grey", "the truth", "real story", "whole shape", "not telling", "aren't they telling", "arent they telling", "lying", "the story"],
      answer: `"All I'll say — and it's already more than I should — is that the corruption isn't a weed you pull. It's older than the briefings, and it wants something, and the people who hand you your orders either don't know that or don't want you to. Your mascot's not lying to you. They just don't have the whole shape of it. Neither do I. But I've seen enough of the edges to know the picture's wrong."` },
    { id: "seen", keys: ["what have you seen", "what did you see", "seen", "edges", "out there", "where were you"],
      answer: `"Things that didn't match the map. A 'cleared' district that went quiet wrong. Grey that moved like it was listening. I don't have it all — I've just learned to trust the part of me that says 'that's not right' over the part of me that wants the simple version. You should too."` },
    { id: "why", keys: ["why warn", "why tell me", "why trust", "why me", "why are you", "why bother", "trust you", "trust me"],
      answer: `"Why you?" She actually meets your eye for a second. "Because you got strong without getting stupid, which is rarer than it sounds. And because if I'm right about any of this, I'd rather not be the only one who is. That's not sentiment. That's strategy. …Mostly."` },
    { id: "alliance", keys: ["alliance", "higher up", "people higher", "your bosses", "the people", "in charge", "report"],
      answer: `"I'm still alliance. I'm not telling you to burn it down — it's the only thing standing between this city and worse. I'm telling you to keep your eyes open inside it. Loyalty and obedience aren't the same word, whatever they'd like you to think."` },
    { id: "friends", keys: ["friends", "are we", "what are we", "like me", "care", "together", "side by side"],
      answer: `"Friends." She tries the word out like it doesn't quite fit, then almost — almost — smiles. "Let's say… I'd be annoyed if something happened to you. Put it that way and I won't have to deny it later."` },
    { id: "rematch", keys: ["again", "rematch", "next time", "come back", "fight again", "spar", "duel"],
      answer: `"Soft? Hardly. I'll still come for you — somebody's got to keep you sharp, and clearly it's going to have to be me. Just… maybe now we both know it's not really about winning."` },
  ],
};

/* A few curated deflections for when the AI is unavailable (or garbles) — Sable
   sidestepping in character, so free-text never dead-ends. Index varies by turn. */
const DEFLECTIONS = [
  `She tilts her head, weighing you. "That's not a today question. Ask me something I'm willing to answer."`,
  `A dry almost-laugh. "Fishing. I respect it. But no."`,
  `"Mm. You'll have to earn that one." She doesn't elaborate.`,
  `"Careful. Keep asking the sharp questions and I might start thinking you're serious about this."`,
];

const GOODBYE = new Set([
  "bye", "goodbye", "good bye", "done", "nothing", "no", "nope", "nevermind", "never mind",
  "later", "see you", "thats all", "that's all", "im done", "i'm done", "enough", "go away",
]);

/** Open talk mode after a Sable scene. `scene` is "challenge" or "return". */
export function beginRivalTalk(state, scene) {
  state.model.rivalTalk = { active: true, scene, asked: [] };
  surfaceTalkPrompt(state, scene);
  return state;
}

/** True if input should END the conversation outright (a goodbye / "leave"). */
export function isRivalTalkExit(raw, cmd) {
  const lower = raw.trim().toLowerCase();
  if (GOODBYE.has(lower)) return true;
  return !!(cmd && cmd.matched && cmd.verb === "retreat"); // leave/go/home/flee
}

/* The lingering prompt — what you can ask, and how to go. Tailored per scene. */
function surfaceTalkPrompt(state, scene) {
  const hint = scene === "return"
    ? "the corruption · what she's seen · why she trusts you · the alliance"
    : "who she is · why she came · the alliance";
  pushLine(state, "—", "hint");
  pushLine(state, "Sable doesn't leave. She leans back against the gate, in no particular hurry, waiting to see what you'll do with the moment.", "system");
  pushLine(state, `(You can talk to her — try: ${hint} — or just say what's on your mind. Say leave when you're done.)`, "hint");
}

/** Handle a line of input while in talk mode: a topic, or a free-text AI reply.
    (Exit/leave and real commands are handled upstream in update.js.) */
export function handleRivalTalk(state, raw) {
  const scene = state.model.rivalTalk.scene;
  const pool = TOPICS[scene] || [];
  const lower = raw.trim().toLowerCase();

  // 1) Authored topic? (deterministic, lore-safe, no AI spend.)
  const topic = pool.find((t) => t.keys.some((k) => lower.includes(k)));
  if (topic) {
    if (!state.model.rivalTalk.asked.includes(topic.id)) state.model.rivalTalk.asked.push(topic.id);
    pushLine(state, topic.answer, "mascot");
    return state;
  }

  // 2) Free-text → the bounded "Sable" AI persona, if available.
  if (aiAvailable() && !state.ui.effect) {
    const p = (state.model.character && state.model.character.pronouns) || {};
    state.ui.effect = {
      type: "ai", kind: "dialogue", raw,
      vars: {
        pronouns: `${p.subj || "they"}/${p.obj || "them"}/${p.poss || "their"}`,
        scene,
        question: raw,
        fallback: DEFLECTIONS[(state.ui.turn || 0) % DEFLECTIONS.length],
      },
    };
    state.ui.busy = true;
    pushLine(state, "(Sable considers…)", "hint");
    return state;
  }

  // 3) AI off → a curated in-character deflection.
  pushLine(state, DEFLECTIONS[(state.ui.turn || 0) % DEFLECTIONS.length], "mascot");
  return state;
}

/** Close the conversation. `opts.silent` skips the parting line (used when the
    player breaks off by taking another action). */
export function endRivalTalk(state, opts = {}) {
  const scene = state.model.rivalTalk && state.model.rivalTalk.scene;
  state.model.rivalTalk = null;
  if (opts.silent) return state;
  const line = scene === "return"
    ? `"Good talk. Don't go soft on me." Sable pushes off the gate and is gone into the evening, the way she always is — there one moment, a rumor the next.`
    : `"That's enough chatter. Go be impressive somewhere." Sable smirks, turns on her heel, and melts back into the dark before you can get the last word.`;
  pushLine(state, line, "mascot");
  return state;
}

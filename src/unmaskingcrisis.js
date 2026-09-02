/* ----------------------------------------------------------------------------
   unmaskingcrisis.js — the high-Unmasking reveal-or-hide fork (DESIGN §3, T20).

   The escalating heat events (visibility.js) culminate, the first time Unmasking
   crosses `high`, in a forced story crisis: someone is in danger out in the open,
   and the only thing that saves them is YOU, working magic where the whole city
   can see. The mask, or the person. You can't keep both — not cleanly.

   Like dilemmas.js this is a one-shot, deterministic, menu-driven push event
   (no AI). visibility.js arms it (character.pendingUnmaskingCrisis); update.js's
   afterCombat surfaces the menu the moment you're safely back at the hub — never
   mid-combat. Latched in flags.unmaskingCrisisSeen so it only ever happens once.

   The branches feed the finale: REVEAL pumps Fame, which lowers the hope you'll
   need at the brink (endgame.js effHopeThreshold). STAY HIDDEN keeps you the
   hidden hero — secret intact, harder gate. The path-gated third option lets a
   committed virtuous/corrupt player keep BOTH, at a fitting cost.
   ---------------------------------------------------------------------------- */
import { CONFIG } from "../config.js";
import { pushLine } from "./state.js";
import { adjustHope } from "./hope.js";
import { adjustAlignment } from "./alignment.js";
import { adjustVisibility, relaxUnmasking } from "./visibility.js";
import { track } from "./analytics.js";

/* The scene. A public square, a person about to be hurt, witnesses everywhere —
   and your unmasked, ordinary self too far away to matter. Only the magic reaches. */
const SETUP = [
  "You barely make it back to the square before it happens. A snarl of grey — the leftover spite of the thing you just put down — coils up out of a storm drain and goes for the nearest warm thing it can find: a girl, maybe nine, frozen at the kerb with a balloon string still looped around her wrist.",
  "There's no alley to duck into. No heartbeat to spare. Half the market is watching — phones already up, faces already turning — and the only thing in reach that can stop it is the part of you that you have spent this whole time keeping secret.",
  "Save her, and they all see exactly who you are. The mask comes off in front of the whole city. There's no taking that back.",
];

/* Each branch's deltas are applied through the proper mutators; only `outcome`
   and the mechanical follow-ups print. Tone: weighty, a little sad — never smug. */

/** Surface the pending crisis IF the moment is safe (back at the hub, no menu up).
    Called from update.js afterCombat after every command; a no-op unless armed. */
export function maybeUnmaskingCrisis(state) {
  const model = state.model;
  const ch = model.character;
  if (!ch.pendingUnmaskingCrisis) return state;
  if (model.mode !== "hub") return state;                  // never mid-combat / mid-dungeon
  if (model.rivalTalk && model.rivalTalk.active) return state; // wait out a Sable conversation
  if (state.ui.menu && state.ui.menu.active) return state; // wait for an open menu (e.g. a dilemma) to clear
  // Already resolved once? (belt-and-suspenders) — drop the stale arm and move on.
  if (model.world.flags.unmaskingCrisisSeen) { ch.pendingUnmaskingCrisis = false; return state; }

  ch.pendingUnmaskingCrisis = false;
  pushLine(state, "—", "hint");
  for (const line of SETUP) pushLine(state, line, "system");

  const options = [
    { label: "Tear off the mask and save her in the open", value: "reveal" },
    { label: "Save her quietly — protect your secret", value: "hide" },
  ];
  // Path-gated third way: a committed alignment can keep BOTH, at a cost in kind.
  if (ch.path === "virtuous") {
    options.push({ label: "Save her, then gently cloud the crowd's memory", value: "cloud" });
  } else if (ch.path === "corrupt") {
    options.push({ label: "Save her, then silence every witness", value: "silence" });
  }

  state.ui.menu = { active: true, kind: "unmaskingcrisis", options, index: 0 };
  return state;
}

/** Apply the chosen branch. Latches the crisis as seen no matter what. */
export function resolveUnmaskingCrisis(state, choice) {
  const model = state.model;
  const ch = model.character;
  const C = CONFIG.unmaskingCrisis || {};
  model.world.flags.unmaskingCrisisSeen = true; // one-shot, regardless of choice

  track("unmasking_crisis_pick", {
    choice,
    day: model.day,
    path: ch.path,
    fame: ch.fame || 0,
    unmasking: ch.unmasking || 0,
  });
  if (choice === "reveal") return doReveal(state, ch, C);
  if (choice === "cloud") return doCloud(state, ch, C);
  if (choice === "silence") return doSilence(state, ch, C);
  return doHide(state, ch, C); // default / "hide"
}

/* ---- REVEAL: the one-way door. Big Fame, +hope, identity public forever. ---- */
function doReveal(state, ch, C) {
  const cfg = C.reveal || {};
  const fame = (CONFIG.axes.fame.gainSaveCivilian || 0) + (cfg.revealFameBonus || 0);
  const d = adjustVisibility(ch, { fame });
  adjustHope(ch, cfg.hope || 0);

  ch.identityRevealed = true;   // permanent — heat stops mattering (visibility.js short-circuits)
  ch.mustLieLow = false;        // nothing left to lie low about
  state.model.hub.pendingDamageControl = false; // no tracks left to cover

  pushLine(state, "You stop reaching for a story to hide behind. You just step into the light and let it come — all of it, all at once, the way it was always going to. The grey doesn't stand a chance against something that has finally stopped being afraid of being seen.", "system");
  pushLine(state, "The girl is fine. The balloon, improbably, is fine. And a whole market full of people lowers their phones and just looks at you — not at a rumour, not at a smudged tabloid sketch, but at you, knowing your face now, knowing your name by tomorrow. There's a cost to that you'll be paying for the rest of your life. You find you don't regret it.", "system");
  pushLine(state, `The city has its hero, out in the open at last. (+${d.fame} Fame · your secret is spent)`, "banner");
  return state;
}

/* ---- STAY HIDDEN: saved quietly, at a cost. The hidden-hero path. ---- */
function doHide(state, ch, C) {
  const cfg = C.hide || {};
  adjustHope(ch, cfg.hope || 0);
  const d = adjustVisibility(ch, { unmasking: -(cfg.unmaskingShed || 0) });
  relaxUnmasking(state); // re-arm dropped tiers; lifts mustLieLow only once below mid

  pushLine(state, "You do it the hard way — the small way. A flicker of power so thin and quick that afterwards no one's quite sure what they saw: a trick of the light, a lucky gust, the way the grey just seemed to lose its nerve and go. The girl is safe and never knows how close it was.", "system");
  pushLine(state, "You're already gone before the crowd thinks to look for someone to thank. It's the right call. You tell yourself that, slipping back into the shadows where it's safe — and try not to notice how much quieter it is in here, how no one will ever know this was you. Some heroes don't get a face. You chose that. You can choose it again tomorrow.", "system");
  if (d.unmasking) pushLine(state, `You melt back into anonymity. (${d.unmasking} Unmasking · the secret holds)`, "hint");
  return state;
}

/* ---- CLOUD (virtuous): keep both, kindly — it drains your magic (Spirit). ---- */
function doCloud(state, ch, C) {
  const cfg = C.cloud || {};
  adjustHope(ch, cfg.hope || 0);
  const d = adjustVisibility(ch, { unmasking: -(cfg.unmaskingShed || 0) });
  relaxUnmasking(state);
  const cost = cfg.spiritCost || 0;
  const before = ch.stats.spirit || 0;
  ch.stats.spirit = Math.max(1, before - cost); // a real, lasting tithe of your strength
  const spent = before - ch.stats.spirit;

  pushLine(state, "You save her first — that part isn't in question. Then you do the gentler, harder thing: you move through the crowd touching the edges of what they just saw, the way you'd smooth a crease from a bedsheet, and let the memory go soft and forgettable. No one is harmed. No one even knows to be grateful. They'll remember a near-miss and a kind stranger and nothing they could point to.", "system");
  pushLine(state, "It works. It always works. But unwriting a thing from someone's mind takes the same magic you'd use to light it up, and that magic doesn't come back the way Stamina does — it leaves a little less of you behind each time, a candle spending itself to keep a room dark.", "system");
  if (spent) pushLine(state, `The secret holds, and the city is kinder for it — but it cost you. (−${spent} Spirit · ${d.unmasking} Unmasking)`, "hint");
  return state;
}

/* ---- SILENCE (corrupt): keep both, by force — conspicuous and dark. ---- */
function doSilence(state, ch, C) {
  const cfg = C.silence || {};
  adjustAlignment(ch, { corruption: cfg.corruption || 0 });
  adjustHope(ch, cfg.hope || 0);
  // Note the SIGN: silencing witnesses is heavy-handed dark power — it RAISES heat
  // even as it buys this round's secrecy. A conspicuous way to stay hidden.
  const d = adjustVisibility(ch, { unmasking: cfg.unmasking || 0 });

  pushLine(state, "You save her — and then you reach into every watching mind in the square and simply press down, hard, until the seeing stops. Not softened. Not smoothed. Stopped. A dozen people blink and find a gap where a moment used to be, and some of them will wake at three in the morning for weeks with their hearts pounding and no idea why.", "system");
  pushLine(state, "The secret holds. Of course it holds — you made it hold. But power used like that doesn't tidy itself away; it leaves fingerprints, on them and on you, and the part of the city that pays attention to the wrong kind of thing has just felt something cold move through it and turned, slowly, to look.", "system");
  pushLine(state, `Your name stays your own — by force. (+${cfg.corruption || 0} Corruption · +${d.unmasking} Unmasking)`, "banner");
  return state;
}

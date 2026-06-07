// MAGICAL.EXE — T11: AI proxy Edge Function (Deno)
//
// The ONLY thing in the system that holds the Anthropic key. The browser calls this
// function (never Anthropic directly). Responsibilities, in order:
//   1. CORS preflight.
//   2. Validate the caller's Supabase JWT -> anonymous user id.
//   3. Enforce, SERVER-SIDE, from the ai_config table: kill switch, global daily cap,
//      per-session daily cap. Over any limit -> HTTP 200 { ok:false, reason } so the
//      game degrades gracefully to deterministic-only (NEVER a 4xx/5xx the client must
//      treat as a crash).
//   4. Assemble the prompt from `kind` (T11 implements `ping` only; T12/T13 add the rest),
//      call Claude Haiku 4.5 with prompt caching on the static system prompt.
//   5. Log the call to ai_usage (also how the daily counters are computed).
//
// Secrets/env (set by Supabase automatically, except ANTHROPIC_API_KEY and
// CLOUDFLARE_TURNSTILE_SECRET which you set via `supabase secrets set`):
// SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, CLOUDFLARE_TURNSTILE_SECRET.
//
// T11b — human-verification gate (Cloudflare Turnstile, "Option B"). What actually costs
// money is the Anthropic call below; minting an anon JWT is free. So we gate the SPEND,
// not the auth: before the first PAID call for a given user we require a Turnstile token,
// verify it with Cloudflare, and record the user in `verified_humans`. Later calls skip
// the check (one CAPTCHA per browser). `ping` is exempt — it's a trivial-cost connectivity
// probe (used by ai-test.html), still bounded by the daily caps + kill switch. A missing or
// failed token returns HTTP 200 { ok:false, reason:"captcha" } so the client degrades to
// deterministic-only and re-prompts for a token, never a crash.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

// Origins allowed to call the function. Add your deployed domain in T21.
const ALLOWED_ORIGINS = new Set([
  "http://localhost:4321",
  "http://127.0.0.1:4321",
]);

function corsHeaders(origin: string | null): Record<string, string> {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : "http://localhost:4321";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, content-type, apikey",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

// Prompt assembly lives server-side so the prompt is identical for every user and
// players can't tamper with it. The static system text gets cache_control: ephemeral
// (a no-op at our prompt sizes — Haiku 4.5's min cacheable prefix is 4096 tokens and
// ours are far smaller — but harmless and future-proof). System prompts are verbatim
// from docs/PROMPTS.md. T11 shipped `ping`; T12 added parse (A) / narrate (C) / city (E);
// T13 adds the combat plausibility judge (B).
const CC = { type: "ephemeral" } as const;

const SYS_PARSE =
  `You are the input parser for a text game. Convert the player's free text into ONE\n` +
  `structured action drawn ONLY from the allowed actions for the current context. Do not\n` +
  `invent actions, items, places, or entities. If the input doesn't map to any allowed\n` +
  `action, return {"action":"unknown","reason":"<short reason>"}.\n\n` +
  `Return ONLY a JSON object. No preamble, no markdown, no backticks.\n\n` +
  `Schema:\n` +
  `{ "action": "<one of the allowed action names>",\n` +
  `  "target": "<entity id from the provided lists, or null>",\n` +
  `  "modifier": "<optional short string, or null>" }\n\n` +
  `Context you will be given each turn:\n` +
  `- mode: "hub" | "exploration" | "combat"\n` +
  `- allowedActions: [ ... ]      // the only legal action names this turn\n` +
  `- presentEntities: [ ... ]     // items/monsters/NPCs/exits the player can refer to\n` +
  `Only use ids that appear in allowedActions / presentEntities.`;

const SYS_NARRATE =
  `You are the narrator of a cozy-but-earnest magical-girl text game. Write 1-3 sentences of\n` +
  `vivid, warm prose describing the OUTCOME you are given. Do NOT invent new events, items, or\n` +
  `results beyond what is provided. Match the player's pronouns and the scene's mood. Keep it\n` +
  `tight and evocative, never purple. Second person ("you").\n` +
  `Output plain prose only — no markdown, headings, titles, or quotation marks around it.`;

const SYS_JUDGE =
  `You are the physics/plausibility judge for a magical-girl text game's combat. The player\n` +
  `proposes a creative action. Decide if it is PLAUSIBLE given the environment tags and the\n` +
  `player's current abilities. Approve grounded, clever uses of the environment. Reject\n` +
  `anything that requires powers the player does not have or that breaks the world's rules.\n\n` +
  `Guidelines:\n` +
  `- Approve: using the environment sensibly (throw sand to blind, kick a rock, use water to\n` +
  `  douse flame, hide behind cover). Effects are MINOR to MODERATE, short-lived.\n` +
  `- Reject: inventing new powers (teleport, dimension doors, instant kills, summoning),\n` +
  `  affecting things not present, or anything that trivializes the fight.\n` +
  `- If the action is "forbidden/dark" in flavor (drawing on corruption), approve it but set\n` +
  `  "corruptionCost" > 0.\n` +
  `- You judge plausibility and propose an effect TYPE and MAGNITUDE only. You do NOT set\n` +
  `  damage numbers, hit/miss, or final stats — the engine does that.\n\n` +
  `Return ONLY JSON, no prose, no backticks:\n` +
  `{ "approved": true|false,\n` +
  `  "reason": "<one short sentence, shown to player>",\n` +
  `  "effect": "<none|blind|stagger|slow|expose|defend|burn|douse|distract>",\n` +
  `  "target": "<self|enemy>",\n` +
  `  "turns": <int 0-2>,\n` +
  `  "magnitude": "<minor|moderate>",\n` +
  `  "corruptionCost": <int, 0 if not forbidden> }\n\n` +
  `Examples:\n` +
  `- tags ["beach","sand"], action "throw sand in its eyes"\n` +
  `  -> {"approved":true,"reason":"You fling a handful of sand into its eyes.","effect":"blind","target":"enemy","turns":1,"magnitude":"minor","corruptionCost":0}\n` +
  `- tags ["forest"], action "open a dimension door to eject the monster"\n` +
  `  -> {"approved":false,"reason":"You don't have that power... yet.","effect":"none","target":"enemy","turns":0,"magnitude":"minor","corruptionCost":0}\n` +
  `- tags ["any"], action "drain its life with forbidden magic"\n` +
  `  -> {"approved":true,"reason":"Dark threads coil from your hand — it costs you.","effect":"stagger","target":"enemy","turns":1,"magnitude":"moderate","corruptionCost":8}\n` +
  `- tags ["cave","dark"], action "instantly kill it"\n` +
  `  -> {"approved":false,"reason":"There's no shortcut here.","effect":"none","target":"enemy","turns":0,"magnitude":"minor","corruptionCost":0}`;

const SYS_CITY =
  `Write 2-4 cozy, atmospheric sentences introducing a player's hometown for a magical-girl\n` +
  `game. You may use the city's name and general vibe, but DO NOT assert specific factual\n` +
  `claims (exact landmarks, population, real streets) as if verified. Keep it warm, slightly\n` +
  `nostalgic, evocative of an ordinary life about to change. Second person.\n` +
  `Output plain prose only — no markdown, no headings, and do NOT title it with the city name.`;

function asText(v: unknown): string {
  return v == null ? "" : String(v);
}

// Verify a Cloudflare Turnstile token. Returns true only on a confirmed human. Any
// network/parse failure returns false (fail-closed: an unverifiable token is not a pass).
async function verifyTurnstile(token: string, remoteip: string | null): Promise<boolean> {
  const secret = Deno.env.get("CLOUDFLARE_TURNSTILE_SECRET");
  if (!secret || !token) return false;
  try {
    const form = new URLSearchParams({ secret, response: token });
    if (remoteip) form.set("remoteip", remoteip);
    const res = await fetch(TURNSTILE_VERIFY_URL, { method: "POST", body: form });
    const data = await res.json().catch(() => null);
    return data?.success === true;
  } catch (e) {
    console.error("turnstile verify failed", e);
    return false;
  }
}

function buildPayload(kind: string, vars: Record<string, unknown>, model: string) {
  switch (kind) {
    case "ping":
      return {
        model,
        max_tokens: 64,
        system: [
          {
            type: "text",
            text:
              "You are a connectivity test for a text game. Reply with ONLY this exact " +
              'JSON and nothing else: {"pong":true}',
            cache_control: CC,
          },
        ],
        messages: [{ role: "user", content: "ping" }],
      };

    case "parse": {
      const user =
        `mode: ${asText(vars.mode)}\n` +
        `allowedActions: ${JSON.stringify(vars.allowedActions ?? [])}\n` +
        `presentEntities: ${JSON.stringify(vars.presentEntities ?? [])}\n` +
        `playerInput: ${JSON.stringify(asText(vars.rawText))}`;
      return {
        model,
        max_tokens: 200,
        system: [{ type: "text", text: SYS_PARSE, cache_control: CC }],
        messages: [{ role: "user", content: user }],
      };
    }

    case "narrate": {
      const user =
        `pronouns: ${asText(vars.pronouns)}\n` +
        `scene: ${asText(vars.scene)}\n` +
        `resolved: ${asText(vars.resolved)}\n` +
        `mood: ${asText(vars.mood)}`;
      return {
        model,
        max_tokens: 200,
        system: [{ type: "text", text: SYS_NARRATE, cache_control: CC }],
        messages: [{ role: "user", content: user }],
      };
    }

    case "judge": {
      const user =
        `environmentTags: ${JSON.stringify(vars.environmentTags ?? [])}\n` +
        `playerAbilities: ${JSON.stringify(vars.abilities ?? [])}\n` +
        `playerTier: ${asText(vars.transformationTier)}\n` +
        `enemy: ${asText(vars.enemyName)}\n` +
        `action: ${JSON.stringify(asText(vars.rawText))}`;
      return {
        model,
        max_tokens: 200,
        system: [{ type: "text", text: SYS_JUDGE, cache_control: CC }],
        messages: [{ role: "user", content: user }],
      };
    }

    case "city": {
      const user =
        `city: ${JSON.stringify(asText(vars.cityName))}, occupation: ${asText(vars.occupation)}`;
      return {
        model,
        max_tokens: 250,
        system: [{ type: "text", text: SYS_CITY, cache_control: CC }],
        messages: [{ role: "user", content: user }],
      };
    }

    default:
      return null; // unknown kind -> 400
  }
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get("origin"));
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "content-type": "application/json" },
    });

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, reason: "method" }, 405);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // 2. Validate the JWT -> a real anonymous user (rejects anon-key-only callers).
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
  if (userErr || !userData?.user) return json({ ok: false, reason: "auth" }, 401);
  const userId = userData.user.id;

  // Parse the request body once here — the human gate needs `kind` (to exempt ping) and
  // `captchaToken`; step 4 reuses the same `kind`/`vars`.
  const body = await req.json().catch(() => null);
  const kind = typeof body?.kind === "string" ? body.kind : "";
  const vars = (body?.vars ?? {}) as Record<string, unknown>;

  // 2b. Human-verification gate (T11b, Option B). Skip ping (cheap probe). For any PAID
  // kind, if this user hasn't been verified yet, require + verify a Turnstile token and
  // record them. Stays a soft, graceful gate: failure -> 200 { ok:false, reason:"captcha" }.
  if (kind !== "ping") {
    const { data: human } = await admin
      .from("verified_humans").select("user_id").eq("user_id", userId).maybeSingle();
    if (!human) {
      const token = asText(body?.captchaToken);
      const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for");
      const ok = await verifyTurnstile(token, ip);
      if (!ok) return json({ ok: false, reason: "captcha" });
      // Idempotent: concurrent first calls race harmlessly on the primary key.
      await admin.from("verified_humans")
        .upsert({ user_id: userId }, { onConflict: "user_id" });
    }
  }

  // 3a. Kill switch.
  const { data: cfg, error: cfgErr } = await admin
    .from("ai_config").select("*").eq("id", 1).single();
  if (cfgErr || !cfg) return json({ ok: false, reason: "config" }, 200);
  if (cfg.kill_switch_enabled) return json({ ok: false, reason: "resting" });

  // 3b/3c. Daily caps (UTC day boundary). Counted BEFORE the call — caps are soft
  // ceilings; a small concurrent overshoot is fine and far cheaper than the alternative.
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const sinceISO = dayStart.toISOString();

  const { count: globalCount } = await admin
    .from("ai_usage").select("*", { count: "exact", head: true })
    .gte("created_at", sinceISO);
  if ((globalCount ?? 0) >= cfg.global_daily_call_cap) {
    return json({ ok: false, reason: "resting" });
  }

  const { count: userCount } = await admin
    .from("ai_usage").select("*", { count: "exact", head: true })
    .eq("user_id", userId).gte("created_at", sinceISO);
  if ((userCount ?? 0) >= cfg.anon_daily_call_cap) {
    return json({ ok: false, reason: "limit" });
  }

  // 4. Build + call (kind/vars parsed above).
  const payload = buildPayload(kind, vars, cfg.model);
  if (!payload) return json({ ok: false, reason: "unknown_kind" }, 400);

  let aData: any;
  try {
    const aRes = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
        "anthropic-version": ANTHROPIC_VERSION,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!aRes.ok) {
      console.error("anthropic error", aRes.status, await aRes.text());
      return json({ ok: false, reason: "upstream" }); // degrade gracefully
    }
    aData = await aRes.json();
  } catch (e) {
    console.error("anthropic fetch failed", e);
    return json({ ok: false, reason: "upstream" });
  }

  // 5. Log usage (drives the counters; lets you watch token cost in the dashboard).
  const u = aData.usage ?? {};
  await admin.from("ai_usage").insert({
    user_id: userId,
    kind,
    input_tokens: u.input_tokens ?? 0,
    output_tokens: u.output_tokens ?? 0,
    cache_read_tokens: u.cache_read_input_tokens ?? 0,
  });

  const text = (aData.content ?? [])
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("");

  return json({ ok: true, kind, text, usage: u });
});

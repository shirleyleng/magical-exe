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
// Secrets/env (set by Supabase automatically, except ANTHROPIC_API_KEY which you set via
// `supabase secrets set`): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

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
// from docs/PROMPTS.md. T11 shipped `ping`; T12 adds parse (A) / narrate (C) / city (E).
// T13 will add the combat judge (B).
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
  `tight and evocative, never purple. Second person ("you").`;

const SYS_CITY =
  `Write 2-4 cozy, atmospheric sentences introducing a player's hometown for a magical-girl\n` +
  `game. You may use the city's name and general vibe, but DO NOT assert specific factual\n` +
  `claims (exact landmarks, population, real streets) as if verified. Keep it warm, slightly\n` +
  `nostalgic, evocative of an ordinary life about to change. Second person.`;

function asText(v: unknown): string {
  return v == null ? "" : String(v);
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

  // 4. Build + call.
  const body = await req.json().catch(() => null);
  const kind = typeof body?.kind === "string" ? body.kind : "";
  const vars = (body?.vars ?? {}) as Record<string, unknown>;
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

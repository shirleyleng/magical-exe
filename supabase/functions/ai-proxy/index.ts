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

// Prompt assembly lives server-side so the cached prefix is identical for every user
// (max prompt-cache savings) and players can't tamper with it. The static system text
// gets cache_control: ephemeral. T11 ships `ping` only — T12/T13 add parse/judge/
// narrate/mascot/city per docs/PROMPTS.md.
function buildPayload(kind: string, _vars: Record<string, unknown>, model: string) {
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
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [{ role: "user", content: "ping" }],
      };
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

/* MAGICAL.EXE — AI client (T11)
 *
 * The browser side of the AI layer. Talks ONLY to the Supabase `ai-proxy` Edge
 * Function — never to Anthropic directly. Responsibilities:
 *   - Lazily create the Supabase client from the public config (url + anon key).
 *   - Sign in anonymously (one shared in-flight promise; session persists in
 *     localStorage and auto-refreshes).
 *   - callAI(kind, vars): POST to the proxy with the user's JWT, return the
 *     proxy's JSON. NEVER throws — on any failure returns { ok:false, reason }
 *     so the game degrades to deterministic-only.
 *
 * T11 wires `ping` only (connectivity test). T12/T13 build parse/judge/narrate on top.
 */
import { CONFIG } from "../config.js";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

let _client = null;
function client() {
  if (_client) return _client;
  const sb = CONFIG.supabase || {};
  // Treat unconfigured / placeholder values as "AI disabled".
  if (!sb.url || !sb.anonKey || sb.url.includes("YOUR_") || sb.anonKey.includes("YOUR_")) {
    return null;
  }
  _client = createClient(sb.url, sb.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return _client;
}

let _signIn = null;
async function ensureSession() {
  const sb = client();
  if (!sb) return null;
  const { data: { session } } = await sb.auth.getSession();
  if (session) return session;
  // Collapse concurrent first-use calls into a single sign-in.
  if (!_signIn) {
    _signIn = sb.auth.signInAnonymously().finally(() => { _signIn = null; });
  }
  const { data, error } = await _signIn;
  if (error) {
    console.warn("[ai] anonymous sign-in failed:", error.message);
    return null;
  }
  return data.session;
}

/** True if the Supabase backend is configured (not whether a call will succeed). */
export function aiAvailable() {
  return client() != null;
}

/**
 * Call the AI proxy. Returns the proxy's JSON, e.g.
 *   { ok:true, kind, text, usage }            on success
 *   { ok:false, reason:"resting"|"limit"|... } when gated or unavailable
 * Always resolves — callers branch on `.ok` and fall back to deterministic play.
 */
export async function callAI(kind, vars = {}) {
  const sb = client();
  if (!sb) return { ok: false, reason: "disabled" };

  let session;
  try {
    session = await ensureSession();
  } catch (e) {
    console.warn("[ai] session error:", e);
    return { ok: false, reason: "auth" };
  }
  if (!session) return { ok: false, reason: "auth" };

  const fnUrl = `${CONFIG.supabase.url}/functions/v1/${CONFIG.supabase.functionName}`;
  try {
    const res = await fetch(fnUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${session.access_token}`,
        "apikey": CONFIG.supabase.anonKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({ kind, vars }),
    });
    const data = await res.json().catch(() => null);
    if (!data) return { ok: false, reason: "badresponse" };
    return data;
  } catch (e) {
    console.warn("[ai] callAI network error:", e);
    return { ok: false, reason: "network" };
  }
}

/** T11 connectivity test: round-trips the proxy -> Claude -> back. */
export function pingAI() {
  return callAI("ping");
}

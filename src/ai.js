/* MAGICAL.EXE — AI client (T11 + T12)
 *
 * The browser side of the AI layer. Talks ONLY to the Supabase `ai-proxy` Edge
 * Function — never to Anthropic directly. Responsibilities:
 *   - Lazily load supabase-js (dynamic import) and build the client from the
 *     public config. The import is LAZY on purpose: the game's core modules
 *     statically import this file, and a blocked/offline esm.sh must NOT break
 *     game boot. Nothing here touches the network until the first AI call.
 *   - Sign in anonymously (one shared in-flight promise; session persists in
 *     localStorage and auto-refreshes).
 *   - callAI(kind, vars): POST to the proxy with the user's JWT, return the
 *     proxy's JSON. NEVER throws — on any failure returns { ok:false, reason }
 *     so the game degrades to deterministic-only.
 *   - parseAIJson: strip ```json fences and JSON.parse (Haiku wraps JSON in
 *     fences even when told not to — see PROMPTS.md implementation notes).
 */
import { CONFIG } from "../config.js";
import { track } from "./analytics.js";

const SUPABASE_ESM = "https://esm.sh/@supabase/supabase-js@2";

function configured() {
  const sb = CONFIG.supabase || {};
  return !!(
    sb.url && sb.anonKey &&
    !sb.url.includes("YOUR_") && !sb.anonKey.includes("YOUR_")
  );
}

/** True if the Supabase backend is configured (not whether a call will succeed). */
export function aiAvailable() {
  return configured();
}

/* ── Human-verification (Turnstile) provider ──────────────────────────────────────
   The edge function gates the first PAID call per session behind a Turnstile token
   (T11b, "Option B"). Obtaining a token means rendering a widget — a UI concern — so the
   UI layer registers a provider here. callAI invokes it ONLY when the server says it needs
   one (reason:"captcha"), keeping the server the single source of truth for who's verified
   and the widget appearing exactly on first AI use. A null/throwing provider degrades
   gracefully to deterministic-only — same contract as everything else in this file. */
let _captchaProvider = null;
export function setCaptchaProvider(fn) {
  _captchaProvider = typeof fn === "function" ? fn : null;
}

let _client = null;
let _clientPromise = null;
async function getClient() {
  if (_client) return _client;
  if (!configured()) return null;
  if (!_clientPromise) {
    _clientPromise = import(SUPABASE_ESM)
      .then(({ createClient }) => {
        _client = createClient(CONFIG.supabase.url, CONFIG.supabase.anonKey, {
          auth: { persistSession: true, autoRefreshToken: true },
        });
        return _client;
      })
      .catch((e) => {
        console.warn("[ai] failed to load supabase-js:", e);
        _clientPromise = null; // allow a later retry
        return null;
      });
  }
  return _clientPromise;
}

let _signIn = null;
async function ensureSession(sb) {
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

/**
 * Call the AI proxy. Returns the proxy's JSON, e.g.
 *   { ok:true, kind, text, usage }            on success
 *   { ok:false, reason:"resting"|"limit"|... } when gated or unavailable
 * Always resolves — callers branch on `.ok` and fall back to deterministic play.
 */
export async function callAI(kind, vars = {}) {
  let sb;
  try {
    sb = await getClient();
  } catch (e) {
    console.warn("[ai] client load error:", e);
    return { ok: false, reason: "disabled" };
  }
  if (!sb) return { ok: false, reason: "disabled" };

  let session;
  try {
    session = await ensureSession(sb);
  } catch (e) {
    console.warn("[ai] session error:", e);
    return { ok: false, reason: "auth" };
  }
  if (!session) return { ok: false, reason: "auth" };

  // First attempt with no token. If this user is already human-verified the server just
  // answers; if not (and this isn't an exempt kind like ping) it replies reason:"captcha".
  let data = await postProxy(session, kind, vars);

  // Reactive retry: the server asked for a human check. Render the widget once, get a
  // token, retry exactly once. No token (blocked CDN / unsolved) -> degrade as-is.
  if (data && data.ok === false && data.reason === "captcha" && _captchaProvider) {
    let token = null;
    try {
      token = await _captchaProvider();
    } catch (e) {
      console.warn("[ai] captcha provider failed:", e);
      token = null;
    }
    if (token) data = await postProxy(session, kind, vars, token);
  }
  track("ai_call", {
    kind,
    ok: !!(data && data.ok),
    reason: data && data.ok === false ? (data.reason || "unknown") : null,
  });
  return data;
}

/** POST the proxy once. Never throws — returns the proxy JSON or an {ok:false} shape. */
async function postProxy(session, kind, vars, captchaToken) {
  const fnUrl = `${CONFIG.supabase.url}/functions/v1/${CONFIG.supabase.functionName}`;
  const body = { kind, vars };
  if (captchaToken) body.captchaToken = captchaToken;
  try {
    const res = await fetch(fnUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${session.access_token}`,
        "apikey": CONFIG.supabase.anonKey,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    if (!data) return { ok: false, reason: "badresponse" };
    return data;
  } catch (e) {
    console.warn("[ai] callAI network error:", e);
    return { ok: false, reason: "network" };
  }
}

/**
 * Parse a model reply that should be a JSON object. Strips ```json / ``` fences
 * first (Haiku adds them even when told not to). Returns the parsed object, or
 * null if it isn't valid JSON — callers treat null as "couldn't understand".
 */
export function parseAIJson(text) {
  if (typeof text !== "string") return null;
  let t = text.trim();
  const fenced = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) t = fenced[1].trim();
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

/** T11 connectivity test: round-trips the proxy -> Claude -> back. */
export function pingAI() {
  return callAI("ping");
}

/* MAGICAL.EXE — Cloudflare Turnstile loader (T11b)
 *
 * The human check for the AI spend gate. Same discipline as our supabase-js loader:
 * the script is loaded LAZILY (only when the first AI call needs a token) and a blocked
 * CDN must NEVER break the game — getCaptchaToken() rejects, callers swallow it, and the
 * game runs deterministic-only.
 *
 * Turnstile is rendered explicitly (render=explicit) so we control exactly when/where the
 * widget appears. With appearance "interaction-only" it stays invisible unless Cloudflare
 * decides a challenge is needed — most humans (and our always-pass test key) solve it with
 * zero interaction. One token per call; tokens are single-use and short-lived.
 */

const DEFAULT_SCRIPT =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let _scriptPromise = null;

/** Lazily inject the Turnstile script. Resolves with window.turnstile, rejects if blocked. */
function loadTurnstile(scriptUrl) {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (_scriptPromise) return _scriptPromise;
  _scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = scriptUrl || DEFAULT_SCRIPT;
    s.async = true;
    s.defer = true;
    s.dataset.turnstile = "1";
    s.onload = () => {
      if (window.turnstile) resolve(window.turnstile);
      else reject(new Error("turnstile script loaded but global missing"));
    };
    s.onerror = () => {
      _scriptPromise = null; // allow a later retry
      reject(new Error("turnstile script blocked"));
    };
    document.head.appendChild(s);
  });
  return _scriptPromise;
}

/**
 * Render a one-shot Turnstile widget into `container` and resolve with the verification
 * token. Rejects on script-load failure, widget error, or timeout — every rejection path
 * is a graceful "no token", which the caller turns into deterministic-only play.
 *
 * @param {HTMLElement} container  where the widget mounts (a stable element, NOT scrollback)
 * @param {string} siteKey         public Turnstile site key
 * @param {{ scriptUrl?: string, timeoutMs?: number, theme?: string }} [opts]
 * @returns {Promise<string>} the token
 */
export async function getCaptchaToken(container, siteKey, opts = {}) {
  const { scriptUrl, timeoutMs = 120000, theme = "auto" } = opts;
  if (!siteKey) throw new Error("no turnstile site key configured");
  const turnstile = await loadTurnstile(scriptUrl);

  return new Promise((resolve, reject) => {
    let settled = false;
    let widgetId = null;
    let timer = null;
    const finish = (fn, arg) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      try {
        if (widgetId != null) turnstile.remove(widgetId);
      } catch { /* widget already gone */ }
      fn(arg);
    };

    try {
      widgetId = turnstile.render(container, {
        sitekey: siteKey,
        appearance: "interaction-only",
        theme,
        callback: (token) => finish(resolve, token),
        "error-callback": () => { finish(reject, new Error("turnstile error")); return true; },
        "timeout-callback": () => finish(reject, new Error("turnstile timeout")),
        "expired-callback": () => finish(reject, new Error("turnstile expired")),
      });
    } catch (e) {
      finish(reject, e);
      return;
    }
    timer = setTimeout(() => finish(reject, new Error("captcha timeout")), timeoutMs);
  });
}

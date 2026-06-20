# Deploying MAGICAL.EXE (Cloudflare Pages)

The site is static files. The one catch: **`config.js` is gitignored**, so a
git-sourced deploy doesn't include it — and since every module does
`import { CONFIG } from "../config.js"`, a missing `config.js` makes the whole app
fail to boot (the terminal frame renders but stays empty, because the host serves
`index.html` for the missing path and the browser gets HTML where it expects a JS
module).

The fix is a **build step that regenerates `config.js` at deploy time** from the
tracked `docs/config.example.js`, injecting the PUBLIC client values from
environment variables. No real secrets are involved — the Supabase anon key and
the Turnstile *site* key are public by design; the Anthropic key and the Turnstile
*secret* live server-side in the Supabase Edge Function.

## Cloudflare Pages settings (Project → Settings → Builds & deployments)

- **Framework preset:** None
- **Build command:** `node scripts/build-config.js`
- **Build output directory:** `/`  (publish the repo root — where `index.html` and
  the generated `config.js` live)

## Environment variables (Settings → Environment variables — set for BOTH Production and Preview)

| Variable             | Value                                                        | Public? |
|----------------------|-------------------------------------------------------------|---------|
| `SUPABASE_URL`       | `https://<your-project-ref>.supabase.co`                    | yes     |
| `SUPABASE_ANON_KEY`  | the Supabase **anon** public key                            | yes (RLS-protected) |
| `TURNSTILE_SITE_KEY` | your Cloudflare Turnstile **site** key (domains allowlisted)| yes     |

> **Status (2026-06-20): real Turnstile keys are live and verified.** The production
> `TURNSTILE_SITE_KEY` is a real Cloudflare site key (starts `0x4AAAAA…`) with
> `magical-exe.redmint.studio` allowlisted, paired with the matching real
> `CLOUDFLARE_TURNSTILE_SECRET` in Supabase (see "Server side" below). Confirmed
> end-to-end: a fresh anonymous session's first paid AI call passes the human-check.
>
> Do **not** revert to the always-pass test key `1x00000000000000000000AA` on
> production — it offers no bot protection on the live AI spend. The test keys are
> still handy for local dev / QA: always-pass site `1x00000000000000000000AA`
> (secret `1x0000000000000000000000000000000AA`), always-block site
> `2x00000000000000000000AB`, force-interactive site `3x00000000000000000000FF`.

After setting these, trigger a redeploy. `scripts/build-config.js` runs first,
writes `config.js` into the root, and the site boots normally. The script exits
non-zero (failing the build loudly) if any of the three env vars are missing,
rather than shipping a broken placeholder config.

## Caching & 404s (in-repo, automatic)

- **`_headers`** sets `Cache-Control: no-cache` on the code + config (`index.html`,
  `config.js`, `src/*`, `styles.css`, `themes.css`) so a deploy is never masked by a
  stale browser cache of an ES module. `no-cache` = revalidate via ETag (cheap 304s
  when unchanged), not "never store". `/music/*` caches hard (a week).
- **`404.html`** is a themed not-found page. With a real 404 page present, missing
  assets should fail visibly instead of silently returning `index.html`. **Make sure
  the Cloudflare Pages project does NOT have a single-page-app catch-all** (i.e. no
  `_redirects` line like `/* /index.html 200`, and SPA mode off) — MAGICAL.EXE has no
  client-side routing, so every real path is a file and misses should 404. (The old
  catch-all is what turned the missing `config.js` into a blank screen instead of an
  obvious error.)

## Server side (one-time, already done — for reference)

The Supabase Edge Function holds the real secrets:
```
supabase secrets set CLOUDFLARE_TURNSTILE_SECRET=<your-secret>
supabase functions deploy ai-proxy
```
The Anthropic key is set in the Supabase project's function secrets / env.

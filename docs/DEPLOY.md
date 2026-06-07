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

> Use your REAL Turnstile site key here (with `magical-exe.redmint.studio`
> allowlisted), not the always-pass test key `1x00000000000000000000AA` — the test
> key offers no bot protection on the live AI spend.

After setting these, trigger a redeploy. `scripts/build-config.js` runs first,
writes `config.js` into the root, and the site boots normally. The script exits
non-zero (failing the build loudly) if any of the three env vars are missing,
rather than shipping a broken placeholder config.

## Server side (one-time, already done — for reference)

The Supabase Edge Function holds the real secrets:
```
supabase secrets set CLOUDFLARE_TURNSTILE_SECRET=<your-secret>
supabase functions deploy ai-proxy
```
The Anthropic key is set in the Supabase project's function secrets / env.

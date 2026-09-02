#!/usr/bin/env node
/* ============================================================
   MAGICAL.EXE — scripts/build-config.js
   Deploy-time generator for config.js.

   config.js is gitignored (per repo convention) so a git-sourced deploy
   (Cloudflare Pages) never ships it — and because every module does
   `import { CONFIG } from "../config.js"`, a missing config.js makes the whole
   app fail to boot (the host serves index.html for the missing path, the browser
   gets HTML where it expects a module, the import throws).

   This script rebuilds config.js from the tracked docs/config.example.js at build
   time, injecting the PUBLIC client values from environment variables:
     SUPABASE_URL        — your Supabase project URL (public)
     SUPABASE_ANON_KEY   — the Supabase ANON key (public by design; RLS-protected)
     TURNSTILE_SITE_KEY  — the Cloudflare Turnstile SITE key (public; client-side)

   No real secrets live here. The Anthropic key and the Turnstile SECRET key live
   server-side in the Supabase Edge Function, never in the client.

   Cloudflare Pages setup (Project → Settings):
     Build command:           node scripts/build-config.js
     Build output directory:   /        (publish the repo root, where index.html
                                          + the generated config.js live)
     Environment variables:    SUPABASE_URL, SUPABASE_ANON_KEY, TURNSTILE_SITE_KEY
                               (set for Production and Preview)

   Run order is build-then-publish, so config.js exists before the site is served.
   NOTE: do not run this locally unless you mean to overwrite your hand-maintained
   config.js — it errors out (rather than clobbering) when the env vars are unset.
   ============================================================ */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "docs", "config.example.js");
const OUT = path.join(ROOT, "config.js");

// placeholder in config.example.js  ->  env var that supplies the real value
const SUBS = [
  { env: "SUPABASE_URL", placeholder: "https://YOUR_PROJECT_REF.supabase.co" },
  { env: "SUPABASE_ANON_KEY", placeholder: "YOUR_SUPABASE_ANON_PUBLIC_KEY" },
  { env: "TURNSTILE_SITE_KEY", placeholder: "YOUR_TURNSTILE_SITE_KEY" },
  // MIXPANEL_TOKEN is OPTIONAL — unset = analytics stays disabled, no error.
  { env: "MIXPANEL_TOKEN", placeholder: "YOUR_MIXPANEL_TOKEN", optional: true },
];

function main() {
  if (!fs.existsSync(SRC)) {
    console.error(`[build-config] source template not found: ${SRC}`);
    process.exit(1);
  }
  let text = fs.readFileSync(SRC, "utf8");

  // Per-deploy build stamp (computed, not from env): a UTC date shown in the About screen.
  const stamp = new Date().toISOString().slice(0, 10);
  text = text.split("__BUILD_STAMP__").join(stamp);

  const missing = [];
  for (const { env, placeholder, optional } of SUBS) {
    const val = process.env[env];
    if (!val) {
      if (!optional) missing.push(env);
      continue; // optional missing -> leave the placeholder in place
    }
    if (!text.includes(placeholder)) {
      console.warn(`[build-config] placeholder "${placeholder}" for ${env} not found — config.example.js may have changed.`);
    }
    text = text.split(placeholder).join(val);
  }

  if (missing.length) {
    console.error(`[build-config] Missing required environment variable(s): ${missing.join(", ")}`);
    console.error("[build-config] Set them in Cloudflare Pages → Settings → Environment variables, then redeploy.");
    process.exit(1);
  }

  fs.writeFileSync(OUT, text);
  console.log(`[build-config] wrote ${OUT} from docs/config.example.js with public values injected.`);
}

main();

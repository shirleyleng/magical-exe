-- MAGICAL.EXE — T11b: human-verification gate (Cloudflare Turnstile, Option B)
--
-- Spend protection at the edge function instead of at Supabase Auth. A bot can still
-- mint a (free, unpaid) anonymous JWT, but it cannot make a PAID AI call without solving
-- a Turnstile challenge once per session. The ai-proxy function verifies the token with
-- Cloudflare and records the session here; subsequent calls skip the check.
--
-- Same lockdown as the T11 tables: RLS on with NO policies => anon/authenticated are
-- denied; only the Edge Function (service_role, which bypasses RLS) reads/writes it.
-- (Option A — the project-global Supabase Auth CAPTCHA setting — is a documented future
--  follow-up; it would block the JWT minting itself. See DESIGN.md.)

-- One row per anonymous user that has passed the human check. Keyed by the anon auth uid
-- so it persists for the life of the (auto-refreshing) session: one CAPTCHA per browser.
create table if not exists public.verified_humans (
  user_id     uuid        primary key,   -- the anonymous auth uid
  verified_at timestamptz not null default now()
);

-- Deny-by-default: RLS on, no policies. Only service_role (the Edge Function) gets through.
alter table public.verified_humans enable row level security;

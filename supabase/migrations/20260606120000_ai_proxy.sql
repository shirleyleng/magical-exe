-- MAGICAL.EXE — T11: AI proxy backend (usage logging + server-side caps/kill switch)
--
-- Two tables, both locked down so ONLY the Edge Function (service_role) can touch them.
-- RLS is enabled with NO policies => anon/authenticated are denied; service_role bypasses
-- RLS. The browser never reads or writes these tables directly — it only calls the
-- ai-proxy function, which uses the service role internally.

-- ── Single-row config: kill switch + caps, editable from the Supabase dashboard ──
-- Mirrors `config.js > ai`. This is the SERVER-SIDE source of truth for caps so a
-- malicious client can't raise its own limits. Flip kill_switch_enabled to true in the
-- dashboard to instantly put AI features "to rest" (game keeps running deterministic-only).
create table if not exists public.ai_config (
  id                    int         primary key default 1,
  kill_switch_enabled   boolean     not null default false,
  anon_daily_call_cap   int         not null default 50,    -- per anonymous session / day
  global_daily_call_cap int         not null default 5000,  -- across all users / day
  model                 text        not null default 'claude-haiku-4-5-20251001',
  updated_at            timestamptz not null default now(),
  constraint ai_config_singleton check (id = 1)
);

insert into public.ai_config (id) values (1) on conflict (id) do nothing;

-- ── Per-call usage log: drives the daily counters + lets you track token cost ──
create table if not exists public.ai_usage (
  id                bigint generated always as identity primary key,
  user_id           uuid        not null,             -- the anonymous auth uid
  kind              text        not null,             -- 'ping' | (later) parse/judge/narrate/...
  input_tokens      int         not null default 0,
  output_tokens     int         not null default 0,
  cache_read_tokens int         not null default 0,
  created_at        timestamptz not null default now()
);

-- Counters query "calls today" by (user_id, created_at) and (created_at); index both.
create index if not exists ai_usage_user_day_idx on public.ai_usage (user_id, created_at);
create index if not exists ai_usage_day_idx       on public.ai_usage (created_at);

-- Deny-by-default: RLS on, no policies. Only service_role (the Edge Function) gets through.
alter table public.ai_config enable row level security;
alter table public.ai_usage  enable row level security;

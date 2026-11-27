-- World Drone News Map: database schema for Supabase.
-- Run once in Supabase: Dashboard > SQL Editor > New query > paste > Run.
-- Visitors must sign up and complete a member profile before they can read the data.
-- Guests get only a small preview through public.preview_data() (see the end of this file).
-- Data is written only by the update jobs with the service role key (which bypasses RLS).

-- ---------- Members ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  org text not null check (char_length(org) between 1 and 120),
  role text not null,
  country text,
  purpose text check (purpose is null or char_length(purpose) <= 300),
  consent boolean not null default false,
  lang text,
  is_admin boolean not null default false,
  joined_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and consent)
$$;
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and is_admin)
$$;

drop policy if exists "profiles: read own or admin" on public.profiles;
create policy "profiles: read own or admin" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());
drop policy if exists "profiles: create own" on public.profiles;
create policy "profiles: create own" on public.profiles
  for insert to authenticated with check (id = auth.uid());
drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Members may set only these columns; is_admin is set by the owner in the SQL editor.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant insert (id, name, org, role, country, purpose, consent, lang) on public.profiles to authenticated;
grant update (name, org, role, country, purpose, lang) on public.profiles to authenticated;

-- ---------- Content ----------
create table if not exists public.news (
  id text primary key,
  title text not null,
  title_en text,
  title_ko text,
  source text,
  url text check (url is null or url like 'https://%'),
  published timestamptz not null,
  place text,
  country text,
  country_en text,
  lat double precision not null,
  lon double precision not null,
  category text not null check (category in ('defense','commercial','uam','policy','business','conflict')),
  lang text,
  created_at timestamptz not null default now()
);
create index if not exists news_published_idx on public.news (published desc);

create table if not exists public.companies (
  id text primary key,
  kind text not null check (kind in ('major','startup','sme','research','portal')),
  name text not null,
  name_ko text,
  place text,
  country text,
  lat double precision not null,
  lon double precision not null,
  segment text, segment_en text,
  founded text,
  products text, products_en text,
  airframe text,
  type text, type_en text,
  "desc" text, desc_en text,
  url text check (url is null or url like 'https://%'),
  region text,
  portal_id text,
  source text,
  as_of date,
  updated_at timestamptz not null default now()
);
create index if not exists companies_kind_idx on public.companies (kind);

create table if not exists public.regions (
  name text primary key,
  total int not null, make int, use int,
  lat double precision not null, lon double precision not null,
  as_of text, source text
);

create table if not exists public.meta (
  key text primary key,
  value jsonb,
  updated_at timestamptz not null default now()
);

alter table public.news enable row level security;
alter table public.companies enable row level security;
alter table public.regions enable row level security;
alter table public.meta enable row level security;
revoke all on public.news, public.companies, public.regions, public.meta from anon, authenticated;
grant select on public.news, public.companies, public.regions, public.meta to authenticated;

drop policy if exists "members read news" on public.news;
create policy "members read news" on public.news for select to authenticated using (public.is_member());
drop policy if exists "members read companies" on public.companies;
create policy "members read companies" on public.companies for select to authenticated using (public.is_member());
drop policy if exists "members read regions" on public.regions;
create policy "members read regions" on public.regions for select to authenticated using (public.is_member());
drop policy if exists "members read meta" on public.meta;
create policy "members read meta" on public.meta for select to authenticated using (public.is_member());

-- Live updates: new news rows are pushed to open pages.
do $$ begin
  alter publication supabase_realtime add table public.news;
exception when duplicate_object then null; when undefined_object then null; end $$;

-- ---------- Guest preview (same as supabase/preview.sql) ----------
-- It shares only: the 10 latest headlines (no article links), organization names and
-- locations (no descriptions, products or websites), and Korean regional totals.
-- Everything else stays member-only through the row-level security in schema.sql.
create or replace function public.preview_data() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'news', coalesce((select jsonb_agg(n order by n.published desc) from (
        select id, title, title_en, title_ko, source, published, place, country, country_en, lat, lon, category
        from public.news order by published desc limit 10) n), '[]'::jsonb),
    'news_total', (select count(*) from public.news where published > now() - interval '30 days'),
    'companies', coalesce((select jsonb_agg(c) from (
        select id, kind, name, name_ko, place, country, lat, lon
        from public.companies where kind <> 'portal') c), '[]'::jsonb),
    'portal_total', (select count(*) from public.companies where kind = 'portal'),
    'regions', coalesce((select jsonb_agg(r) from (
        select name, total, make, use, lat, lon, as_of from public.regions) r), '[]'::jsonb),
    'kr_totals', (select value from public.meta where key = 'kr_totals'),
    'updated_at', (select coalesce(value->>'updatedAt', updated_at::text) from public.meta where key = 'status')
  )
$$;
revoke all on function public.preview_data() from public;
grant execute on function public.preview_data() to anon, authenticated;

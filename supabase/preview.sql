-- Guest preview: lets visitors who are not signed in see a small part of the map.
-- Run once in Supabase: Dashboard > SQL Editor > New query > paste > Run.
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

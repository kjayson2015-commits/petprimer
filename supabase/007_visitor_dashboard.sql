-- Pet Primer: visitor dashboard (petprimer.online/dashboard/).
-- Adds three anonymous details to each page view and one private function that
-- adds up the numbers for the editor. Nothing personal is stored: no IP, no
-- cookies, no account link. Run once in Supabase → SQL Editor. Safe to run again.

-- 1) Anonymous details on each view
--    session: a random code the browser forgets when the tab closes (counts visits, not people)
--    device:  phone, tablet or computer (from screen size)
--    tz:      the browser's time zone, e.g. America/Chicago (shared by millions; gives the rough region)
alter table public.page_views add column if not exists session text not null default '';
alter table public.page_views add column if not exists device text not null default '';
alter table public.page_views add column if not exists tz text not null default '';
alter table public.page_views drop constraint if exists page_views_session_check;
alter table public.page_views add constraint page_views_session_check check (char_length(session) <= 40);
alter table public.page_views drop constraint if exists page_views_device_check;
alter table public.page_views add constraint page_views_device_check check (device in ('', 'phone', 'tablet', 'computer'));
alter table public.page_views drop constraint if exists page_views_tz_check;
alter table public.page_views add constraint page_views_tz_check check (char_length(tz) <= 60);

-- 2) One function returns everything the dashboard shows. Only the editor may call it.
create or replace function public.visitor_stats(p_days int default 30, p_tz text default 'UTC')
returns json
language plpgsql stable security definer set search_path = public as $$
declare
  d int := greatest(1, least(coalesce(p_days, 30), 365));
  z text := case when exists (select 1 from pg_timezone_names where name = p_tz) then p_tz else 'UTC' end;
  t0 timestamptz;      -- start of today, in the dashboard's time zone
  since timestamptz;   -- start of the chosen period
  prev timestamptz;    -- start of the period before it (for the % change)
  result json;
begin
  if not public.is_admin() then
    raise exception 'Only the editor can see visitor stats' using errcode = '42501';
  end if;
  t0 := date_trunc('day', now() at time zone z) at time zone z;
  since := t0 - make_interval(days => d - 1);
  prev := since - make_interval(days => d);

  with v as (
    select path, referrer, device, tz, created_at,
           coalesce(nullif(session, ''), id::text) as who
    from public.page_views
    where created_at >= least(prev, now() - interval '24 hours')
  ),
  cur as (select * from v where created_at >= since)
  select json_build_object(
    'tz', z,
    'days', d,
    'generated', now(),
    'live', json_build_object(
      'visitors', (select count(distinct who) from v where created_at > now() - interval '5 minutes'),
      'views', (select count(*) from v where created_at > now() - interval '5 minutes'),
      'pages', (select coalesce(json_agg(x), '[]'::json) from (
                 select path, count(*) as views from v where created_at > now() - interval '5 minutes'
                 group by path order by views desc, path limit 6) x)
    ),
    'totals', json_build_object(
      'today_views', (select count(*) from v where created_at >= t0),
      'today_visitors', (select count(distinct who) from v where created_at >= t0),
      'yesterday_views', (select count(*) from v where created_at >= t0 - interval '1 day' and created_at < t0),
      'yesterday_visitors', (select count(distinct who) from v where created_at >= t0 - interval '1 day' and created_at < t0),
      'views', (select count(*) from cur),
      'visitors', (select count(distinct who) from cur),
      'prev_views', (select count(*) from v where created_at >= prev and created_at < since),
      'prev_visitors', (select count(distinct who) from v where created_at >= prev and created_at < since)
    ),
    'daily', (select coalesce(json_agg(json_build_object('day', g.day, 'views', coalesce(c.views, 0), 'visitors', coalesce(c.visitors, 0)) order by g.day), '[]'::json)
              from (select gs::date as day from generate_series((since at time zone z)::date, (now() at time zone z)::date, interval '1 day') gs) g
              left join (select (created_at at time zone z)::date as day, count(*) as views, count(distinct who) as visitors
                         from cur group by 1) c on c.day = g.day),
    'hourly', (select coalesce(json_agg(json_build_object('hour', h.h, 'views', h.views) order by h.h), '[]'::json)
               from (select gs as h, (select count(*) from v where created_at >= gs and created_at < gs + interval '1 hour') as views
                     from generate_series(date_trunc('hour', now()) - interval '23 hours', date_trunc('hour', now()), interval '1 hour') gs) h),
    'pages', (select coalesce(json_agg(x), '[]'::json) from (
               select path, count(*) as views, count(distinct who) as visitors from cur
               group by path order by views desc, path limit 12) x),
    'referrers', (select coalesce(json_agg(x), '[]'::json) from (
               select referrer, count(distinct who) as visitors from cur where referrer <> ''
               group by referrer order by visitors desc, referrer limit 10) x),
    'direct_visitors', (select count(distinct who) from cur where referrer = ''),
    'devices', (select coalesce(json_agg(x), '[]'::json) from (
               select coalesce(nullif(device, ''), 'unknown') as device, count(distinct who) as visitors from cur
               group by 1 order by visitors desc) x),
    'timezones', (select coalesce(json_agg(x), '[]'::json) from (
               select tz, count(distinct who) as visitors from cur where tz <> ''
               group by tz order by visitors desc, tz limit 40) x)
  ) into result;
  return result;
end $$;

revoke all on function public.visitor_stats(int, text) from public;
grant execute on function public.visitor_stats(int, text) to authenticated;

-- Check
select (select count(*) from public.page_views) as page_views_so_far;

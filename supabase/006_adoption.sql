-- Pet Primer: Adopt — free listings that connect people with dogs and cats who need a home.
-- Pet Primer never handles pets or money; the lister and the adopter talk directly.
-- Run once in Supabase: SQL Editor → New query → paste → Run. Safe to run again.

-- ============ Listings ============
create table if not exists public.adopt_listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  lister text not null default 'owner' check (lister in ('owner', 'rescue')),
  pet text not null check (pet in ('dogs', 'cats')),
  name text not null check (char_length(name) between 1 and 40),
  age text not null default '' check (char_length(age) <= 30),
  sex text not null default 'unknown' check (sex in ('male', 'female', 'unknown')),
  size text not null default '' check (size in ('', 'small', 'medium', 'large')),
  country text not null check (country in ('US', 'UK')),
  area text not null check (char_length(area) between 2 and 60),
  about text not null check (char_length(about) between 20 and 1500),
  good_with text not null default '' check (char_length(good_with) <= 120),
  photo_url text,
  status text not null default 'available' check (status in ('available', 'adopted')),
  removed boolean not null default false,
  -- The lister must confirm they are not selling the pet.
  no_sale boolean not null check (no_sale = true),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists adopt_listings_feed_idx on public.adopt_listings (removed, status, created_at desc);
drop trigger if exists adopt_listings_touch on public.adopt_listings;
create trigger adopt_listings_touch before update on public.adopt_listings for each row execute function public.touch_updated_at();

-- How to reach the lister, kept apart so it is shown only to signed-in visitors
-- (keeps emails and numbers away from spam bots).
create table if not exists public.adopt_contacts (
  listing_id uuid primary key references public.adopt_listings (id) on delete cascade,
  contact text not null check (char_length(contact) between 3 and 200)
);

-- Listers may change wording and status, never the removed flag (only the editor can).
create or replace function public.protect_listing() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.removed := old.removed;
    new.owner_id := old.owner_id;
  end if;
  return new;
end $$;
drop trigger if exists protect_listing on public.adopt_listings;
create trigger protect_listing before update on public.adopt_listings for each row execute function public.protect_listing();

-- ============ Security rules ============
alter table public.adopt_listings enable row level security;
alter table public.adopt_contacts enable row level security;

drop policy if exists "adopt read" on public.adopt_listings;
create policy "adopt read" on public.adopt_listings for select using (removed = false or owner_id = auth.uid() or public.is_admin());
drop policy if exists "adopt insert own" on public.adopt_listings;
create policy "adopt insert own" on public.adopt_listings for insert with check (owner_id = auth.uid() and removed = false);
drop policy if exists "adopt update own" on public.adopt_listings;
create policy "adopt update own" on public.adopt_listings for update using (owner_id = auth.uid() or public.is_admin());
drop policy if exists "adopt delete own" on public.adopt_listings;
create policy "adopt delete own" on public.adopt_listings for delete using (owner_id = auth.uid() or public.is_admin());

drop policy if exists "adopt contact signed in" on public.adopt_contacts;
create policy "adopt contact signed in" on public.adopt_contacts for select to authenticated using (true);
drop policy if exists "adopt contact own" on public.adopt_contacts;
create policy "adopt contact own" on public.adopt_contacts for all to authenticated
  using (exists (select 1 from public.adopt_listings l where l.id = listing_id and (l.owner_id = auth.uid() or public.is_admin())))
  with check (exists (select 1 from public.adopt_listings l where l.id = listing_id and l.owner_id = auth.uid()));

-- ============ Reports: listings can be reported too ============
alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports add constraint reports_target_type_check check (target_type in ('post', 'comment', 'listing'));

-- Three reports hide a post, reply or listing until the editor reviews it.
create or replace function public.auto_hide_reported() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  select count(distinct reporter_id) into n from public.reports
   where target_type = new.target_type and target_id = new.target_id and status = 'open';
  if n >= 3 then
    if new.target_type = 'post' then
      update public.community_posts set removed = true where id = new.target_id;
    elsif new.target_type = 'listing' then
      update public.adopt_listings set removed = true where id = new.target_id;
    else
      update public.comments set removed = true where id = new.target_id;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists reports_auto_hide on public.reports;
create trigger reports_auto_hide after insert on public.reports
  for each row execute function public.auto_hide_reported();

-- Check
select (select count(*) from public.adopt_listings) as adopt_listings;

-- Pet Primer: X-style conversations — general "Talk" posts, follows and profile bios.
-- Safe to run again.

-- Allow a general conversation type and posts about both pets.
alter table public.community_posts drop constraint if exists community_posts_type_check;
alter table public.community_posts add constraint community_posts_type_check check (type in ('talk', 'okay', 'show', 'question', 'tip'));
alter table public.community_posts drop constraint if exists community_posts_pet_check;
alter table public.community_posts add constraint community_posts_pet_check check (pet in ('dogs', 'cats', 'both'));

-- A short public bio on each profile.
alter table public.profiles add column if not exists bio text not null default '';
alter table public.profiles drop constraint if exists profiles_bio_check;
alter table public.profiles add constraint profiles_bio_check check (char_length(bio) <= 160);

-- Follow other members (powers the Following tab).
create table if not exists public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index if not exists follows_followee_idx on public.follows (followee_id);
alter table public.follows enable row level security;
drop policy if exists "follows read" on public.follows;
create policy "follows read" on public.follows for select using (true);
drop policy if exists "follow as yourself" on public.follows;
create policy "follow as yourself" on public.follows for insert with check (follower_id = auth.uid());
drop policy if exists "unfollow as yourself" on public.follows;
create policy "unfollow as yourself" on public.follows for delete using (follower_id = auth.uid());

-- Give the editor an easy handle if it is still the automatic one.
update public.profiles set handle = 'petprimer'
where is_admin and handle like 'petprimer%\_%' escape '\'
  and not exists (select 1 from public.profiles where handle = 'petprimer');

-- Check
select (select count(*) from public.follows) as follows,
       (select handle from public.profiles where is_admin order by created_at limit 1) as editor_handle;

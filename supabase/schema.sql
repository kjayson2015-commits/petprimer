-- Pet Primer database setup
-- Run this once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- It is safe to run again; it only creates what is missing.

-- ============ Profiles (one per signed-in person) ============
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 40),
  handle text unique check (handle ~ '^[a-z0-9_]{2,24}$'),
  avatar_url text,
  badge text check (badge in ('vet', 'keeper')),
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- Make a profile automatically when someone signs in for the first time.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare base text;
begin
  base := lower(regexp_replace(split_part(new.email, '@', 1), '[^a-zA-Z0-9_]', '', 'g'));
  if char_length(base) < 2 then base := 'member'; end if;
  base := left(base, 18);
  insert into public.profiles (id, display_name, handle)
  values (new.id, initcap(base), base || '_' || substr(replace(new.id::text, '-', ''), 1, 4))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper: is the current person an editor?
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- Members cannot give themselves badges or editor rights.
create or replace function public.protect_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    new.is_admin := old.is_admin;
    new.badge := old.badge;
  end if;
  return new;
end $$;
drop trigger if exists protect_profile on public.profiles;
create trigger protect_profile before update on public.profiles
  for each row execute function public.protect_profile();

-- ============ Site content written in the editor ============
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  kind text not null default 'note' check (kind in ('note', 'faq', 'myth', 'page')),
  pet text not null default 'dogs' check (pet in ('dogs', 'cats', 'both')),
  access text not null default 'free' check (access in ('free', 'members')),
  status text not null default 'draft' check (status in ('draft', 'review', 'published')),
  title text not null,
  bottom_line text default '',
  body text default '',
  cover_url text,
  cover_alt text default '',
  author_note text default '',
  verdict text,
  claims jsonb not null default '[]'::jsonb,
  focus_keyword text default '',
  seo_title text default '',
  meta_desc text default '',
  tags text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  reviewed_at timestamptz
);
create index if not exists posts_status_idx on public.posts (status, published_at desc);

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists posts_touch on public.posts;
create trigger posts_touch before update on public.posts for each row execute function public.touch_updated_at();

-- ============ Community board ============
create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('okay', 'show', 'question', 'tip')),
  pet text not null check (pet in ('dogs', 'cats')),
  body text not null check (char_length(body) between 1 and 4000),
  photo_url text,
  removed boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists community_posts_feed_idx on public.community_posts (removed, created_at desc);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts (id) on delete cascade,
  parent_id uuid references public.comments (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  removed boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists comments_post_idx on public.comments (post_id, created_at);

create table if not exists public.post_likes (
  post_id uuid not null references public.community_posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create table if not exists public.comment_likes (
  comment_id uuid not null references public.comments (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('post', 'comment')),
  target_id uuid not null,
  reason text not null check (char_length(reason) <= 500),
  status text not null default 'open' check (status in ('open', 'kept', 'warned', 'removed')),
  created_at timestamptz not null default now()
);

create table if not exists public.waitlist (
  email text primary key check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  created_at timestamptz not null default now()
);

-- ============ Security rules (row-level security) ============
alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.community_posts enable row level security;
alter table public.comments enable row level security;
alter table public.post_likes enable row level security;
alter table public.comment_likes enable row level security;
alter table public.reports enable row level security;
alter table public.waitlist enable row level security;

-- Profiles: anyone can see names and badges; you can edit only your own.
drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles for select using (true);
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles for update using (id = auth.uid() or public.is_admin());

-- Site content: everyone reads published posts; only the editor changes anything.
drop policy if exists "posts read published" on public.posts;
create policy "posts read published" on public.posts for select using (status = 'published' or public.is_admin());
drop policy if exists "posts editor writes" on public.posts;
create policy "posts editor writes" on public.posts for all using (public.is_admin()) with check (public.is_admin());

-- Community posts and replies: everyone reads what isn't removed; signed-in
-- members write their own; authors can delete their own; the editor moderates.
drop policy if exists "community read" on public.community_posts;
create policy "community read" on public.community_posts for select using (removed = false or public.is_admin());
drop policy if exists "community insert own" on public.community_posts;
create policy "community insert own" on public.community_posts for insert with check (author_id = auth.uid() and removed = false);
drop policy if exists "community delete own" on public.community_posts;
create policy "community delete own" on public.community_posts for delete using (author_id = auth.uid() or public.is_admin());
drop policy if exists "community moderate" on public.community_posts;
create policy "community moderate" on public.community_posts for update using (public.is_admin());

drop policy if exists "comments read" on public.comments;
create policy "comments read" on public.comments for select using (removed = false or public.is_admin());
drop policy if exists "comments insert own" on public.comments;
create policy "comments insert own" on public.comments for insert with check (author_id = auth.uid() and removed = false);
drop policy if exists "comments delete own" on public.comments;
create policy "comments delete own" on public.comments for delete using (author_id = auth.uid() or public.is_admin());
drop policy if exists "comments moderate" on public.comments;
create policy "comments moderate" on public.comments for update using (public.is_admin());

-- Helpful marks
drop policy if exists "post likes read" on public.post_likes;
create policy "post likes read" on public.post_likes for select using (true);
drop policy if exists "post likes own" on public.post_likes;
create policy "post likes own" on public.post_likes for insert with check (user_id = auth.uid());
drop policy if exists "post likes remove own" on public.post_likes;
create policy "post likes remove own" on public.post_likes for delete using (user_id = auth.uid());
drop policy if exists "comment likes read" on public.comment_likes;
create policy "comment likes read" on public.comment_likes for select using (true);
drop policy if exists "comment likes own" on public.comment_likes;
create policy "comment likes own" on public.comment_likes for insert with check (user_id = auth.uid());
drop policy if exists "comment likes remove own" on public.comment_likes;
create policy "comment likes remove own" on public.comment_likes for delete using (user_id = auth.uid());

-- Reports: members send them; only the editor reads and resolves them.
drop policy if exists "reports insert" on public.reports;
create policy "reports insert" on public.reports for insert with check (reporter_id = auth.uid() and status = 'open');
drop policy if exists "reports editor" on public.reports;
create policy "reports editor" on public.reports for select using (public.is_admin());
drop policy if exists "reports editor update" on public.reports;
create policy "reports editor update" on public.reports for update using (public.is_admin());

-- Waitlist: anyone can join; only the editor can see the list.
drop policy if exists "waitlist join" on public.waitlist;
create policy "waitlist join" on public.waitlist for insert with check (true);
drop policy if exists "waitlist editor" on public.waitlist;
create policy "waitlist editor" on public.waitlist for select using (public.is_admin());

-- ============ Photo storage ============
-- Public bucket for community photos and cover images, 5 MB per file, images only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "photos read" on storage.objects;
create policy "photos read" on storage.objects for select using (bucket_id = 'photos');
-- Members upload only into their own folder (photos/<their id>/...).
drop policy if exists "photos upload own folder" on storage.objects;
create policy "photos upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and ((storage.foldername(name))[1] = auth.uid()::text or ((storage.foldername(name))[1] = 'site' and public.is_admin())));
drop policy if exists "photos delete own" on storage.objects;
create policy "photos delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- ============ First content: the grass FAQ ============
insert into public.posts (slug, kind, pet, access, status, title, bottom_line, author_note, body, cover_url, cover_alt, claims, focus_keyword, seo_title, meta_desc, tags, published_at)
values (
  'why-does-my-dog-eat-grass', 'faq', 'dogs', 'free', 'published',
  'Why does my dog eat grass?',
  'In my experience, grass eating has been a normal mix of instinct, taste, digestion help and boredom. Talk to a vet if your dog eats large amounts or seems unwell.',
  'From my own dog · personal experience',
  E'I first noticed it on a regular Tuesday morning. After his usual walk he headed straight for the patch of grass by the fence and started chewing like it was the most normal thing in the world.\n\nAt first I assumed he was just bored. He does the same thing on days I’m working late and he’s been inside longer than usual — he’ll wander over, sniff around, and graze for a few minutes. But he also does it right after we’ve been out playing, so it isn’t only boredom or anxiety.\n\nI’ve since watched him do it in different situations. Sometimes it’s the fresh spring growth; he’ll ignore the older grass and go straight for the newer, brighter blades, clearly enjoying the taste and texture. Other times he seems more deliberate about it, almost like he’s trying to settle his stomach. He rarely throws up afterward (I’ve only seen it a couple of times), but he’ll slow down and look more comfortable once he’s finished.\n\nIt lines up with what I’ve read about dogs and grass. Their wild ancestors ate plant material along with prey, and a bit of roughage seems to help keep things moving. For him it appears to be a mix of all of it — a little instinct, a little digestion help, occasional boredom, and sometimes just because he likes it.\n\nHe’s been doing it for years and stays happy and healthy, so I’ve mostly stopped worrying about it as long as he’s not eating large amounts or acting sick.',
  '/assets/img/golden-retriever.jpg', 'A smiling golden retriever in the sun',
  '[{"text": "Dogs’ wild ancestors ate plant material along with prey", "grade": "Pending", "note": "", "sources": []}, {"text": "Some roughage helps keep a dog’s digestion moving", "grade": "Pending", "note": "", "sources": []}]'::jsonb,
  'why does my dog eat grass', 'Why Does My Dog Eat Grass? | Pet Primer',
  'A dog owner’s real experience with grass eating, what the research says about it, and when it’s worth calling a vet.',
  'grass eating grazing plants vomiting stomach digestion boredom behavior', now()
) on conflict (slug) do nothing;

-- ============ Make yourself the editor ============
-- After you sign in on petprimer.online once, run this with YOUR email:
-- update public.profiles set is_admin = true, display_name = 'Gilbert Jones'
--   where id = (select id from auth.users where email = 'YOUR-EMAIL@example.com');

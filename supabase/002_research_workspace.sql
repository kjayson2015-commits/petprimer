-- Pet Primer: private research workspace for the editor.
-- Run once in Supabase → SQL Editor. Safe to run again.

-- Research notes: your private thinking space. Never shown to readers.
create table if not exists public.research_notes (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Untitled note',
  body text not null default '',
  tags text not null default '',
  pet text not null default 'dogs' check (pet in ('dogs', 'cats', 'both')),
  pinned boolean not null default false,
  post_id uuid references public.posts (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists research_notes_updated_idx on public.research_notes (updated_at desc);

-- Source library: each study, vet guideline or article saved once, reused everywhere.
create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  url text not null default '',
  authors text not null default '',
  year int check (year between 1900 and 2100),
  kind text not null default 'study' check (kind in ('study', 'review', 'vet guideline', 'article', 'book', 'owner experience', 'other')),
  summary text not null default '',
  quality text not null default '' ,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists research_notes_touch on public.research_notes;
create trigger research_notes_touch before update on public.research_notes for each row execute function public.touch_updated_at();
drop trigger if exists sources_touch on public.sources;
create trigger sources_touch before update on public.sources for each row execute function public.touch_updated_at();

-- Only the editor can see or change any of this.
alter table public.research_notes enable row level security;
alter table public.sources enable row level security;
drop policy if exists "research editor only" on public.research_notes;
create policy "research editor only" on public.research_notes for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "sources editor only" on public.sources;
create policy "sources editor only" on public.sources for all using (public.is_admin()) with check (public.is_admin());

-- A first note so the workspace isn't empty.
insert into public.research_notes (title, body, tags, pet, pinned)
select 'Grass eating — research plan',
E'What I''ve seen: my dog grazes after walks, on boring days, and picks fresh blades. Rarely throws up.\n\nClaims to check:\n- Wild ancestors ate plant material\n- Roughage helps digestion\n- Grass eating as a sign of an upset stomach\n\nLinks: [[Why does my dog eat grass?]]\n\nNext: find studies and vet guidance, add them to the Source library, then grade each claim.',
'grass, eating, digestion', 'dogs', true
where not exists (select 1 from public.research_notes);

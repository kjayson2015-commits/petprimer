-- Pet Primer: seasonal articles, pet profiles, and community safety (auto-hide after 3 reports).
-- Safe to run again.

-- 1) Two seasonal articles (left alone if they already exist)
insert into public.posts (slug, kind, pet, access, status, title, bottom_line, body, cover_url, cover_alt, author_note, claims, tags, focus_keyword, seo_title, meta_desc, published_at, reviewed_at)
values ('halloween-sweets-and-pets', 'note', 'both', 'free', 'published', 'Halloween sweets and pets: chocolate, xylitol and wrappers', 'The two big Halloween risks for dogs are chocolate and xylitol, the sweetener in sugar-free gum and sweets. Xylitol can drop a dog’s blood sugar within 30 minutes. Keep the sweet bowl out of reach, and call a vet or pet poison line straight away if your dog gets into it.', 'Halloween puts bowls of sweets at nose height for a few days, and dogs are very good at finding them. Cats are much less interested in sweets, so most of this note is about dogs.

## 1. Chocolate

Chocolate contains **theobromine**, which dogs clear very slowly. The darker the chocolate, the more dangerous it is:

- **White chocolate** has almost none.
- **Milk chocolate**, the kind in most fun-size bars, has some, so a small dog eating several bars is a real worry.
- **Dark chocolate**, **baking chocolate** and **cocoa powder** are the most dangerous.

Signs usually start 6 to 12 hours after eating: restlessness, vomiting, panting, a racing heart and, with large amounts, shaking or seizures. Use the [chocolate risk calculator](/tools/chocolate-calculator/) to get a rough idea of how serious it is, then ring your vet. More detail is in [[Is chocolate dangerous for dogs?]].

## 2. Xylitol in sugar-free sweets and gum

Xylitol is a sweetener in sugar-free gum, mints and sweets, and also in some peanut butters, baked goods, toothpastes and chewable vitamins. It is sometimes listed as **birch sugar**.

In dogs, xylitol triggers a big release of insulin, so blood sugar drops fast. According to the Merck Veterinary Manual:

- Doses above about **100 mg per kg** of body weight can cause dangerously low blood sugar.
- Doses above about **500 mg per kg** can cause liver failure in some dogs.
- Signs can start within **30 minutes**. With some gums they are delayed by **12 to 18 hours**, so a dog that seems fine at first may still be in trouble.

Signs of low blood sugar include weakness, wobbliness, vomiting, collapse and seizures. Different gums contain very different amounts of xylitol, so keep the packet and read it to the vet or poison line.

The Merck manual says dogs are the only pets reported to be poisoned by xylitol. That is good news for cats, but sugar-free sweets are still no treat for them.

## 3. Raisins and wrappers

- **Raisins** turn up in snack boxes and trail mix. They can cause sudden kidney failure in dogs, with no known safe amount. See [[Can dogs eat grapes or raisins?]].
- **Wrappers, foil and lolly sticks** can cause choking or block the gut, especially when a dog swallows a whole stash at once.

## How to keep Halloween safe

- Keep the sweet bowl and children’s collected sweets up high or behind a closed door.
- Ask children to empty their bags on a table, not the floor.
- Check visitors’ bags and coats. Sugar-free gum in a handbag is a common way dogs find xylitol.
- If the doorbell keeps ringing, give your dog a quiet room so it doesn’t slip out of the front door.
- Choose dog treats for your dog, and keep human sweets for people.

## If your dog eats sweets

Call your vet or a pet poison line straight away, before signs appear. Have ready: what was eaten, roughly how much, when, and your dog’s weight. Don’t make your dog sick unless a vet tells you to. Our [emergency page](/emergency/) has the US and UK poison line numbers.', '/assets/img/three-dogs.jpg', 'Three dogs sitting together', 'Research summary · sources below', '[{"text": "Xylitol can cause dangerously low blood sugar in dogs", "grade": "Strong", "note": "The Merck Veterinary Manual puts the level at about 100 mg per kg of body weight, with liver failure possible in some dogs above about 500 mg per kg.", "sources": ["https://www.merckvetmanual.com/toxicology/food-hazards/xylitol"]}, {"text": "Signs of xylitol poisoning can be delayed", "grade": "Strong", "note": "Signs often begin within 30 minutes, but with some sugar-free gums they may not appear for 12 to 18 hours.", "sources": ["https://www.merckvetmanual.com/toxicology/food-hazards/xylitol"]}, {"text": "Cats are not known to be poisoned by xylitol", "grade": "Moderate", "note": "The Merck Veterinary Manual says dogs are the only domestic species in which xylitol poisoning has been reported. Absence of reports is not the same as proven safety.", "sources": ["https://www.merckvetmanual.com/toxicology/food-hazards/xylitol"]}, {"text": "Dark and baking chocolate are far more dangerous than milk chocolate", "grade": "Strong", "note": "Baking chocolate has about 7 times, and cocoa powder about 12 times, the theobromine of milk chocolate.", "sources": ["https://www.merckvetmanual.com/toxicology/food-hazards/chocolate-toxicosis-in-animals"]}]'::jsonb, 'halloween, xylitol, chocolate, sweets, candy, sugar-free gum, poison', 'halloween candy dogs xylitol', 'Halloween Sweets and Pets: Chocolate, Xylitol and Wrappers', 'Why chocolate and xylitol in sugar-free sweets are the biggest Halloween dangers for dogs, how fast signs start, and what to do if your dog eats some.', now(), '2026-10-17')
on conflict (slug) do nothing;

insert into public.posts (slug, kind, pet, access, status, title, bottom_line, body, cover_url, cover_alt, author_note, claims, tags, focus_keyword, seo_title, meta_desc, published_at, reviewed_at)
values ('fireworks-scared-dog-or-cat', 'note', 'both', 'free', 'published', 'Fireworks and Bonfire Night: helping a scared dog or cat', 'About one in five dogs is strongly afraid of fireworks, and the fear tends to grow with age. Plan ahead: settle pets indoors before dark, give them a hiding place, mask the noise, and let them choose whether to hide or come to you. If your pet panics every year, talk to your vet before the season starts.', 'Fireworks season is long: Halloween, Diwali and Bonfire Night in the UK, New Year’s Eve everywhere, and the Fourth of July in the US. For a frightened pet, it can mean weeks of sudden bangs.

## How common is the fear?

In a Norwegian survey of more than 5,000 dogs from 17 breeds, owners said about **21% of dogs showed strong or very strong fear of fireworks**, and the share rose with age. It varied a lot by breed, from about 8% to 32%. It is a survey of what owners noticed, so treat the numbers as a guide.

## Signs your pet is scared

- **Dogs:** trembling, panting or drooling, pacing, hiding, whining or barking, clinging to you, a tucked tail, refusing food.
- **Cats:** hiding, eating or drinking less, pacing, going to the toilet indoors, over-grooming.

Some of these signs can also mean illness, so check with your vet if you’re unsure.

## Before the fireworks

- **Make a safe den** in a quiet room: a covered crate or bed for a dog, a box or a high shelf for a cat.
- **Check microchip details** are up to date. Frightened pets bolt.
- **Walk dogs in daylight**, before fireworks usually start.
- **Bring cats in before dark**, with a litter tray, food and water inside.
- **Talk to your vet early** if your pet panics every year. Some medicines must be started before the fireworks, and your vet can refer you to a behaviourist.

## During the fireworks

- Close windows, curtains and cat flaps, and turn the lights on to soften the flashes.
- Play music or the TV to mask the bangs.
- **Let your pet choose.** If it wants to hide, let it. If your dog comes to you for comfort, comfort it. Don’t pull a cat out of hiding or hold it.
- Stay calm and act normally. Your pet reads your mood.
- Don’t leave a frightened dog home alone, and never tell it off for accidents or fear.

## After the season

Go back to your normal routine. If the fear was severe, work on it over the year rather than the week before: a vet or clinical behaviourist can set up gradual sound training, which takes time but can help.

In the UK, Dogs Trust runs a free behaviour support line on **0303 003 6666**.', '/assets/img/three-dogs.jpg', 'Three dogs looking over a low wall', 'Research summary · sources below', '[{"text": "Around one in five dogs is strongly afraid of fireworks", "grade": "Moderate", "note": "A survey of 5,257 dogs from 17 breeds found about 21% showed strong or very strong fear of fireworks, from about 8% in the least affected breed to 32% in the most. A large study, but it relies on owner reports.", "sources": ["https://avsab.org/science-friday-noise-sensitivity-in-17-dog-breeds/"]}, {"text": "Fear of fireworks tends to increase as dogs get older", "grade": "Moderate", "note": "In the same survey, older dogs were more likely to be afraid of loud noises.", "sources": ["https://avsab.org/science-friday-noise-sensitivity-in-17-dog-breeds/"]}, {"text": "Comforting a scared dog makes its fear worse", "grade": "Not supported", "note": "Dogs Trust advises comforting a dog that seeks reassurance and says ignoring it doesn’t help. We haven’t found good evidence that comfort reinforces fear.", "sources": ["https://www.dogstrust.org.uk/dog-advice/life-with-your-dog/seasonal/fireworks"]}, {"text": "Cats are safest kept indoors during fireworks", "grade": "Early", "note": "This is expert welfare guidance from Cats Protection, based on the risk of frightened cats running off, rather than the result of a study.", "sources": ["https://www.cats.org.uk/fireworks-and-bonfire-night"]}]'::jsonb, 'fireworks, bonfire night, noise fear, anxiety, fourth of july, new year', 'dog scared of fireworks', 'Dog or Cat Scared of Fireworks? What Helps on Bonfire Night', 'How common firework fear is in dogs, the signs in dogs and cats, and what to do before, during and after fireworks, based on research and UK welfare charity advice.', now(), '2026-10-17')
on conflict (slug) do nothing;

-- 2) Pet profiles: each member can describe one pet
alter table public.profiles add column if not exists pet_name text check (char_length(pet_name) <= 40);
alter table public.profiles add column if not exists pet_type text check (pet_type in ('dog', 'cat'));
alter table public.profiles add column if not exists pet_breed text check (char_length(pet_breed) <= 40);
alter table public.profiles add column if not exists pet_birth_year int check (pet_birth_year between 1990 and 2100);
alter table public.profiles add column if not exists pet_photo_url text;

-- 3) Community safety: a post or reply reported by 3 different members is hidden until the editor reviews it
create or replace function public.auto_hide_reported() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  select count(distinct reporter_id) into n from public.reports
   where target_type = new.target_type and target_id = new.target_id and status = 'open';
  if n >= 3 then
    if new.target_type = 'post' then
      update public.community_posts set removed = true where id = new.target_id;
    else
      update public.comments set removed = true where id = new.target_id;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists reports_auto_hide on public.reports;
create trigger reports_auto_hide after insert on public.reports
  for each row execute function public.auto_hide_reported();

-- One report per member per post or reply
do $u$ begin
  create unique index if not exists reports_one_per_member on public.reports (reporter_id, target_type, target_id);
exception when others then raise notice 'Duplicate reports exist, so the one-report rule was skipped.';
end $u$;

-- 4) Softer wording in the cats welcome post
update public.community_posts
   set body = replace(body, 'ask "is this normal?"', 'get a second opinion when something seems off')
 where body like '%ask "is this normal?"%';

select (select count(*) from public.posts where status = 'published') as published_articles,
       (select count(*) from information_schema.columns where table_name = 'profiles' and column_name like 'pet_%') as pet_columns;

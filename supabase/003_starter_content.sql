-- Pet Primer: researched starter articles, a community welcome, and a private visitor counter.
-- Safe to run again: existing articles with the same web address are left as they are.

-- 1) Grade the claims on the grass article
update public.posts set claims = '[{"text": "Most dogs that eat grass were not sick beforehand", "grade": "Moderate", "note": "In a survey of 1,571 dog owners, only 8% said their dog often looked ill before eating plants. A large survey, but it relies on what owners noticed.", "sources": ["https://www.dvm360.com/view/why-do-dogs-and-cats-eat-grass", "https://agris.fao.org/search/en/records/65de42de7c7033e84bea5ee4"]}, {"text": "Eating grass usually makes dogs throw up", "grade": "Not supported", "note": "Only 22% of owners said their dog regularly vomited afterward, and just 8% in a smaller group of vet students'' dogs. Vomiting happens, but it is the exception.", "sources": ["https://www.dvm360.com/view/why-do-dogs-and-cats-eat-grass"]}, {"text": "Dogs eat grass because their food lacks fibre", "grade": "Weak", "note": "Dogs on lower-fibre diets did not eat more plants than other dogs, and raw or table-scrap diets made no difference either.", "sources": ["https://www.dvm360.com/view/why-do-dogs-and-cats-eat-grass"]}, {"text": "Dogs’ wild relatives also eat plant material", "grade": "Moderate", "note": "Plant material turned up in 2% to 74% of wolf and cougar droppings and stomach contents across six older studies. Researchers think grazing is an inherited habit, possibly one that once helped flush out gut parasites, but that last part is still a theory.", "sources": ["https://www.dvm360.com/view/why-do-dogs-and-cats-eat-grass"]}]'::jsonb, reviewed_at = now() where slug = 'why-does-my-dog-eat-grass';

-- 2) New articles
insert into public.posts (slug, kind, pet, access, status, title, bottom_line, body, cover_url, cover_alt, author_note, verdict, claims, tags, focus_keyword, seo_title, meta_desc, published_at, reviewed_at)
values ('can-dogs-eat-grapes-or-raisins', 'faq', 'dogs', 'free', 'published', 'Can dogs eat grapes or raisins?', 'No. Grapes, raisins, sultanas and currants can cause sudden kidney failure in dogs, and there is no known safe amount. If your dog eats any, call your vet or a pet poison line straight away, before signs appear.', '## Why grapes are dangerous

Vets have known for years that grapes and raisins can damage a dog’s kidneys, but nobody knew why. In 2022 the ASPCA Animal Poison Control Center reported that the likely culprit is **tartaric acid**, a natural acid found in grapes.

The amount of tartaric acid in grapes varies a lot, from about 0.35% to 2%. That is why one dog can eat a handful with no problem while another gets very sick from a few. You can’t tell in advance which one your dog will be.

## What counts

- Fresh grapes of any colour, seeded or seedless
- Raisins, sultanas and currants
- Foods that contain them: fruit cake, hot cross buns, trail mix, cereal bars
- Cream of tartar and tamarind, which are also high in tartaric acid

## What to do if your dog eats some

- Call your vet, an emergency clinic or a pet poison helpline right away. In the US, ASPCA Animal Poison Control is (888) 426-4435 (a fee may apply).
- Don’t wait for signs. Treatment works best early, often by making the dog vomit and giving fluids.
- Tell them roughly how much your dog ate, when, and your dog’s weight.

Early signs can include vomiting, diarrhoea, low energy and not eating. Later signs of kidney trouble include drinking and peeing much more, or much less, than usual.', '/assets/img/three-dogs.jpg', 'Three dogs sitting together outdoors', 'Research summary · sources below', null, '[{"text": "Grapes and raisins can cause acute kidney injury in dogs", "grade": "Strong", "note": "Many documented cases from poison control records and vet reports show the same pattern of kidney damage.", "sources": ["https://www.aspcapro.org/node/104073"]}, {"text": "Tartaric acid is the toxic part of grapes", "grade": "Moderate", "note": "Identified in 2022 from poison control cases, including a dog harmed by homemade playdough made with cream of tartar. Convincing, but based on case reports rather than controlled studies.", "sources": ["https://www.aspcapro.org/node/104073"]}, {"text": "A few grapes are safe for a big dog", "grade": "Not supported", "note": "Tartaric acid levels vary widely between grapes, so the risk can’t be predicted from size or amount. Vets treat any amount as an emergency.", "sources": ["https://www.aspcapro.org/node/104073"]}]'::jsonb, 'grapes, raisins, toxic foods, kidney, poison', 'can dogs eat grapes', 'Can Dogs Eat Grapes or Raisins? Why They’re Toxic', 'Grapes and raisins can cause sudden kidney failure in dogs, and there is no safe amount. What the research found and what to do if your dog eats some.', now(), now())
on conflict (slug) do nothing;
insert into public.posts (slug, kind, pet, access, status, title, bottom_line, body, cover_url, cover_alt, author_note, verdict, claims, tags, focus_keyword, seo_title, meta_desc, published_at, reviewed_at)
values ('is-chocolate-dangerous-for-dogs', 'faq', 'dogs', 'free', 'published', 'Is chocolate dangerous for dogs?', 'Yes. Chocolate contains theobromine, which dogs clear very slowly. The darker the chocolate, the more dangerous it is. Cocoa powder and baking chocolate are the worst, white chocolate has very little.', '## Why dogs react to chocolate

Chocolate contains **theobromine** and a little caffeine. People break these down quickly. Dogs don’t: theobromine stays in a dog’s body much longer, with a half-life of about 17.5 hours, so it builds up and affects the heart and nervous system.

## How much is too much

The Merck Veterinary Manual gives these rough levels, per kilogram of the dog’s body weight:

- **20 mg/kg:** vomiting, diarrhoea, drinking a lot
- **40 to 50 mg/kg:** heart problems such as a racing or irregular heartbeat
- **60 mg/kg or more:** seizures

How much theobromine is in chocolate (roughly, per gram):

- White chocolate: almost none (0.04 mg)
- Milk chocolate: about 2.3 mg
- Dark chocolate: about 5.5 mg
- Unsweetened baking chocolate: about 15.5 mg
- Cocoa powder: about 28.5 mg

**Example:** a 10 kg dog reaches the 20 mg/kg level at 200 mg of theobromine. That is about 87 g of milk chocolate (a large bar), but only about 13 g of baking chocolate.

## What to do

- Work out what kind of chocolate and roughly how much was eaten, and check the wrapper.
- Call your vet or a pet poison helpline straight away, even if your dog seems fine. Signs usually start 6 to 12 hours later.
- Watch for restlessness, panting, vomiting, a fast heartbeat, shaking or seizures.', '/assets/img/corgi.png', 'A corgi looking up', 'Research summary · sources below', null, '[{"text": "Chocolate is toxic to dogs because of theobromine", "grade": "Strong", "note": "Well established in veterinary toxicology, with clear dose levels for mild signs, heart effects and seizures.", "sources": ["https://www.merckvetmanual.com/toxicology/food-hazards/chocolate-toxicosis-in-animals"]}, {"text": "Dark chocolate and cocoa are far more dangerous than milk chocolate", "grade": "Strong", "note": "Baking chocolate has about 7 times, and cocoa powder about 12 times, the theobromine of milk chocolate.", "sources": ["https://www.merckvetmanual.com/toxicology/food-hazards/chocolate-toxicosis-in-animals"]}, {"text": "Dogs clear theobromine more slowly than people", "grade": "Strong", "note": "Its half-life in dogs is about 17.5 hours, compared with about 10 hours in humans.", "sources": ["https://en.wikipedia.org/wiki/Theobromine_poisoning"]}]'::jsonb, 'chocolate, theobromine, toxic foods, poison', 'is chocolate dangerous for dogs', 'Is Chocolate Dangerous for Dogs? How Much Is Too Much', 'Why chocolate is toxic to dogs, how much is dangerous by chocolate type, and what to do if your dog eats some. Based on veterinary toxicology data.', now(), now())
on conflict (slug) do nothing;
insert into public.posts (slug, kind, pet, access, status, title, bottom_line, body, cover_url, cover_alt, author_note, verdict, claims, tags, focus_keyword, seo_title, meta_desc, published_at, reviewed_at)
values ('myth-warm-dry-nose-means-a-sick-dog', 'myth', 'dogs', 'free', 'published', 'A warm, dry nose means your dog is sick', 'Not true. A dog’s nose changes temperature and wetness through the day. A healthy dog can have a warm, dry nose and a sick dog can have a cold, wet one. Look at eating, drinking, energy and behaviour instead.', '## Where the idea comes from

A cold, wet nose is common in healthy dogs, so people started treating it as a health check. But a nose is affected by lots of everyday things: sleeping, sunshine, a warm room, licking, wind and exercise.

## What vets say

Veterinarians interviewed by WebMD call the belief false. One vet put it simply: nose moisture is “just not a reliable sign.” A dog with a serious illness can still have a cool, damp nose. A very dehydrated dog may have a dry nose, but you would usually see other signs too.

## Better signs to watch

- Not eating, or eating much less
- Drinking a lot more, or much less, than usual
- Low energy, hiding or unusual behaviour
- Vomiting, diarrhoea, coughing or trouble breathing
- A nose that is cracked, crusty, bleeding or has thick discharge

If you think your dog has a fever, the only reliable check is a thermometer. Ask your vet how to take your dog’s temperature safely.', null, '', 'Research summary · sources below', 'Not supported', '[{"text": "A warm, dry nose is a reliable sign of illness", "grade": "Not supported", "note": "Nose temperature and moisture change from hour to hour in healthy dogs. Vets don’t use it to judge health.", "sources": ["https://www.webmd.com/pets/dogs/features/dogs-hot-nose"]}, {"text": "Changes in eating, drinking and behaviour are better warning signs", "grade": "Moderate", "note": "This is standard veterinary guidance, though it comes from clinical experience rather than formal studies.", "sources": ["https://www.webmd.com/pets/dogs/features/dogs-hot-nose"]}]'::jsonb, 'nose, fever, sick dog, health signs', 'warm dry nose dog sick', 'Does a Warm, Dry Nose Mean My Dog Is Sick? Myth Check', 'Is a warm, dry nose a sign your dog is sick? Vets say no. What a dog’s nose really tells you, and which signs to watch instead.', now(), now())
on conflict (slug) do nothing;
insert into public.posts (slug, kind, pet, access, status, title, bottom_line, body, cover_url, cover_alt, author_note, verdict, claims, tags, focus_keyword, seo_title, meta_desc, published_at, reviewed_at)
values ('myth-dogs-only-see-black-and-white', 'myth', 'dogs', 'free', 'published', 'Dogs only see in black and white', 'Not true. Dogs see colour, just fewer colours than we do. They see blues and yellows well, while reds and greens look dull, greyish or brownish to them.', '## Where the myth came from

In the 1940s, an influential book on animal eyes suggested dogs could barely see colour, if at all. The idea stuck for decades.

## What the research found

In 1989, researchers at the University of California, Santa Barbara tested dogs with colour-matching tasks. They found that dogs have **two types of colour-sensing cells (cones)** in their eyes, where people usually have three. That means dogs have “dichromatic” colour vision, similar to a person with red-green colour blindness.

- Blues and yellows: dogs see these clearly
- Reds and greens: these look muted, often greyish or brownish

## What it means for your dog

- A red ball on green grass can be hard for a dog to spot. A **blue or yellow** toy stands out much better.
- Dogs lean heavily on smell, movement and brightness, not just colour, so they still find most things fine.', null, '', 'Research summary · sources below', 'Not supported', '[{"text": "Dogs see only in black and white", "grade": "Not supported", "note": "Colour-matching experiments showed dogs can tell colours apart.", "sources": ["https://www.cambridge.org/core/product/5A30E35A384D10B6A2B46B01C896D3D5"]}, {"text": "Dogs have two-colour (dichromatic) vision, seeing blues and yellows best", "grade": "Strong", "note": "Shown by behavioural tests in 1989 and consistent with what is known about the dog retina. The original study tested only three dogs, but later work agrees.", "sources": ["https://www.cambridge.org/core/product/5A30E35A384D10B6A2B46B01C896D3D5", "https://www.scientificamerican.com/article/what-colors-do-dogs-see"]}]'::jsonb, 'colour vision, eyes, toys, senses', 'do dogs see in black and white', 'Do Dogs See in Black and White? Myth Check', 'Dogs don’t see in black and white. Research shows they see blues and yellows, while reds and greens look dull. What that means for toys and training.', now(), now())
on conflict (slug) do nothing;
insert into public.posts (slug, kind, pet, access, status, title, bottom_line, body, cover_url, cover_alt, author_note, verdict, claims, tags, focus_keyword, seo_title, meta_desc, published_at, reviewed_at)
values ('are-lilies-dangerous-for-cats', 'faq', 'cats', 'free', 'published', 'Are lilies dangerous for cats?', 'Yes, very. True lilies and daylilies can cause kidney failure in cats. Every part is toxic, including the pollen and the water in the vase. If your cat touches or chews one, get to a vet straight away.', '## Which lilies

These are the dangerous ones for cats:

- Easter lily
- Asiatic lily (and its hybrids)
- Oriental lily, including Stargazer
- Tiger lily
- Rubrum lily
- Japanese Show lily
- Wood lily
- Daylily (*Hemerocallis*)

## Every part counts

The whole plant is toxic: leaves, stem, flowers and **pollen**. A cat can be poisoned just by licking a few grains of pollen off its fur while grooming. Even the water in a vase of lilies is a risk.

## What happens

- **Within hours:** drooling, vomiting, not eating, low energy
- **12 to 24 hours:** peeing more, dehydration as the kidneys are damaged
- **24 to 72 hours:** kidney failure, which can be fatal

Treatment started late, after about 18 hours, often can’t save the kidneys. Early treatment greatly improves the chances.

## What to do

- Call your vet or a pet poison helpline right away, even if your cat seems fine.
- Take the plant, or a photo of it, so the vet can identify it.
- The safest choice is to keep these lilies out of any home with a cat, including in bouquets.

Dogs that eat lilies may get an upset stomach, but they don’t get the kidney failure that cats do.', '/assets/img/ginger-cat.jpg', 'A ginger cat', 'Research summary · sources below', null, '[{"text": "True lilies and daylilies can cause kidney failure in cats", "grade": "Strong", "note": "Well documented by veterinary schools and the US FDA.", "sources": ["https://vet.purdue.edu/news/beautiful-spring-lilies-pose-serious-danger-to-cats.php"]}, {"text": "Pollen or vase water alone can poison a cat", "grade": "Moderate", "note": "Reported by veterinary sources from clinical cases. Exact doses aren’t known, so all exposure is treated as an emergency.", "sources": ["https://vet.purdue.edu/news/beautiful-spring-lilies-pose-serious-danger-to-cats.php"]}]'::jsonb, 'lilies, plants, toxic, kidney, poison, flowers', 'are lilies dangerous for cats', 'Are Lilies Dangerous for Cats? Which Ones and What to Do', 'Lilies can cause kidney failure in cats, even from pollen or vase water. Which lilies are dangerous, the warning signs, and what to do fast.', now(), now())
on conflict (slug) do nothing;
insert into public.posts (slug, kind, pet, access, status, title, bottom_line, body, cover_url, cover_alt, author_note, verdict, claims, tags, focus_keyword, seo_title, meta_desc, published_at, reviewed_at)
values ('why-does-my-cat-eat-grass', 'note', 'cats', 'free', 'published', 'Why does my cat eat grass?', 'Grass eating is normal for cats. Most cats that do it are not sick beforehand, and most don’t throw up afterward. Researchers think it is an inherited habit that may once have helped wild cats clear gut parasites.', '## What a big survey found

In 2019, researchers at the University of California, Davis surveyed 1,021 cat owners who watched their cats for at least three hours a day.

- **71%** had seen their cat eat plants at least six times
- **11%** had never seen it
- **91%** of the time, the cat seemed completely normal beforehand
- About **27%** of cats were said to often vomit afterward
- Young cats ate plants more often: 39% of cats under 3 did it daily, compared with 27% of cats aged 4 and older

## Why cats might do it

The old idea is that cats eat grass to make themselves sick when their stomach is upset. The survey doesn’t support that, because most cats weren’t ill first and most didn’t vomit.

The researchers’ explanation is that it is an **inherited behaviour**. Plant material may help move things through the gut, which could have helped wild cats get rid of intestinal parasites. That is still a theory.

## Keeping it safe

- Grow **cat grass** (oat, wheat or barley grass) indoors so your cat has a safe option.
- Keep toxic plants out of reach, especially lilies. See [[Are lilies dangerous for cats?]]
- Avoid lawns treated with weedkillers or fertiliser.
- See a vet if your cat suddenly eats a lot more plants, vomits often, or seems unwell.', '/assets/img/dog-and-cat.jpg', 'A dog and a cat resting together', 'Research summary · sources below', null, '[{"text": "Most cats that eat grass are not sick beforehand", "grade": "Moderate", "note": "Owners of 1,021 cats said their cats looked normal before eating plants 91% of the time. A large survey, but based on what owners noticed and not yet a full peer-reviewed paper.", "sources": ["https://www.smithsonianmag.com/smart-news/researchers-figure-out-why-cats-eat-grass-180972885/"]}, {"text": "Cats eat grass to make themselves vomit", "grade": "Weak", "note": "Only about a quarter of cats often vomit afterward, which doesn’t fit the idea that vomiting is the goal.", "sources": ["https://www.smithsonianmag.com/smart-news/researchers-figure-out-why-cats-eat-grass-180972885/"]}, {"text": "Grass eating helped wild ancestors clear gut parasites", "grade": "Early", "note": "A reasonable theory based on wild carnivores and primates, but not tested directly in cats.", "sources": ["https://www.smithsonianmag.com/smart-news/researchers-figure-out-why-cats-eat-grass-180972885/", "https://www.dvm360.com/view/why-do-dogs-and-cats-eat-grass"]}]'::jsonb, 'grass, eating, plants, vomiting, cat grass', 'why does my cat eat grass', 'Why Does My Cat Eat Grass? What Research Says', 'Why cats eat grass, how common it is, and whether you should worry. Based on a survey of over 1,000 cat owners by UC Davis researchers.', now(), now())
on conflict (slug) do nothing;
insert into public.posts (slug, kind, pet, access, status, title, bottom_line, body, cover_url, cover_alt, author_note, verdict, claims, tags, focus_keyword, seo_title, meta_desc, published_at, reviewed_at)
values ('myth-milk-is-good-for-cats', 'myth', 'cats', 'free', 'published', 'Milk is good for cats', 'Not really. Cats don’t need milk, and many adult cats can’t digest the lactose in cow’s milk, which can cause diarrhoea. Fresh water is all a cat needs to drink.', '## Why the myth exists

Cats often love the taste of milk and cream, and the image of a cat with a saucer of milk is everywhere. But liking something isn’t the same as it being good for them.

## What happens in a cat’s gut

Kittens make an enzyme called **lactase** that lets them digest their mother’s milk. As cats grow up, most make much less of it, just like many adult people. Without enough lactase, the sugar in milk (lactose) isn’t digested properly.

The most common result is **diarrhoea**, usually within 8 to 12 hours. Some cats also get an upset stomach or vomit.

## Kittens

Even kittens shouldn’t have cow’s milk. Vets say cow’s milk isn’t suitable for kittens. Orphaned or fostered kittens need a **kitten milk replacer** from a vet or pet shop.

## If your cat loves it

- Milk isn’t needed in a cat’s diet at all.
- Some cats handle a spoonful or two as an occasional treat. Watch for loose stools over the next day.
- Lactose-free milk or cat milk products are gentler options.
- Treats of any kind should stay under about 5% to 10% of what your cat eats.', null, '', 'Research summary · sources below', 'Not supported', '[{"text": "Cats need milk", "grade": "Not supported", "note": "A complete cat food plus fresh water covers a cat’s needs. Vets don’t recommend milk.", "sources": ["https://www.webmd.com/cats/guide/cats-and-dairy-get-the-facts"]}, {"text": "Many adult cats are lactose intolerant", "grade": "Moderate", "note": "Cats make less lactase as they grow up, and diarrhoea after milk is commonly seen by vets. How many cats are affected hasn’t been measured well.", "sources": ["https://www.webmd.com/cats/guide/cats-and-dairy-get-the-facts"]}]'::jsonb, 'milk, dairy, lactose, diet, kittens', 'is milk good for cats', 'Is Milk Good for Cats? Myth Check', 'Is milk good for cats? Most adult cats can’t digest lactose well and don’t need milk at all. What vets say, plus safer options for kittens and treats.', now(), now())
on conflict (slug) do nothing;
insert into public.posts (slug, kind, pet, access, status, title, bottom_line, body, cover_url, cover_alt, author_note, verdict, claims, tags, focus_keyword, seo_title, meta_desc, published_at, reviewed_at)
values ('myth-cats-always-land-on-their-feet', 'myth', 'cats', 'free', 'published', 'Cats always land on their feet, so falls don’t hurt them', 'Cats are very good at twisting to land feet first, but falls still injure them badly. Vets see so many falls from windows and balconies that it has a name: high-rise syndrome. Screens on windows and balconies prevent it.', '## The part that’s true

Cats have a **righting reflex**: as they fall, they twist their body around to land feet first. From most heights above about 90 cm (3 feet), most cats can do it.

## The part that isn’t

Landing feet first doesn’t mean landing safely. In 1987, vets in New York looked at **132 cats** brought in after falling from buildings. Many were injured. Common fall injuries in cats include broken jaws, broken legs and chest and lung damage.

Oddly, cats falling from **fewer than six storeys** had worse injuries than some falling from higher up. One idea is that from higher falls cats reach top speed, relax and spread out. But there’s a big catch: cats that died in falls were less likely to be brought to a vet, so they were left out of the numbers. High falls are not safer.

## How to protect your cat

- Fit secure **screens or mesh** on windows you open and on balconies.
- Don’t rely on a cat “knowing better”. Cats fall chasing birds or insects, or when startled.
- If your cat falls, see a vet even if it seems fine. Chest injuries aren’t always obvious.', null, '', 'Research summary · sources below', 'Not supported', '[{"text": "Cats can twist in mid-air to land feet first", "grade": "Strong", "note": "The righting reflex is well documented and works from heights of about 90 cm and up.", "sources": ["https://en.wikipedia.org/wiki/High-rise_syndrome"]}, {"text": "Cats aren’t hurt by falls because they land on their feet", "grade": "Not supported", "note": "Fall injuries in cats are common enough to have a name, high-rise syndrome. A study of 132 cats found many injured.", "sources": ["https://en.wikipedia.org/wiki/High-rise_syndrome"]}, {"text": "Cats are safer falling from higher floors", "grade": "Weak", "note": "Some data show fewer injuries above six storeys, but cats that died weren’t counted, which makes high falls look safer than they are.", "sources": ["https://en.wikipedia.org/wiki/High-rise_syndrome"]}]'::jsonb, 'falls, high-rise syndrome, windows, balcony, safety', 'do cats always land on their feet', 'Do Cats Always Land on Their Feet? Myth Check', 'Cats twist to land feet first, but falls still cause serious injuries. What the research on high-rise syndrome shows and how to keep your cat safe.', now(), now())
on conflict (slug) do nothing;

-- 3) A welcome post from the editor in each community section
insert into public.community_posts (author_id, type, pet, body)
select p.id, 'question', x.pet, x.body
from (select id from public.profiles where is_admin order by created_at limit 1) p
cross join (values
  ('dogs', 'Welcome to the Pet Primer community! 🐶 Ask anything about your dog here: odd habits, food worries, "is this okay?" photos. Members can reply and mark the answers that helped. To start us off: what is one dog habit you have always wondered about?'),
  ('cats', 'Welcome, cat people! 🐱 Share a photo, ask "is this normal?", or pass on a tip that worked for you. To get things going: what is the strangest thing your cat does every day?')
) as x(pet, body)
where not exists (select 1 from public.community_posts);

-- 4) Private visitor counter: pages store a view, only the editor can read the totals.
create table if not exists public.page_views (
  id uuid primary key default gen_random_uuid(),
  path text not null check (char_length(path) between 1 and 200),
  referrer text not null default '' check (char_length(referrer) <= 200),
  created_at timestamptz not null default now()
);
create index if not exists page_views_time_idx on public.page_views (created_at desc);
alter table public.page_views enable row level security;
drop policy if exists "anyone can count a view" on public.page_views;
create policy "anyone can count a view" on public.page_views for insert with check (true);
drop policy if exists "editor reads views" on public.page_views;
create policy "editor reads views" on public.page_views for select using (public.is_admin());

-- Check
select (select count(*) from public.posts where status = 'published') as published_articles,
       (select count(*) from public.community_posts) as community_posts,
       (select count(*) from public.page_views) as page_views;

# Pet Primer

Dog and cat care, graded by the evidence — **https://petprimer.online**

- **Website:** static pages hosted free on GitHub Pages, rebuilt automatically.
- **Storage:** Supabase (free tier) holds member accounts, community posts, replies, photos, reports, the membership waitlist, and the notes you write in the editor.
- **Editor:** `petprimer.online/editor/` — only accounts marked as editor can open it.

---

## Setup checklist

Do these once, in order. Each takes a few minutes.

### 1. Point petprimer.online to GitHub (Namecheap)

1. Sign in to Namecheap → **Domain List** → **Manage** next to petprimer.online → **Advanced DNS**.
2. Delete the existing parking records (usually a `CNAME www → parkingpage.namecheap.com` and a `URL Redirect @`).
3. Add these records (**Add new record**). Leave TTL on Automatic.

| Type | Host | Value |
|---|---|---|
| A Record | @ | 185.199.108.153 |
| A Record | @ | 185.199.109.153 |
| A Record | @ | 185.199.110.153 |
| A Record | @ | 185.199.111.153 |
| AAAA Record | @ | 2606:50c0:8000::153 |
| AAAA Record | @ | 2606:50c0:8001::153 |
| AAAA Record | @ | 2606:50c0:8002::153 |
| AAAA Record | @ | 2606:50c0:8003::153 |
| CNAME Record | www | kjayson2015-commits.github.io. |

4. Save. DNS can take from a few minutes up to 24 hours.
5. On GitHub: this repo → **Settings → Pages**. Check that **Source** is “GitHub Actions” and **Custom domain** is `petprimer.online`. Once the DNS check passes, tick **Enforce HTTPS**.
6. Recommended — protect the domain: your GitHub profile picture → **Settings → Pages → Add a domain** → `petprimer.online`. GitHub shows a TXT record; add it in Namecheap Advanced DNS, then click **Verify**.

### 2. Create the database (Supabase)

1. Create a free account at supabase.com → **New project**. Name: `petprimer`. Pick a strong database password and save it. Region: closest to most readers (for a US audience, an East US region).
2. When the project is ready: **SQL Editor → New query**, paste everything from [`supabase/schema.sql`](supabase/schema.sql), click **Run**. This creates all tables, security rules, the photo storage bucket, and loads the grass FAQ.
3. **Authentication → URL Configuration:**
   - Site URL: `https://petprimer.online`
   - Redirect URLs: add `https://petprimer.online/**`
4. **Authentication → Sign In / Providers → Email:** keep Email enabled (sign-in links, no passwords).
5. **Project Settings → API:** copy the **Project URL** and the **anon public** key.

### 3. Connect the website to the database

1. This repo → **Settings → Secrets and variables → Actions → Variables tab → New repository variable**:
   - `SUPABASE_URL` = the Project URL
   - `SUPABASE_ANON_KEY` = the anon public key
   (These are meant to be public. The security rules in the database decide who can read or write.)
2. **Actions → Deploy site → Run workflow.** About a minute later the community board, sign-in and editor work.

### 4. Make yourself the editor

1. On petprimer.online click **Sign in**, enter your email, and open the link Supabase emails you.
2. In Supabase **SQL Editor**, run (with your email):

```sql
update public.profiles set is_admin = true, display_name = 'Gilbert Jones'
where id = (select id from auth.users where email = 'YOUR-EMAIL@example.com');
```

3. Reload the site: an **Editor** button appears next to your name.

---

### 5. Turn on Adopt (once)

The Adopt pages (`/adopt/` and `/adopt/list/`) need their own tables. In Supabase **SQL Editor → New query**, paste everything from [`supabase/006_adoption.sql`](supabase/006_adoption.sql) and click **Run**. Until then the pages show “Adoption listings open very soon.”

---

## Day to day

- **Write or change a note:** `petprimer.online/editor/` → write → **Publish**. The site rebuilds itself about every 30 minutes. To update right away: GitHub → **Actions → Deploy site → Run workflow**.
- **Moderate:** Editor → **Reported posts** → Keep, Mark member warned, or Remove.
- **Adoption listings:** listings reported by three members hide themselves and show up in Editor → **Reported posts** with a link to the listing. Remove any that ask for money, deposits or shipping.
- **Badges:** Editor → **Members and badges** → set Verified vet (after checking a license) or Experienced keeper.
- **Waitlist emails:** Supabase → **Table Editor → waitlist** → export.
- **Backups:** Supabase → **Database → Backups** (daily on paid plans). On the free plan, export important tables from the Table Editor now and then.

## Good to know

- **Free-plan limits:** Supabase free gives 500 MB of database and 1 GB of photo storage; photos are shrunk to about 1600 px before upload, so that goes a long way. A free Supabase project pauses after a week with no activity — any visit to the community board counts as activity, and you can unpause from the dashboard.
- **Sign-in emails:** Supabase’s built-in email sender only sends a few emails per hour. Before launch, add your own email sender in **Authentication → Emails → SMTP Settings** (for example Resend, Brevo or your domain’s email).
- **Scheduled rebuilds:** GitHub pauses scheduled runs in a repo that has had no commits for 60 days. Pushing any change, or clicking Run workflow, starts them again.
- **Payments:** memberships ($9–15/month, $79–129/year) show a “Notify me” waitlist for now. Members-only notes show their first paragraph plus a members box; full payment and gating come next.

## Working on the code

```bash
node scripts/build.mjs        # builds the site into _site/
npm run preview               # builds, then serves it on http://localhost:8080
```

- `pages/` — page content; `partials/` — shared head, header, footer
- `assets/` — styles, scripts, images
- `scripts/build.mjs` — turns pages + published notes into the site, plus `sitemap.xml`, `robots.txt`, `search-index.json`, and Google structured data
- `supabase/schema.sql` — database, security rules and storage
- `content/seed.json` — starter content used when the database isn’t connected

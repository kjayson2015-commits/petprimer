// Pet Primer build: turns pages/ + published notes into a finished static site in _site/.
// Run locally with:  node scripts/build.mjs
// Optional env: SUPABASE_URL, SUPABASE_ANON_KEY (otherwise read from assets/js/config.js)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { esc, renderMarkdown, plainText, gradeClass, RESERVED_SLUGS } from '../assets/js/markdown.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, '_site');
const SITE = 'https://petprimer.online';
const VERSION = (process.env.GITHUB_SHA || Date.now().toString(36)).slice(0, 8);
const YEAR = new Date().getFullYear();
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

// ---------- Settings ----------
const cfgText = read('assets/js/config.js');
const fromCfg = (k) => (cfgText.match(new RegExp(k + ":\\s*'([^']*)'")) || [])[1] || '';
const SB_URL = (process.env.SUPABASE_URL || fromCfg('supabaseUrl')).replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const SB_KEY = process.env.SUPABASE_ANON_KEY || fromCfg('supabaseAnonKey');

// ---------- Content ----------
async function loadPosts() {
  const seed = JSON.parse(read('content/seed.json'));
  if (!SB_URL || !SB_KEY) { console.log('No Supabase settings: building with starter content only.'); return seed; }
  try {
    const res = await fetch(`${SB_URL}/rest/v1/posts?status=eq.published&select=*&order=published_at.desc`, { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    const live = await res.json();
    const slugs = new Set(live.map((p) => p.slug));
    console.log(`Loaded ${live.length} published posts from Supabase.`);
    return [...live, ...seed.filter((p) => !slugs.has(p.slug))];
  } catch (err) {
    console.warn('Could not reach Supabase, using starter content:', err.message);
    return seed;
  }
}

// ---------- Helpers ----------
const abs = (u) => (!u ? `${SITE}/assets/img/share.jpg` : u.startsWith('http') ? u : SITE + u);
const KIND = { note: 'Note', faq: 'FAQ', myth: 'Myth check', page: 'Page' };
const PET = { dogs: 'Dogs', cats: 'Cats', both: 'Dogs and cats' };
const date = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
const urlOf = (p) => `/${p.slug}/`;
const summaryOf = (p) => p.bottom_line || plainText(p.body).slice(0, 155);
const jsonld = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;

const PARTS = { head: read('partials/head.html'), header: read('partials/header.html'), footer: read('partials/footer.html'), modals: read('partials/modals.html') };

function page({ pathName, nav, title, description, robots = 'index, follow', ogType = 'website', ogImage, schema, content, bare }) {
  const head = PARTS.head
    .replaceAll('{{title}}', esc(title)).replaceAll('{{description}}', esc(description))
    .replaceAll('{{robots}}', robots).replaceAll('{{canonical}}', SITE + pathName)
    .replaceAll('{{ogType}}', ogType).replaceAll('{{ogImage}}', abs(ogImage))
    .replaceAll('{{jsonld}}', schema ? (Array.isArray(schema) ? schema : [schema]).map(jsonld).join('\n') : '');
  const header = bare ? '' : PARTS.header.replace(new RegExp(`data-nav="${nav}"`), `data-nav="${nav}" aria-current="page"`);
  const footer = bare ? '' : PARTS.footer;
  const html = `<!doctype html>\n<html lang="en">\n<head>\n${head}</head>\n<body>\n${header}<main id="main">\n${content}\n</main>\n${footer}${PARTS.modals}</body>\n</html>\n`;
  return html.replaceAll('{{version}}', VERSION).replaceAll('{{year}}', String(YEAR));
}

function write(rel, html) {
  const file = path.join(OUT, rel.endsWith('/') ? rel + 'index.html' : rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
}

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
  }
}

// ---------- Pieces ----------
function card(p) {
  return `<a class="card" href="${urlOf(p)}">
${p.cover_url ? `<img class="cover" src="${esc(p.cover_url)}" alt="${esc(p.cover_alt || '')}" loading="lazy" style="object-position: center 30%">` : ''}
<span class="meta">${esc(PET[p.pet])} · ${esc(KIND[p.kind])}</span>
<span class="title">${esc(p.title)}</span>
<span style="color: var(--ink-2)">${esc(summaryOf(p))}</span>
<span class="meta">${p.reviewed_at ? 'Reviewed ' + esc(date(p.reviewed_at)) : 'Evidence review in progress'}${p.access === 'members' ? ' · Members' : ' · Free'}</span>
</a>`;
}

const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
function claimCard(c) {
  const sources = (c.sources || []).filter(Boolean);
  return `<div class="claim-card">
<h3 style="font-size: 20px; line-height: 1.35; font-family: var(--body)">${esc(c.text)}</h3>
<span class="pill grade ${gradeClass(c.grade)}" style="align-self: flex-start">${c.grade && c.grade !== 'Pending' ? esc(c.grade) + ' evidence' : 'Evidence review in progress'}</span>
${c.note ? `<p style="color: var(--ink-2)">${esc(c.note)}</p>` : ''}
${sources.length ? `<div class="sources"><strong>Sources:</strong> ${sources.map((s, i) => `<a href="${esc(s)}" rel="noopener nofollow">${esc(hostOf(s) || 'Source ' + (i + 1))}</a>`).join(' · ')}</div>` : ''}
</div>`;
}

// [[Note title]] in an article becomes a link to that published note; anything else is plain text.
let LINK_INDEX = new Map();
const linkOpts = { link: (target, label) => {
  if (/^src:/i.test(target)) return null;
  const hit = LINK_INDEX.get(target.trim().toLowerCase());
  return hit ? `<a href="${urlOf(hit)}">${esc(label || hit.title)}</a>` : null;
} };

function noteBody(p) {
  if (p.access !== 'members') return renderMarkdown(p.body, linkOpts);
  const first = String(p.body || '').split(/\n{2,}/)[0] || '';
  return renderMarkdown(first, linkOpts) + `<div class="panel" style="margin-top: 8px"><strong style="font-size: 18px">The rest of this note is for members.</strong><p class="muted">Memberships open soon: $9–15 a month or $79–129 a year.</p><a class="btn" href="/#membership" style="align-self: flex-start">Get notified</a></div>`;
}

function notePage(p, all) {
  const related = all.filter((x) => x.slug !== p.slug && x.kind !== 'page' && (x.pet === p.pet || x.pet === 'both' || p.pet === 'both')).slice(0, 3);
  const section = p.kind === 'faq' ? ['FAQ', '/faq/'] : p.pet === 'cats' ? ['Cats', '/cats/'] : ['Dogs', '/dogs/'];
  const crumbs = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' },
    { '@type': 'ListItem', position: 2, name: section[0], item: SITE + section[1] },
    { '@type': 'ListItem', position: 3, name: p.title, item: SITE + urlOf(p) }] };
  const article = { '@context': 'https://schema.org', '@type': 'Article', headline: p.title, description: p.meta_desc || summaryOf(p), image: abs(p.cover_url), datePublished: p.published_at, dateModified: p.updated_at || p.published_at, author: { '@type': 'Person', name: 'Gilbert Jones', url: SITE + '/about/' }, publisher: { '@type': 'Organization', name: 'Pet Primer', logo: { '@type': 'ImageObject', url: SITE + '/assets/img/icon-512.png' } }, mainEntityOfPage: SITE + urlOf(p), isAccessibleForFree: p.access !== 'members' };
  const schema = [crumbs, article];
  if (p.kind === 'faq' && p.access !== 'members') schema.push({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [{ '@type': 'Question', name: p.title, acceptedAnswer: { '@type': 'Answer', text: [p.bottom_line, plainText(p.body)].filter(Boolean).join(' ') } }] });
  const content = `<article class="article">
<div class="narrow">
<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <a href="${section[1]}">${section[0]}</a> › ${esc(p.title)}</nav>
<p class="eyebrow">${esc(PET[p.pet])} · ${esc(KIND[p.kind])}${p.kind === 'myth' && p.verdict ? ` · Verdict: ${esc(p.verdict)}` : ''}</p>
<h1>${esc(p.title)}</h1>
<div class="byline"><img src="/assets/img/golden-retriever.jpg" alt="" width="44" height="44"><span style="display: flex; flex-direction: column; line-height: 1.3"><a href="/about/" style="font-weight: 600; color: var(--ink); text-decoration: none">Gilbert Jones</a><span class="small muted">${esc(p.author_note || 'Pet Primer')} · ${p.reviewed_at ? 'Reviewed ' + esc(date(p.reviewed_at)) : 'Updated ' + esc(date(p.updated_at || p.published_at))}</span></span></div>
${p.bottom_line ? `<div class="bottom-line"><strong>Bottom line:</strong> ${esc(p.bottom_line)}</div>` : ''}
${p.cover_url ? `<img class="cover" src="${esc(p.cover_url)}" alt="${esc(p.cover_alt || '')}" style="object-position: center 30%">` : ''}
<div class="prose">${noteBody(p)}</div>
${(p.claims || []).length ? `<section class="claims" aria-labelledby="claims-h"><h2 id="claims-h" style="font-size: 26px">What the evidence says</h2>${p.claims.map(claimCard).join('\n')}</section>` : ''}
<div class="notice" role="note" style="margin-top: 32px"><span>This note shares experience and research, not a diagnosis. If your pet seems unwell, contact a vet.</span></div>
<div class="panel" style="margin-top: 24px; flex-direction: row; flex-wrap: wrap; align-items: center; justify-content: space-between"><span style="font-weight: 600; font-size: 18px">Does your pet do this too?</span><a class="btn" href="/community/">Share in the community</a></div>
</div>
${related.length ? `<div class="wrap" style="margin-top: 56px"><h2 style="font-size: 28px; margin-bottom: 18px">Related notes</h2><div class="grid">${related.map(card).join('\n')}</div></div>` : ''}
</article>`;
  return page({ pathName: urlOf(p), nav: section[1].replaceAll('/', ''), title: p.seo_title || `${p.title} | Pet Primer`, description: p.meta_desc || summaryOf(p), ogType: 'article', ogImage: p.cover_url, schema, content });
}

function listingPage({ pathName, nav, title, h1, intro, items, seoTitle, seoDesc }) {
  const content = `<section class="wrap" style="padding-top: 48px; padding-bottom: 80px">
<p class="eyebrow">${esc(title)}</p>
<h1 style="font-size: clamp(36px, 5vw, 52px); margin: 8px 0 12px">${esc(h1)}</h1>
<p style="font-size: 18px; color: var(--ink-2); max-width: 44rem; margin-bottom: 32px">${esc(intro)}</p>
${items.length ? `<div class="grid">${items.map(card).join('\n')}</div>` : `<div class="empty"><img src="/assets/img/corgi.png" alt="" width="120" height="133" style="width: 120px; height: auto"><p>The first notes here are being researched now. Follow along on <a href="https://www.instagram.com/petprimer.care/">Instagram</a> or ask a question in the <a href="/community/">community</a>.</p></div>`}
</section>`;
  const schema = { '@context': 'https://schema.org', '@type': 'CollectionPage', name: h1, url: SITE + pathName, hasPart: items.map((p) => ({ '@type': 'Article', headline: p.title, url: SITE + urlOf(p) })) };
  return page({ pathName, nav, title: seoTitle, description: seoDesc, schema, content });
}

// ---------- Build ----------
async function build() {
  const posts = (await loadPosts()).filter((p) => p.status === 'published' && p.slug && !RESERVED_SLUGS.includes(p.slug));
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  copyDir(path.join(ROOT, 'assets'), path.join(OUT, 'assets'));
  // Swap in larger photos where the build server can download them.
  try {
    const remote = JSON.parse(read('content/remote-images.json'));
    for (const [rel, url] of Object.entries(remote)) {
      if (rel.startsWith('_')) continue;
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
        const buf = Buffer.from(await res.arrayBuffer());
        if (res.ok && buf.length > 40000 && /image\//.test(res.headers.get('content-type') || '')) { fs.writeFileSync(path.join(OUT, rel), buf); console.log('Larger photo:', rel, Math.round(buf.length / 1024) + ' KB'); }
      } catch (e) { console.log('Kept the local photo for', rel); }
    }
  } catch (e) { /* no remote images listed */ }
  if (SB_URL && SB_KEY) {
    const cfg = cfgText.replace(/supabaseUrl:\s*'[^']*'/, `supabaseUrl: '${SB_URL}'`).replace(/supabaseAnonKey:\s*'[^']*'/, `supabaseAnonKey: '${SB_KEY}'`);
    fs.writeFileSync(path.join(OUT, 'assets/js/config.js'), cfg);
  }
  fs.copyFileSync(path.join(ROOT, 'CNAME'), path.join(OUT, 'CNAME'));
  fs.writeFileSync(path.join(OUT, '.nojekyll'), '');

  LINK_INDEX = new Map();
  for (const p of posts) { LINK_INDEX.set(p.title.trim().toLowerCase(), p); LINK_INDEX.set(p.slug, p); }
  const notes = posts.filter((p) => p.kind !== 'page');
  const dogs = notes.filter((p) => p.pet === 'dogs' || p.pet === 'both');
  const cats = notes.filter((p) => p.pet === 'cats' || p.pet === 'both');
  const faqs = notes.filter((p) => p.kind === 'faq');
  const myths = notes.filter((p) => p.kind === 'myth');
  const count = (list, word) => list.length ? `${list.length} ${list.length === 1 ? 'note' : 'notes'}` : `${word} notes coming soon`;
  const withClaim = notes.find((p) => (p.claims || []).length);
  const exampleClaim = withClaim
    ? `<div style="display: flex; flex-direction: column; gap: 10px"><span class="small muted">How a claim looks, from “${esc(withClaim.title)}”</span>${claimCard(withClaim.claims[0])}<a href="${urlOf(withClaim)}" style="font-weight: 600">Read the full note</a></div>`
    : '<div class="claim-card"><p class="muted">Graded claims appear here as notes are published.</p></div>';
  const faqList = faqs.length
    ? faqs.slice(0, 6).map((p, i) => `<details class="faq"${i === 0 ? ' open' : ''}><summary>${esc(p.title)}</summary><div class="answer">
<div style="display: flex; align-items: center; gap: 12px"><img src="/assets/img/golden-retriever.jpg" alt="" width="44" height="44" style="width: 44px; height: 44px; border-radius: 50%; object-fit: cover; object-position: center 30%"><span style="display: flex; flex-direction: column; line-height: 1.3"><span style="font-weight: 600">Gilbert Jones</span><span class="small muted">${esc(p.author_note || 'Pet Primer')}</span></span></div>
${p.bottom_line ? `<p><strong>${esc(p.bottom_line)}</strong></p>` : ''}
${renderMarkdown(String(p.body || '').split(/\n{2,}/).slice(0, 2).join('\n\n'), linkOpts)}
<a href="${urlOf(p)}" style="font-weight: 600">Read the full answer and the evidence →</a>
</div></details>`).join('\n')
    : '<p class="muted">The first answers are on their way.</p>';
  const mythSection = myths.length
    ? `<section class="section band" id="myths"><div class="wrap"><div class="section-head"><div><h2>Myth checks</h2><p>Popular advice, checked against the research.</p></div></div><div class="grid">${myths.slice(0, 3).map((p) => `<a class="card" href="${urlOf(p)}"><span class="meta">You often hear</span><span class="title">“${esc(p.title)}”</span>${p.verdict ? `<span class="pill grade ${gradeClass(p.verdict)}" style="align-self: flex-start">${esc(p.verdict)}</span>` : ''}</a>`).join('\n')}</div></div></section>`
    : '';

  const homeSchema = [
    { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Pet Primer', url: SITE + '/', potentialAction: { '@type': 'SearchAction', target: SITE + '/search/?q={search_term_string}', 'query-input': 'required name=search_term_string' } },
    { '@context': 'https://schema.org', '@type': 'Organization', name: 'Pet Primer', url: SITE + '/', logo: SITE + '/assets/img/icon-512.png', founder: { '@type': 'Person', name: 'Gilbert Jones' }, sameAs: ['https://www.instagram.com/petprimer.care/', 'https://x.com/PetPrimer1'] }
  ];

  for (const file of fs.readdirSync(path.join(ROOT, 'pages')).filter((f) => f.endsWith('.html'))) {
    const src = read('pages/' + file);
    const m = src.match(/^<!--meta (\{[\s\S]*?\})-->/);
    if (!m) throw new Error('Missing meta comment in pages/' + file);
    const meta = JSON.parse(m[1]);
    let content = src.slice(m[0].length);
    content = content.replaceAll('{{DOG_COUNT}}', count(dogs, 'Dog')).replaceAll('{{CAT_COUNT}}', count(cats, 'Cat'))
      .replaceAll('{{LATEST}}', notes.slice(0, 6).map(card).join('\n') || '<p class="muted">The first notes are being written now.</p>')
      .replaceAll('{{FAQ_LIST}}', faqList).replaceAll('{{MYTHS}}', mythSection).replaceAll('{{EXAMPLE_CLAIM}}', exampleClaim);
    const schema = meta.schema === 'home' ? homeSchema : meta.schema === 'about' ? { '@context': 'https://schema.org', '@type': 'AboutPage', name: 'About Pet Primer', url: SITE + '/about/', mainEntity: { '@type': 'Person', name: 'Gilbert Jones', description: 'Dog owner and creator of Pet Primer' } } : null;
    write(meta.path === '/404.html' ? '404.html' : meta.path, page({ pathName: meta.path, nav: meta.nav, title: meta.title, description: meta.description, robots: meta.noindex ? 'noindex, follow' : 'index, follow', schema, content, bare: meta.bare }));
  }

  for (const p of posts) write(urlOf(p), notePage(p, notes));
  write('/dogs/', listingPage({ pathName: '/dogs/', nav: 'dogs', title: 'Dogs', h1: 'Dog care notes', intro: 'Behavior, diet, health and everyday care for dogs: real experience first, with every claim graded by the evidence.', items: dogs, seoTitle: 'Dog Care Notes Graded by the Evidence | Pet Primer', seoDesc: 'Practical dog care notes on behavior, diet and health, written from real experience with every claim graded by how strong the research is.' }));
  write('/cats/', listingPage({ pathName: '/cats/', nav: 'cats', title: 'Cats', h1: 'Cat care notes', intro: 'Behavior, diet, health and indoor life for cats, researched and graded the same way.', items: cats, seoTitle: 'Cat Care Notes Graded by the Evidence | Pet Primer', seoDesc: 'Practical cat care notes on behavior, diet, health and indoor life, with every claim graded by how strong the research is.' }));
  write('/faq/', listingPage({ pathName: '/faq/', nav: 'faq', title: 'FAQ', h1: 'Frequently asked questions', intro: 'The questions dog and cat owners ask most, answered from real experience and checked against the research.', items: faqs, seoTitle: 'Dog and Cat Questions Answered | Pet Primer FAQ', seoDesc: 'Answers to the questions dog and cat owners ask most, from real experience, with the evidence behind each claim graded in plain words.' }));
  write('/myths/', listingPage({ pathName: '/myths/', nav: '', title: 'Myth checks', h1: 'Myth checks', intro: 'Popular dog and cat advice, checked against the research.', items: myths, seoTitle: 'Dog and Cat Myths Checked | Pet Primer', seoDesc: 'Popular dog and cat care advice checked against the research and graded in plain words.' }));

  // Search index
  const index = [
    ...notes.map((p) => ({ kind: KIND[p.kind], title: p.title, url: urlOf(p), keyword: p.focus_keyword, tags: p.tags, pet: PET[p.pet], summary: summaryOf(p), text: plainText(p.body).slice(0, 2000) })),
    { kind: 'Page', title: 'Dog care notes', url: '/dogs/', tags: 'dog dogs puppy', summary: 'All dog notes.', text: '' },
    { kind: 'Page', title: 'Cat care notes', url: '/cats/', tags: 'cat cats kitten', summary: 'All cat notes.', text: '' },
    { kind: 'Page', title: 'Frequently asked questions', url: '/faq/', tags: 'faq questions answers', summary: 'Common dog and cat questions.', text: '' },
    { kind: 'Community', title: 'Community board', url: '/community/', tags: 'community ask question photo help forum okay share', summary: 'Ask “Is this okay?” and share photos.', text: '' },
    { kind: 'Page', title: 'Who’s behind Pet Primer', url: '/about/', tags: 'about gilbert jones who vet veterinarian', summary: 'Gilbert Jones and why Pet Primer exists.', text: '' },
    { kind: 'Page', title: 'Membership', url: '/#membership', tags: 'membership price cost join plan subscribe', summary: '$9–15 a month or $79–129 a year.', text: '' }
  ];
  fs.writeFileSync(path.join(OUT, 'search-index.json'), JSON.stringify(index));

  // Sitemap + robots
  const today = new Date().toISOString().slice(0, 10);
  const urls = [['/', today], ['/dogs/', today], ['/cats/', today], ['/faq/', today], ['/community/', today], ['/about/', today], ['/myths/', today], ['/how-we-grade/', today], ['/privacy/', today], ['/terms/', today],
    ...posts.map((p) => [urlOf(p), String(p.updated_at || p.published_at || today).slice(0, 10)])];
  fs.writeFileSync(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(([u, d]) => `<url><loc>${SITE}${u}</loc><lastmod>${d}</lastmod></url>`).join('\n')}\n</urlset>\n`);
  fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /editor/\nDisallow: /search/\n\nSitemap: ${SITE}/sitemap.xml\n`);
  console.log(`Built ${posts.length} notes and ${fs.readdirSync(path.join(ROOT, 'pages')).length} pages into _site/ (version ${VERSION}).`);
}

build().catch((err) => { console.error(err); process.exit(1); });

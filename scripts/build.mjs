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
const AUTHOR_URL = '/authors/gilbert-jones/';
const CHECKER = JSON.parse(read('content/checker.json'));
// Seasonal articles ship with the site so they appear even before they are added to the database.
const SEASONAL = JSON.parse(read('content/seasonal-articles.json')).posts.map((p) => ({ access: 'free', status: 'published', verdict: null, published_at: '2026-10-17T08:00:00Z', updated_at: '2026-10-17T08:00:00Z', reviewed_at: '2026-10-17T08:00:00Z', ...p }));

async function loadPosts() {
  const seed = [...JSON.parse(read('content/seed.json')), ...SEASONAL];
  // For local testing without the database: PP_TEST_SEED=1 adds the starter articles.
  if (process.env.PP_TEST_SEED) seed.push(...JSON.parse(read('content/starter-articles.json')).posts.map((p) => ({ access: 'free', status: 'published', published_at: '2026-10-16T08:00:00Z', reviewed_at: '2026-10-16T08:00:00Z', verdict: p.kind === 'myth' ? 'Not supported' : null, ...p })));
  if (!SB_URL || !SB_KEY) { console.log('No Supabase settings: building with starter content only.'); return seed; }
  try {
    const res = await fetch(`${SB_URL}/rest/v1/posts?status=eq.published&select=*&order=published_at.desc`, { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    const live = await res.json();
    console.log(`Loaded ${live.length} published posts from Supabase.`);
    // The database is the source of truth: built-in starter articles are only a fallback for an
    // empty database, so an article deleted or unpublished in the editor never comes back.
    if (live.length) return live;
    return seed;
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

// Serve WebP wherever a WebP copy of a local image exists (social-card images stay JPEG).
const WEBP = new Set(fs.readdirSync(path.join(ROOT, 'assets/img')).filter((f) => f.endsWith('.webp')).map((f) => f.slice(0, -5)));
const toWebp = (html) => html.replace(/(src=["'])\/assets\/img\/([\w-]+)\.(?:jpe?g|png)(?=["'?])/g, (m, a, n) => (WEBP.has(n) ? `${a}/assets/img/${n}.webp` : m));

function page({ pathName, nav, title, description, robots = 'index, follow', ogType = 'website', ogImage, schema, content, bare }) {
  const head = PARTS.head
    .replaceAll('{{title}}', esc(title)).replaceAll('{{description}}', esc(description))
    .replaceAll('{{robots}}', robots).replaceAll('{{canonical}}', SITE + pathName)
    .replaceAll('{{ogType}}', ogType).replaceAll('{{ogImage}}', abs(ogImage))
    .replaceAll('{{jsonld}}', schema ? (Array.isArray(schema) ? schema : [schema]).map(jsonld).join('\n') : '');
  const header = bare ? '' : PARTS.header.replace(new RegExp(`data-nav="${nav}"`), `data-nav="${nav}" aria-current="page"`);
  const footer = bare ? '' : PARTS.footer;
  const html = `<!doctype html>\n<html lang="en">\n<head>\n${head}</head>\n<body>\n${header}<main id="main">\n${content}\n</main>\n${footer}${PARTS.modals}</body>\n</html>\n`;
  return toWebp(html.replaceAll('{{version}}', VERSION).replaceAll('{{year}}', String(YEAR)).replace(/(['"])\/assets\/js\/([\w-]+)\.js\1/g, `$1/assets/js/$2.js?v=${VERSION}$1`));
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

// Gives each section heading an id and builds the "On this page" list and reading time.
function withContents(html, p) {
  const used = new Set();
  const heads = [];
  const out = html.replace(/<h2>([\s\S]*?)<\/h2>/g, (m, inner) => {
    let id = inner.replace(/<[^>]+>/g, '').toLowerCase().replace(/&[a-z]+;|&#\d+;/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'section';
    while (used.has(id)) id += '-2';
    used.add(id); heads.push([id, inner.replace(/<[^>]+>/g, '').replace(/^\d+\.\s+/, '')]);
    return `<h2 id="${id}">${inner}</h2>`;
  });
  const words = (plainText(p.body) + ' ' + (p.claims || []).map((c) => `${c.text} ${c.note || ''}`).join(' ')).split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 220));
  const showToc = heads.length >= 3 && words >= 450;
  const toc = showToc ? `<nav class="toc" aria-labelledby="toc-h"><h2 id="toc-h" class="toc-h">On this page</h2><ol>${heads.map(([id, t]) => `<li><a href="#${id}">${t}</a></li>`).join('')}${(p.claims || []).length ? '<li><a href="#claims-h">What the evidence says</a></li>' : ''}</ol></nav>` : '';
  return { html: out, toc, minutes };
}

function madeBox(p) {
  const n = (p.claims || []).length;
  const srcCount = new Set((p.claims || []).flatMap((c) => c.sources || []).filter(Boolean)).size;
  return `<section class="made" aria-labelledby="made-h">
<h2 id="made-h">How this article was made</h2>
<ul>
<li>Written by <a href="${AUTHOR_URL}">Gilbert Jones</a>, who keeps dogs and is not a vet.</li>
<li>${n ? `Built from ${srcCount} ${srcCount === 1 ? 'source' : 'sources'}, linked under each of the ${n} graded ${n === 1 ? 'claim' : 'claims'} above.` : 'Based on owner experience; no graded claims yet.'} Grades follow <a href="/how-we-grade/">our method</a>.</li>
<li>Not reviewed by a veterinarian. It does not replace a vet who has examined your pet.</li>
<li>First published ${esc(date(p.published_at || p.updated_at))}${p.reviewed_at ? ` · Evidence last checked ${esc(date(p.reviewed_at))}` : ''}.</li>
<li>Spotted a mistake or a better study? Email <a href="mailto:petprimer.care@gmail.com?subject=${encodeURIComponent('Correction: ' + p.title)}">petprimer.care@gmail.com</a>. Corrections are noted on the page.</li>
</ul>
</section>`;
}

function notePage(p, all) {
  const related = all.filter((x) => x.slug !== p.slug && x.kind !== 'page' && (x.pet === p.pet || x.pet === 'both' || p.pet === 'both')).slice(0, 3);
  const section = p.kind === 'faq' ? ['FAQ', '/faq/'] : p.pet === 'cats' ? ['Cats', '/cats/'] : ['Dogs', '/dogs/'];
  const crumbs = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' },
    { '@type': 'ListItem', position: 2, name: section[0], item: SITE + section[1] },
    { '@type': 'ListItem', position: 3, name: p.title, item: SITE + urlOf(p) }] };
  const article = { '@context': 'https://schema.org', '@type': 'Article', headline: p.title, description: p.meta_desc || summaryOf(p), image: abs(p.cover_url), datePublished: p.published_at, dateModified: p.updated_at || p.published_at, author: { '@type': 'Person', name: 'Gilbert Jones', url: SITE + AUTHOR_URL }, publisher: { '@type': 'Organization', name: 'Pet Primer', logo: { '@type': 'ImageObject', url: SITE + '/assets/img/icon-512.png' } }, mainEntityOfPage: SITE + urlOf(p), isAccessibleForFree: p.access !== 'members' };
  const schema = [crumbs, article];
  if (p.kind === 'faq' && p.access !== 'members') schema.push({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [{ '@type': 'Question', name: p.title, acceptedAnswer: { '@type': 'Answer', text: [p.bottom_line, plainText(p.body)].filter(Boolean).join(' ') } }] });
  const body = withContents(noteBody(p), p);
  const content = `<article class="article">
<div class="narrow">
<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <a href="${section[1]}">${section[0]}</a> › ${esc(p.title)}</nav>
<p class="eyebrow">${esc(PET[p.pet])} · ${esc(KIND[p.kind])}${p.kind === 'myth' && p.verdict ? ` · Verdict: ${esc(p.verdict)}` : ''}</p>
<h1>${esc(p.title)}</h1>
<div class="byline"><img src="/assets/img/golden-retriever-112.webp" alt="" width="44" height="44"><span style="display: flex; flex-direction: column; line-height: 1.3"><a href="${AUTHOR_URL}" rel="author" style="font-weight: 600; color: var(--ink); text-decoration: none">Gilbert Jones</a><span class="small muted">${esc(p.author_note || 'Pet Primer')} · ${p.reviewed_at ? 'Reviewed ' + esc(date(p.reviewed_at)) : 'Updated ' + esc(date(p.updated_at || p.published_at))} · ${body.minutes} min read</span></span></div>
${p.bottom_line ? `<div class="bottom-line"><strong>Bottom line:</strong> ${esc(p.bottom_line)}</div>` : ''}
${p.cover_url ? `<img class="cover" src="${esc(p.cover_url)}" alt="${esc(p.cover_alt || '')}" style="object-position: center 30%">` : ''}
${body.toc}
<div class="prose">${body.html}</div>
${(p.claims || []).length ? `<section class="claims" aria-labelledby="claims-h"><h2 id="claims-h" style="font-size: 26px">What the evidence says</h2>${p.claims.map(claimCard).join('\n')}</section>` : ''}
${madeBox(p)}
<div class="notice" role="note" style="margin-top: 24px"><span>This note shares experience and research, not a diagnosis. If your pet seems unwell, contact a vet. Possible poisoning? See the <a href="/emergency/">emergency page</a>.</span></div>
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
${items.length ? `<div class="grid">${items.map(card).join('\n')}</div>` : `<div class="empty"><img src="/assets/img/paws-empty.svg" alt="" width="132" height="99" class="empty-art"><p>The first notes here are being researched now. Follow along on <a href="https://www.instagram.com/petprimer.care/">Instagram</a> or ask a question in the <a href="/community/">community</a>.</p></div>`}
</section>`;
  const schema = { '@context': 'https://schema.org', '@type': 'CollectionPage', name: h1, url: SITE + pathName, hasPart: items.map((p) => ({ '@type': 'Article', headline: p.title, url: SITE + urlOf(p) })) };
  return page({ pathName, nav, title: seoTitle, description: seoDesc, schema, content });
}

// ---------- "Can my pet eat this?" ----------
const EAT = { no: ['No, keep away', 'eat-no'], caution: ['Only with care', 'eat-caution'], yes: ['Generally safe', 'eat-yes'], unknown: ['Not checked yet', 'eat-unknown'] };
const CHECKED = 'October 17, 2026';
const eatPill = (st, who) => `<span class="pill eat ${EAT[st][1]}">${who ? `<span class="sr-only">${who}: </span>` : ''}${EAT[st][0]}</span>`;
const eatUrl = (it) => `/can-my-pet-eat/${it.slug}/`;
const lcName = (n) => (/^Boston/.test(n) ? n : n.charAt(0).toLowerCase() + n.slice(1)).replace(/\s*\(.*\)/, '');
const isPlural = (n) => /s$/.test(n.replace(/\s*\(.*\)/, '')) && !/pothos/i.test(n);
const eatQuestion = (it, pet) => it.group === 'plant' ? `${isPlural(it.name) ? 'Are' : 'Is'} ${lcName(it.name)} safe for ${pet}?` : `Can ${pet} ${it.verb || 'eat'} ${lcName(it.name)}?`;
const eatTitle = (it) => eatQuestion(it, it.cat === 'unknown' ? 'dogs' : 'dogs and cats');
const eatAnswer = (it, pet) => it[pet] === 'unknown' ? `Not checked yet for ${pet === 'dog' ? 'dogs' : 'cats'}. Ask your vet before offering it.` : `${EAT[it[pet]][0]}. ${it[pet + '_note'] || ''}`.trim();

function eatPage(it, posts) {
  const art = it.article && posts.find((p) => p.slug === it.article);
  const srcs = (it.sources || []).map((k) => CHECKER.sources[k]).filter(Boolean);
  const qa = ['dog', 'cat'].filter((k) => it[k] !== 'unknown').map((k) => ({ '@type': 'Question', name: eatQuestion(it, k === 'dog' ? 'dogs' : 'cats'), acceptedAnswer: { '@type': 'Answer', text: eatAnswer(it, k) } }));
  const schema = [
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' },
      { '@type': 'ListItem', position: 2, name: 'Can my pet eat this?', item: SITE + '/can-my-pet-eat/' },
      { '@type': 'ListItem', position: 3, name: it.name, item: SITE + eatUrl(it) }] },
    qa.length ? { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: qa } : null].filter(Boolean);
  const box = (k, label) => `<div class="eat-card ${EAT[it[k]][1]}-card"><span class="eat-who">${label}</span>${eatPill(it[k])}<p>${esc(it[k] === 'unknown' ? 'Our sources for this item only cover dogs. Ask your vet before offering it to a cat.' : it[k + '_note'] || '')}</p></div>`;
  const danger = it.dog === 'no' || it.cat === 'no';
  const content = `<article class="article"><div class="narrow">
<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <a href="/can-my-pet-eat/">Can my pet eat this?</a> › ${esc(it.name)}</nav>
<p class="eyebrow">${it.group === 'plant' ? 'Plants' : 'Food'} · Can my pet eat this?</p>
<h1>${esc(eatTitle(it))}</h1>
${it.aka ? `<p class="muted" style="margin-top: 10px">Also covers: ${esc(it.aka)}</p>` : ''}
<div class="eat-cards">${box('dog', 'Dogs')}${box('cat', 'Cats')}</div>
${it.what_to_do ? `<div class="${danger ? 'notice notice-danger' : 'notice'}" role="note" style="margin-top: 20px"><span><strong>If your pet ate some:</strong> ${esc(it.what_to_do)}${danger ? ' <a href="/emergency/">Poison line numbers</a>' : ''}</span></div>` : ''}
${art || it.tool ? `<div class="eat-more">${art ? `<a class="btn ghost" href="${urlOf(art)}">Read the full article</a>` : ''}${it.tool ? `<a class="btn ghost" href="${it.tool}">Open the chocolate calculator</a>` : ''}</div>` : ''}
<section class="made" aria-labelledby="src-h" style="margin-top: 28px"><h2 id="src-h">Sources</h2><ul>${srcs.map(([t, u]) => `<li><a href="${esc(u)}" rel="noopener nofollow">${esc(t)}</a></li>`).join('')}</ul>
<p class="small muted">Checked by Gilbert Jones on ${CHECKED}. Not reviewed by a vet. Every pet is different, and amounts matter. Corrections: <a href="mailto:petprimer.care@gmail.com?subject=${encodeURIComponent('Correction: ' + it.name)}">petprimer.care@gmail.com</a></p></section>
<p style="margin-top: 24px"><a href="/can-my-pet-eat/">← Check another food or plant</a></p>
</div></article>`;
  return page({ pathName: eatUrl(it), nav: 'tools', title: `${eatTitle(it)} | Pet Primer`, description: `Dogs: ${eatAnswer(it, 'dog')} Cats: ${eatAnswer(it, 'cat')}`.slice(0, 158).replace(/\s\S*$/, '…'), schema, content });
}

function eatIndex() {
  const row = (it) => `<li class="eat-row" data-name="${esc((it.name + ' ' + (it.aka || '')).toLowerCase())}" data-group="${it.group}"><a href="${eatUrl(it)}"><span class="eat-name">${esc(it.name)}</span><span class="eat-pair"><span class="eat-pet">Dogs</span>${eatPill(it.dog, 'Dogs')}<span class="eat-pet">Cats</span>${eatPill(it.cat, 'Cats')}</span></a></li>`;
  const sorted = (g) => CHECKER.items.filter((i) => i.group === g).sort((a, b) => a.name.localeCompare(b.name));
  const content = `<section class="wrap" style="padding-top: 48px; padding-bottom: 80px; max-width: 900px">
<p class="eyebrow">Tool</p>
<h1 style="font-size: clamp(34px, 5vw, 50px); margin: 8px 0 12px">Can my pet eat this?</h1>
<p style="font-size: 18px; color: var(--ink-2); max-width: 44rem">Type a food or plant to see whether it’s safe for dogs and cats, with the source for every answer.</p>
<div class="notice notice-danger" role="note" style="margin: 20px 0"><span><strong>Already eaten something worrying?</strong> Don’t wait for signs. <a href="/emergency/">Call a vet or pet poison line now</a>.</span></div>
<label for="eat-q" class="sr-only">Search foods and plants</label>
<input id="eat-q" class="field eat-search" type="search" placeholder="Try “grapes”, “gum” or “lily”" autocomplete="off" data-eat-search>
<p class="small muted" data-eat-count role="status" style="margin: 8px 0 0"></p>
<div class="eat-legend small"><span>${eatPill('no')} keep away</span><span>${eatPill('caution')} small amounts or with care</span><span>${eatPill('yes')} generally safe</span></div>
<h2 class="eat-group" data-group-head="food">Foods</h2>
<ul class="eat-list" data-eat-list>${sorted('food').map(row).join('')}</ul>
<h2 class="eat-group" data-group-head="plant">Plants and flowers</h2>
<ul class="eat-list" data-eat-list>${sorted('plant').map(row).join('')}</ul>
<p class="empty" data-eat-empty hidden>Not on the list yet. <a href="mailto:petprimer.care@gmail.com?subject=Please%20add%20to%20the%20checker">Ask us to add it</a>, and check with your vet in the meantime.</p>
<p class="small muted" style="margin-top: 24px">Answers summarise the ASPCA, the Merck Veterinary Manual, the US FDA, the American Kennel Club and vet schools. Last checked ${CHECKED}. Not reviewed by a vet.</p>
</section>
<script type="module" src="/assets/js/checker.js?v={{version}}"></script>`;
  const schema = { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Can my pet eat this?', url: SITE + '/can-my-pet-eat/', hasPart: CHECKER.items.map((i) => ({ '@type': 'WebPage', name: eatTitle(i), url: SITE + eatUrl(i) })) };
  return page({ pathName: '/can-my-pet-eat/', nav: 'tools', title: 'Can My Dog or Cat Eat This? Food and Plant Checker | Pet Primer', description: 'Check whether common foods and plants are safe for dogs and cats, from chocolate and grapes to lilies and sugar-free gum, with a source for every answer.', schema, content });
}

function authorPage(notes) {
  const content = `<section class="wrap" style="max-width: 1040px; padding-top: 56px; padding-bottom: 72px">
<div style="display: flex; flex-wrap: wrap; gap: 32px; align-items: center">
<img src="/assets/img/golden-retriever.jpg" width="160" height="160" alt="Gilbert Jones’s golden retriever" style="width: 160px; height: 160px; border-radius: 50%; object-fit: cover; object-position: center 30%">
<div style="flex: 1 1 360px; display: flex; flex-direction: column; gap: 10px">
<p class="eyebrow">Author</p>
<h1 style="font-size: clamp(34px, 5vw, 48px)">Gilbert Jones</h1>
<p style="font-size: 18px; color: var(--ink-2); max-width: 40rem">Dog owner and creator of Pet Primer. I write every article and grade every claim. I’m not a veterinarian, so I lean on published research, veterinary reference works and poison-control data, and link to all of it.</p>
</div></div>
<div class="grid" style="margin-top: 36px; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr))">
<div class="panel"><h2 style="font-size: 20px; font-family: var(--body)">What I write about</h2><p class="muted">Everyday dog and cat care: food safety, behaviour, myths and seasonal risks.</p></div>
<div class="panel"><h2 style="font-size: 20px; font-family: var(--body)">How I check things</h2><p class="muted">Each claim is graded from Strong to Not supported. <a href="/how-we-grade/">See the method</a>.</p></div>
<div class="panel"><h2 style="font-size: 20px; font-family: var(--body)">Corrections</h2><p class="muted">Found a mistake? Email <a href="mailto:petprimer.care@gmail.com">petprimer.care@gmail.com</a> and I’ll review it.</p></div>
</div>
<h2 style="font-size: 28px; margin: 48px 0 18px">Articles by Gilbert (${notes.length})</h2>
<div class="grid">${notes.map(card).join('\n')}</div>
<p style="margin-top: 28px"><a href="/about/">More about Pet Primer</a> · <a href="https://x.com/PetPrimer1" rel="noopener me">X</a> · <a href="https://www.instagram.com/petprimer.care/" rel="noopener me">Instagram</a></p>
</section>`;
  const schema = { '@context': 'https://schema.org', '@type': 'ProfilePage', url: SITE + AUTHOR_URL, mainEntity: { '@type': 'Person', name: 'Gilbert Jones', url: SITE + AUTHOR_URL, image: SITE + '/assets/img/golden-retriever.jpg', description: 'Dog owner and creator of Pet Primer. Not a veterinarian.', worksFor: { '@type': 'Organization', name: 'Pet Primer', url: SITE + '/' }, sameAs: ['https://x.com/PetPrimer1', 'https://www.instagram.com/petprimer.care/'] } };
  return page({ pathName: AUTHOR_URL, nav: 'about', title: 'Gilbert Jones, author | Pet Primer', description: 'Gilbert Jones writes and fact-checks every Pet Primer article. A dog owner, not a vet, who grades each claim by the evidence and links every source.', schema, content });
}

// Myth or Fact quiz: myth checks are myths, strongly supported claims are facts.
function quizData(notes) {
  const q = [];
  for (const p of notes) {
    if (p.kind === 'myth' && /not supported|not true|false/i.test(p.verdict || 'Not supported')) q.push({ s: p.title, a: 'myth', why: p.bottom_line || '', url: urlOf(p) });
    for (const c of p.claims || []) {
      if (p.kind === 'myth') continue;
      if (c.grade === 'Strong') q.push({ s: c.text, a: 'fact', why: c.note || '', url: urlOf(p) });
      if (c.grade === 'Not supported') q.push({ s: c.text, a: 'myth', why: c.note || '', url: urlOf(p) });
    }
  }
  return JSON.stringify(q).replace(/</g, '\\u003c');
}


// ---------- Adopt: "Help me find a pet" ----------
// Listings live in Supabase (supabase/006_adoption.sql). Every rebuild turns them into real pages,
// so search engines see each pet without running any JavaScript.
const ADOPT_COLS = 'id,lister,pet,name,age,sex,size,country,area,about,good_with,photo_url,status,created_at,updated_at';
async function loadListings() {
  if (!SB_URL || !SB_KEY) return [];
  try {
    const res = await fetch(`${SB_URL}/rest/v1/adopt_listings?removed=eq.false&select=${ADOPT_COLS}&order=created_at.desc&limit=2000`, { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    const cutoff = Date.now() - 30 * 864e5;
    const rows = (await res.json()).filter((l) => /^[0-9a-f-]{36}$/i.test(l.id) && (l.status === 'available' || new Date(l.updated_at).getTime() > cutoff));
    rows.sort((a, b) => (a.status === b.status ? b.created_at.localeCompare(a.created_at) : a.status === 'available' ? -1 : 1));
    console.log(`Loaded ${rows.length} adoption listings.`);
    return rows;
  } catch (err) {
    console.log('Adoption listings not loaded (run supabase/006_adoption.sql to turn them on):', err.message);
    return [];
  }
}
const A_PET = { dogs: 'Dog', cats: 'Cat' };
const A_SEX = { male: 'Male', female: 'Female', unknown: '' };
const A_SIZE = { small: 'Small', medium: 'Medium', large: 'Large', '': '' };
const A_COUNTRY = { US: 'United States', UK: 'United Kingdom' };
const petUrl = (l) => `/adopt/pet/${l.id}/`;
const aFacts = (l) => [A_PET[l.pet], l.age, A_SEX[l.sex], A_SIZE[l.size] && `${A_SIZE[l.size]} size`].filter(Boolean).join(' · ');
const aLister = (l) => `<span class="pill ${l.lister === 'rescue' ? 'adopt-rescue' : 'adopt-owner'}">${l.lister === 'rescue' ? 'Rescue' : 'Owner rehoming'}</span>`;
const aImg = (l, cls, eager) => l.photo_url
  ? `<img class="${cls}" src="${esc(l.photo_url)}" alt="${esc(`${l.name}, a ${A_PET[l.pet].toLowerCase()} for adoption in ${l.area}`)}"${eager ? '' : ' loading="lazy"'}>`
  : `<span class="${cls} adopt-nophoto" aria-hidden="true"><img src="/assets/img/paws-empty.svg" alt="" width="96" height="72"></span>`;
function petTile(l) {
  return `<a class="pet-tile" href="${petUrl(l)}" data-id="${esc(l.id)}">${aImg(l, 'pet-tile-img')}<span class="pet-tile-body"><span class="pet-tile-name">${esc(l.name)}${l.status === 'adopted' ? '<span class="pill adopt-done">Adopted</span>' : ''}</span><span class="small" style="color: var(--ink-2)">${esc(aFacts(l))}</span><span class="small muted">${esc(l.area)} · ${esc(l.country)}</span>${aLister(l)}</span></a>`;
}
const ADOPT_FAQ = [
  ['How does “Help me find a pet” work?', 'Owners and rescues in the US and UK list dogs and cats who need a new home. You browse, open a pet’s page, sign in to see how to contact the person listing them, and arrange to meet. The adoption is agreed between you and them.'],
  ['Is it free to adopt or list a pet?', 'Yes. Browsing and listing are free. Pet Primer does not charge adopters, owners or rescues, and takes nothing from any adoption.'],
  ['Can I rehome my own dog or cat here?', 'Yes. Choose “List a pet for adoption”, add a photo and a description, and say how people can reach you. Owners agree not to sell their pet. Rescues may mention their normal adoption fee, paid to the rescue.'],
  ['How do I avoid pet adoption scams?', 'Meet the pet in person before you agree to anything. Never pay a deposit, “holding” fee or shipping fee to someone you have not met, ask to see vet records yourself, and be wary of pressure to decide fast. Report any listing that feels wrong.'],
  ['Do you ship pets or arrange delivery?', 'No. Pet Primer never handles pets, transport or money. Anyone who asks you to pay online so they can ship a pet to you is very likely running a scam.'],
  ['Which areas do you cover?', 'The United States and the United Kingdom. Search by town, city or state to find pets near you.']
];
const adoptFaqHtml = () => ADOPT_FAQ.map(([q, a], i) => `<details class="faq"${i === 0 ? ' open' : ''}><summary>${esc(q)}</summary><div class="answer"><p>${esc(a)}</p></div></details>`).join('\n');
const ADOPT_VIEWS = [
  { path: '/adopt/', pet: 'all', h1: 'Help me find a pet', crumb: null,
    intro: 'Free listings from owners and rescues in the US and UK. Find a pet you like, then contact the person listing them directly. Pet Primer never charges anyone.',
    title: 'Help Me Find a Pet: Adopt a Dog or Cat Near You | Pet Primer',
    desc: 'Find a dog or cat who needs a new home near you. Free adoption and rehoming listings from owners and rescues across the US and UK, with no fees and no middleman.' },
  { path: '/adopt/dogs/', pet: 'dogs', h1: 'Help me find a dog', crumb: 'Dogs',
    intro: 'Dogs and puppies who need a new home in the US and UK, listed free by their owners and by rescues. Search your area, then contact the person listing them directly.',
    title: 'Dogs for Adoption Near You: Help Me Find a Dog | Pet Primer',
    desc: 'Dogs and puppies for adoption in the US and UK, listed free by owners rehoming their dog and by rescues. Search by town or state and contact them directly.' },
  { path: '/adopt/cats/', pet: 'cats', h1: 'Help me find a cat', crumb: 'Cats',
    intro: 'Cats and kittens who need a new home in the US and UK, listed free by their owners and by rescues. Search your area, then contact the person listing them directly.',
    title: 'Cats for Adoption Near You: Help Me Find a Cat | Pet Primer',
    desc: 'Cats and kittens for adoption in the US and UK, listed free by owners rehoming their cat and by rescues. Search by town or state and contact them directly.' }
];
function adoptCrumbs(trail) {
  const items = [['Home', '/'], ...trail];
  return {
    html: `<nav class="crumbs" aria-label="Breadcrumb">${items.map(([n, u], i) => i === items.length - 1 ? esc(n) : `<a href="${u}">${esc(n)}</a>`).join(' › ')}</nav>`,
    schema: { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map(([n, u], i) => ({ '@type': 'ListItem', position: i + 1, name: n, item: SITE + u })) }
  };
}
function adoptPage(tpl, view, listings) {
  const items = listings.filter((l) => view.pet === 'all' || l.pet === view.pet);
  const live = items.filter((l) => l.status === 'available');
  const crumbs = adoptCrumbs(view.crumb ? [['Adopt', '/adopt/'], [view.crumb, view.path]] : [['Adopt', '/adopt/']]);
  const word = view.pet === 'dogs' ? ['dog', 'dogs'] : view.pet === 'cats' ? ['cat', 'cats'] : ['pet', 'pets'];
  const empty = `<div class="empty adopt-empty"><img src="/assets/img/paws-empty.svg" alt="" width="132" height="99" class="empty-art"><p>No ${word[1]} listed yet. Need to rehome a dog or cat?</p><a class="btn" href="/adopt/list/">List a pet</a></div>`;
  const pressed = (v) => String(view.pet === v);
  let content = tpl.content
    .replaceAll('{{ADOPT_CRUMBS}}', view.crumb ? crumbs.html : '').replaceAll('{{ADOPT_H1}}', esc(view.h1)).replaceAll('{{ADOPT_INTRO}}', esc(view.intro))
    .replaceAll('{{ADOPT_PET}}', view.pet).replaceAll('{{PRESSED_ALL}}', pressed('all')).replaceAll('{{PRESSED_DOGS}}', pressed('dogs')).replaceAll('{{PRESSED_CATS}}', pressed('cats'))
    .replaceAll('{{ADOPT_LIST_HEADING}}', `${word[1].charAt(0).toUpperCase() + word[1].slice(1)} looking for a home`)
    .replaceAll('{{ADOPT_COUNT}}', items.length ? `${items.length} ${items.length === 1 ? word[0] : word[1]}` : '')
    .replaceAll('{{ADOPT_TILES}}', items.length ? items.map(petTile).join('\n') : empty)
    .replaceAll('{{ADOPT_FAQ}}', adoptFaqHtml());
  content += `\n<script type="application/json" id="adopt-built">${JSON.stringify(listings.map((l) => l.id))}</script>`;
  const schema = [crumbs.schema, { '@context': 'https://schema.org', '@type': 'CollectionPage', name: view.h1, description: view.desc, url: SITE + view.path, isPartOf: { '@type': 'WebSite', name: 'Pet Primer', url: SITE + '/' },
    mainEntity: { '@type': 'ItemList', numberOfItems: live.length, itemListElement: live.slice(0, 100).map((l, i) => ({ '@type': 'ListItem', position: i + 1, url: SITE + petUrl(l), name: `${l.name}, ${A_PET[l.pet].toLowerCase()} for adoption in ${l.area}` })) } }];
  if (view.pet === 'all') schema.push({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: ADOPT_FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) });
  const ogImage = (live.find((l) => l.photo_url) || {}).photo_url || '/assets/img/three-dogs.jpg';
  return page({ pathName: view.path, nav: 'adopt', title: view.title, description: view.desc, ogImage, schema, content });
}
function adoptPreview(listings) {
  const live = listings.filter((l) => l.status === 'available').slice(0, 4);
  return live.length ? `<div class="adopt-grid" style="margin-top: 24px">${live.map(petTile).join('\n')}</div>` : '';
}
function adoptRow(listings) {
  const live = listings.filter((l) => l.status === 'available').slice(0, 3);
  const rehome = '<a class="dash-rehome" href="/adopt/list/"><strong>Rehoming a pet?</strong><span>List them free →</span></a>';
  const find = '<a class="dash-rehome dash-find" href="/adopt/"><strong>Looking for a pet?</strong><span>Dogs and cats who need a home →</span></a>';
  return (live.length ? live.map(petTile).join('\n') : find) + rehome;
}
function featuredCard(notes) {
  const p = notes.find((x) => x.cover_url) || notes[0];
  if (!p) return '';
  const grade = (p.claims || []).map((c) => c.grade).find((g) => g && g !== 'Pending');
  const label = grade ? `${grade} evidence` : `${PET[p.pet]} · ${KIND[p.kind]}`;
  return `<a class="dash-feature" href="${urlOf(p)}">${p.cover_url ? `<img src="${esc(p.cover_url)}" alt="${esc(p.cover_alt || '')}" fetchpriority="high">` : ''}<span class="dash-feature-body"><span class="dash-badge">${esc(label)}</span><strong>${esc(p.title)}</strong><span>${esc(summaryOf(p).length > 120 ? summaryOf(p).slice(0, 118).replace(/\s\S*$/, '') + '…' : summaryOf(p))}</span></span></a>`;
}
function petPage(l, listings) {
  const petWord = A_PET[l.pet].toLowerCase();
  const section = l.pet === 'cats' ? ['Cats', '/adopt/cats/'] : ['Dogs', '/adopt/dogs/'];
  const crumbs = adoptCrumbs([['Adopt', '/adopt/'], section, [l.name, petUrl(l)]]);
  const more = listings.filter((x) => x.id !== l.id && x.status === 'available' && x.pet === l.pet).sort((a, b) => (b.country === l.country) - (a.country === l.country)).slice(0, 4);
  const adopted = l.status === 'adopted';
  const about = String(l.about || '').split(/\n{2,}/).map((t) => `<p>${esc(t).replace(/\n/g, '<br>')}</p>`).join('');
  const listed = date(l.created_at);
  const content = `<article class="wrap adopt-page pet-page-wrap">
${crumbs.html}
<div class="pet-page">
${aImg(l, 'pet-page-img', true)}
<div class="pet-page-main">
<p class="eyebrow">${esc(A_PET[l.pet])} for adoption · ${esc(l.area)}, ${esc(l.country)}</p>
<div style="display: flex; flex-wrap: wrap; align-items: center; gap: 10px"><h1>${esc(l.name)}</h1>${adopted ? '<span class="pill adopt-done">Adopted</span>' : ''}${aLister(l)}</div>
<p style="color: var(--ink-2); font-weight: 600; font-size: 18px">${esc(aFacts(l))}</p>
<p class="small muted">${esc(l.area)}, ${esc(A_COUNTRY[l.country] || l.country)} · Listed ${esc(listed)}</p>
<div class="prose pet-about">${about}</div>
${l.good_with ? `<p><strong>Good with:</strong> ${esc(l.good_with)}</p>` : ''}
${adopted ? `<div class="adopt-contact"><strong>${esc(l.name)} has found a home.</strong><a href="${section[1]}">See other ${section[0].toLowerCase()} looking for a home</a></div>`
    : `<div class="adopt-contact" data-pet-contact data-id="${esc(l.id)}" data-lister="${esc(l.lister)}"><p class="small" style="color: var(--ink-2)">Sign in to see how to contact the person listing ${esc(l.name)}. It’s free and keeps their details away from spam.</p><button type="button" class="btn" data-sign-in>Sign in to contact</button></div>`}
<button type="button" class="btn plain" style="padding: 0; align-self: flex-start" data-pet-report="${esc(l.id)}">Report this listing</button>
</div>
</div>
${more.length ? `<section style="margin-top: 56px" aria-labelledby="more-h"><h2 id="more-h" style="font-size: 28px; margin-bottom: 18px">More ${section[0].toLowerCase()} looking for a home</h2><div class="adopt-grid">${more.map(petTile).join('\n')}</div><p style="margin-top: 18px"><a href="${section[1]}" style="font-weight: 600">See all ${section[0].toLowerCase()} for adoption →</a></p></section>` : ''}
<div class="panel" style="margin-top: 40px"><h2 style="font-size: 20px; font-family: var(--body)">Before ${esc(l.name)} comes home</h2><p class="muted">Read our <a href="/${l.pet}/">${petWord} care notes</a>, check <a href="/can-my-pet-eat/">which foods and plants are safe</a>, and ask other owners anything in the <a href="/community/">community</a>.</p></div>
</article>`;
  const desc = `Meet ${l.name} (${aFacts(l)}) in ${l.area}, ${l.country}, ${adopted ? 'who has found a new home' : 'looking for a new home'}. ${plainText(l.about)}`.slice(0, 158).replace(/\s\S*$/, '…');
  const schema = [crumbs.schema, { '@context': 'https://schema.org', '@type': 'WebPage', name: `${l.name}: ${petWord} for adoption in ${l.area}`, description: desc, url: SITE + petUrl(l), datePublished: l.created_at, dateModified: l.updated_at, ...(l.photo_url ? { primaryImageOfPage: { '@type': 'ImageObject', url: abs(l.photo_url) } } : {}), isPartOf: { '@type': 'CollectionPage', url: SITE + section[1] } }];
  return page({ pathName: petUrl(l), nav: 'adopt', title: `${l.name}: ${A_PET[l.pet]} for Adoption in ${l.area} | Pet Primer`, description: desc, robots: adopted ? 'noindex, follow' : 'index, follow', ogImage: l.photo_url || '/assets/img/three-dogs.jpg', schema, content: content + `\n<script type="module" src="/assets/js/adopt.js?v={{version}}"></script>` });
}

// ---------- Build ----------
async function build() {
  const listings = await loadListings();
  const posts = (await loadPosts()).filter((p) => p.status === 'published' && p.slug && !RESERVED_SLUGS.includes(p.slug));
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  copyDir(path.join(ROOT, 'assets'), path.join(OUT, 'assets'));
  // Files that must sit at the top of the site (e.g. Google Search Console verification).
  if (fs.existsSync(path.join(ROOT, 'static'))) copyDir(path.join(ROOT, 'static'), OUT);
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
  // Version every script import so a new deploy never mixes old and new scripts from the browser cache.
  const jsDir = path.join(OUT, 'assets/js');
  for (const f of fs.readdirSync(jsDir).filter((x) => x.endsWith('.js'))) {
    const file = path.join(jsDir, f);
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/(['"])\/assets\/js\/([\w-]+)\.js\1/g, `$1/assets/js/$2.js?v=${VERSION}$1`));
  }
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
<div style="display: flex; align-items: center; gap: 12px"><img src="/assets/img/golden-retriever-112.webp" alt="" width="44" height="44" style="width: 44px; height: 44px; border-radius: 50%; object-fit: cover; object-position: center 30%"><span style="display: flex; flex-direction: column; line-height: 1.3"><span style="font-weight: 600">Gilbert Jones</span><span class="small muted">${esc(p.author_note || 'Pet Primer')}</span></span></div>
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
    if (meta.custom === 'adopt') { for (const view of ADOPT_VIEWS) write(view.path, adoptPage({ content }, view, listings)); continue; }
    content = content.replaceAll('{{DOG_COUNT}}', count(dogs, 'Dog')).replaceAll('{{CAT_COUNT}}', count(cats, 'Cat'))
      .replaceAll('{{LATEST}}', notes.slice(0, 6).map(card).join('\n') || '<p class="muted">The first notes are being written now.</p>')
      .replaceAll('{{QUIZ_DATA}}', quizData(notes)).replaceAll('{{EAT_COUNT}}', String(CHECKER.items.length))
      .replaceAll('{{ADOPT_ROW}}', adoptRow(listings)).replaceAll('{{FEATURED}}', featuredCard(notes)).replaceAll('{{FAQ_LIST}}', faqList).replaceAll('{{MYTHS}}', mythSection).replaceAll('{{EXAMPLE_CLAIM}}', exampleClaim);
    const schema = meta.schema === 'home' ? homeSchema : meta.schema === 'contact' ? { '@context': 'https://schema.org', '@type': 'ContactPage', name: 'Contact Pet Primer', url: SITE + '/contact/', mainEntity: { '@type': 'Organization', name: 'Pet Primer', url: SITE + '/', email: 'petprimer.care@gmail.com', sameAs: ['https://www.instagram.com/petprimer.care/', 'https://x.com/PetPrimer1'] } } : meta.schema === 'about' ? { '@context': 'https://schema.org', '@type': 'AboutPage', name: 'About Pet Primer', url: SITE + '/about/', mainEntity: { '@type': 'Person', name: 'Gilbert Jones', description: 'Dog owner and creator of Pet Primer' } } : null;
    write(meta.path === '/404.html' ? '404.html' : meta.path, page({ pathName: meta.path, nav: meta.nav, title: meta.title, description: meta.description, robots: meta.noindex ? 'noindex, follow' : 'index, follow', schema, content, bare: meta.bare }));
  }

  for (const p of posts) write(urlOf(p), notePage(p, notes));
  for (const l of listings) write(petUrl(l), petPage(l, listings));
  write('/can-my-pet-eat/', eatIndex());
  for (const it of CHECKER.items) write(eatUrl(it), eatPage(it, posts));
  write(AUTHOR_URL, authorPage(notes));
  write('/dogs/', listingPage({ pathName: '/dogs/', nav: 'dogs', title: 'Dogs', h1: 'Dog care notes', intro: 'Behavior, diet, health and everyday care for dogs: real experience first, with every claim graded by the evidence.', items: dogs, seoTitle: 'Dog Care Notes Graded by the Evidence | Pet Primer', seoDesc: 'Practical dog care notes on behavior, diet and health, written from real experience with every claim graded by how strong the research is.' }));
  write('/cats/', listingPage({ pathName: '/cats/', nav: 'cats', title: 'Cats', h1: 'Cat care notes', intro: 'Behavior, diet, health and indoor life for cats, researched and graded the same way.', items: cats, seoTitle: 'Cat Care Notes Graded by the Evidence | Pet Primer', seoDesc: 'Practical cat care notes on behavior, diet, health and indoor life, with every claim graded by how strong the research is.' }));
  write('/faq/', listingPage({ pathName: '/faq/', nav: 'faq', title: 'FAQ', h1: 'Frequently asked questions', intro: 'The questions dog and cat owners ask most, answered from real experience and checked against the research.', items: faqs, seoTitle: 'Dog and Cat Questions Answered | Pet Primer FAQ', seoDesc: 'Answers to the questions dog and cat owners ask most, from real experience, with the evidence behind each claim graded in plain words.' }));
  write('/myths/', listingPage({ pathName: '/myths/', nav: 'myths', title: 'Myth checks', h1: 'Myth checks', intro: 'Popular dog and cat advice, checked against the research.', items: myths, seoTitle: 'Dog and Cat Myths Checked | Pet Primer', seoDesc: 'Popular dog and cat care advice checked against the research and graded in plain words.' }));

  // Search index
  const index = [
    ...notes.map((p) => ({ kind: KIND[p.kind], title: p.title, url: urlOf(p), keyword: p.focus_keyword, tags: p.tags, pet: PET[p.pet], summary: summaryOf(p), text: plainText(p.body).slice(0, 2000) })),
    { kind: 'Page', title: 'Dog care notes', url: '/dogs/', tags: 'dog dogs puppy', summary: 'All dog notes.', text: '' },
    { kind: 'Page', title: 'Cat care notes', url: '/cats/', tags: 'cat cats kitten', summary: 'All cat notes.', text: '' },
    { kind: 'Page', title: 'Frequently asked questions', url: '/faq/', tags: 'faq questions answers', summary: 'Common dog and cat questions.', text: '' },
    { kind: 'Adopt', title: 'Help me find a pet', url: '/adopt/', tags: 'help me find a pet adopt adoption rehome rehoming rescue shelter new home puppy kitten find a pet', summary: 'Dogs and cats who need a home, listed free by owners and rescues.', text: '' },
    { kind: 'Adopt', title: 'Help me find a dog', url: '/adopt/dogs/', tags: 'dogs for adoption puppy adopt a dog near me rehome', summary: 'Dogs and puppies for adoption.', text: '' },
    { kind: 'Adopt', title: 'Help me find a cat', url: '/adopt/cats/', tags: 'cats for adoption kitten adopt a cat near me rehome', summary: 'Cats and kittens for adoption.', text: '' },
    { kind: 'Adopt', title: 'List a pet for adoption', url: '/adopt/list/', tags: 'rehome rehoming give away my dog cat list post adoption rescue', summary: 'Rehoming a pet? List them free.', text: '' },
    ...listings.filter((l) => l.status === 'available').map((l) => ({ kind: 'Adopt', title: `${l.name}: ${A_PET[l.pet].toLowerCase()} for adoption in ${l.area}`, url: petUrl(l), tags: `adopt adoption rehome ${l.pet} ${A_PET[l.pet].toLowerCase()} ${l.area} ${l.country}`, summary: aFacts(l), text: String(l.about || '').slice(0, 400) })),
    { kind: 'Community', title: 'Community board', url: '/community/', tags: 'community ask question photo help forum okay share', summary: 'Get a second opinion from other owners and share photos.', text: '' },
    { kind: 'Page', title: 'Contact Pet Primer', url: '/contact/', tags: 'contact email message instagram x twitter correction help support account', summary: 'Email petprimer.care@gmail.com or find us on Instagram and X.', text: '' },
    { kind: 'Page', title: 'Who’s behind Pet Primer', url: '/about/', tags: 'about gilbert jones who vet veterinarian', summary: 'Gilbert Jones and why Pet Primer exists.', text: '' },
    ...CHECKER.items.map((it) => ({ kind: 'Can my pet eat this?', title: eatTitle(it), url: eatUrl(it), tags: `${it.name} ${it.aka || ''} eat safe toxic poison ${it.group}`, summary: `Dogs: ${EAT[it.dog][0]}. Cats: ${EAT[it.cat][0]}.`, text: `${it.dog_note || ''} ${it.cat_note || ''}` })),
    { kind: 'Tool', title: 'Can my pet eat this?', url: '/can-my-pet-eat/', tags: 'eat safe toxic food plant poison checker', summary: 'Check foods and plants for dogs and cats.', text: '' },
    { kind: 'Tool', title: 'Chocolate risk calculator', url: '/tools/chocolate-calculator/', tags: 'chocolate calculator theobromine dose dog ate chocolate', summary: 'How serious is the chocolate your dog ate?', text: '' },
    { kind: 'Tool', title: 'Dog age calculator', url: '/tools/dog-age/', tags: 'dog age human years calculator', summary: 'Your dog’s age in human years, from a 2020 study.', text: '' },
    { kind: 'Tool', title: 'Myth or Fact quiz', url: '/tools/myth-quiz/', tags: 'quiz myth fact test', summary: 'Ten quick pet care myths and facts.', text: '' },
    { kind: 'Page', title: 'Pet poisoning emergency', url: '/emergency/', tags: 'emergency poison poisoned ate help vet hotline helpline number urgent', summary: 'What to do now, and US and UK poison line numbers.', text: '' },
    { kind: 'Page', title: 'Membership', url: '/#membership', tags: 'membership price cost join plan subscribe', summary: '$9–15 a month or $79–129 a year.', text: '' }
  ];
  fs.writeFileSync(path.join(OUT, 'search-index.json'), JSON.stringify(index));

  // Sitemap + robots
  const today = new Date().toISOString().slice(0, 10);
  const urls = [['/', today], ['/dogs/', today], ['/cats/', today], ['/faq/', today], ['/community/', today], ['/adopt/', today], ['/adopt/dogs/', today], ['/adopt/cats/', today], ['/adopt/list/', today], ['/about/', today], ['/contact/', today], ['/myths/', today], ['/how-we-grade/', today], ['/privacy/', today], ['/terms/', today], ['/emergency/', today], ['/tools/', today], ['/tools/chocolate-calculator/', today], ['/tools/dog-age/', today], ['/tools/myth-quiz/', today], ['/can-my-pet-eat/', today], [AUTHOR_URL, today],
    ...CHECKER.items.map((it) => [eatUrl(it), '2026-10-17']),
    ...posts.map((p) => [urlOf(p), String(p.updated_at || p.published_at || today).slice(0, 10)]),
    ...listings.filter((l) => l.status === 'available').map((l) => [petUrl(l), String(l.updated_at || l.created_at).slice(0, 10)])];
  fs.writeFileSync(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(([u, d]) => `<url><loc>${SITE}${u}</loc><lastmod>${d}</lastmod></url>`).join('\n')}\n</urlset>\n`);
  fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /editor/\nDisallow: /dashboard/\nDisallow: /search/\n\nSitemap: ${SITE}/sitemap.xml\n`);
  console.log(`Built ${posts.length} notes and ${fs.readdirSync(path.join(ROOT, 'pages')).length} pages into _site/ (version ${VERSION}).`);
}

build().catch((err) => { console.error(err); process.exit(1); });

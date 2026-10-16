import { getClient, el, toast, currentProfile, shrinkImage, rank } from '/assets/js/app.js';
import { renderMarkdown, slugify, RESERVED_SLUGS, GRADES, gradeClass, plainText, esc } from '/assets/js/markdown.js';
import { loadWorkspace, researchView, sourcesView, sourcePicker } from '/assets/js/workspace.js';

const root = document.querySelector('[data-editor]');
const REPO_ACTIONS = 'https://github.com/kjayson2015-commits/petprimer/actions/workflows/deploy.yml';
const KINDS = { note: 'Note', faq: 'FAQ', myth: 'Myth check', page: 'Page' };
const PETS = { dogs: 'Dogs', cats: 'Cats', both: 'Dogs and cats' };
const STATUS = { draft: 'Draft', review: 'Review', published: 'Published' };
const STATUS_COLORS = { published: ['#D3E6D9', '#1F4D36'], draft: ['#EEF0EC', '#3A4540'], review: ['#FBE9C8', '#6B3F0A'] };
const S = { sb: null, me: null, posts: [], section: 'research', q: '', cur: null, dirty: false, preview: false, reports: [], profiles: [], waitlist: 0, notes: [], sources: [], curNoteId: null, curSourceId: null, wsError: null };

const FILTERS = {
  all: () => true,
  dogs: (p) => p.pet === 'dogs' || p.pet === 'both',
  cats: (p) => p.pet === 'cats' || p.pet === 'both',
  faq: (p) => p.kind === 'faq',
  myth: (p) => p.kind === 'myth',
  drafts: (p) => p.status !== 'published',
  pages: (p) => p.kind === 'page'
};
const LABELS = { research: 'Research notes', sources: 'Source library', all: 'All content', dogs: 'Dogs', cats: 'Cats', faq: 'Frequently asked', myth: 'Myth checks', drafts: 'Drafts and review', pages: 'Pages', reports: 'Reported posts', members: 'Members and badges', waitlist: 'Membership waitlist', publish: 'Publish the site' };

function gate(msg, withButton) {
  root.replaceChildren(el('div', { class: 'gate' },
    el('a', { href: '/', class: 'brand' }, el('img', { src: '/assets/img/golden-retriever.jpg', alt: '', width: 44, height: 44 }), el('span', { text: 'Pet Primer editor' })),
    el('p', { text: msg }),
    withButton ? el('button', { type: 'button', class: 'btn', 'data-sign-in': '', text: 'Sign in with email' }) : null,
    el('a', { href: '/', text: 'Back to the site' })));
}

// ---------- Data ----------
async function loadPosts() {
  const { data, error } = await S.sb.from('posts').select('*').order('updated_at', { ascending: false });
  if (error) { toast('Could not load posts: ' + error.message); return; }
  S.posts = data || [];
}
async function loadReports() {
  const { data } = await S.sb.from('reports').select('*').order('created_at', { ascending: false }).limit(100);
  const reports = data || [];
  const postIds = reports.filter((r) => r.target_type === 'post').map((r) => r.target_id);
  const commentIds = reports.filter((r) => r.target_type === 'comment').map((r) => r.target_id);
  const [posts, comments] = await Promise.all([
    postIds.length ? S.sb.from('community_posts').select('id, body, removed, author:profiles!community_posts_author_id_fkey(display_name)').in('id', postIds) : { data: [] },
    commentIds.length ? S.sb.from('comments').select('id, body, removed, post_id, author:profiles!comments_author_id_fkey(display_name)').in('id', commentIds) : { data: [] }
  ]);
  const map = new Map([...(posts.data || []), ...(comments.data || [])].map((x) => [x.id, x]));
  S.reports = reports.map((r) => ({ ...r, target: map.get(r.target_id) }));
}
async function loadMembers() {
  const [{ data }, wl] = await Promise.all([
    S.sb.from('profiles').select('id, display_name, handle, badge, is_admin, created_at').order('created_at', { ascending: false }).limit(500),
    S.sb.from('waitlist').select('email', { count: 'exact', head: true })
  ]);
  S.profiles = data || [];
  S.waitlist = wl.count || 0;
}

function blankPost() {
  return { id: null, kind: 'note', pet: 'dogs', access: 'free', status: 'draft', title: '', slug: '', bottom_line: '', body: '', cover_url: '', cover_alt: '', author_note: '', verdict: '', claims: [], focus_keyword: '', seo_title: '', meta_desc: '', tags: '', _slugAuto: true };
}

async function save(nextStatus) {
  const p = S.cur;
  if (!p.title.trim()) return toast('Give it a title first.');
  if (!p.slug) p.slug = slugify(p.title);
  if (RESERVED_SLUGS.includes(p.slug)) return toast('That web address is used by the site. Change the address.');
  const clash = S.posts.find((x) => x.slug === p.slug && x.id !== p.id);
  if (clash) return toast('Another post already uses that web address.');
  const row = { kind: p.kind, pet: p.pet, access: p.access, status: nextStatus || p.status, title: p.title.trim(), slug: p.slug, bottom_line: p.bottom_line, body: p.body, cover_url: p.cover_url || null, cover_alt: p.cover_alt, author_note: p.author_note, verdict: p.verdict || null, claims: p.claims.filter((c) => c.text.trim()), focus_keyword: p.focus_keyword, seo_title: p.seo_title, meta_desc: p.meta_desc, tags: p.tags };
  if (row.status === 'published' && !p.published_at) row.published_at = new Date().toISOString();
  if (nextStatus === 'published') row.reviewed_at = new Date().toISOString();
  const res = p.id ? await S.sb.from('posts').update(row).eq('id', p.id).select().single() : await S.sb.from('posts').insert(row).select().single();
  if (res.error) return toast('Could not save: ' + res.error.message);
  S.dirty = false;
  await loadPosts();
  if (p._fromNoteId) {
    await S.sb.from('research_notes').update({ post_id: res.data.id }).eq('id', p._fromNoteId);
    const note = S.notes.find((n) => n.id === p._fromNoteId); if (note) note.post_id = res.data.id;
  }
  S.cur = { ...res.data, _slugAuto: false };
  toast(nextStatus === 'published' ? 'Published. It appears on petprimer.online at the next site update.' : 'Saved.');
  render();
}

async function remove() {
  if (!S.cur.id) { S.cur = null; render(); return; }
  if (!window.confirm(`Delete “${S.cur.title}” for good? This cannot be undone.`)) return;
  const { error } = await S.sb.from('posts').delete().eq('id', S.cur.id);
  if (error) return toast('Could not delete: ' + error.message);
  await loadPosts(); S.cur = null; toast('Deleted.'); render();
}

// ---------- SEO checks ----------
function seoChecks(p) {
  const focus = (p.focus_keyword || '').toLowerCase().trim();
  const has = (t) => focus && (t || '').toLowerCase().includes(focus);
  const fw = focus.split(/\s+/).filter((w) => w.length > 2);
  const tl = (p.seo_title || '').length, dl = (p.meta_desc || '').length;
  return [
    [!!focus, 'Focus keyword chosen'],
    [has(p.seo_title), 'Keyword is in the SEO title'],
    [has(p.meta_desc) || (fw.length > 0 && fw.every((w) => (p.meta_desc || '').toLowerCase().includes(w.slice(0, 4)))), 'Keyword words are in the description'],
    [has(p.title) || has(plainText(p.body).slice(0, 300)), 'Keyword is in the title or first paragraph'],
    [tl >= 30 && tl <= 60, 'SEO title is 30–60 characters'],
    [dl >= 120 && dl <= 160, 'Description is 120–160 characters'],
    [!!p.slug && p.slug.length <= 60 && fw.some((w) => p.slug.includes(w.slice(0, 4))), 'Web address is short and has the keyword'],
    [!!p.bottom_line && p.bottom_line.length >= 40, 'Has a one-sentence bottom line'],
    [p.claims.some((c) => c.grade !== 'Pending' && (c.sources || []).length), 'At least one claim is graded with a source'],
    [plainText(p.body).split(' ').length >= 300, 'Body is at least 300 words']
  ];
}

// ---------- Rendering ----------
function sidebar() {
  const navBtn = (id, count) => el('button', { type: 'button', class: 'nav', 'aria-pressed': S.section === id && !S.q ? 'true' : 'false', onclick: () => go(id) },
    el('span', { text: LABELS[id] }), count === undefined ? null : el('span', { class: 'small muted', text: String(count) }));
  const search = el('input', { type: 'search', class: 'field', placeholder: 'Search everything…', 'aria-label': 'Search all content', value: S.q, style: 'min-height:42px;padding:0 12px' });
  search.addEventListener('input', () => { const was = !!listEl; S.q = search.value; if (!was || !S.q) { render(); const f = root.querySelector('.ed-side input[type=search]'); if (f) { f.focus(); f.setSelectionRange(f.value.length, f.value.length); } } else paintList(); });
  return el('aside', { class: 'ed-side', 'aria-label': 'Editor sections' },
    el('a', { href: '/', class: 'brand' }, el('img', { src: '/assets/img/golden-retriever.jpg', alt: '', width: 36, height: 36, style: 'width:36px;height:36px' }),
      el('span', { style: 'display:flex;flex-direction:column;line-height:1.2' }, el('span', { style: 'font-size:17px', text: 'Pet Primer' }), el('span', { class: 'small muted', style: 'font-family:var(--body);font-weight:400;font-size:12px', text: 'Editor · only you see this' }))),
    search,
    el('button', { type: 'button', class: 'btn', text: '+ New article', onclick: () => { if (!confirmLeave()) return; S.cur = blankPost(); S.section = 'all'; S.q = ''; render(); } }),
    el('div', { class: 'grp' }, el('span', { class: 'lbl', text: 'Research (private)' }), navBtn('research', S.notes.length), navBtn('sources', S.sources.length)),
    el('div', { class: 'grp' }, el('span', { class: 'lbl', text: 'Articles readers see' }), ...['all', 'dogs', 'cats', 'faq', 'myth', 'drafts', 'pages'].map((id) => navBtn(id, S.posts.filter(FILTERS[id]).length))),
    el('div', { class: 'grp' }, el('span', { class: 'lbl', text: 'Community' }), navBtn('reports', S.reports.filter((r) => r.status === 'open').length), navBtn('members')),
    el('div', { class: 'grp' }, el('span', { class: 'lbl', text: 'Business' }), navBtn('waitlist'), navBtn('publish')),
    el('span', { style: 'margin-top:auto', class: 'small muted' }, 'Signed in as ', el('strong', { text: S.me.display_name || 'you' })));
}

function confirmLeave() { return !S.dirty || window.confirm('You have unsaved changes. Leave without saving?'); }
async function go(id) {
  if (!confirmLeave()) return;
  S.section = id; S.q = ''; S.dirty = false;
  if (id === 'reports') await loadReports();
  if (id === 'members' || id === 'waitlist') await loadMembers();
  if (id === 'research' || id === 'sources') await loadWorkspace(S);
  if (FILTERS[id]) S.cur = S.cur && FILTERS[id](S.cur) ? S.cur : (S.posts.filter(FILTERS[id])[0] ? { ...S.posts.filter(FILTERS[id])[0], _slugAuto: false } : null);
  render();
}

let listEl = null;
function paintList() {
  if (!listEl) return;
  let items, title, sub, extra = [];
  if (S.q.trim()) {
    const idx = S.posts.map((p) => ({ p, title: p.title, keyword: p.focus_keyword, tags: p.tags, pet: p.pet, kind: KINDS[p.kind], summary: p.bottom_line, text: plainText(p.body) }));
    items = rank(idx, S.q, 50).map((r) => r.p);
    const noteHits = rank(S.notes.map((n) => ({ n, title: n.title, tags: n.tags, text: plainText(n.body) })), S.q, 20).map((r) => r.n);
    const srcHits = rank(S.sources.map((x) => ({ x, title: x.title, tags: x.kind + ' ' + x.authors, text: x.summary })), S.q, 20).map((r) => r.x);
    extra = [
      ...noteHits.map((n) => el('button', { type: 'button', class: 'item', onclick: () => { S.q = ''; S.section = 'research'; S.curNoteId = n.id; render(); } }, el('span', { style: 'font-weight:600', text: n.title }), el('span', { class: 'small muted', text: 'Research note · ' + plainText(n.body).slice(0, 60) }))),
      ...srcHits.map((x) => el('button', { type: 'button', class: 'item', onclick: () => { S.q = ''; S.section = 'sources'; S.curSourceId = x.id; render(); } }, el('span', { style: 'font-weight:600', text: x.title }), el('span', { class: 'small muted', text: 'Source · ' + x.kind })))
    ];
    const total = items.length + extra.length;
    title = 'Search'; sub = `${total} ${total === 1 ? 'result' : 'results'} for “${S.q.trim()}”`;
  } else {
    items = S.posts.filter(FILTERS[S.section] || FILTERS.all);
    title = LABELS[S.section] || 'All content'; sub = `${items.length} ${items.length === 1 ? 'item' : 'items'}`;
  }
  listEl.replaceChildren(el('div', { class: 'head' }, el('h1', { style: 'font-size:22px', text: title }), el('span', { class: 'small muted', text: sub })),
    ...(items.length ? items.map((p) => {
      const c = STATUS_COLORS[p.status] || STATUS_COLORS.draft;
      const b = el('button', { type: 'button', class: 'item', 'aria-pressed': S.cur && S.cur.id === p.id ? 'true' : 'false' },
        el('span', { style: 'font-weight:600', text: p.title || 'Untitled' }),
        el('span', { class: 'small muted', text: (p.bottom_line || plainText(p.body) || 'No text yet').slice(0, 80) }),
        el('span', { style: 'display:flex;gap:6px;flex-wrap:wrap' }, el('span', { class: 'pill', style: `font-size:12px;background:${c[0]};color:${c[1]}`, text: STATUS[p.status] }), el('span', { class: 'pill', style: 'font-size:12px', text: `${KINDS[p.kind]} · ${PETS[p.pet]}` })));
      b.addEventListener('click', () => { if (!confirmLeave()) return; S.cur = { ...p, claims: (p.claims || []).map((x) => ({ ...x })), _slugAuto: false }; S.dirty = false; S.preview = false; render(); });
      return b;
    }) : (extra.length ? [] : [el('p', { class: 'muted', style: 'padding:24px 16px', text: S.q ? 'Nothing found. Try another word or check the spelling.' : 'Nothing here yet. Click “+ New article”.' })])), ...extra);
}

function field(label, input) { return el('label', {}, el('span', { text: label }), input); }
function bind(input, key, after) {
  input.addEventListener('input', () => { S.cur[key] = input.value; S.dirty = true; if (after) after(); refreshSeo(); });
  return input;
}

let seoEl = null;
function refreshSeo() {
  if (!seoEl || !S.cur) return;
  const p = S.cur;
  const checks = seoChecks(p);
  const passed = checks.filter((c) => c[0]).length;
  const [bg, fg] = passed >= 8 ? ['#D3E6D9', '#1F4D36'] : passed >= 6 ? ['#FBE9C8', '#6B3F0A'] : ['#F2DADA', '#8A2B2B'];
  seoEl.querySelector('[data-score]').replaceWith(el('span', { 'data-score': '', class: 'pill', style: `background:${bg};color:${fg};font-weight:700`, text: `${passed} of ${checks.length}` }));
  seoEl.querySelector('[data-tcount]').textContent = `${(p.seo_title || '').length}/60`;
  seoEl.querySelector('[data-dcount]').textContent = `${(p.meta_desc || '').length}/160`;
  seoEl.querySelector('[data-pv-url]').textContent = `petprimer.online › ${p.slug || ''}`;
  seoEl.querySelector('[data-pv-title]').textContent = p.seo_title || p.title || 'Untitled';
  seoEl.querySelector('[data-pv-desc]').textContent = p.meta_desc || p.bottom_line || 'Add a description so Google shows your summary instead of guessing one.';
  seoEl.querySelector('[data-checks]').replaceChildren(...checks.map(([ok, label]) => el('div', { class: 'check' }, el('span', { class: 'dot', style: `background:${ok ? '#1F4D36' : '#B0703A'}`, 'aria-hidden': 'true', text: ok ? '✓' : '!' }), el('span', { text: (ok ? '' : 'To do: ') + label }))));
}

function claimsEditor() {
  const wrap = el('div', { style: 'display:flex;flex-direction:column;gap:10px' });
  const paint = () => {
    wrap.replaceChildren(...S.cur.claims.map((c, i) => {
      const text = el('input', { type: 'text', value: c.text, placeholder: 'Claim, written as a plain statement', 'aria-label': 'Claim', style: 'flex:1 1 260px' });
      text.addEventListener('input', () => { c.text = text.value; S.dirty = true; });
      const grade = el('select', { 'aria-label': 'Evidence grade' }, ...GRADES.map((g) => el('option', { value: g, text: g, selected: c.grade === g })));
      grade.addEventListener('change', () => { c.grade = grade.value; S.dirty = true; refreshSeo(); });
      const src = el('input', { type: 'text', value: (c.sources || []).join(', '), placeholder: 'Source links, separated by commas', 'aria-label': 'Sources', style: 'flex:1 1 100%' });
      src.addEventListener('input', () => { c.sources = src.value.split(',').map((s) => s.trim()).filter(Boolean); S.dirty = true; refreshSeo(); });
      const note = el('input', { type: 'text', value: c.note || '', placeholder: 'What the research found, in one or two sentences', 'aria-label': 'Evidence summary', style: 'flex:1 1 100%' });
      note.addEventListener('input', () => { c.note = note.value; S.dirty = true; });
      const pick = sourcePicker(S, (url) => { c.sources = [...new Set([...(c.sources || []), url])]; src.value = c.sources.join(', '); S.dirty = true; refreshSeo(); });
      return el('div', { class: 'ed-claim' }, text, grade, note, src, pick,
        el('button', { type: 'button', class: 'btn plain', style: 'min-height:32px;color:var(--danger)', text: 'Remove claim', onclick: () => { S.cur.claims.splice(i, 1); S.dirty = true; paint(); refreshSeo(); } }));
    }));
  };
  paint();
  return el('div', { style: 'border-top:1px solid var(--line);padding-top:16px;display:flex;flex-direction:column;gap:10px' },
    el('div', { style: 'display:flex;justify-content:space-between;align-items:center;gap:12px' }, el('h2', { style: 'font-size:17px;font-family:var(--body)', text: 'Claims and evidence grades' }),
      el('button', { type: 'button', class: 'btn ghost', style: 'min-height:36px', text: '+ Add claim', onclick: () => { S.cur.claims.push({ text: '', grade: 'Pending', note: '', sources: [] }); S.dirty = true; paint(); } })),
    wrap);
}

function contentEditor() {
  const p = S.cur;
  if (!p) return el('div', { style: 'padding:40px;color:var(--ink-3)', text: 'Pick something on the left, or click “+ New note”.' });
  const sel = (key, opts) => { const s = el('select', {}, ...Object.entries(opts).map(([v, t]) => el('option', { value: v, text: t, selected: p[key] === v }))); s.addEventListener('change', () => { p[key] = s.value; S.dirty = true; render(); }); return s; };
  const c = STATUS_COLORS[p.status] || STATUS_COLORS.draft;
  const bar = el('div', { class: 'ed-bar' },
    el('label', {}, 'Pet', sel('pet', PETS)), el('label', {}, 'Type', sel('kind', KINDS)), el('label', {}, 'Access', sel('access', { free: 'Free', members: 'Members' })),
    el('span', { class: 'pill', style: `background:${c[0]};color:${c[1]}`, text: STATUS[p.status] + (S.dirty ? ' · unsaved' : '') }),
    el('span', { style: 'margin-left:auto' }),
    el('button', { type: 'button', class: 'btn plain', text: S.preview ? 'Edit' : 'Preview', onclick: () => { S.preview = !S.preview; render(); } }),
    p.status === 'published' ? el('button', { type: 'button', class: 'btn plain', text: 'Unpublish', onclick: () => save('draft') }) : el('button', { type: 'button', class: 'btn ghost', text: 'Save draft', onclick: () => save(p.status === 'review' ? 'review' : 'draft') }),
    p.status === 'published' ? null : el('button', { type: 'button', class: 'btn ghost', text: 'Ready for review', onclick: () => save('review') }),
    el('button', { type: 'button', class: 'btn', text: p.status === 'published' ? 'Update' : 'Publish', onclick: () => save('published') }));

  const title = bind(el('input', { class: 'title-in', type: 'text', value: p.title, placeholder: 'Title', 'aria-label': 'Title' }), 'title', () => { if (p._slugAuto) { p.slug = slugify(p.title); const s = seoEl && seoEl.querySelector('[data-slug]'); if (s) s.value = p.slug; } });
  const bottom = bind(el('textarea', { class: 'small-ta meta-in', rows: 2, placeholder: 'Bottom line: the answer in one or two sentences. Shown at the top and in search results.', 'aria-label': 'Bottom line', style: 'padding:8px 10px;font-size:16px' }), 'bottom_line');
  bottom.value = p.bottom_line || '';
  const author = bind(el('input', { class: 'meta-in', type: 'text', value: p.author_note || '', placeholder: 'Byline note, e.g. From my own dog · personal experience', 'aria-label': 'Byline note' }), 'author_note');
  const body = bind(el('textarea', { class: 'body-in', placeholder: 'Start writing. Leave a blank line between paragraphs. Use ## for a heading and - for a list.', 'aria-label': 'Body' }), 'body');
  body.value = p.body || '';

  const coverInput = el('input', { type: 'file', accept: 'image/*', class: 'sr-only', id: 'cover-file' });
  const coverImg = p.cover_url ? el('img', { src: p.cover_url, alt: '', style: 'width:100%;max-height:220px;object-fit:cover;border-radius:12px' }) : null;
  coverInput.addEventListener('change', async () => {
    const f = coverInput.files[0]; if (!f) return;
    toast('Uploading photo…');
    try {
      const blob = await shrinkImage(f, 1800);
      const path = `site/${Date.now()}.jpg`;
      const up = await S.sb.storage.from('photos').upload(path, blob, { contentType: 'image/jpeg' });
      if (up.error) throw up.error;
      p.cover_url = S.sb.storage.from('photos').getPublicUrl(path).data.publicUrl;
      S.dirty = true; toast('Photo added. Save to keep it.'); render();
    } catch (err) { toast('Upload failed: ' + (err.message || err)); }
  });
  const coverAlt = bind(el('input', { class: 'meta-in', type: 'text', value: p.cover_alt || '', placeholder: 'Describe the photo for screen readers and Google', 'aria-label': 'Photo description' }), 'cover_alt');
  const verdict = p.kind === 'myth' ? el('label', { style: 'display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600' }, 'Verdict', (() => { const s = el('select', { class: 'meta-in' }, ...GRADES.map((g) => el('option', { value: g, text: g, selected: p.verdict === g }))); s.addEventListener('change', () => { p.verdict = s.value; S.dirty = true; }); return s; })()) : null;

  const write = el('div', { class: 'ed-write' }, title,
    S.preview
      ? el('div', { class: 'prose', style: 'font-size:17px' }, (() => { const d = el('div', { style: 'display:contents' }); d.innerHTML = renderMarkdown(p.body, { link: (t, l) => { const hit = S.posts.find((x) => x.status === 'published' && (x.title.toLowerCase() === t.toLowerCase() || x.slug === t.toLowerCase())); return hit ? `<a href="/${hit.slug}/" target="_blank">${esc(l || hit.title)}</a>` : null; } }); return d; })())
      : el('div', { style: 'display:flex;flex-direction:column;gap:12px' }, bottom, author, verdict,
        el('div', { style: 'display:flex;flex-wrap:wrap;gap:10px;align-items:center' }, el('label', { for: 'cover-file', class: 'btn ghost', style: 'border-style:dashed;min-height:38px', text: p.cover_url ? 'Change photo' : 'Add cover photo' }), coverInput, p.cover_url ? el('button', { type: 'button', class: 'btn plain', text: 'Remove photo', onclick: () => { p.cover_url = ''; S.dirty = true; render(); } }) : null),
        coverImg, p.cover_url ? coverAlt : null, body),
    claimsEditor(),
    el('div', { style: 'border-top:1px solid var(--line);padding-top:16px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px' },
      p.status === 'published' && p.slug ? el('a', { href: `/${p.slug}/`, target: '_blank', rel: 'noopener', text: 'View on the site ↗' }) : el('span'),
      el('button', { type: 'button', class: 'btn plain', style: 'color:var(--danger)', text: 'Delete', onclick: remove })));

  const tags = bind(el('input', { type: 'text', value: p.tags || '', placeholder: 'grass, eating, stomach' }), 'tags');
  const focus = bind(el('input', { type: 'text', value: p.focus_keyword || '', placeholder: 'e.g. why does my dog eat grass' }), 'focus_keyword');
  const st = bind(el('input', { type: 'text', value: p.seo_title || '' }), 'seo_title');
  const md = bind(el('textarea', { rows: 3 }), 'meta_desc'); md.value = p.meta_desc || '';
  const slug = el('input', { type: 'text', value: p.slug || '', 'data-slug': '', style: 'flex:1;min-width:0;border:0;padding:0 8px 0 0' });
  slug.addEventListener('input', () => { p.slug = slugify(slug.value); p._slugAuto = false; S.dirty = true; refreshSeo(); });
  seoEl = el('aside', { class: 'ed-seo', 'aria-label': 'Google SEO' },
    el('div', { style: 'display:flex;justify-content:space-between;align-items:center' }, el('h2', { style: 'font-size:17px;font-family:var(--body)', text: 'Google SEO' }), el('span', { 'data-score': '' })),
    field('Focus keyword (what people type into Google)', focus),
    el('label', {}, el('span', { style: 'display:flex;justify-content:space-between' }, el('span', { text: 'SEO title' }), el('span', { 'data-tcount': '', style: 'font-weight:400;color:#5A655F' })), st),
    el('label', {}, el('span', { style: 'display:flex;justify-content:space-between' }, el('span', { text: 'Meta description' }), el('span', { 'data-dcount': '', style: 'font-weight:400;color:#5A655F' })), md),
    el('label', {}, el('span', { text: 'Web address' }), el('span', { style: 'display:flex;align-items:center;border:1px solid #C9D0CB;border-radius:8px;background:#fff;overflow:hidden' }, el('span', { class: 'small muted', style: 'padding:0 4px 0 10px;white-space:nowrap', text: 'petprimer.online/' }), slug)),
    field('Search tags (other words people use)', tags),
    el('div', { style: 'display:flex;flex-direction:column;gap:4px;padding:14px;background:#fff;border:1px solid var(--line);border-radius:10px' },
      el('span', { class: 'small muted', style: 'font-size:12px', text: 'Google preview' }), el('span', { 'data-pv-url': '', class: 'small', style: 'color:#3A4540' }),
      el('span', { 'data-pv-title': '', style: 'font-size:18px;line-height:1.3;color:#1A0DAB' }), el('span', { 'data-pv-desc': '', class: 'small', style: 'color:#3A4540' })),
    el('div', { 'data-checks': '', style: 'display:flex;flex-direction:column;gap:6px' }),
    el('p', { class: 'small muted', style: 'font-size:12px', text: `Added automatically when the site updates: sitemap entry, ${p.kind === 'faq' ? 'FAQ' : 'Article'} structured data for Google, share preview, breadcrumb and links to related notes.` }));
  setTimeout(refreshSeo, 0);
  return el('div', { style: 'display:flex;flex-direction:column;min-height:100%' }, bar, el('div', { class: 'ed-cols' }, write, seoEl));
}

function reportsView() {
  const act = async (r, status) => {
    if (status === 'removed' && r.target) {
      const table = r.target_type === 'post' ? 'community_posts' : 'comments';
      const res = await S.sb.from(table).update({ removed: true }).eq('id', r.target_id);
      if (res.error) return toast('Could not remove: ' + res.error.message);
    }
    const { error } = await S.sb.from('reports').update({ status }).eq('id', r.id);
    if (error) return toast('Could not update the report.');
    await loadReports(); toast('Done.'); render();
  };
  return el('div', { style: 'padding:28px;display:flex;flex-direction:column;gap:16px;max-width:820px' },
    el('h2', { style: 'font-size:26px', text: 'Reported posts' }),
    ...(S.reports.length ? S.reports.map((r) => el('div', { class: 'panel', style: 'background:var(--ground)' },
      el('span', { class: 'small muted', text: `${r.target_type === 'post' ? 'Post' : 'Reply'} by ${(r.target && r.target.author && r.target.author.display_name) || 'member'} · reported ${new Date(r.created_at).toLocaleDateString()}` }),
      el('p', { style: 'font-size:16px;white-space:pre-line', text: r.target ? r.target.body : '(already deleted)' }),
      el('span', { class: 'small' }, el('strong', { text: 'Reason: ' }), r.reason),
      el('span', { class: 'small' }, el('strong', { text: 'Status: ' }), r.status),
      r.target && r.target_type === 'comment' ? el('a', { class: 'small', href: `/community/post/?id=${r.target.post_id}`, target: '_blank', text: 'Open the thread ↗' }) : r.target ? el('a', { class: 'small', href: `/community/post/?id=${r.target_id}`, target: '_blank', text: 'Open the post ↗' }) : null,
      r.status === 'open' ? el('div', { style: 'display:flex;flex-wrap:wrap;gap:10px' },
        el('button', { type: 'button', class: 'btn ghost', text: 'Keep post', onclick: () => act(r, 'kept') }),
        el('button', { type: 'button', class: 'btn ghost', style: 'background:var(--amber-soft);color:var(--amber-ink);border-color:var(--amber-soft)', text: 'Mark member warned', onclick: () => act(r, 'warned') }),
        el('button', { type: 'button', class: 'btn danger', text: 'Remove post', onclick: () => act(r, 'removed') })) : null))
      : [el('p', { class: 'muted', text: 'No reports. The community is behaving.' })]));
}

function membersView() {
  return el('div', { style: 'padding:28px;display:flex;flex-direction:column;gap:14px;max-width:820px' },
    el('h2', { style: 'font-size:26px', text: 'Members and badges' }),
    el('p', { class: 'muted', text: 'Give the Verified vet badge only after checking a license. Experienced keeper is for long-time helpful members.' }),
    ...S.profiles.map((m) => {
      const s = el('select', { class: 'field', style: 'min-height:38px;padding:0 8px', 'aria-label': 'Badge for ' + (m.display_name || 'member') },
        el('option', { value: '', text: 'No badge', selected: !m.badge }), el('option', { value: 'vet', text: 'Verified vet', selected: m.badge === 'vet' }), el('option', { value: 'keeper', text: 'Experienced keeper', selected: m.badge === 'keeper' }));
      s.addEventListener('change', async () => {
        const { error } = await S.sb.from('profiles').update({ badge: s.value || null }).eq('id', m.id);
        toast(error ? 'Could not change the badge: ' + error.message : 'Badge updated.');
      });
      return el('div', { style: 'display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--line)' },
        el('span', { style: 'display:flex;flex-direction:column' }, el('strong', { text: (m.display_name || 'Member') + (m.is_admin ? ' (editor)' : '') }), el('span', { class: 'small muted', text: 'Joined ' + new Date(m.created_at).toLocaleDateString() })), s);
    }));
}

function waitlistView() {
  return el('div', { style: 'padding:28px;display:flex;flex-direction:column;gap:14px;max-width:720px' },
    el('h2', { style: 'font-size:26px', text: 'Membership waitlist' }),
    el('p', { style: 'font-size:40px;font-family:var(--display);font-weight:700', text: String(S.waitlist) }),
    el('p', { class: 'muted', text: 'People who asked to hear when memberships ($9–15 a month or $79–129 a year) open. The full email list is in Supabase → Table editor → waitlist, where you can export it as a spreadsheet.' }));
}

function publishView() {
  return el('div', { style: 'padding:28px;display:flex;flex-direction:column;gap:14px;max-width:720px' },
    el('h2', { style: 'font-size:26px', text: 'Publish the site' }),
    el('p', { text: 'Published notes go live automatically: the site rebuilds itself about every 30 minutes.' }),
    el('p', { text: 'To update right now: open the deploy page on GitHub, click “Run workflow”, then “Run workflow” again. It takes about a minute.' }),
    el('a', { class: 'btn', href: REPO_ACTIONS, target: '_blank', rel: 'noopener', text: 'Open the deploy page on GitHub ↗' }));
}

const ctx = {
  S,
  render: () => render(),
  openPost: (post) => {
    if (!confirmLeave()) return;
    S.section = FILTERS[S.section] ? S.section : 'all';
    S.q = '';
    S.cur = { ...post, claims: (post.claims || []).map((x) => ({ ...x })), _slugAuto: !post.id };
    S.dirty = !post.id; S.preview = false;
    render();
  }
};

function render() {
  const main = el('main', { class: 'ed-main', id: 'main' });
  listEl = el('section', { class: 'ed-list', 'aria-label': 'Items' });
  const ws = { research: researchView, sources: sourcesView };
  if (!S.q && ws[S.section]) { root.replaceChildren(el('div', { class: 'ed' }, sidebar(), ...ws[S.section](ctx))); listEl = null; return; }
  const views = { reports: reportsView, members: membersView, waitlist: waitlistView, publish: publishView };
  if (!S.q && views[S.section]) { main.append(views[S.section]()); root.replaceChildren(el('div', { class: 'ed' }, sidebar(), main)); listEl = null; return; }
  main.append(contentEditor());
  root.replaceChildren(el('div', { class: 'ed' }, sidebar(), listEl, main));
  paintList();
}

window.addEventListener('beforeunload', (e) => { if (S.dirty) { e.preventDefault(); e.returnValue = ''; } });

(async () => {
  S.sb = await getClient();
  if (!S.sb) return gate('The editor needs the database connection. Add your Supabase URL and key (see the setup guide), then reload.');
  S.me = await currentProfile();
  if (!S.me) return gate('Sign in with your editor email to manage Pet Primer.', true);
  if (!S.me.is_admin) return gate('This account is not an editor. Sign in with the editor email, or make this account an editor in Supabase.');
  await Promise.all([loadPosts(), loadReports(), loadWorkspace(S)]);
  S.cur = S.posts[0] ? { ...S.posts[0], _slugAuto: false } : blankPost();
  if (S.wsError) S.section = 'all';
  render();
})();

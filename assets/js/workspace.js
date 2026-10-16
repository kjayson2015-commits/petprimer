// Pet Primer editor — private research workspace (research notes + source library).
// Notes autosave, link to each other with [[Note title]], cite sources with [[src:Source title]],
// show what links back to them, and turn into a draft article in one click.
import { el, toast, rank } from '/assets/js/app.js';
import { renderMarkdown, plainText, findLinks, esc } from '/assets/js/markdown.js';

const PETS = { dogs: 'Dogs', cats: 'Cats', both: 'Dogs and cats' };
const KINDS = ['study', 'review', 'vet guideline', 'article', 'book', 'owner experience', 'other'];
const norm = (t) => String(t || '').trim().toLowerCase();

export async function loadWorkspace(S) {
  const [n, s] = await Promise.all([
    S.sb.from('research_notes').select('*').order('pinned', { ascending: false }).order('updated_at', { ascending: false }),
    S.sb.from('sources').select('*').order('title')
  ]);
  if (n.error || s.error) {
    S.wsError = (n.error || s.error).message;
    S.notes = []; S.sources = [];
    return;
  }
  S.wsError = null;
  S.notes = n.data || [];
  S.sources = s.data || [];
}

// What a [[link]] points to: a research note, a site post, or a source.
export function resolve(S, target) {
  const t = norm(target);
  if (t.startsWith('src:')) {
    const name = norm(t.slice(4));
    const src = S.sources.find((x) => norm(x.title) === name);
    return src ? { type: 'source', item: src } : { type: 'missing-source', name: target.slice(4).trim() };
  }
  const note = S.notes.find((x) => norm(x.title) === t);
  if (note) return { type: 'note', item: note };
  const post = S.posts.find((x) => norm(x.title) === t || norm(x.slug) === t);
  if (post) return { type: 'post', item: post };
  return { type: 'missing', name: target.trim() };
}

function backlinks(S, title) {
  const t = norm(title);
  if (!t) return [];
  const hits = (body) => findLinks(body).some((l) => norm(l.target) === t);
  return [
    ...S.notes.filter((n) => hits(n.body)).map((n) => ({ type: 'note', item: n })),
    ...S.posts.filter((p) => hits(p.body)).map((p) => ({ type: 'post', item: p }))
  ];
}

function sourceUsage(S, src) {
  const t = 'src:' + norm(src.title);
  const notes = S.notes.filter((n) => findLinks(n.body).some((l) => norm(l.target) === t));
  const posts = S.posts.filter((p) => src.url && (p.claims || []).some((c) => (c.sources || []).includes(src.url)));
  return { notes, posts };
}

// ---------- Autosave ----------
// One timer per row, so switching notes mid-typing never drops the last change.
const saveTimers = new Map();
function scheduleSave(ctx, table, row, statusEl) {
  const key = table + ':' + row.id;
  clearTimeout(saveTimers.get(key));
  statusEl.textContent = 'Saving…';
  saveTimers.set(key, setTimeout(async () => {
    saveTimers.delete(key);
    const { id, created_at, updated_at, ...fields } = row;
    const { error } = await ctx.S.sb.from(table).update(fields).eq('id', id);
    statusEl.textContent = error ? 'Not saved: ' + error.message : 'Saved';
    if (!error) row.updated_at = new Date().toISOString();
  }, 700));
}

async function createNote(ctx, title = 'Untitled note', extra = {}) {
  const { S } = ctx;
  const { data, error } = await S.sb.from('research_notes').insert({ title, body: '', tags: '', pet: 'dogs', ...extra }).select().single();
  if (error) { toast('Could not create the note: ' + error.message); return null; }
  S.notes.unshift(data);
  return data;
}

async function createSource(ctx, title = 'New source') {
  const { S } = ctx;
  const { data, error } = await S.sb.from('sources').insert({ title, url: '', authors: '', kind: 'study', summary: '', quality: '' }).select().single();
  if (error) { toast('Could not add the source: ' + error.message); return null; }
  S.sources.push(data);
  S.sources.sort((a, b) => a.title.localeCompare(b.title));
  return data;
}

// Follow a [[link]] from anywhere in the workspace.
async function follow(ctx, target) {
  const { S } = ctx;
  const r = resolve(S, target);
  if (r.type === 'note') { S.section = 'research'; S.curNoteId = r.item.id; return ctx.render(); }
  if (r.type === 'post') return ctx.openPost(r.item);
  if (r.type === 'source') { S.section = 'sources'; S.curSourceId = r.item.id; return ctx.render(); }
  if (r.type === 'missing-source') {
    const src = await createSource(ctx, r.name);
    if (src) { S.section = 'sources'; S.curSourceId = src.id; ctx.render(); }
    return;
  }
  const n = await createNote(ctx, r.name);
  if (n) { S.section = 'research'; S.curNoteId = n.id; ctx.render(); }
}

function renderWithLinks(ctx, body) {
  const box = el('div', { class: 'prose', style: 'font-size:16px' });
  box.innerHTML = renderMarkdown(body, {
    link: (target, label) => {
      const r = resolve(ctx.S, target);
      const missing = r.type === 'missing' || r.type === 'missing-source';
      const text = label || (r.type === 'source' ? r.item.title : target.replace(/^src:/i, ''));
      return `<a href="#" data-wikilink="${encodeURIComponent(target)}" class="${missing ? 'wl-missing' : 'wl'}" title="${missing ? 'Not created yet — click to create' : 'Open'}">${esc(text)}</a>`;
    }
  });
  box.addEventListener('click', (e) => {
    const a = e.target.closest('[data-wikilink]');
    if (!a) return;
    e.preventDefault();
    follow(ctx, decodeURIComponent(a.dataset.wikilink));
  });
  return box;
}

// Suggestions while typing [[ in a textarea.
function attachLinkSuggest(ctx, textarea, onChange) {
  const box = el('div', { class: 'wl-suggest', hidden: true, role: 'listbox', 'aria-label': 'Link suggestions' });
  const options = () => [
    ...ctx.S.notes.map((n) => ({ label: n.title, kind: 'Research note', insert: n.title })),
    ...ctx.S.posts.map((p) => ({ label: p.title, kind: 'Article', insert: p.title })),
    ...ctx.S.sources.map((s) => ({ label: s.title, kind: 'Source', insert: 'src:' + s.title }))
  ];
  const close = () => { box.hidden = true; };
  const update = () => {
    const pos = textarea.selectionStart;
    const before = textarea.value.slice(0, pos);
    const open = before.lastIndexOf('[[');
    if (open === -1 || before.slice(open).includes(']]') || before.slice(open).includes('\n')) return close();
    const q = norm(before.slice(open + 2)).replace(/^src:/, '');
    const list = options().filter((o) => !q || norm(o.label).includes(q)).slice(0, 8);
    const createLabel = before.slice(open + 2).trim();
    box.replaceChildren(...[
      ...list.map((o) => el('button', { type: 'button', role: 'option', onmousedown: (e) => { e.preventDefault(); insert(open, pos, o.insert); } },
        el('span', { style: 'font-weight:600', text: o.label }), el('span', { class: 'small muted', text: o.kind }))),
      createLabel ? el('button', { type: 'button', role: 'option', onmousedown: (e) => { e.preventDefault(); insert(open, pos, createLabel); } },
        el('span', { style: 'font-weight:600', text: `Link to “${createLabel.replace(/^src:\s*/i, '')}”` }), el('span', { class: 'small muted', text: /^src:/i.test(createLabel) ? 'New source' : 'New note' })) : null].filter(Boolean));
    box.hidden = !box.children.length;
  };
  const insert = (open, pos, text) => {
    const v = textarea.value;
    const after = v.slice(pos).startsWith(']]') ? v.slice(pos + 2) : v.slice(pos);
    textarea.value = v.slice(0, open) + '[[' + text + ']]' + after;
    const caret = open + text.length + 4;
    textarea.setSelectionRange(caret, caret);
    textarea.focus();
    close();
    onChange();
  };
  textarea.addEventListener('input', update);
  textarea.addEventListener('click', update);
  textarea.addEventListener('blur', () => setTimeout(close, 150));
  textarea.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  return box;
}

function setupNeeded() {
  return el('div', { style: 'padding:32px;max-width:720px;display:flex;flex-direction:column;gap:12px' },
    el('h2', { style: 'font-size:26px', text: 'One database update needed' }),
    el('p', { text: 'The research workspace needs two new private tables. Run supabase/002_research_workspace.sql from the GitHub repo in Supabase → SQL Editor, then reload this page.' }));
}

// ---------- Research notes ----------
export function researchView(ctx) {
  const { S } = ctx;
  if (S.wsError) return [setupNeeded()];
  let q = S.wsQ || '';
  const list = el('section', { class: 'ed-list', 'aria-label': 'Research notes' });
  let repaintList = () => {};
  const paintList = () => {
    const search = el('input', { type: 'search', class: 'field', placeholder: 'Search research notes…', 'aria-label': 'Search research notes', value: q, style: 'min-height:38px;padding:0 10px;width:100%' });
    search.addEventListener('input', () => { q = S.wsQ = search.value; paintItems(); });
    const itemsBox = el('div', { style: 'display:flex;flex-direction:column' });
    const paintItems = () => {
      const its = q.trim() ? rank(S.notes.map((n) => ({ n, title: n.title, tags: n.tags, pet: n.pet, text: plainText(n.body) })), q, 100).map((r) => r.n) : [...S.notes].sort((x, y) => (y.pinned ? 1 : 0) - (x.pinned ? 1 : 0));
      itemsBox.replaceChildren(...(its.length ? its.map((n) => el('button', { type: 'button', class: 'item', 'aria-pressed': n.id === S.curNoteId ? 'true' : 'false', onclick: () => { S.curNoteId = n.id; ctx.render(); } },
        el('span', { style: 'font-weight:600', text: (n.pinned ? '📌 ' : '') + (n.title || 'Untitled note') }),
        el('span', { class: 'small muted', text: plainText(n.body).slice(0, 80) || 'Empty note' }),
        el('span', { style: 'display:flex;gap:6px;flex-wrap:wrap' },
          el('span', { class: 'pill', style: 'font-size:12px', text: PETS[n.pet] }),
          n.post_id ? el('span', { class: 'pill', style: 'font-size:12px;background:#D3E6D9;color:#1F4D36', text: 'Has article' }) : null,
          ...String(n.tags || '').split(',').map((t) => t.trim()).filter(Boolean).slice(0, 3).map((t) => el('span', { class: 'pill', style: 'font-size:12px;background:#fff;border:1px solid var(--line)', text: '#' + t }))))) :
        [el('p', { class: 'muted', style: 'padding:20px 16px', text: q ? 'No notes match.' : 'No research notes yet.' })]));
    };
    paintItems();
    repaintList = paintItems;
    list.replaceChildren(el('div', { class: 'head', style: 'display:flex;flex-direction:column;gap:10px' },
      el('div', { style: 'display:flex;justify-content:space-between;align-items:center;gap:8px' },
        el('h1', { style: 'font-size:22px', text: 'Research notes' }),
        el('button', { type: 'button', class: 'btn', style: 'min-height:36px;padding:0 12px', text: '+ New', onclick: async () => { const n = await createNote(ctx); if (n) { S.curNoteId = n.id; ctx.render(); } } })),
      el('span', { class: 'small muted', text: 'Private. Readers never see these.' }),
      search), itemsBox);
  };
  paintList();

  const n = S.notes.find((x) => x.id === S.curNoteId) || S.notes[0];
  if (!n) return [list, el('main', { class: 'ed-main', style: 'padding:40px' }, el('p', { class: 'muted', text: 'Click “+ New” to start your first research note.' }))];
  S.curNoteId = n.id;
  repaintList();

  const status = el('span', { class: 'small muted', role: 'status', text: 'Saved' });
  if (S.lastNoteId !== n.id) { S.notePreview = null; S.lastNoteId = n.id; } // opening a note always starts in edit mode
  const preview = S.notePreview === n.id;
  let listTimer = null;
  const save = () => { scheduleSave(ctx, 'research_notes', n, status); paintSide(); clearTimeout(listTimer); listTimer = setTimeout(repaintList, 300); };

  const title = el('input', { class: 'title-in', type: 'text', value: n.title, 'aria-label': 'Note title', placeholder: 'Note title' });
  title.addEventListener('input', () => { n.title = title.value; save(); });
  const tags = el('input', { class: 'meta-in', type: 'text', value: n.tags, placeholder: 'Tags, separated by commas', 'aria-label': 'Tags', style: 'flex:1 1 240px' });
  tags.addEventListener('input', () => { n.tags = tags.value; save(); });
  const pet = el('select', { class: 'meta-in', 'aria-label': 'Pet' }, ...Object.entries(PETS).map(([v, t]) => el('option', { value: v, text: t, selected: n.pet === v })));
  pet.addEventListener('change', () => { n.pet = pet.value; save(); });
  const body = el('textarea', { class: 'body-in', 'aria-label': 'Note', placeholder: 'Write freely. Type [[ to link another note or article, [[src: to cite a saved source. Use ## for headings and - for lists.' });
  body.value = n.body;
  const suggest = attachLinkSuggest(ctx, body, () => { n.body = body.value; save(); });
  body.addEventListener('input', () => { n.body = body.value; save(); });

  const bar = el('div', { class: 'ed-bar' },
    el('label', {}, 'Pet', pet),
    el('button', { type: 'button', class: 'btn plain', 'aria-pressed': n.pinned ? 'true' : 'false', text: n.pinned ? 'Unpin' : 'Pin to top', onclick: () => { n.pinned = !n.pinned; save(); ctx.render(); } }),
    el('span', { style: 'margin-left:auto' }), status,
    el('button', { type: 'button', class: 'btn plain', text: preview ? 'Edit' : 'Preview', onclick: () => { S.notePreview = preview ? null : n.id; ctx.render(); } }),
    n.post_id && S.posts.find((p) => p.id === n.post_id)
      ? el('button', { type: 'button', class: 'btn ghost', text: 'Open article', onclick: () => ctx.openPost(S.posts.find((p) => p.id === n.post_id)) })
      : el('button', { type: 'button', class: 'btn', text: 'Turn into article', onclick: () => turnIntoArticle(ctx, n) }),
    el('button', { type: 'button', class: 'btn plain', style: 'color:var(--danger)', text: 'Delete', onclick: async () => {
      if (!window.confirm(`Delete the research note “${n.title}”? This cannot be undone.`)) return;
      const { error } = await S.sb.from('research_notes').delete().eq('id', n.id);
      if (error) return toast('Could not delete: ' + error.message);
      S.notes = S.notes.filter((x) => x.id !== n.id); S.curNoteId = null; ctx.render();
    } }));

  const write = el('div', { class: 'ed-write' }, title,
    el('div', { style: 'display:flex;flex-wrap:wrap;gap:10px' }, tags),
    preview ? renderWithLinks(ctx, n.body) : el('div', { style: 'position:relative;display:flex;flex-direction:column;gap:6px' }, body, suggest));

  const side = el('aside', { class: 'ed-seo', 'aria-label': 'Links' });
  const linkRow = (r) => {
    const label = r.type === 'missing' ? r.name : r.type === 'missing-source' ? r.name : r.item.title;
    const tag = { note: 'Note', post: 'Article', source: 'Source', missing: 'Not created yet', 'missing-source': 'Source not saved yet' }[r.type];
    const target = r.type === 'source' ? 'src:' + r.item.title : r.type === 'missing-source' ? 'src:' + r.name : label;
    return el('button', { type: 'button', class: 'item', style: 'padding:10px 12px;border-radius:8px;border:1px solid var(--line);background:#fff', onclick: () => follow(ctx, target) },
      el('span', { style: 'font-weight:600', text: label }), el('span', { class: 'small muted', text: tag + (r.type.startsWith('missing') ? ' · click to create' : '') }));
  };
  const paintSide = () => {
    const out = [];
    const seen = new Set();
    for (const l of findLinks(n.body)) { const k = norm(l.target); if (seen.has(k)) continue; seen.add(k); out.push(resolve(S, l.target)); }
    const back = backlinks(S, n.title);
    const tagHits = String(n.tags || '').split(',').map((t) => norm(t)).filter(Boolean);
    const related = tagHits.length ? S.notes.filter((x) => x.id !== n.id && String(x.tags || '').split(',').map((t) => norm(t)).some((t) => tagHits.includes(t))).slice(0, 6) : [];
    side.replaceChildren(...[
      el('h2', { style: 'font-size:16px;font-family:var(--body)', text: 'Links in this note' }),
      ...(out.length ? out.map(linkRow) : [el('p', { class: 'small muted', text: 'Type [[ in the note to link a note, article or source.' })]),
      el('h2', { style: 'font-size:16px;font-family:var(--body);margin-top:10px', text: 'Linked from' }),
      ...(back.length ? back.map(linkRow) : [el('p', { class: 'small muted', text: 'Nothing links here yet.' })]),
      related.length ? el('h2', { style: 'font-size:16px;font-family:var(--body);margin-top:10px', text: 'Same tags' }) : null,
      ...related.map((x) => linkRow({ type: 'note', item: x })),
      el('p', { class: 'small muted', style: 'font-size:12px;margin-top:8px', text: 'Shortcuts: [[Note title]] links a note or article · [[src:Source title]] cites a saved source · [[Title|other words]] changes the link text.' })].filter(Boolean));
  };
  paintSide();
  return [list, el('main', { class: 'ed-main', id: 'main' }, bar, el('div', { class: 'ed-cols' }, write, side))];
}

async function turnIntoArticle(ctx, n) {
  const { S } = ctx;
  const cited = findLinks(n.body).map((l) => resolve(S, l.target)).filter((r) => r.type === 'source').map((r) => r.item);
  const body = String(n.body || '').replace(/\[\[src:([^\]|]+)(?:\|([^\]]+))?\]\]/gi, (m, t, label) => label || t.trim());
  const draft = {
    id: null, kind: 'note', pet: n.pet, access: 'free', status: 'draft', title: String(n.title || '').replace(/\s*[—–-]\s*(research( plan| notes?)?|notes?|plan)\s*$/i, '').trim() || n.title, slug: '', bottom_line: '', body,
    cover_url: '', cover_alt: '', author_note: '', verdict: '', tags: n.tags, focus_keyword: '', seo_title: '', meta_desc: '',
    claims: cited.length ? [{ text: '', grade: 'Pending', note: '', sources: cited.map((s) => s.url).filter(Boolean) }] : [],
    _slugAuto: true, _fromNoteId: n.id
  };
  toast('Draft article created from your note. Fill in the bottom line, then Save draft.');
  ctx.openPost(draft);
}

// ---------- Source library ----------
export function sourcesView(ctx) {
  const { S } = ctx;
  if (S.wsError) return [setupNeeded()];
  let q = S.srcQ || '';
  const list = el('section', { class: 'ed-list', 'aria-label': 'Sources' });
  const itemsBox = el('div', { style: 'display:flex;flex-direction:column' });
  const paintItems = () => {
    const its = q.trim() ? rank(S.sources.map((s) => ({ s, title: s.title, tags: s.kind + ' ' + s.authors, text: s.summary })), q, 100).map((r) => r.s) : S.sources;
    itemsBox.replaceChildren(...(its.length ? its.map((s) => el('button', { type: 'button', class: 'item', 'aria-pressed': s.id === S.curSourceId ? 'true' : 'false', onclick: () => { S.curSourceId = s.id; ctx.render(); } },
      el('span', { style: 'font-weight:600', text: s.title }),
      el('span', { class: 'small muted', text: [s.authors, s.year].filter(Boolean).join(' · ') || s.url || 'No details yet' }),
      el('span', { class: 'pill', style: 'font-size:12px;align-self:flex-start', text: s.kind }))) :
      [el('p', { class: 'muted', style: 'padding:20px 16px', text: q ? 'No sources match.' : 'No sources saved yet.' })]));
  };
  const search = el('input', { type: 'search', class: 'field', placeholder: 'Search sources…', 'aria-label': 'Search sources', value: q, style: 'min-height:38px;padding:0 10px;width:100%' });
  search.addEventListener('input', () => { q = S.srcQ = search.value; paintItems(); });
  list.append(el('div', { class: 'head', style: 'display:flex;flex-direction:column;gap:10px' },
    el('div', { style: 'display:flex;justify-content:space-between;align-items:center;gap:8px' },
      el('h1', { style: 'font-size:22px', text: 'Source library' }),
      el('button', { type: 'button', class: 'btn', style: 'min-height:36px;padding:0 12px', text: '+ Add', onclick: async () => { const s = await createSource(ctx); if (s) { S.curSourceId = s.id; ctx.render(); } } })),
    el('span', { class: 'small muted', text: 'Save each study or guideline once, then reuse it.' }), search), itemsBox);
  paintItems();

  const s = S.sources.find((x) => x.id === S.curSourceId) || S.sources[0];
  if (!s) return [list, el('main', { class: 'ed-main', style: 'padding:40px' }, el('p', { class: 'muted', text: 'Click “+ Add” to save your first source: a study, a vet guideline or an article.' }))];
  S.curSourceId = s.id;
  paintItems();
  const status = el('span', { class: 'small muted', role: 'status', text: 'Saved' });
  let listTimer = null;
  const save = () => { scheduleSave(ctx, 'sources', s, status); clearTimeout(listTimer); listTimer = setTimeout(paintItems, 300); };
  const input = (key, label, attrs = {}) => {
    const i = el('input', { type: 'text', class: 'meta-in', value: s[key] ?? '', ...attrs });
    i.addEventListener('input', () => { s[key] = key === 'year' ? (parseInt(i.value, 10) || null) : i.value; save(); });
    return el('label', { style: 'display:flex;flex-direction:column;gap:4px;font-size:13px;font-weight:600' }, label, i);
  };
  const area = (key, label, ph) => {
    const t = el('textarea', { class: 'meta-in', rows: 4, placeholder: ph, style: 'padding:8px 10px;resize:vertical' });
    t.value = s[key] || '';
    t.addEventListener('input', () => { s[key] = t.value; save(); });
    return el('label', { style: 'display:flex;flex-direction:column;gap:4px;font-size:13px;font-weight:600' }, label, t);
  };
  const kind = el('select', { class: 'meta-in' }, ...KINDS.map((k) => el('option', { value: k, text: k, selected: s.kind === k })));
  kind.addEventListener('change', () => { s.kind = kind.value; save(); });
  const use = sourceUsage(S, s);
  const copy = async () => { try { await navigator.clipboard.writeText(`[[src:${s.title}]]`); toast('Copied. Paste it into a research note.'); } catch (e) { toast(`Type [[src:${s.title}]] in a note`); } };

  const form = el('div', { class: 'ed-write', style: 'max-width:760px' },
    input('title', 'Title', { style: 'font-size:18px;font-weight:600' }),
    input('url', 'Link', { placeholder: 'https://…', inputmode: 'url' }),
    el('div', { style: 'display:flex;flex-wrap:wrap;gap:12px' },
      el('div', { style: 'flex:2 1 260px' }, input('authors', 'Authors or organization')),
      el('div', { style: 'flex:1 1 100px' }, input('year', 'Year', { inputmode: 'numeric' })),
      el('label', { style: 'display:flex;flex-direction:column;gap:4px;font-size:13px;font-weight:600;flex:1 1 160px' }, 'Type', kind)),
    area('summary', 'What it found', 'The main finding, in your own words.'),
    area('quality', 'How strong is it?', 'For example: small study of 30 dogs; large review of 12 studies; vet association guideline.'),
    s.url ? el('a', { href: s.url, target: '_blank', rel: 'noopener', text: 'Open the source ↗' }) : null);
  const side = el('aside', { class: 'ed-seo', 'aria-label': 'Where this source is used' },
    el('h2', { style: 'font-size:16px;font-family:var(--body)', text: 'Cite it' }),
    el('button', { type: 'button', class: 'btn ghost', text: 'Copy [[src:…]] link', onclick: copy }),
    el('h2', { style: 'font-size:16px;font-family:var(--body);margin-top:10px', text: 'Used in' }),
    ...(use.notes.length + use.posts.length ? [
      ...use.notes.map((x) => el('button', { type: 'button', class: 'item', style: 'padding:10px 12px;border-radius:8px;border:1px solid var(--line);background:#fff', onclick: () => { S.section = 'research'; S.curNoteId = x.id; ctx.render(); } }, el('span', { style: 'font-weight:600', text: x.title }), el('span', { class: 'small muted', text: 'Research note' }))),
      ...use.posts.map((x) => el('button', { type: 'button', class: 'item', style: 'padding:10px 12px;border-radius:8px;border:1px solid var(--line);background:#fff', onclick: () => ctx.openPost(x) }, el('span', { style: 'font-weight:600', text: x.title }), el('span', { class: 'small muted', text: 'Article claim' })))
    ] : [el('p', { class: 'small muted', text: 'Not cited anywhere yet.' })]),
    el('button', { type: 'button', class: 'btn plain', style: 'color:var(--danger);margin-top:auto', text: 'Delete source', onclick: async () => {
      if (!window.confirm(`Delete the source “${s.title}”?`)) return;
      const { error } = await S.sb.from('sources').delete().eq('id', s.id);
      if (error) return toast('Could not delete: ' + error.message);
      S.sources = S.sources.filter((x) => x.id !== s.id); S.curSourceId = null; ctx.render();
    } }));
  const bar = el('div', { class: 'ed-bar' }, el('span', { class: 'pill', text: s.kind }), el('span', { style: 'margin-left:auto' }), status);
  return [list, el('main', { class: 'ed-main', id: 'main' }, bar, el('div', { class: 'ed-cols' }, form, side))];
}

// Source picker for article claims.
export function sourcePicker(S, onPick) {
  if (!S.sources || !S.sources.length) return null;
  const s = el('select', { 'aria-label': 'Add a source from the library', style: 'flex:1 1 220px' },
    el('option', { value: '', text: '+ Add a source from your library…' }),
    ...S.sources.filter((x) => x.url).map((x) => el('option', { value: x.url, text: `${x.title}${x.year ? ' (' + x.year + ')' : ''}` })));
  s.addEventListener('change', () => { if (s.value) { onPick(s.value); s.value = ''; } });
  return s;
}

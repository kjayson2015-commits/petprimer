// Pet Primer — shared browser code (header, sign-in, search, helpers)
const CFG = window.PETPRIMER || {};
let clientPromise = null;

export function isConfigured() {
  return Boolean(CFG.supabaseUrl && CFG.supabaseAnonKey);
}

export function getClient() {
  if (!isConfigured()) return Promise.resolve(null);
  if (!clientPromise) {
    clientPromise = import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm')
      .then(({ createClient }) => createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      }))
      .catch((err) => { console.error('Could not load Supabase', err); return null; });
  }
  return clientPromise;
}

// Small element builder. Text is always set with textContent, so member
// content can never inject HTML.
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

export function toast(msg) {
  const t = document.querySelector('[data-toast]');
  if (!t) return;
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.hidden = true; }, 3200);
}

export function timeAgo(iso) {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'now';
  const m = Math.round(s / 60); if (m < 60) return m + 'm';
  const h = Math.round(m / 60); if (h < 24) return h + 'h';
  const d = Math.round(h / 24); if (d < 30) return d + 'd';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function avatar(profile, size = 40) {
  const name = (profile && profile.display_name) || '?';
  if (profile && profile.avatar_url) {
    return el('img', { class: 'avatar', src: profile.avatar_url, alt: '', width: size, height: size, style: `width:${size}px;height:${size}px` });
  }
  return el('span', { class: 'avatar', 'aria-hidden': 'true', style: `width:${size}px;height:${size}px`, text: name.trim().charAt(0).toUpperCase() || '?' });
}

export function badge(profile) {
  if (!profile || !profile.badge) return null;
  if (profile.badge === 'vet') return el('span', { class: 'pill badge-vet', text: 'Verified vet' });
  if (profile.badge === 'keeper') return el('span', { class: 'pill badge-keeper', text: 'Experienced keeper' });
  return null;
}

export async function shrinkImage(file, max = 1600) {
  if (!file || !file.type.startsWith('image/')) throw new Error('Please choose an image file.');
  if (file.size > 15 * 1024 * 1024) throw new Error('That photo is over 15 MB. Please pick a smaller one.');
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res) => c.toBlob((b) => res(b), 'image/jpeg', 0.85));
}

// ---------- Light / dark mode ----------
// Follows the device setting until the visitor picks one; the choice is remembered on this device.
(function themeSwitch() {
  const root = document.documentElement;
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const isDark = () => root.getAttribute('data-theme') === 'dark' || (!root.getAttribute('data-theme') && media.matches);
  const paint = () => {
    const dark = isDark();
    root.classList.toggle('is-dark', dark);
    document.querySelectorAll('[data-theme-toggle]').forEach((b) => {
      const next = dark ? 'Light mode' : 'Dark mode';
      b.setAttribute('aria-label', 'Switch to ' + next.toLowerCase()); b.title = 'Switch to ' + next.toLowerCase();
      const label = b.querySelector('.theme-label'); if (label) label.textContent = next;
    });
  };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-theme-toggle]');
    if (!b) return;
    const next = isDark() ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('pp-theme', next); } catch (err) { /* private mode */ }
    paint();
  });
  media.addEventListener('change', paint);
  paint();
})();

// ---------- Header menu ----------
(function headerMenu() {
  const header = document.querySelector('.site-header');
  const toggle = document.querySelector('[data-menu-toggle]');
  const mores = [...document.querySelectorAll('.nav-more')];
  if (!header || !toggle) return;
  const phone = window.matchMedia('(max-width: 1240px)');
  const setOpen = (open) => { header.classList.toggle('menu-open', open); toggle.setAttribute('aria-expanded', String(open)); };
  toggle.addEventListener('click', () => setOpen(!header.classList.contains('menu-open')));
  // On phones the dropdown links are always listed in the open menu.
  const syncMore = () => mores.forEach((m) => { m.open = phone.matches; });
  syncMore();
  phone.addEventListener('change', () => { syncMore(); if (!phone.matches) setOpen(false); });
  // Only one dropdown open at a time on wide screens.
  mores.forEach((m) => m.addEventListener('toggle', () => { if (m.open && !phone.matches) mores.forEach((o) => { if (o !== m) o.open = false; }); }));
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (header.classList.contains('menu-open')) { setOpen(false); toggle.focus(); }
    const open = mores.find((m) => m.open);
    if (open && !phone.matches) { open.open = false; open.querySelector('summary').focus(); }
  });
  document.addEventListener('click', (e) => { if (!phone.matches) mores.forEach((m) => { if (m.open && !m.contains(e.target)) m.open = false; }); });
})();

// ---------- Sidebar: highlight the page you're on ----------
(function sideNav() {
  const side = document.querySelector('.app-side');
  if (!side || side.querySelector('[aria-current="page"]')) return;
  const path = location.pathname;
  const links = [...side.querySelectorAll('a[href^="/"]')].filter((a) => a.getAttribute('href') !== '/');
  const exact = links.find((a) => a.getAttribute('href') === path);
  const hit = exact || links.filter((a) => path.startsWith(a.getAttribute('href'))).sort((a, b) => b.getAttribute('href').length - a.getAttribute('href').length)[0];
  if (hit) hit.setAttribute('aria-current', 'page');
})();

// ---------- Friendly greeting on the home page ----------
(function greeting() {
  const el2 = document.querySelector('[data-greeting]');
  if (!el2) return;
  const h = new Date().getHours();
  const part = h < 5 ? 'Hello' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  el2.textContent = part;
  currentProfile().then((p) => { if (p && p.display_name) el2.textContent = `${part}, ${p.display_name}`; }).catch(() => {});
})();

// ---------- Phone tab bar and "More" panel ----------
(function tabBar() {
  const bar = document.querySelector('[data-tabbar]');
  const sheet = document.querySelector('[data-more-sheet]');
  if (!bar || !sheet) return;
  const path = location.pathname;
  const hit = [...bar.querySelectorAll('[data-tab-for]')].filter((a) => (a.dataset.tabFor === '/' ? path === '/' : path.startsWith(a.dataset.tabFor))).pop();
  if (hit) hit.setAttribute('aria-current', 'page');
  sheet.querySelectorAll('.more-chips a').forEach((a) => { if (a.getAttribute('href') === path) a.setAttribute('aria-current', 'page'); });
  const btn = bar.querySelector('[data-more-open]');
  let last = null;
  const open = () => { last = document.activeElement; sheet.hidden = false; document.documentElement.classList.add('more-open'); btn.setAttribute('aria-expanded', 'true'); requestAnimationFrame(() => sheet.classList.add('is-open')); const f = sheet.querySelector('.more-x'); if (f) f.focus(); };
  const close = () => { sheet.classList.remove('is-open'); document.documentElement.classList.remove('more-open'); btn.setAttribute('aria-expanded', 'false'); setTimeout(() => { sheet.hidden = true; }, 200); if (last && last.focus) last.focus(); };
  btn.addEventListener('click', () => (sheet.hidden ? open() : close()));
  sheet.addEventListener('click', (e) => { if (e.target.closest('[data-more-close]')) close(); else if (e.target.closest('a, [data-sign-in], [data-open-community]')) setTimeout(close, 0); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !sheet.hidden) close(); });
})();

// ---------- Modals ----------
function openModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.hidden = false;
  const f = m.querySelector('input, a, button:not(.backdrop)');
  if (f) f.focus();
}
function closeModals() { document.querySelectorAll('.modal').forEach((m) => { m.hidden = true; }); }
export function requireSignIn() { openModal('signin-modal'); }

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-open-community]')) { e.preventDefault(); openModal('community-modal'); }
  if (e.target.closest('[data-close-modal]')) { e.preventDefault(); closeModals(); }
  if (e.target.closest('[data-sign-in]')) { e.preventDefault(); openModal('signin-modal'); }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModals(); });

const socialList = document.querySelector('[data-social-list]');
if (socialList) {
  for (const s of CFG.socials || []) {
    socialList.append(el('li', {}, el('a', { href: s.url, target: '_blank', rel: 'noopener' },
      el('span', { style: 'display:flex;flex-direction:column;line-height:1.3' },
        el('span', { style: 'font-weight:600', text: s.name }),
        el('span', { class: 'small muted', text: s.handle })),
      el('span', { 'aria-hidden': 'true', text: '↗' }))));
  }
}

// ---------- Sign in ----------
export async function currentUser() {
  const sb = await getClient();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session ? data.session.user : null;
}

export async function currentProfile() {
  const sb = await getClient();
  const user = await currentUser();
  if (!sb || !user) return null;
  const { data } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
  return data;
}

const form = document.querySelector('[data-signin-form]');
if (form) {
  let usePassword = false;
  const row = form.querySelector('[data-password-row]');
  const toggle = form.querySelector('[data-password-toggle]');
  const submitBtn = form.querySelector('[data-signin-submit]');
  const intro = form.querySelector('[data-signin-intro]');
  toggle.addEventListener('click', () => {
    usePassword = !usePassword;
    row.hidden = !usePassword;
    form.password.required = usePassword;
    submitBtn.textContent = usePassword ? 'Sign in' : 'Send sign-in link';
    toggle.textContent = usePassword ? 'Email me a sign-in link instead' : 'Sign in with a password instead';
    intro.textContent = usePassword ? 'Sign in with your email and password.' : 'Enter your email and we’ll send you a sign-in link. No password needed.';
    if (usePassword) form.password.focus();
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = form.querySelector('[data-signin-status]');
    const sb = await getClient();
    if (!sb) { status.textContent = 'Accounts open soon. Follow us on Instagram or X meanwhile.'; return; }
    const email = form.email.value.trim();
    if (usePassword) {
      status.textContent = 'Signing in…';
      const { error } = await sb.auth.signInWithPassword({ email, password: form.password.value });
      if (error) { status.textContent = 'Could not sign in: ' + (error.message === 'Invalid login credentials' ? 'that email and password don’t match.' : error.message); return; }
      status.textContent = 'Signed in.';
      form.password.value = '';
      setTimeout(() => location.reload(), 400);
      return;
    }
    status.textContent = 'Sending…';
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.href.split('#')[0], data: { age_16_plus: true } } });
    status.textContent = error ? ('Could not send the link: ' + error.message) : 'Check your inbox for the sign-in link.';
  });
}

async function paintAuth() {
  const slots = [...document.querySelectorAll('[data-auth-slot]')];
  if (!slots.length) return;
  const sb = await getClient();
  if (!sb) return;
  const p = await currentProfile();
  if (!p) return;
  document.documentElement.classList.add('signed-in');
  for (const slot of slots) slot.replaceChildren(
    el('span', { style: 'display:inline-flex;align-items:center;gap:8px' },
      avatar(p, 34),
      el('span', { class: 'small auth-name', style: 'font-weight:600', text: p.display_name || 'You' }),
      p.is_admin ? el('a', { class: 'btn ghost', href: '/editor/', text: 'Editor' }) : null,
      p.is_admin ? el('a', { class: 'btn ghost', href: '/dashboard/', text: 'Visitors' }) : null,
      el('button', { type: 'button', class: 'btn plain', text: 'Sign out', onclick: async () => { await sb.auth.signOut(); location.reload(); } }))
  );
}
paintAuth();

// ---------- Private visit counter ----------
// Records the page, the referring website, phone/tablet/computer, the browser's time zone
// (e.g. America/Chicago) and a random visit code the browser forgets when the tab closes.
// No cookies, no IP, no account link. Skipped for the editor, local testing, Do Not Track,
// and for browsers where the editor turned counting off on the visitor dashboard.
(function countVisit() {
  try {
    if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return;
    if (/^\/(editor|dashboard)/.test(location.pathname) || !/petprimer\.online$/.test(location.hostname)) return;
    if (/bot|crawl|spider|preview|headless|lighthouse/i.test(navigator.userAgent)) return;
    try { if (localStorage.getItem('pp-no-count') === '1') return; } catch (e) { /* storage blocked */ }
    let ref = '';
    try { const r = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, '') : ''; ref = r && !/petprimer\.online$/.test(r) ? r : ''; } catch (e) { ref = ''; }
    let session = '';
    try {
      session = sessionStorage.getItem('pp-visit') || '';
      if (!session) { session = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now().toString(36)).replace(/-/g, '').slice(0, 16); sessionStorage.setItem('pp-visit', session); }
    } catch (e) { session = ''; }
    const coarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;
    const w = Math.min(screen.width || innerWidth, screen.height || innerHeight) || innerWidth;
    const device = coarse ? (w < 600 ? 'phone' : 'tablet') : 'computer';
    let tz = '';
    try { tz = (Intl.DateTimeFormat().resolvedOptions().timeZone || '').slice(0, 60); } catch (e) { tz = ''; }
    const base = { path: location.pathname.slice(0, 200), referrer: ref.slice(0, 200) };
    const send = () => getClient().then(async (sb) => {
      if (!sb) return;
      const { error } = await sb.from('page_views').insert({ ...base, session, device, tz });
      // Before the dashboard update is installed in Supabase, fall back to the basic count.
      if (error && /column|schema cache|PGRST204/i.test(`${error.code || ''} ${error.message || ''}`)) await sb.from('page_views').insert(base);
    }).catch(() => {});
    if (document.readyState === 'complete') setTimeout(send, 800); else window.addEventListener('load', () => setTimeout(send, 800), { once: true });
  } catch (e) { /* counting is best-effort */ }
})();

getClient().then((sb) => { if (sb) sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_IN') paintAuth(); }); });

// ---------- Search (typo tolerant, understands synonyms) ----------
const SYN = {
  puppy: 'dog', puppies: 'dog', pup: 'dog', pups: 'dog', doggy: 'dog', doggo: 'dog', canine: 'dog', dogs: 'dog', hound: 'dog',
  kitten: 'cat', kittens: 'cat', kitty: 'cat', feline: 'cat', cats: 'cat', kitties: 'cat',
  eats: 'eat', eating: 'eat', ate: 'eat', chew: 'eat', chewing: 'eat', chews: 'eat', grazing: 'eat', grazes: 'eat',
  vomit: 'vomiting', vomits: 'vomiting', throwing: 'vomiting', puke: 'vomiting', sick: 'vomiting',
  food: 'diet', foods: 'diet', feeding: 'diet', feed: 'diet', meals: 'diet', kibble: 'diet',
  price: 'cost', prices: 'cost', expensive: 'cost', money: 'cost',
  scratching: 'scratch', itchy: 'scratch', itching: 'scratch', walks: 'walk', walking: 'walk'
};
const STOP = new Set('why does my do the a an is it of to for and in on with how what i can should when are does my your be'.split(' '));

const rawWords = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
// vocab: words that really appear in the content. A real word (e.g. "grapes") is never
// "corrected" into a look-alike synonym (e.g. "grazes" → eat); only typos are.
export function words(t, vocab) {
  return rawWords(t).map((w) => {
    if (SYN[w]) return SYN[w];
    if (w.length >= 4 && !(vocab && vocab.has(w))) { const k = SYN_KEYS.find((key) => near(w, key)); if (k) return SYN[k]; }
    return w;
  });
}
const VOCABS = new WeakMap();
function vocabFor(items) {
  if (!VOCABS.has(items)) VOCABS.set(items, new Set(items.flatMap((it) => rawWords([it.title, it.keyword, it.tags, it.summary, it.text].join(' ')))));
  return VOCABS.get(items);
}
const SYN_KEYS = Object.keys(SYN).filter((k) => k.length >= 4);
function near(a, b) {
  if (a === b) return true;
  if (a.length < 4 || Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}
export function rank(items, q, limit = 8) {
  const vocab = vocabFor(items);
  const qt = words(q, vocab).filter((w) => !STOP.has(w));
  if (!qt.length) return [];
  return items.map((item) => {
    const fields = [[words(item.title + ' ' + (item.keyword || ''), vocab), 3], [words((item.tags || '') + ' ' + (item.pet || '') + ' ' + (item.kind || ''), vocab), 2], [words((item.summary || '') + ' ' + (item.text || ''), vocab), 1]];
    let total = 0, hit = 0;
    for (const w of qt) {
      let best = 0;
      for (const [ws, wt] of fields) for (const x of ws) {
        if (x === w) best = Math.max(best, wt);
        else if (w.length >= 3 && x.startsWith(w)) best = Math.max(best, wt * 0.7);
        else if (near(w, x)) best = Math.max(best, wt * 0.5);
      }
      if (best > 0) hit++;
      total += best;
    }
    return { item, score: hit >= Math.ceil(qt.length * 0.6) ? total : 0 };
  }).filter((r) => r.score > 0).sort((a, b) => b.score - a.score).slice(0, limit).map((r) => r.item);
}

let indexPromise = null;
function loadIndex() {
  if (!indexPromise) indexPromise = fetch('/search-index.json').then((r) => r.json()).catch(() => []);
  return indexPromise;
}

document.querySelectorAll('[data-search]').forEach((box) => {
  const input = box.querySelector('input');
  const out = box.querySelector('.search-results');
  let timer;
  const run = async () => {
    const q = input.value.trim();
    if (q.length < 2) { out.hidden = true; return; }
    const items = await loadIndex();
    const res = rank(items, q, location.pathname.startsWith('/search') ? 20 : 6);
    out.replaceChildren(el('span', { class: 'summary', text: res.length ? `${res.length} ${res.length === 1 ? 'match' : 'matches'} for “${q}”` : `Searching for “${q}”` }));
    for (const r of res) {
      out.append(el('a', { href: r.url },
        el('span', { style: 'display:flex;flex-wrap:wrap;gap:8px;align-items:center' }, el('span', { class: 'pill', style: 'font-size:12px', text: r.kind }), el('span', { style: 'font-weight:600', text: r.title })),
        el('span', { class: 'small muted', text: r.summary || '' })));
    }
    if (!res.length) out.append(el('p', { class: 'none' }, 'No match yet. Try fewer words, or ', el('a', { href: '/community/', text: 'ask the community' }), '.'));
    out.hidden = false;
  };
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 120); });
  box.addEventListener('submit', async (e) => {
    e.preventDefault();
    await run();
    const first = out.querySelector('a');
    if (first && !location.pathname.startsWith('/search')) first.focus();
  });
  document.addEventListener('click', (e) => { if (!box.contains(e.target)) out.hidden = true; });
  const params = new URLSearchParams(location.search);
  if (params.get('q')) { input.value = params.get('q'); run(); }
});

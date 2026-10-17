// Pet Primer community — an X-style public timeline for dog and cat owners.
import { getClient, el, avatar, toast, currentProfile, shrinkImage } from '/assets/js/app.js';
import { TYPES, postRow, POST_SELECT, likedSetFor, profileHref, threadHref, icon } from '/assets/js/social.js';

const PAGE = 20;
const MAX = 1000;
const feed = document.querySelector('[data-feed]');
const more = document.querySelector('[data-more]');
const slot = document.querySelector('[data-composer-slot]');
const params = new URLSearchParams(location.search);
const state = { tab: 'latest', type: 'all', pet: 'all', q: params.get('q') || '', page: 0, me: null, liked: new Set() };

function emptyState(text, withSocial) {
  return el('div', { class: 'empty' },
    el('img', { src: '/assets/img/paws-empty.svg', alt: '', width: 132, height: 99, class: 'empty-art' }),
    el('p', { text }),
    withSocial ? el('button', { type: 'button', class: 'btn', 'data-open-community': '', text: 'Follow us meanwhile' }) : null);
}

function composer() {
  if (!state.me) {
    return el('div', { class: 'compose compose-out' },
      el('span', { style: 'font-weight:600;font-size:17px', text: 'Join the conversation. Sign in to post, reply and like.' }),
      el('button', { type: 'button', class: 'btn', 'data-sign-in': '', text: 'Sign in' }));
  }
  let type = 'talk';
  const text = el('textarea', { id: 'post-text', rows: 2, maxlength: MAX, placeholder: 'What’s happening with your pet?', 'aria-label': 'Write a post' });
  const count = el('span', { class: 'compose-count', 'aria-live': 'polite' });
  const grow = () => { text.style.height = 'auto'; text.style.height = Math.min(text.scrollHeight, 360) + 'px'; const left = MAX - text.value.length; count.textContent = left <= 100 ? String(left) : ''; count.classList.toggle('warn', left <= 20); };
  text.addEventListener('input', grow);
  const typeSel = el('select', { id: 'post-type', 'aria-label': 'Kind of post' }, ...Object.entries(TYPES).map(([k, v]) => el('option', { value: k, text: v })));
  typeSel.addEventListener('change', () => { type = typeSel.value; text.placeholder = type === 'okay' ? 'Describe it: dog or cat, age, food, home, and how long it has been happening.' : 'What’s happening with your pet?'; });
  const pet = el('select', { id: 'post-pet', 'aria-label': 'Which pet' }, el('option', { value: 'dogs', text: 'Dog' }), el('option', { value: 'cats', text: 'Cat' }), el('option', { value: 'both', text: 'Dogs & cats' }));
  const file = el('input', { type: 'file', accept: 'image/*', class: 'sr-only', id: 'post-photo' });
  const photoName = el('span', { class: 'small muted' });
  const preview = el('img', { class: 'compose-preview', alt: 'Photo to post', hidden: true });
  file.addEventListener('change', () => {
    const f = file.files[0];
    photoName.textContent = f ? f.name : '';
    if (f) { preview.src = URL.createObjectURL(f); preview.hidden = false; } else preview.hidden = true;
  });
  const status = el('span', { class: 'small muted', role: 'status' });
  const submit = el('button', { type: 'submit', class: 'btn', text: 'Post' });
  const form = el('form', { class: 'compose' },
    el('a', { href: profileHref(state.me), 'aria-label': 'Your profile' }, avatar(state.me, 44)),
    el('div', { class: 'compose-main' },
      text, preview,
      el('div', { class: 'compose-bar' },
        el('label', { for: 'post-photo', class: 'compose-tool', title: 'Add a photo' }, icon('camera'), el('span', { class: 'sr-only', text: 'Add a photo' })), file,
        typeSel, pet, photoName,
        el('span', { class: 'compose-right' }, count, submit)),
      status));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = text.value.trim();
    if (!body) { status.textContent = 'Write something first.'; text.focus(); return; }
    submit.disabled = true; status.textContent = 'Posting…';
    const sb = await getClient();
    let photo_url = null;
    try {
      if (file.files[0]) {
        const blob = await shrinkImage(file.files[0]);
        const path = `${state.me.id}/${Date.now()}.jpg`;
        const up = await sb.storage.from('photos').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
        if (up.error) throw up.error;
        photo_url = sb.storage.from('photos').getPublicUrl(path).data.publicUrl;
      }
      let { error } = await sb.from('community_posts').insert({ author_id: state.me.id, type, pet: pet.value, body, photo_url });
      // Before the conversations update is installed, fall back to an older post type.
      if (error && /check constraint/i.test(error.message) && (type === 'talk' || pet.value === 'both')) {
        ({ error } = await sb.from('community_posts').insert({ author_id: state.me.id, type: type === 'talk' ? 'question' : type, pet: pet.value === 'both' ? 'dogs' : pet.value, body, photo_url }));
      }
      if (error) throw error;
      form.reset(); preview.hidden = true; photoName.textContent = ''; grow(); status.textContent = '';
      toast('Posted');
      state.tab = 'latest'; paintTabs(); load(true);
    } catch (err) {
      status.textContent = 'Could not post: ' + (err.message || err);
    }
    submit.disabled = false;
  });
  return form;
}

async function followingIds(sb) {
  if (!state.me) return null;
  const { data, error } = await sb.from('follows').select('followee_id').eq('follower_id', state.me.id);
  if (error) return [];
  return (data || []).map((r) => r.followee_id);
}

async function load(reset) {
  const sb = await getClient();
  if (!sb) { feed.replaceChildren(emptyState('The community opens very soon. Follow Pet Primer on Instagram and X to hear first.', true)); return; }
  if (reset) state.page = 0;
  const top = state.tab === 'top';
  let q = sb.from('community_posts').select(POST_SELECT).eq('removed', false).order('created_at', { ascending: false });
  q = top ? q.gte('created_at', new Date(Date.now() - 7 * 864e5).toISOString()).limit(200) : q.range(0, (state.page + 1) * PAGE - 1);
  if (state.type !== 'all') q = q.eq('type', state.type);
  if (state.pet !== 'all') q = q.in('pet', [state.pet, 'both']);
  if (state.q) q = q.ilike('body', `%${state.q.replace(/[%_]/g, '')}%`);
  if (state.tab === 'following') {
    if (!state.me) { feed.replaceChildren(emptyState('Sign in to see posts from people you follow.')); more.hidden = true; return; }
    const ids = await followingIds(sb);
    if (!ids.length) { feed.replaceChildren(emptyState('You’re not following anyone yet. Open a member’s profile and tap Follow.')); more.hidden = true; return; }
    q = q.in('author_id', ids);
  }
  let { data, error } = await q;
  if (error) { feed.replaceChildren(emptyState('The community could not load right now. Please refresh in a moment.')); console.error(error); return; }
  if (top) {
    const score = (p) => ((p.post_likes && p.post_likes[0] && p.post_likes[0].count) || 0) + 2 * ((p.comments && p.comments[0] && p.comments[0].count) || 0);
    data = data.slice().sort((a, b) => score(b) - score(a)).slice(0, 50);
  }
  state.liked = await likedSetFor(sb, state.me, data);
  const msg = state.q ? `No posts match “${state.q}” yet.` : state.tab === 'top' ? 'No posts this week yet. Start one!' : 'No posts of this kind yet. Be the first to post one.';
  feed.replaceChildren(...(data.length ? data.map((p) => postRow(p, state.liked)) : [emptyState(msg)]));
  more.hidden = top || data.length < (state.page + 1) * PAGE;
}

// Pet of the Week: the most-liked Show & tell photo from the last 7 days.
async function petOfTheWeek(sb) {
  const box = document.querySelector('[data-potw]');
  if (!box || !sb) return;
  const { data, error } = await sb.from('community_posts').select(POST_SELECT).eq('removed', false).eq('type', 'show')
    .not('photo_url', 'is', null).gte('created_at', new Date(Date.now() - 7 * 864e5).toISOString()).limit(100);
  const likes = (p) => (p.post_likes && p.post_likes[0] && p.post_likes[0].count) || 0;
  const best = !error && (data || []).slice().sort((a, b) => likes(b) - likes(a) || b.created_at.localeCompare(a.created_at))[0];
  if (!best) {
    box.replaceChildren(el('div', { class: 'panel' },
      el('span', { class: 'potw-tag', text: 'Pet of the Week' }),
      el('p', { class: 'small', style: 'color: var(--ink-2)', text: 'Post a Show & tell photo of your dog or cat. The most-liked photo each week is featured here.' })));
    return;
  }
  const a = best.author || {};
  box.replaceChildren(el('a', { class: 'panel potw', href: threadHref(best.id), style: 'text-decoration: none; color: var(--ink)' },
    el('img', { src: best.photo_url, alt: `Pet of the Week, shared by ${a.display_name || 'a member'}`, loading: 'lazy', width: 400, height: 300 }),
    el('span', { class: 'potw-body' },
      el('span', { class: 'potw-tag', text: 'Pet of the Week' }),
      el('span', { class: 'small', style: 'color: var(--ink-2)', text: best.body.length > 90 ? best.body.slice(0, 88) + '…' : best.body }),
      el('span', { class: 'small muted', text: `${a.display_name || 'Member'} · ${likes(best)} ${likes(best) === 1 ? 'like' : 'likes'}` }))));
}

function paintTabs() {
  document.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', b.dataset.tab === state.tab ? 'true' : 'false'));
}
document.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { state.tab = b.dataset.tab; paintTabs(); load(true); }));
document.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => {
  state.type = b.dataset.filter;
  document.querySelectorAll('[data-filter]').forEach((x) => x.setAttribute('aria-pressed', x.dataset.filter === state.type ? 'true' : 'false'));
  load(true);
}));
document.querySelectorAll('[data-pet]').forEach((b) => b.addEventListener('click', () => {
  state.pet = b.dataset.pet;
  document.querySelectorAll('[data-pet]').forEach((x) => x.setAttribute('aria-pressed', x.dataset.pet === state.pet ? 'true' : 'false'));
  load(true);
}));
const search = document.querySelector('[data-board-search]');
if (search) {
  search.value = state.q;
  let t;
  search.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => {
      state.q = search.value.trim();
      const u = new URL(location.href); if (state.q) u.searchParams.set('q', state.q); else u.searchParams.delete('q');
      history.replaceState(null, '', u);
      load(true);
    }, 300);
  });
}
more.addEventListener('click', () => { state.page++; load(false); });

(async () => {
  state.me = await currentProfile();
  slot.replaceChildren(composer());
  paintTabs();
  load(true);
  getClient().then(petOfTheWeek).catch(() => {});
})();

import { getClient, el, avatar, badge, timeAgo, toast, currentProfile, requireSignIn, shrinkImage } from '/assets/js/app.js';

const TYPES = { okay: 'Is this okay?', show: 'Show & tell', question: 'Question', tip: 'Tip' };
const PAGE = 20;
const feed = document.querySelector('[data-feed]');
const more = document.querySelector('[data-more]');
const slot = document.querySelector('[data-composer-slot]');
const state = { type: 'all', pet: 'all', page: 0, me: null, liked: new Set() };

function emptyState(text, withSocial) {
  return el('div', { class: 'empty' },
    el('img', { src: '/assets/img/corgi.png', alt: '', width: 120, height: 133, style: 'width:120px;height:auto' }),
    el('p', { text }),
    withSocial ? el('button', { type: 'button', class: 'btn', 'data-open-community': '', text: 'Follow us meanwhile' }) : null);
}

function postCard(p) {
  const a = p.author || {};
  const likes = (p.post_likes && p.post_likes[0] && p.post_likes[0].count) || 0;
  const replies = (p.comments && p.comments[0] && p.comments[0].count) || 0;
  const liked = state.liked.has(p.id);
  const likeBtn = el('button', { type: 'button', class: 'btn ghost', 'aria-pressed': liked ? 'true' : 'false', style: liked ? 'background:var(--accent-soft)' : '', text: `Helpful · ${likes}` });
  likeBtn._count = likes;
  likeBtn.addEventListener('click', () => toggleLike(p, likeBtn));
  return el('article', { class: 'post' },
    el('div', { class: 'who' }, avatar(a),
      el('span', { style: 'display:flex;flex-direction:column;line-height:1.3' },
        el('span', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' }, el('span', { style: 'font-weight:600', text: a.display_name || 'Member' }), badge(a)),
        el('span', { class: 'small muted', text: `${p.pet === 'cats' ? 'Cats' : 'Dogs'} · ${timeAgo(p.created_at)}` })),
      el('span', { class: `pill type-${p.type}`, style: 'margin-left:auto', text: TYPES[p.type] || 'Post' })),
    el('p', { style: 'font-size:17px;white-space:pre-line', text: p.body }),
    p.photo_url ? el('img', { class: 'photo', src: p.photo_url, alt: 'Photo shared by ' + (a.display_name || 'a member'), loading: 'lazy' }) : null,
    el('div', { class: 'actions' }, likeBtn,
      el('a', { class: 'btn plain', href: `/community/post/?id=${p.id}`, text: `${replies} ${replies === 1 ? 'reply' : 'replies'} · Open thread` }),
      el('button', { type: 'button', class: 'btn plain', style: 'margin-left:auto', text: 'Report', onclick: () => report('post', p.id) })));
}

async function toggleLike(p, btn) {
  const sb = await getClient();
  if (!state.me) return requireSignIn();
  const liked = state.liked.has(p.id);
  btn.disabled = true;
  const res = liked
    ? await sb.from('post_likes').delete().eq('post_id', p.id).eq('user_id', state.me.id)
    : await sb.from('post_likes').insert({ post_id: p.id, user_id: state.me.id });
  btn.disabled = false;
  if (res.error) return toast('Could not save that. Please try again.');
  if (liked) state.liked.delete(p.id); else state.liked.add(p.id);
  btn._count += liked ? -1 : 1;
  btn.textContent = `Helpful · ${btn._count}`;
  btn.setAttribute('aria-pressed', liked ? 'false' : 'true');
  btn.style.background = liked ? '' : 'var(--accent-soft)';
}

export async function report(targetType, targetId) {
  const sb = await getClient();
  if (!state.me && !(await currentProfile())) return requireSignIn();
  const reason = window.prompt('Why are you reporting this? (for example: unsafe advice, rude, spam)');
  if (!reason) return;
  const me = state.me || (await currentProfile());
  const { error } = await sb.from('reports').insert({ reporter_id: me.id, target_type: targetType, target_id: targetId, reason: reason.slice(0, 500) });
  toast(error ? 'Could not send the report.' : 'Thanks. The report was sent to Pet Primer.');
}

function composer() {
  if (!state.me) {
    return el('div', { class: 'panel', style: 'flex-direction:row;flex-wrap:wrap;align-items:center;justify-content:space-between' },
      el('span', { style: 'font-weight:600;font-size:18px', text: 'Sign in to post, reply and mark answers helpful.' }),
      el('button', { type: 'button', class: 'btn', 'data-sign-in': '', text: 'Sign in' }));
  }
  let type = 'okay';
  const text = el('textarea', { id: 'post-text', rows: 3, maxlength: 4000, placeholder: 'Describe it: dog or cat, age, food, home, and how long this has been happening.', class: 'field', style: 'resize:vertical' });
  const pet = el('select', { id: 'post-pet', class: 'field', style: 'min-height:44px' }, el('option', { value: 'dogs', text: 'Dog' }), el('option', { value: 'cats', text: 'Cat' }));
  const file = el('input', { type: 'file', accept: 'image/*', class: 'sr-only', id: 'post-photo' });
  const photoLabel = el('span', { text: 'Add photo' });
  file.addEventListener('change', () => { photoLabel.textContent = file.files[0] ? 'Photo: ' + file.files[0].name : 'Add photo'; });
  const chips = el('div', { class: 'chips', role: 'group', 'aria-label': 'Post type' });
  const paint = () => chips.querySelectorAll('button').forEach((b) => { const on = b.dataset.t === type; b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.className = 'chip' + (on ? ' type-' + b.dataset.t : ''); });
  for (const [k, v] of Object.entries(TYPES)) chips.append(el('button', { type: 'button', 'data-t': k, text: v, onclick: () => { type = k; paint(); } }));
  paint();
  const status = el('span', { class: 'small muted', role: 'status' });
  const submit = el('button', { type: 'submit', class: 'btn', style: 'margin-left:auto', text: 'Post' });
  const form = el('form', { class: 'panel composer' },
    el('label', { for: 'post-text', style: 'font-weight:600;font-size:18px', text: 'What’s going on with your pet?' }),
    text, chips,
    el('div', { style: 'display:flex;flex-wrap:wrap;gap:12px;align-items:center' },
      el('label', { for: 'post-pet', class: 'small', style: 'font-weight:600', text: 'Pet' }), pet,
      el('label', { for: 'post-photo', class: 'btn ghost', style: 'border-style:dashed' }, photoLabel), file,
      submit),
    el('span', { class: 'small muted' }, 'Posting as ', el('strong', { text: state.me.display_name || 'Member' }), ' · ',
      el('button', { type: 'button', class: 'btn plain', style: 'min-height:auto;padding:0;text-decoration:underline', text: 'change name', onclick: changeName })),
    status);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = text.value.trim();
    if (!body) { status.textContent = 'Write something first.'; return; }
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
      const { error } = await sb.from('community_posts').insert({ author_id: state.me.id, type, pet: pet.value, body, photo_url });
      if (error) throw error;
      form.reset(); photoLabel.textContent = 'Add photo'; status.textContent = 'Posted.';
      load(true);
    } catch (err) {
      status.textContent = 'Could not post: ' + (err.message || err);
    }
    submit.disabled = false;
  });
  return form;
}

async function changeName() {
  const sb = await getClient();
  const name = window.prompt('Name shown on your posts', state.me.display_name || '');
  if (!name) return;
  const { error } = await sb.from('profiles').update({ display_name: name.trim().slice(0, 40) }).eq('id', state.me.id);
  if (error) return toast('Could not change the name.');
  state.me.display_name = name.trim().slice(0, 40);
  slot.replaceChildren(composer());
}

async function load(reset) {
  const sb = await getClient();
  if (!sb) { feed.replaceChildren(emptyState('The community board opens very soon. Follow Pet Primer on Instagram and X to hear first.', true)); return; }
  if (reset) state.page = 0;
  let q = sb.from('community_posts')
    .select('id, type, pet, body, photo_url, created_at, author:profiles!community_posts_author_id_fkey(display_name, handle, badge, avatar_url), comments(count), post_likes(count)')
    .eq('removed', false)
    .order('created_at', { ascending: false })
    .range(0, (state.page + 1) * PAGE - 1);
  if (state.type !== 'all') q = q.eq('type', state.type);
  if (state.pet !== 'all') q = q.eq('pet', state.pet);
  const { data, error } = await q;
  if (error) { feed.replaceChildren(emptyState('The board could not load right now. Please refresh in a moment.')); console.error(error); return; }
  if (state.me && data.length) {
    const { data: mine } = await sb.from('post_likes').select('post_id').eq('user_id', state.me.id).in('post_id', data.map((d) => d.id));
    state.liked = new Set((mine || []).map((m) => m.post_id));
  }
  feed.replaceChildren(...(data.length ? data.map(postCard) : [emptyState('No posts of this kind yet. Be the first to post one.')]));
  more.hidden = data.length < (state.page + 1) * PAGE;
}

document.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => {
  state.type = b.dataset.filter;
  document.querySelectorAll('[data-filter]').forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
  load(true);
}));
document.querySelectorAll('[data-pet]').forEach((b) => b.addEventListener('click', () => {
  state.pet = b.dataset.pet;
  document.querySelectorAll('[data-pet]').forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
  load(true);
}));
more.addEventListener('click', () => { state.page++; load(false); });

(async () => {
  state.me = await currentProfile();
  slot.replaceChildren(composer());
  load(true);
})();

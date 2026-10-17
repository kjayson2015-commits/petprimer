// Pet Primer community — a member's public profile: bio, follow counts and posts.
import { getClient, el, avatar, badge, toast, currentProfile, shrinkImage } from '/assets/js/app.js';
import { postRow, POST_SELECT, likedSetFor, follow, richText } from '/assets/js/social.js';

const box = document.querySelector('[data-member]');
const wanted = (new URLSearchParams(location.search).get('u') || '').toLowerCase().replace(/^@/, '');
const state = { me: null, p: null, following: false, followers: 0, followingCount: 0, editing: false, posts: [], liked: new Set() };

const back = () => el('div', { class: 'x-title', style: 'padding-bottom:14px' },
  el('a', { href: '/community/', class: 'act', 'aria-label': 'Back to the community', style: 'font-size:20px', text: '←' }),
  el('h1', { style: 'font-size:20px', text: state.p ? state.p.display_name || 'Member' : 'Profile' }));

function notFound(msg) {
  box.replaceChildren(back(), el('div', { class: 'empty', style: 'margin:16px' },
    el('img', { src: '/assets/img/paws-empty.svg', alt: '', width: 132, height: 99, class: 'empty-art' }),
    el('p', { text: msg }), el('a', { class: 'btn', href: '/community/', text: 'Back to the community' })));
}

function editForm() {
  const p = state.p;
  const name = el('input', { id: 'edit-name', class: 'field', maxlength: 40, value: p.display_name || '' });
  const handle = el('input', { id: 'edit-handle', class: 'field', maxlength: 24, value: p.handle || '', pattern: '[a-z0-9_]{2,24}', autocapitalize: 'off', spellcheck: 'false' });
  const bio = el('textarea', { id: 'edit-bio', class: 'field', maxlength: 160, rows: 3, placeholder: 'For example: Golden retriever dad. Learning cat language one blink at a time.' });
  bio.value = p.bio || '';
  const petName = el('input', { id: 'edit-pet-name', class: 'field', maxlength: 40, value: p.pet_name || '', placeholder: 'For example: Biscuit' });
  const petType = el('select', { id: 'edit-pet-type', class: 'field' }, el('option', { value: '', text: 'Choose' }), el('option', { value: 'dog', text: 'Dog' }), el('option', { value: 'cat', text: 'Cat' }));
  petType.value = p.pet_type || '';
  const petBreed = el('input', { id: 'edit-pet-breed', class: 'field', maxlength: 40, value: p.pet_breed || '', placeholder: 'Breed or “mixed”' });
  const thisYear = new Date().getFullYear();
  const petYear = el('input', { id: 'edit-pet-year', class: 'field', type: 'number', inputmode: 'numeric', min: 1990, max: thisYear, value: p.pet_birth_year || '', placeholder: 'e.g. ' + (thisYear - 3) });
  const petPhoto = el('input', { id: 'edit-pet-photo', type: 'file', accept: 'image/*' });
  const status = el('span', { class: 'small muted', role: 'status' });
  const f = el('form', { class: 'panel', style: 'margin:0 18px 16px' },
    el('label', { for: 'edit-name', style: 'font-weight:600', text: 'Name' }), name,
    el('label', { for: 'edit-handle', style: 'font-weight:600', text: 'Username (after @)' }), handle,
    el('span', { class: 'small muted', text: '2 to 24 characters: lowercase letters, numbers and _' }),
    el('label', { for: 'edit-bio', style: 'font-weight:600', text: 'Bio' }), bio,
    el('h2', { style: 'font-size:18px;font-family:var(--body);margin-top:10px', text: 'Your pet (optional)' }),
    el('label', { for: 'edit-pet-name', style: 'font-weight:600', text: 'Pet’s name' }), petName,
    el('label', { for: 'edit-pet-type', style: 'font-weight:600', text: 'Dog or cat' }), petType,
    el('label', { for: 'edit-pet-breed', style: 'font-weight:600', text: 'Breed' }), petBreed,
    el('label', { for: 'edit-pet-year', style: 'font-weight:600', text: 'Year born (roughly is fine)' }), petYear,
    el('label', { for: 'edit-pet-photo', style: 'font-weight:600', text: 'Pet photo' }), petPhoto,
    el('div', { style: 'display:flex;gap:10px;align-items:center;flex-wrap:wrap' },
      el('button', { type: 'submit', class: 'btn', text: 'Save profile' }),
      el('button', { type: 'button', class: 'btn plain', text: 'Cancel', onclick: () => { state.editing = false; render(); } }), status));
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const h = handle.value.trim().toLowerCase();
    if (!/^[a-z0-9_]{2,24}$/.test(h)) { status.textContent = 'Usernames use 2 to 24 lowercase letters, numbers or _.'; return; }
    const sb = await getClient();
    const yr = parseInt(petYear.value, 10);
    const upd = { display_name: name.value.trim().slice(0, 40) || 'Member', handle: h, bio: bio.value.trim().slice(0, 160),
      pet_name: petName.value.trim().slice(0, 40) || null, pet_type: petType.value || null, pet_breed: petBreed.value.trim().slice(0, 40) || null,
      pet_birth_year: yr >= 1990 && yr <= thisYear ? yr : null };
    status.textContent = 'Saving…';
    try {
      if (petPhoto.files[0]) {
        const blob = await shrinkImage(petPhoto.files[0], 800);
        const path = `${p.id}/pet-${Date.now()}.jpg`;
        const up = await sb.storage.from('photos').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
        if (up.error) throw up.error;
        upd.pet_photo_url = sb.storage.from('photos').getPublicUrl(path).data.publicUrl;
      }
    } catch (err) { status.textContent = 'Could not upload the photo: ' + (err.message || err); return; }
    let { error } = await sb.from('profiles').update(upd).eq('id', p.id);
    // Before the pet-profile update is installed, save the rest.
    if (error && /pet_|bio/.test(error.message)) { for (const k of Object.keys(upd)) if (k.startsWith('pet_') || (k === 'bio' && /bio/.test(error.message))) delete upd[k]; ({ error } = await sb.from('profiles').update(upd).eq('id', p.id)); }
    if (error) { status.textContent = /duplicate|unique/i.test(error.message) ? 'That username is taken. Try another.' : 'Could not save: ' + error.message; return; }
    Object.assign(p, upd); state.editing = false; toast('Profile saved');
    history.replaceState(null, '', '/community/member/?u=' + encodeURIComponent(h));
    render();
  });
  return f;
}

function petCard(p) {
  if (!p.pet_name) return null;
  const age = p.pet_birth_year ? new Date().getFullYear() - p.pet_birth_year : null;
  const bits = [p.pet_type === 'cat' ? 'Cat' : p.pet_type === 'dog' ? 'Dog' : '', p.pet_breed || '', age === null ? '' : age < 1 ? 'under a year old' : `about ${age} ${age === 1 ? 'year' : 'years'} old`].filter(Boolean);
  return el('div', { class: 'pet-card-profile', style: 'margin:4px 0 0' },
    p.pet_photo_url ? el('img', { src: p.pet_photo_url, alt: p.pet_name, width: 64, height: 64, loading: 'lazy' }) : el('span', { class: 'pet-ph', 'aria-hidden': 'true' }),
    el('span', { style: 'display:flex;flex-direction:column;gap:2px' },
      el('span', { class: 'small muted', text: 'Meet' }),
      el('strong', { style: 'font-size:18px', text: p.pet_name }),
      bits.length ? el('span', { class: 'small', style: 'color:var(--ink-2)', text: bits.join(' · ') }) : null));
}

function render() {
  const p = state.p;
  const mine = state.me && state.me.id === p.id;
  document.title = `${p.display_name || 'Member'} (@${p.handle}) | Pet Primer Community`;
  const followBtn = mine
    ? el('button', { type: 'button', class: 'btn ghost', style: 'border-radius:999px', text: 'Edit profile', onclick: () => { state.editing = true; render(); } })
    : el('button', { type: 'button', class: state.following ? 'btn ghost' : 'btn', style: 'border-radius:999px', 'aria-pressed': state.following ? 'true' : 'false', text: state.following ? 'Following' : 'Follow',
      onclick: async () => { const r = await follow(p.id, !state.following); if (r === null) return; state.following = r; state.followers += r ? 1 : -1; render(); } });
  const joined = new Date(p.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const stat = (n, label) => el('span', {}, el('strong', { style: 'color:var(--ink)', text: String(n) }), ' ' + label);
  box.replaceChildren(...[
    back(),
    el('div', { style: 'height:110px;background:var(--accent-soft)' }),
    el('div', { style: 'padding:0 18px 14px;display:flex;flex-direction:column;gap:10px' },
      el('div', { style: 'display:flex;justify-content:space-between;align-items:flex-end;margin-top:-44px' },
        el('span', { style: 'border:4px solid var(--surface);border-radius:50%;display:inline-flex;background:var(--surface)' }, avatar(p, 88)), followBtn),
      el('div', { style: 'display:flex;flex-direction:column;gap:2px' },
        el('span', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' }, el('span', { style: 'font-size:22px;font-weight:800;font-family:var(--display)', text: p.display_name || 'Member' }), badge(p)),
        el('span', { class: 'muted', text: '@' + p.handle })),
      p.bio ? richText(p.bio, 'p', { style: 'font-size:16px' }) : null,
      petCard(p),
      el('span', { class: 'small muted', text: 'Joined ' + joined }),
      el('div', { style: 'display:flex;gap:18px;flex-wrap:wrap;font-size:15px;color:var(--ink-3)' }, stat(state.followingCount, 'Following'), stat(state.followers, state.followers === 1 ? 'Follower' : 'Followers'), stat(state.posts.length, state.posts.length === 1 ? 'Post' : 'Posts'))),
    state.editing ? editForm() : null,
    el('div', { class: 'x-tabs', style: 'border-bottom:1px solid var(--line)' }, el('button', { type: 'button', role: 'tab', 'aria-selected': 'true', text: 'Posts' })),
    el('div', { class: 'x-feed' }, ...(state.posts.length ? state.posts.map((x) => postRow(x, state.liked))
      : [el('p', { class: 'muted', style: 'padding:24px 18px', text: mine ? 'You haven’t posted yet. Say hello on the community!' : 'No posts yet.' })]))].filter(Boolean));
}

(async () => {
  const sb = await getClient();
  state.me = await currentProfile();
  if (!sb) return notFound('Profiles open very soon.');
  const handle = wanted || (state.me && state.me.handle);
  if (!handle) return notFound('Sign in to see your profile, or open a member from the community.');
  const { data: p } = await sb.from('profiles').select('*').eq('handle', handle).maybeSingle();
  if (!p) return notFound(`There’s no member called @${handle}.`);
  state.p = p;
  const [posts, fers, fing, mine] = await Promise.all([
    sb.from('community_posts').select(POST_SELECT).eq('author_id', p.id).eq('removed', false).order('created_at', { ascending: false }).limit(50),
    sb.from('follows').select('follower_id', { count: 'exact', head: true }).eq('followee_id', p.id),
    sb.from('follows').select('followee_id', { count: 'exact', head: true }).eq('follower_id', p.id),
    state.me ? sb.from('follows').select('follower_id').eq('follower_id', state.me.id).eq('followee_id', p.id).maybeSingle() : Promise.resolve({ data: null })
  ]);
  state.posts = posts.data || [];
  state.followers = fers.count || 0;
  state.followingCount = fing.count || 0;
  state.following = Boolean(mine.data);
  state.liked = await likedSetFor(sb, state.me, state.posts);
  render();
})();

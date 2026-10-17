// Pet Primer — shared pieces for the X-style community: post rows, @mentions, #tags, likes, follows.
import { getClient, el, avatar, badge, timeAgo, toast, currentProfile, requireSignIn } from '/assets/js/app.js';

export const TYPES = { talk: 'Talk', okay: 'Second opinion', show: 'Show & tell', question: 'Question', tip: 'Tip' };
export const PETS = { dogs: 'Dogs', cats: 'Cats', both: 'Dogs & cats' };
export const nameOf = (a) => (a && a.display_name) || 'Member';
export const handleOf = (a) => (a && a.handle) || '';
export const profileHref = (a) => (a && a.handle ? `/community/member/?u=${encodeURIComponent(a.handle)}` : '#');
export const threadHref = (id) => `/community/post/?id=${encodeURIComponent(id)}`;

// Small line icons (stroke uses currentColor so they follow light and dark mode).
const ICONS = {
  reply: 'M4 5h16v11H8l-4 4z',
  heart: 'M12 20s-7-4.4-9.2-8.6C1.3 8.4 3 5 6.4 5c2 0 3.3 1.1 4.1 2.3h3C14.3 6.1 15.6 5 17.6 5 21 5 22.7 8.4 21.2 11.4 19 15.6 12 20 12 20z',
  share: 'M12 3v12M7 8l5-5 5 5M5 14v6h14v-6',
  flag: 'M5 21V4h11l-2 4 2 4H5',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z'
};
export function icon(name, filled) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('width', '19'); svg.setAttribute('height', '19'); svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', ICONS[name]);
  path.setAttribute('fill', filled ? 'currentColor' : 'none');
  path.setAttribute('stroke', 'currentColor'); path.setAttribute('stroke-width', '1.8'); path.setAttribute('stroke-linejoin', 'round'); path.setAttribute('stroke-linecap', 'round');
  svg.append(path);
  return svg;
}

// Turns @handles, #tags and web links in member text into links. Everything is built as DOM nodes, never HTML.
export function richText(text, tag = 'p', attrs = {}) {
  const node = el(tag, { class: 'rich', ...attrs });
  const re = /(@[a-z0-9_]{2,24})|(#[\p{L}0-9_]{2,40})|(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/giu;
  let last = 0; let m;
  const s = String(text || '');
  while ((m = re.exec(s))) {
    if (m.index > last) node.append(s.slice(last, m.index));
    if (m[1]) node.append(el('a', { href: `/community/member/?u=${encodeURIComponent(m[1].slice(1).toLowerCase())}`, text: m[1] }));
    else if (m[2]) node.append(el('a', { href: `/community/?q=${encodeURIComponent(m[2])}`, text: m[2] }));
    else node.append(el('a', { href: m[3], rel: 'noopener nofollow ugc', target: '_blank', text: m[3].replace(/^https?:\/\/(www\.)?/, '').slice(0, 40) + (m[3].length > 48 ? '…' : '') }));
    last = m.index + m[0].length;
  }
  if (last < s.length) node.append(s.slice(last));
  return node;
}

export async function sharePost(id) {
  const url = location.origin + threadHref(id);
  try {
    if (navigator.share) await navigator.share({ title: 'Pet Primer community', url });
    else { await navigator.clipboard.writeText(url); toast('Link copied'); }
  } catch (e) { /* closed the share sheet */ }
}

export async function report(targetType, targetId) {
  const me = await currentProfile();
  if (!me) return requireSignIn();
  const reason = window.prompt('Why are you reporting this? (for example: unsafe advice, rude, spam)');
  if (!reason) return;
  const sb = await getClient();
  const { error } = await sb.from('reports').insert({ reporter_id: me.id, target_type: targetType, target_id: targetId, reason: reason.slice(0, 500) });
  toast(!error ? 'Thanks. The report was sent to Pet Primer.' : error.code === '23505' ? 'You’ve already reported this. Thanks.' : 'Could not send the report.');
}

// Like (heart) a post; keeps the count in step without reloading.
export async function toggleLike(p, btn, likedSet) {
  const me = await currentProfile();
  if (!me) return requireSignIn();
  const sb = await getClient();
  const liked = likedSet.has(p.id);
  btn.disabled = true;
  const res = liked
    ? await sb.from('post_likes').delete().eq('post_id', p.id).eq('user_id', me.id)
    : await sb.from('post_likes').insert({ post_id: p.id, user_id: me.id });
  btn.disabled = false;
  if (res.error) return toast('Could not save that. Please try again.');
  if (liked) likedSet.delete(p.id); else likedSet.add(p.id);
  p._likes = (p._likes || 0) + (liked ? -1 : 1);
  paintLike(btn, !liked, p._likes);
}
function paintLike(btn, on, n) {
  btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  btn.setAttribute('aria-label', `${on ? 'Liked' : 'Like'} · ${n}`);
  btn.replaceChildren(icon('heart', on), el('span', { text: n ? String(n) : '' }));
}

// One post in the timeline, laid out like X: avatar on the left, then name, @handle and time, text, photo, actions.
export function postRow(p, likedSet) {
  const a = p.author || {};
  p._likes = p._likes ?? ((p.post_likes && p.post_likes[0] && p.post_likes[0].count) || 0);
  const replies = (p.comments && p.comments[0] && p.comments[0].count) || 0;
  const like = el('button', { type: 'button', class: 'act act-like' });
  paintLike(like, likedSet.has(p.id), p._likes);
  like.addEventListener('click', (e) => { e.stopPropagation(); toggleLike(p, like, likedSet); });
  const row = el('article', { class: 'tweet', tabindex: '-1' },
    el('a', { href: profileHref(a), class: 'tweet-avatar', 'aria-label': nameOf(a) }, avatar(a, 44)),
    el('div', { class: 'tweet-main' },
      el('div', { class: 'tweet-head' },
        el('a', { href: profileHref(a), class: 'tweet-name', text: nameOf(a) }), badge(a),
        handleOf(a) ? el('span', { class: 'tweet-handle', text: '@' + handleOf(a) }) : null,
        el('span', { class: 'tweet-dot', 'aria-hidden': 'true', text: '·' }),
        el('a', { href: threadHref(p.id), class: 'tweet-time', title: new Date(p.created_at).toLocaleString(), text: timeAgo(p.created_at) })),
      p.type !== 'talk' || p.pet ? el('div', { class: 'tweet-tags' },
        p.type !== 'talk' ? el('span', { class: `pill type-${p.type}`, text: TYPES[p.type] || 'Post' }) : null,
        p.pet ? el('span', { class: 'tweet-pet', text: PETS[p.pet] || '' }) : null) : null,
      richText(p.body, 'p', { class: 'rich tweet-text' }),
      p.photo_url ? el('img', { class: 'tweet-photo', src: p.photo_url, alt: 'Photo shared by ' + nameOf(a), loading: 'lazy' }) : null,
      el('div', { class: 'tweet-actions' },
        el('a', { href: threadHref(p.id), class: 'act act-reply', 'aria-label': `Reply · ${replies}` }, icon('reply'), el('span', { text: replies ? String(replies) : '' })),
        like,
        el('button', { type: 'button', class: 'act', 'aria-label': 'Share', onclick: (e) => { e.stopPropagation(); sharePost(p.id); } }, icon('share')),
        el('button', { type: 'button', class: 'act act-more', 'aria-label': 'Report this post', title: 'Report', onclick: (e) => { e.stopPropagation(); report('post', p.id); } }, icon('flag')))));
  // Clicking the empty part of a post opens its thread, like X.
  row.addEventListener('click', (e) => {
    if (e.target.closest('a, button, input, textarea, select') || getSelection().toString()) return;
    location.href = threadHref(p.id);
  });
  return row;
}

export const POST_SELECT = 'id, type, pet, body, photo_url, created_at, author_id, author:profiles!community_posts_author_id_fkey(id, display_name, handle, badge, avatar_url), comments(count), post_likes(count)';

export async function likedSetFor(sb, me, posts) {
  if (!me || !posts.length) return new Set();
  const { data } = await sb.from('post_likes').select('post_id').eq('user_id', me.id).in('post_id', posts.map((d) => d.id));
  return new Set((data || []).map((m) => m.post_id));
}

export async function follow(targetId, on) {
  const me = await currentProfile();
  if (!me) { requireSignIn(); return null; }
  const sb = await getClient();
  const res = on
    ? await sb.from('follows').insert({ follower_id: me.id, followee_id: targetId })
    : await sb.from('follows').delete().eq('follower_id', me.id).eq('followee_id', targetId);
  if (res.error) { toast(/relation .*follows/.test(res.error.message) ? 'Following opens very soon.' : 'Could not save that.'); return null; }
  return on;
}

import { getClient, el, avatar, badge, timeAgo, toast, currentProfile, requireSignIn } from '/assets/js/app.js';
import { TYPES, PETS, richText, profileHref, icon } from '/assets/js/social.js';
const box = document.querySelector('[data-thread]');
const id = new URLSearchParams(location.search).get('id');
const state = { me: null, post: null, comments: [], liked: new Set(), open: new Set(), replyingTo: null, postLiked: false, postLikes: 0 };

const nameOf = (a) => (a && a.display_name) || 'Member';
const at = (a) => '@' + ((a && (a.handle || a.display_name)) || 'member').replace(/\s+/g, '').toLowerCase();

async function report(targetType, targetId) {
  const sb = await getClient();
  if (!state.me) return requireSignIn();
  const reason = window.prompt('Why are you reporting this? (for example: unsafe advice, rude, spam)');
  if (!reason) return;
  const { error } = await sb.from('reports').insert({ reporter_id: state.me.id, target_type: targetType, target_id: targetId, reason: reason.slice(0, 500) });
  toast(error ? 'Could not send the report.' : 'Thanks. The report was sent to Pet Primer.');
}

async function addComment(text, parentId) {
  const sb = await getClient();
  if (!state.me) return requireSignIn();
  const body = text.trim();
  if (!body) return;
  const { error } = await sb.from('comments').insert({ post_id: id, parent_id: parentId || null, author_id: state.me.id, body: body.slice(0, 2000) });
  if (error) return toast('Could not post your reply: ' + error.message);
  state.replyingTo = null;
  await load();
}

async function likeComment(c) {
  const sb = await getClient();
  if (!state.me) return requireSignIn();
  const has = state.liked.has(c.id);
  const res = has
    ? await sb.from('comment_likes').delete().eq('comment_id', c.id).eq('user_id', state.me.id)
    : await sb.from('comment_likes').insert({ comment_id: c.id, user_id: state.me.id });
  if (res.error) return toast('Could not save that.');
  if (has) state.liked.delete(c.id); else state.liked.add(c.id);
  c.likes += has ? -1 : 1;
  render();
}

async function likePost() {
  const sb = await getClient();
  if (!state.me) return requireSignIn();
  const res = state.postLiked
    ? await sb.from('post_likes').delete().eq('post_id', id).eq('user_id', state.me.id)
    : await sb.from('post_likes').insert({ post_id: id, user_id: state.me.id });
  if (res.error) return toast('Could not save that.');
  state.postLikes += state.postLiked ? -1 : 1;
  state.postLiked = !state.postLiked;
  render();
}

function replyForm(placeholder, parentId) {
  const input = el('input', { type: 'text', maxlength: 2000, placeholder, 'aria-label': placeholder });
  const f = el('form', { class: 'reply-form' }, input,
    el('button', { type: 'submit', class: 'btn', style: 'border-radius:999px', text: 'Reply' }),
    parentId ? el('button', { type: 'button', class: 'btn plain', text: 'Cancel', onclick: () => { state.replyingTo = null; render(); } }) : null);
  f.addEventListener('submit', (e) => { e.preventDefault(); addComment(input.value, parentId); });
  setTimeout(() => parentId && input.focus(), 0);
  return f;
}

function chains() {
  const byParent = new Map();
  for (const c of state.comments) {
    const k = c.parent_id || 'root';
    if (!byParent.has(k)) byParent.set(k, []);
    byParent.get(k).push(c);
  }
  const roots = (byParent.get('root') || []);
  return roots.map((root) => {
    const list = [root];
    const queue = [root.id];
    while (queue.length) {
      const pid = queue.shift();
      for (const ch of byParent.get(pid) || []) { list.push(ch); queue.push(ch.id); }
    }
    list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    return list;
  });
}

function render() {
  const p = state.post;
  const a = p.author || {};
  const byId = new Map(state.comments.map((c) => [c.id, c]));
  document.title = (p.body.slice(0, 55) + (p.body.length > 55 ? '…' : '')) + ' | Pet Primer Community';
  const head = el('div', { style: 'display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--line)' },
    el('a', { href: '/community/', 'aria-label': 'Back to the community', style: 'width:44px;height:44px;display:flex;align-items:center;justify-content:center;border-radius:50%;text-decoration:none;font-size:22px', text: '←' }),
    el('h1', { style: 'font-size:22px', text: 'Thread' }));
  const share = async () => {
    try { if (navigator.share) await navigator.share({ title: 'Pet Primer community', url: location.href }); else { await navigator.clipboard.writeText(location.href); toast('Link copied'); } } catch (e) { /* closed */ }
  };
  const main = el('article', { style: 'padding:20px 20px 8px;display:flex;flex-direction:column;gap:14px' },
    el('div', { style: 'display:flex;align-items:center;gap:12px' }, el('a', { href: profileHref(a), 'aria-label': nameOf(a) }, avatar(a, 48)),
      el('span', { style: 'display:flex;flex-direction:column;line-height:1.3' },
        el('span', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' }, el('a', { href: profileHref(a), class: 'tweet-name', text: nameOf(a) }), badge(a)),
        el('span', { class: 'small muted', text: at(a) }))),
    el('span', { class: `pill type-${p.type}`, style: 'align-self:flex-start', text: `${TYPES[p.type] || 'Post'} · ${PETS[p.pet] || 'Dogs'}` }),
    richText(p.body, 'p', { style: 'font-size:20px;line-height:1.45;white-space:pre-line;overflow-wrap:anywhere' }),
    p.photo_url ? el('img', { src: p.photo_url, alt: 'Photo shared by ' + nameOf(a), style: 'width:100%;max-height:480px;object-fit:cover;border-radius:14px' }) : null,
    el('span', { class: 'small muted', text: new Date(p.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) }),
    el('div', { style: 'display:flex;flex-wrap:wrap;gap:6px 20px;padding:12px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);font-size:15px;color:var(--ink-3)' },
      el('span', {}, el('strong', { style: 'color:var(--ink)', text: String(state.comments.length) }), ' Replies'),
      el('span', {}, el('strong', { style: 'color:var(--ink)', text: String(state.postLikes) }), ' Likes')),
    el('div', { style: 'display:flex;flex-wrap:wrap;gap:8px' },
      el('button', { type: 'button', class: 'act act-like', 'aria-pressed': state.postLiked ? 'true' : 'false', 'aria-label': state.postLiked ? 'Liked' : 'Like', onclick: likePost }, icon('heart', state.postLiked), el('span', { text: state.postLiked ? 'Liked' : 'Like' })),
      el('button', { type: 'button', class: 'act', onclick: share }, icon('share'), el('span', { text: 'Share' })),
      el('button', { type: 'button', class: 'act', style: 'margin-left:auto', onclick: () => report('post', p.id) }, icon('flag'), el('span', { text: 'Report' }))));

  const composer = state.me
    ? el('div', { style: 'display:flex;gap:12px;padding:16px 20px;border-top:1px solid var(--line);border-bottom:1px solid var(--line);align-items:center' }, avatar(state.me), replyForm('Post your reply', null))
    : el('div', { style: 'display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;padding:16px 20px;border-top:1px solid var(--line);border-bottom:1px solid var(--line)' },
      el('span', { style: 'font-weight:600', text: 'Sign in to reply' }), el('button', { type: 'button', class: 'btn', 'data-sign-in': '', text: 'Sign in' }));

  const groups = chains().map((list, gi) => {
    const open = state.open.has(gi);
    const shown = open ? list : list.slice(0, 2);
    const hidden = list.length - shown.length;
    const wrap = el('div', { class: 'chain' });
    shown.forEach((c, i) => {
      const ca = c.author || {};
      const parent = c.parent_id ? byId.get(c.parent_id) : null;
      const liked = state.liked.has(c.id);
      wrap.append(el('div', { class: 'reply' },
        el('div', { class: 'rail' }, el('a', { href: profileHref(ca), 'aria-label': nameOf(ca) }, avatar(ca)), (i < shown.length - 1 || hidden > 0) ? el('span', { class: 'line', 'aria-hidden': 'true' }) : null),
        el('div', { class: 'body' },
          el('div', { style: 'display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;font-size:15px' },
            el('a', { href: profileHref(ca), class: 'tweet-name', text: nameOf(ca) }), badge(ca), el('span', { class: 'muted', text: `${at(ca)} · ${timeAgo(c.created_at)}` })),
          el('span', { class: 'small muted', text: 'Replying to ' + at(parent ? parent.author : p.author) }),
          richText(c.body, 'p', { style: 'white-space:pre-line;overflow-wrap:anywhere' }),
          el('div', { style: 'display:flex;gap:16px;flex-wrap:wrap' },
            el('button', { type: 'button', class: 'act', onclick: () => { if (!state.me) return requireSignIn(); state.replyingTo = c.id; render(); } }, icon('reply'), el('span', { text: 'Reply' })),
            el('button', { type: 'button', class: 'act act-like', 'aria-pressed': liked ? 'true' : 'false', 'aria-label': `${liked ? 'Liked' : 'Like'} · ${c.likes}`, onclick: () => likeComment(c) }, icon('heart', liked), el('span', { text: c.likes ? String(c.likes) : '' })),
            el('button', { type: 'button', class: 'act', 'aria-label': 'Report this reply', onclick: () => report('comment', c.id) }, icon('flag'))),
          state.replyingTo === c.id ? replyForm('Reply to ' + at(ca), c.id) : null)));
    });
    if (hidden > 0) wrap.append(el('button', { type: 'button', class: 'btn plain', style: 'width:100%;justify-content:flex-start;padding-left:72px;color:var(--accent);font-weight:600', text: `Show ${hidden} more ${hidden === 1 ? 'reply' : 'replies'}`, onclick: () => { state.open.add(gi); render(); } }));
    return wrap;
  });
  box.replaceChildren(...[head, main, composer, ...groups,
    groups.length ? null : el('p', { class: 'muted', style: 'padding:20px', text: 'No replies yet. Start the conversation.' })].filter(Boolean));
}

async function load() {
  const sb = await getClient();
  if (!sb) { box.replaceChildren(el('p', { style: 'padding:24px', text: 'The community board opens very soon.' })); return; }
  if (!id) { box.replaceChildren(el('p', { style: 'padding:24px' }, 'This thread link is missing its post. ', el('a', { href: '/community/', text: 'Back to the board' }))); return; }
  const [{ data: post, error }, { data: comments }, likes] = await Promise.all([
    sb.from('community_posts').select('id, type, pet, body, photo_url, created_at, author:profiles!community_posts_author_id_fkey(id, display_name, handle, badge, avatar_url), post_likes(count)').eq('id', id).eq('removed', false).maybeSingle(),
    sb.from('comments').select('id, parent_id, body, created_at, author:profiles!comments_author_id_fkey(display_name, handle, badge, avatar_url), comment_likes(count)').eq('post_id', id).eq('removed', false).order('created_at'),
    state.me ? sb.from('post_likes').select('post_id').eq('post_id', id).eq('user_id', state.me.id) : Promise.resolve({ data: [] })
  ]);
  if (error || !post) { box.replaceChildren(el('p', { style: 'padding:24px' }, 'This post was removed or does not exist. ', el('a', { href: '/community/', text: 'Back to the board' }))); return; }
  state.post = post;
  state.postLikes = (post.post_likes && post.post_likes[0] && post.post_likes[0].count) || 0;
  state.postLiked = Boolean(likes.data && likes.data.length);
  state.comments = (comments || []).map((c) => ({ ...c, likes: (c.comment_likes && c.comment_likes[0] && c.comment_likes[0].count) || 0 }));
  if (state.me && state.comments.length) {
    const { data: mine } = await sb.from('comment_likes').select('comment_id').eq('user_id', state.me.id).in('comment_id', state.comments.map((c) => c.id));
    state.liked = new Set((mine || []).map((m) => m.comment_id));
  }
  render();
}

(async () => { state.me = await currentProfile(); load(); })();

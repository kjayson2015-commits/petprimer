// Tiny, safe text-to-HTML renderer shared by the build and the editor.
// Supports: blank-line paragraphs, "## " and "### " headings, "- " lists,
// **bold**, *italic*, and [links](https://...). Everything else is escaped.
export function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const unesc = (s) => String(s).replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

// [[Target]] or [[Target|link text]]; [[src:Source title]] cites a saved source.
const WIKI = /\[\[([^\]|\n]+?)(?:\|([^\]\n]+))?\]\]/g;
export function findLinks(text) {
  const out = [];
  String(text || '').replace(WIKI, (m, target, label) => { out.push({ target: target.trim(), label: label ? label.trim() : '' }); return m; });
  return out;
}

function inline(s, opts = {}) {
  let out = esc(s);
  out = out.replace(WIKI, (m, target, label) => {
    const t = unesc(target).trim();
    const l = label ? unesc(label).trim() : '';
    if (opts.link) {
      const html = opts.link(t, l);
      if (html) return html;
    }
    return esc(l || t.replace(/^src:/i, ''));
  });
  out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, '$1<em>$2</em>');
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)/g, (m, text, url) => `<a href="${url}"${url.startsWith('http') ? ' rel="noopener"' : ''}>${text}</a>`);
  return out;
}

export function renderMarkdown(text, opts = {}) {
  const blocks = String(text || '').replace(/\r\n/g, '\n').split(/\n{2,}/);
  const html = [];
  for (const raw of blocks) {
    const b = raw.trim();
    if (!b) continue;
    if (b.startsWith('### ')) { html.push(`<h3>${inline(b.slice(4), opts)}</h3>`); continue; }
    if (b.startsWith('## ')) { html.push(`<h2>${inline(b.slice(3), opts)}</h2>`); continue; }
    const lines = b.split('\n');
    if (lines.every((l) => /^\s*[-*] /.test(l))) {
      html.push('<ul>' + lines.map((l) => `<li>${inline(l.replace(/^\s*[-*] /, ''), opts)}</li>`).join('') + '</ul>');
      continue;
    }
    html.push(`<p>${lines.map((l) => inline(l, opts)).join('<br>')}</p>`);
  }
  return html.join('\n');
}

export function plainText(text) {
  return String(text || '').replace(WIKI, (m, t, l) => l || t.replace(/^src:/i, '')).replace(/^#+\s*/gm, '').replace(/\*\*|\*/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ').trim();
}

export function slugify(t) {
  return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '').trim().replace(/[\s-]+/g, '-').slice(0, 70).replace(/-$/, '');
}

export const RESERVED_SLUGS = ['dogs', 'cats', 'faq', 'community', 'about', 'privacy', 'terms', 'search', 'editor', 'assets', 'myths', 'notes', '404', 'how-we-grade', 'emergency', 'tools', 'can-my-pet-eat', 'authors'];

export const GRADES = ['Pending', 'Strong', 'Moderate', 'Early', 'Weak', 'Not supported'];
export const gradeClass = (g) => 'grade-' + String(g || 'Pending').toLowerCase().replace(/\s+/g, '-');

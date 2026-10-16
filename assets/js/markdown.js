// Tiny, safe text-to-HTML renderer shared by the build and the editor.
// Supports: blank-line paragraphs, "## " and "### " headings, "- " lists,
// **bold**, *italic*, and [links](https://...). Everything else is escaped.
export function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function inline(s) {
  let out = esc(s);
  out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, '$1<em>$2</em>');
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)/g, (m, text, url) => `<a href="${url}"${url.startsWith('http') ? ' rel="noopener"' : ''}>${text}</a>`);
  return out;
}

export function renderMarkdown(text) {
  const blocks = String(text || '').replace(/\r\n/g, '\n').split(/\n{2,}/);
  const html = [];
  for (const raw of blocks) {
    const b = raw.trim();
    if (!b) continue;
    if (b.startsWith('### ')) { html.push(`<h3>${inline(b.slice(4))}</h3>`); continue; }
    if (b.startsWith('## ')) { html.push(`<h2>${inline(b.slice(3))}</h2>`); continue; }
    const lines = b.split('\n');
    if (lines.every((l) => /^\s*[-*] /.test(l))) {
      html.push('<ul>' + lines.map((l) => `<li>${inline(l.replace(/^\s*[-*] /, ''))}</li>`).join('') + '</ul>');
      continue;
    }
    html.push(`<p>${lines.map(inline).join('<br>')}</p>`);
  }
  return html.join('\n');
}

export function plainText(text) {
  return String(text || '').replace(/^#+\s*/gm, '').replace(/\*\*|\*/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ').trim();
}

export function slugify(t) {
  return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '').trim().replace(/[\s-]+/g, '-').slice(0, 70).replace(/-$/, '');
}

export const RESERVED_SLUGS = ['dogs', 'cats', 'faq', 'community', 'about', 'privacy', 'terms', 'search', 'editor', 'assets', 'myths', 'notes', '404'];

export const GRADES = ['Pending', 'Strong', 'Moderate', 'Early', 'Weak', 'Not supported'];
export const gradeClass = (g) => 'grade-' + String(g || 'Pending').toLowerCase().replace(/\s+/g, '-');

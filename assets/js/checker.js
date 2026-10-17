// Filters the "Can my pet eat this?" list as you type.
const input = document.querySelector('[data-eat-search]');
const rows = [...document.querySelectorAll('.eat-row')];
const count = document.querySelector('[data-eat-count]');
const empty = document.querySelector('[data-eat-empty]');
const norm = (s) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, '').trim();
function filter() {
  const q = norm(input.value);
  const words = q.split(/\s+/).filter(Boolean).map((w) => w.replace(/(ies|es|s)$/, ''));
  let shown = 0;
  for (const r of rows) {
    const hit = !words.length || words.every((w) => norm(r.dataset.name).includes(w));
    r.hidden = !hit; if (hit) shown++;
  }
  for (const g of ['food', 'plant']) {
    const head = document.querySelector(`[data-group-head="${g}"]`);
    if (head) head.hidden = !rows.some((r) => r.dataset.group === g && !r.hidden);
  }
  empty.hidden = shown > 0;
  count.textContent = q ? `${shown} ${shown === 1 ? 'match' : 'matches'}` : '';
}
if (input) {
  const q = new URLSearchParams(location.search).get('q');
  if (q) input.value = q;
  input.addEventListener('input', filter);
  filter();
}

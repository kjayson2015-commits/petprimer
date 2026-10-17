// Pet Primer — private visitor dashboard (editor only).
// Numbers come from public.visitor_stats() (supabase/007_visitor_dashboard.sql), which only the editor may call.
import { getClient, el, currentProfile, timeAgo } from '/assets/js/app.js';

const body = document.querySelector('[data-vd-body]');
const controls = document.querySelector('[data-vd-controls]');
const statusPill = document.querySelector('[data-vd-status]');
const TZ = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (e) { return 'UTC'; } })();
const SVG = 'http://www.w3.org/2000/svg';
const REFRESH_MS = 30000;
const state = { sb: null, days: 30, data: null, recent: [], titles: new Map(), timer: null, updated: null, loading: false };
try { const d = Number(localStorage.getItem('pp-vd-range')); if ([1, 7, 30, 90].includes(d)) state.days = d; } catch (e) { /* storage blocked */ }

const fmt = (n) => Number(n || 0).toLocaleString('en-US');
const pct = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);
const rangeName = (d) => (d === 1 ? 'today' : `the last ${d} days`);

// ---------- Friendly names ----------
const US_ZONES = { 'America/New_York': 'Eastern', 'America/Detroit': 'Eastern', 'America/Indiana': 'Eastern', 'America/Kentucky': 'Eastern', 'America/Chicago': 'Central', 'America/Menominee': 'Central', 'America/North_Dakota': 'Central', 'America/Denver': 'Mountain', 'America/Boise': 'Mountain', 'America/Phoenix': 'Mountain', 'America/Los_Angeles': 'Pacific', 'America/Anchorage': 'Alaska', 'America/Juneau': 'Alaska', 'America/Sitka': 'Alaska', 'America/Nome': 'Alaska', 'America/Yakutat': 'Alaska', 'America/Metlakatla': 'Alaska', 'America/Adak': 'Hawaii', 'Pacific/Honolulu': 'Hawaii' };
const COUNTRY = { 'Europe/London': 'United Kingdom', 'Europe/Belfast': 'United Kingdom', 'Europe/Dublin': 'Ireland', 'America/Toronto': 'Canada', 'America/Vancouver': 'Canada', 'America/Edmonton': 'Canada', 'America/Winnipeg': 'Canada', 'America/Halifax': 'Canada', 'America/St_Johns': 'Canada', 'America/Regina': 'Canada', 'America/Montreal': 'Canada', 'Africa/Nairobi': 'Kenya', 'Africa/Kampala': 'Uganda', 'Africa/Dar_es_Salaam': 'Tanzania', 'Africa/Lagos': 'Nigeria', 'Africa/Accra': 'Ghana', 'Africa/Johannesburg': 'South Africa', 'Europe/Paris': 'France', 'Europe/Berlin': 'Germany', 'Europe/Madrid': 'Spain', 'Europe/Rome': 'Italy', 'Europe/Amsterdam': 'Netherlands', 'Europe/Brussels': 'Belgium', 'Europe/Stockholm': 'Sweden', 'Europe/Oslo': 'Norway', 'Europe/Copenhagen': 'Denmark', 'Europe/Warsaw': 'Poland', 'Europe/Lisbon': 'Portugal', 'Europe/Zurich': 'Switzerland', 'Asia/Kolkata': 'India', 'Asia/Calcutta': 'India', 'Asia/Manila': 'Philippines', 'Asia/Dubai': 'United Arab Emirates', 'Asia/Singapore': 'Singapore', 'Asia/Tokyo': 'Japan', 'America/Mexico_City': 'Mexico', 'America/Sao_Paulo': 'Brazil', 'America/La_Paz': 'Bolivia', 'America/Bogota': 'Colombia', 'America/Lima': 'Peru', 'Pacific/Auckland': 'New Zealand' };
function usZone(tz) { return US_ZONES[tz] || US_ZONES[tz.split('/').slice(0, 2).join('/')] || null; }
function countryOf(tz) {
  if (usZone(tz)) return 'United States';
  if (COUNTRY[tz]) return COUNTRY[tz];
  if (tz.startsWith('Australia/')) return 'Australia';
  const city = (tz.split('/').pop() || tz).replace(/_/g, ' ');
  return `Other (${city})`;
}
function sourceName(host) {
  const h = String(host || '').toLowerCase();
  if (!h) return 'Typed or bookmarked';
  const rules = [[/(^|\.)google\./, 'Google'], [/(^|\.)bing\.com$/, 'Bing'], [/duckduckgo\.com$/, 'DuckDuckGo'], [/(^|\.)yahoo\./, 'Yahoo'], [/instagram\.com$/, 'Instagram'], [/(^|\.)(t\.co|x\.com|twitter\.com)$/, 'X'], [/facebook\.com$|fb\.me$/, 'Facebook'], [/pinterest\./, 'Pinterest'], [/reddit\.com$/, 'Reddit'], [/tiktok\.com$/, 'TikTok'], [/youtube\.com$|youtu\.be$/, 'YouTube'], [/chatgpt\.com$|openai\.com$/, 'ChatGPT'], [/perplexity\.ai$/, 'Perplexity'], [/mail\.google\.com$|outlook\.|mail\.yahoo/, 'Email']];
  for (const [re, name] of rules) if (re.test(h)) return name;
  return h;
}
const DEVICE = { phone: 'Phones', tablet: 'Tablets', computer: 'Computers', unknown: 'Not recorded' };
function pageName(path) {
  if (path === '/') return 'Home page';
  const t = state.titles.get(path);
  return t || path;
}

// ---------- Small pieces ----------
function panel(title, sub, ...kids) {
  return el('section', { class: 'panel vd-panel' },
    el('div', { class: 'vd-panel-head' }, el('h2', { text: title }), sub ? el('span', { class: 'small muted', text: sub }) : null),
    ...kids);
}
function change(cur, prev, label) {
  if (!prev && !cur) return el('span', { class: 'vd-change', text: `No visits in the ${label} before` });
  if (!prev) return el('span', { class: 'vd-change', text: `New: none in the ${label} before` });
  const p = Math.round(((cur - prev) / prev) * 100);
  const arrow = p > 0 ? '↑' : p < 0 ? '↓' : '→';
  return el('span', { class: `vd-change ${p > 0 ? 'up' : p < 0 ? 'down' : ''}`, text: `${arrow} ${Math.abs(p)}% vs the ${label} before` });
}
function tile(label, value, note) {
  return el('div', { class: 'vd-tile' }, el('span', { class: 'vd-tile-label', text: label }), el('strong', { class: 'vd-tile-num', text: value }), note || null);
}
function barList(rows, { total, unit = 'visitors', link } = {}) {
  if (!rows.length) return [el('p', { class: 'small muted', text: 'Nothing yet.' })];
  const max = Math.max(...rows.map((r) => r.value), 1);
  return [el('ol', { class: 'vd-bars' }, ...rows.map((r) => el('li', { class: 'vd-bar-row', title: `${r.label}: ${fmt(r.value)} ${unit}` },
    el('span', { class: 'vd-bar-label' }, link && r.href ? el('a', { href: r.href, target: '_blank', rel: 'noopener', text: r.label }) : r.label),
    el('span', { class: 'vd-bar-val' }, el('strong', { text: fmt(r.value) }), total ? el('span', { class: 'muted', text: ` · ${pct(r.value, total)}%` }) : null),
    el('span', { class: 'vd-bar-track', 'aria-hidden': 'true' }, el('span', { class: 'vd-bar-fill', style: `width:${Math.max(2, (r.value / max) * 100)}%` })))))];
}
function svg(tag, attrs = {}) { const n = document.createElementNS(SVG, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v)); return n; }
function niceMax(v) { if (v <= 4) return 4; const p = 10 ** Math.floor(Math.log10(v)); const m = v / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p; }
const tooltip = el('div', { class: 'vd-tip', role: 'status', hidden: true });
document.body.append(tooltip);
function showTip(x, y, rows, title) {
  tooltip.replaceChildren(el('span', { class: 'vd-tip-title', text: title }), ...rows.map(([name, val, cls]) => el('span', { class: 'vd-tip-row' }, el('span', { class: `vd-key ${cls}` }), el('strong', { text: fmt(val) }), el('span', { class: 'muted', text: name }))));
  tooltip.hidden = false;
  const r = tooltip.getBoundingClientRect();
  const left = Math.min(window.innerWidth - r.width - 8, Math.max(8, x - r.width / 2));
  const top = y - r.height - 14 < 8 ? y + 18 : y - r.height - 14;
  tooltip.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
}
const hideTip = () => { tooltip.hidden = true; };

// ---------- Charts ----------
function dayLabel(iso, opts) { return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', opts || { month: 'short', day: 'numeric' }); }
function hourLabel(iso) { return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric' }).replace(' ', '').toLowerCase(); }

function lineChart(daily) {
  const wrap = el('div', { class: 'vd-chart' });
  const draw = () => {
    const W = Math.max(280, wrap.clientWidth || 600), H = 240, L = 44, R = 12, T = 12, B = 30;
    const n = daily.length, iw = W - L - R, ih = H - T - B;
    const max = niceMax(Math.max(1, ...daily.map((d) => Math.max(d.views, d.visitors))));
    const x = (i) => L + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
    const y = (v) => T + ih - (v / max) * ih;
    const s = svg('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, class: 'vd-svg', role: 'img', 'aria-label': `Page views and visitors per day for ${rangeName(state.days)}` });
    for (let k = 0; k <= 4; k++) {
      const v = (max / 4) * k, yy = y(v);
      s.append(svg('line', { x1: L, x2: W - R, y1: yy, y2: yy, class: k === 0 ? 'vd-axis' : 'vd-grid' }));
      const t = svg('text', { x: L - 8, y: yy + 4, 'text-anchor': 'end', class: 'vd-tick' }); t.textContent = fmt(v); s.append(t);
    }
    const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 72))));
    daily.forEach((d, i) => {
      if (i % every && i !== n - 1) return;
      if (i !== n - 1 && n - 1 - i < every * 0.6) return;
      const t = svg('text', { x: x(i), y: H - 8, 'text-anchor': i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle', class: 'vd-tick' }); t.textContent = i === n - 1 ? 'Today' : dayLabel(d.day); s.append(t);
    });
    const area = `M${x(0)},${y(0)} ` + daily.map((d, i) => `L${x(i)},${y(d.views)}`).join(' ') + ` L${x(n - 1)},${y(0)} Z`;
    s.append(svg('path', { d: area, class: 'vd-area' }));
    for (const [key, cls] of [['views', 's1'], ['visitors', 's2']]) {
      s.append(svg('path', { d: daily.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d[key])}`).join(' '), class: `vd-line ${cls}` }));
      if (n === 1) s.append(svg('circle', { cx: x(0), cy: y(daily[0][key]), r: 4, class: `vd-dot ${cls}` }));
    }
    const cross = svg('line', { y1: T, y2: T + ih, class: 'vd-cross', visibility: 'hidden' });
    const d1 = svg('circle', { r: 4.5, class: 'vd-dot s1', visibility: 'hidden' }), d2 = svg('circle', { r: 4.5, class: 'vd-dot s2', visibility: 'hidden' });
    s.append(cross, d1, d2);
    const hit = svg('rect', { x: L, y: T, width: iw, height: ih, fill: 'transparent', tabindex: 0, 'aria-label': 'Daily chart. Use the arrow keys to read each day.' });
    let idx = n - 1;
    const show = (i, cx, cy) => {
      idx = Math.max(0, Math.min(n - 1, i)); const d = daily[idx];
      for (const [node, vis] of [[cross, 1], [d1, 1], [d2, 1]]) node.setAttribute('visibility', vis ? 'visible' : 'hidden');
      cross.setAttribute('x1', x(idx)); cross.setAttribute('x2', x(idx));
      d1.setAttribute('cx', x(idx)); d1.setAttribute('cy', y(d.views)); d2.setAttribute('cx', x(idx)); d2.setAttribute('cy', y(d.visitors));
      const box = s.getBoundingClientRect();
      showTip(cx ?? box.left + x(idx), cy ?? box.top + y(Math.max(d.views, d.visitors)), [['page views', d.views, 's1'], ['visitors', d.visitors, 's2']], dayLabel(d.day, { weekday: 'short', month: 'short', day: 'numeric' }));
    };
    const hide = () => { [cross, d1, d2].forEach((nd) => nd.setAttribute('visibility', 'hidden')); hideTip(); };
    hit.addEventListener('pointermove', (e) => { const box = s.getBoundingClientRect(); const px = e.clientX - box.left; show(n === 1 ? 0 : Math.round(((px - L) / iw) * (n - 1)), e.clientX, box.top + T); });
    hit.addEventListener('pointerleave', hide);
    hit.addEventListener('focus', () => show(idx));
    hit.addEventListener('blur', hide);
    hit.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') { e.preventDefault(); show(idx - 1); } if (e.key === 'ArrowRight') { e.preventDefault(); show(idx + 1); } });
    s.append(hit);
    wrap.replaceChildren(s);
  };
  requestAnimationFrame(draw);
  new ResizeObserver(() => draw()).observe(wrap);
  return wrap;
}

function hourChart(hourly) {
  const wrap = el('div', { class: 'vd-chart' });
  const draw = () => {
    const W = Math.max(280, wrap.clientWidth || 600), H = 190, L = 36, R = 6, T = 10, B = 28;
    const n = hourly.length, iw = W - L - R, ih = H - T - B, slot = iw / n, bw = Math.max(3, slot - 2);
    const max = niceMax(Math.max(1, ...hourly.map((h) => h.views)));
    const y = (v) => T + ih - (v / max) * ih;
    const s = svg('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, class: 'vd-svg', role: 'img', 'aria-label': 'Page views in each of the last 24 hours' });
    for (let k = 0; k <= 2; k++) {
      const v = (max / 2) * k, yy = y(v);
      s.append(svg('line', { x1: L, x2: W - R, y1: yy, y2: yy, class: k === 0 ? 'vd-axis' : 'vd-grid' }));
      const t = svg('text', { x: L - 6, y: yy + 4, 'text-anchor': 'end', class: 'vd-tick' }); t.textContent = fmt(v); s.append(t);
    }
    hourly.forEach((h, i) => {
      const x0 = L + i * slot + (slot - bw) / 2, hh = Math.max(h.views ? 2 : 0, ih - (y(h.views) - T)), r = Math.min(4, bw / 2, hh);
      const yTop = T + ih - hh;
      const d = hh ? `M${x0},${T + ih} V${yTop + r} Q${x0},${yTop} ${x0 + r},${yTop} H${x0 + bw - r} Q${x0 + bw},${yTop} ${x0 + bw},${yTop + r} V${T + ih} Z` : '';
      if (d) s.append(svg('path', { d, class: `vd-bar ${i === n - 1 ? 'now' : ''}` }));
      const hit = svg('rect', { x: L + i * slot, y: T, width: slot, height: ih, fill: 'transparent', tabindex: 0, 'aria-label': `${hourLabel(h.hour)}: ${h.views} page views` });
      const show = (e) => { const box = s.getBoundingClientRect(); showTip(e && e.clientX ? e.clientX : box.left + x0 + bw / 2, box.top + yTop, [['page views', h.views, 's1']], i === n - 1 ? 'This hour' : `${hourLabel(h.hour)} – ${hourLabel(new Date(new Date(h.hour).getTime() + 36e5).toISOString())}`); };
      hit.addEventListener('pointermove', show); hit.addEventListener('focus', () => show()); hit.addEventListener('pointerleave', hideTip); hit.addEventListener('blur', hideTip);
      s.append(hit);
      if (i % 6 === 0 || i === n - 1) { const t = svg('text', { x: L + i * slot + slot / 2, y: H - 8, 'text-anchor': i === n - 1 ? 'end' : 'middle', class: 'vd-tick' }); t.textContent = i === n - 1 ? 'Now' : hourLabel(h.hour); s.append(t); }
    });
    wrap.replaceChildren(s);
  };
  requestAnimationFrame(draw);
  new ResizeObserver(() => draw()).observe(wrap);
  return wrap;
}

function dailyTable(daily) {
  return el('details', { class: 'vd-table' }, el('summary', { text: 'Show these numbers as a table' }),
    el('table', {}, el('thead', {}, el('tr', {}, el('th', { text: 'Day' }), el('th', { text: 'Visitors' }), el('th', { text: 'Page views' }))),
      el('tbody', {}, ...daily.slice().reverse().map((d) => el('tr', {}, el('td', { text: dayLabel(d.day, { weekday: 'short', month: 'short', day: 'numeric' }) }), el('td', { text: fmt(d.visitors) }), el('td', { text: fmt(d.views) }))))));
}

// ---------- Render ----------
function render() {
  const d = state.data, t = d.totals;
  const period = state.days === 1 ? 'day' : `${state.days} days`;
  const live = d.live || { visitors: 0, views: 0, pages: [] };

  const liveBox = el('section', { class: `vd-live ${live.visitors ? 'on' : ''}` },
    el('div', { class: 'vd-live-main' },
      el('span', { class: 'vd-live-label' }, el('span', { class: 'vd-pulse', 'aria-hidden': 'true' }), 'Right now'),
      el('strong', { class: 'vd-live-num', text: fmt(live.visitors) }),
      el('span', { class: 'vd-live-sub', text: live.visitors === 1 ? 'person on the site in the last 5 minutes' : 'people on the site in the last 5 minutes' })),
    el('div', { class: 'vd-live-pages' },
      el('span', { class: 'vd-tile-label', text: 'What they are reading' }),
      ...(live.pages.length ? live.pages.map((p) => el('div', { class: 'vd-live-page' }, el('a', { href: p.path, target: '_blank', rel: 'noopener', text: pageName(p.path) }), el('span', { class: 'muted', text: `${fmt(p.views)} ${p.views === 1 ? 'view' : 'views'}` })))
        : [el('p', { class: 'small muted', text: 'Nobody at the moment. This updates every 30 seconds.' })])));

  const perVisit = t.visitors ? (t.views / t.visitors).toFixed(1) : '0';
  const tiles = el('div', { class: 'vd-tiles' },
    tile(state.days === 1 ? 'Visitors today' : `Visitors, last ${state.days} days`, fmt(t.visitors), change(t.visitors, t.prev_visitors, period)),
    tile(state.days === 1 ? 'Page views today' : `Page views, last ${state.days} days`, fmt(t.views), change(t.views, t.prev_views, period)),
    state.days === 1 ? tile('Visitors yesterday', fmt(t.yesterday_visitors), el('span', { class: 'vd-change', text: `${fmt(t.yesterday_views)} page views` }))
      : tile('Visitors today', fmt(t.today_visitors), change(t.today_visitors, t.yesterday_visitors, 'day')),
    tile('Pages per visit', perVisit, el('span', { class: 'vd-change', text: 'How many pages a visitor reads' })));

  const legend = el('div', { class: 'vd-legend' }, el('span', {}, el('span', { class: 'vd-key s2' }), 'Visitors'), el('span', {}, el('span', { class: 'vd-key s1' }), 'Page views'));
  const trend = state.days === 1
    ? panel('Today, hour by hour', 'Page views in each of the last 24 hours', hourChart(d.hourly))
    : panel('Visitors over time', `Each day, ${rangeName(state.days)}`, legend, lineChart(d.daily), dailyTable(d.daily));
  const hours = state.days === 1 ? null : panel('Last 24 hours', 'Page views each hour', hourChart(d.hourly));

  const pages = panel('Top pages', `Most viewed, ${rangeName(state.days)}`,
    ...barList(d.pages.map((p) => ({ label: pageName(p.path), value: p.views, href: p.path })), { total: t.views, unit: 'page views', link: true }));

  const src = new Map();
  if (d.direct_visitors) src.set('Typed or bookmarked', d.direct_visitors);
  for (const r of d.referrers) { const k = sourceName(r.referrer); src.set(k, (src.get(k) || 0) + r.visitors); }
  const sources = panel('Where visitors come from', 'Search engines, social media and other sites',
    ...barList([...src].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 8), { total: t.visitors }));

  const devices = panel('Devices', 'Phone, tablet or computer',
    ...barList(d.devices.map((x) => ({ label: DEVICE[x.device] || x.device, value: x.visitors })), { total: t.visitors }));

  const countries = new Map(), us = new Map();
  let located = 0;
  for (const z of d.timezones) {
    const c = countryOf(z.tz); countries.set(c, (countries.get(c) || 0) + z.visitors); located += z.visitors;
    const u = usZone(z.tz); if (u) us.set(u, (us.get(u) || 0) + z.visitors);
  }
  const countryRows = [...countries].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  const usTotal = [...us.values()].reduce((a, b) => a + b, 0);
  const regions = panel('Where in the world', 'From each browser’s time zone, so it is approximate',
    ...barList(countryRows.slice(0, 8), { total: located }),
    usTotal ? el('p', { class: 'small vd-us', text: 'US time zones: ' + [...us].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pct(v, usTotal)}%`).join(' · ') }) : null,
    !located && t.visitors ? el('p', { class: 'small muted', text: 'Older visits don’t have a time zone yet. New visits will show here.' }) : null);

  const recent = panel('Latest visits', 'The most recent page views',
    state.recent.length ? el('div', { class: 'vd-feed' }, ...state.recent.map((r) => el('div', { class: 'vd-feed-row' },
      el('span', { class: 'vd-feed-time', text: timeAgo(r.created_at) }),
      el('a', { class: 'vd-feed-page', href: r.path, target: '_blank', rel: 'noopener', text: pageName(r.path) }),
      el('span', { class: 'vd-feed-meta muted', text: [sourceName(r.referrer), r.device ? DEVICE[r.device].replace(/s$/, '') : '', r.tz ? countryOf(r.tz).replace(/^Other \((.*)\)$/, '$1') : ''].filter(Boolean).join(' · ') }))))
      : el('p', { class: 'small muted', text: 'No visits yet. Share a link to petprimer.online and they’ll appear here within seconds.' }));

  let noCount = false; try { noCount = localStorage.getItem('pp-no-count') === '1'; } catch (e) { /* ignore */ }
  const own = el('label', { class: 'vd-own' }, el('input', { type: 'checkbox', checked: noCount || null, onchange: (e) => { try { localStorage.setItem('pp-no-count', e.target.checked ? '1' : '0'); } catch (err) { /* ignore */ } } }),
    el('span', {}, el('strong', { text: 'Don’t count my own visits on this browser. ' }), 'Keeps your checking and testing out of the numbers. Turn it on in each browser you use.'));

  body.replaceChildren(liveBox, tiles, trend,
    el('div', { class: 'vd-grid2' }, ...(hours ? [hours] : []), pages),
    el('div', { class: 'vd-grid3' }, sources, devices, regions),
    recent,
    el('div', { class: 'vd-foot' }, own,
      el('p', { class: 'small muted', text: `Times shown in your time zone (${TZ}). A visitor is one browsing session: the site uses no cookies and stores no IP addresses, so the same person on two devices counts twice. Visits from the editor and this dashboard are never counted.` })));
}

// ---------- Data ----------
async function loadTitles() {
  try {
    const idx = await fetch('/search-index.json').then((r) => r.json());
    for (const it of idx) if (it.url && it.title && !state.titles.has(it.url)) state.titles.set(it.url, it.title);
  } catch (e) { /* titles are optional */ }
}
function setStatus(text, on) {
  statusPill.replaceChildren(el('span', { class: 'vd-pulse', 'aria-hidden': 'true' }), text);
  statusPill.classList.toggle('off', !on);
}
async function load({ quiet } = {}) {
  if (state.loading) return; state.loading = true;
  if (!quiet) controls.querySelectorAll('[data-range]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.range) === state.days)));
  const [{ data, error }, recent] = await Promise.all([
    state.sb.rpc('visitor_stats', { p_days: state.days, p_tz: TZ }),
    state.sb.from('page_views').select('*').order('created_at', { ascending: false }).limit(25)
  ]);
  state.loading = false;
  if (error) {
    if (/visitor_stats|PGRST202|42883|schema cache/i.test(`${error.code} ${error.message}`)) return setup();
    setStatus('Offline', false);
    if (!state.data) body.replaceChildren(el('div', { class: 'panel' }, el('p', { text: 'The numbers could not load right now. They will try again in 30 seconds.' }), el('p', { class: 'small muted', text: error.message })));
    return;
  }
  state.data = data; state.recent = recent.error ? [] : (recent.data || []);
  state.updated = new Date();
  setStatus(`Live · updated ${state.updated.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`, true);
  render();
}
function setup() {
  controls.hidden = true;
  body.replaceChildren(el('div', { class: 'panel vd-setup' },
    el('h2', { text: 'One step left' }),
    el('p', { text: 'The dashboard needs a small update in Supabase before it can show numbers.' }),
    el('ol', {}, el('li', { text: 'Open Supabase → SQL Editor → New query.' }), el('li', { text: 'Paste everything from supabase/007_visitor_dashboard.sql in the GitHub repo.' }), el('li', { text: 'Click Run, then refresh this page.' }))));
}
function schedule() {
  clearInterval(state.timer);
  state.timer = setInterval(() => { if (document.visibilityState === 'visible') load({ quiet: true }); }, REFRESH_MS);
}

(async () => {
  state.sb = await getClient();
  if (!state.sb) { body.replaceChildren(el('div', { class: 'panel' }, el('p', { text: 'The database is not connected on this copy of the site.' }))); return; }
  const me = await currentProfile();
  if (!me) {
    body.replaceChildren(el('div', { class: 'panel vd-gate' }, el('h2', { text: 'Sign in to see your visitors' }), el('p', { class: 'muted', text: 'This page is private. Sign in with the Pet Primer editor account.' }), el('button', { type: 'button', class: 'btn', 'data-sign-in': '', text: 'Sign in' })));
    return;
  }
  if (!me.is_admin) {
    body.replaceChildren(el('div', { class: 'panel vd-gate' }, el('h2', { text: 'Editor only' }), el('p', { class: 'muted', text: 'This page is only for the Pet Primer editor.' }), el('a', { class: 'btn ghost', href: '/', text: 'Back to the home page' })));
    return;
  }
  // The editor's own browsing is left out of the numbers unless they turn it back on below.
  try { if (localStorage.getItem('pp-no-count') === null) localStorage.setItem('pp-no-count', '1'); } catch (e) { /* ignore */ }
  controls.hidden = false;
  controls.querySelectorAll('[data-range]').forEach((b) => b.addEventListener('click', () => {
    state.days = Number(b.dataset.range);
    try { localStorage.setItem('pp-vd-range', String(state.days)); } catch (e) { /* ignore */ }
    load();
  }));
  document.querySelector('[data-vd-refresh]').addEventListener('click', () => load());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') load({ quiet: true }); });
  await loadTitles();
  await load();
  schedule();
})();

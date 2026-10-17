// Pet Primer — Adopt: free listings that connect people with dogs and cats who need a home.
// Pet Primer never handles pets or money; adopters contact the lister directly.
import { getClient, el, toast, currentProfile, shrinkImage, requireSignIn, timeAgo } from '/assets/js/app.js';

const PAGE = 24;
const PET = { dogs: 'Dog', cats: 'Cat' };
const SEX = { male: 'Male', female: 'Female', unknown: '' };
const SIZE = { small: 'Small', medium: 'Medium', large: 'Large', '': '' };
const COLS = 'id, owner_id, lister, pet, name, age, sex, size, country, area, about, good_with, photo_url, status, created_at';
const notReady = (err) => err && /does not exist|schema cache|42P01|PGRST205/i.test(`${err.code || ''} ${err.message || ''}`);

function emptyBox(text, ...extra) {
  return el('div', { class: 'empty adopt-empty' },
    el('img', { src: '/assets/img/paws-empty.svg', alt: '', width: 132, height: 99, class: 'empty-art' }),
    el('p', { text }), ...extra);
}

function facts(p) {
  return [PET[p.pet], p.age, SEX[p.sex], SIZE[p.size] && `${SIZE[p.size]} size`].filter(Boolean).join(' · ');
}

function photo(p, cls) {
  return p.photo_url
    ? el('img', { class: cls, src: p.photo_url, alt: `${p.name}, a ${PET[p.pet].toLowerCase()} looking for a home`, loading: 'lazy' })
    : el('span', { class: `${cls} adopt-nophoto`, 'aria-hidden': 'true' }, el('img', { src: '/assets/img/paws-empty.svg', alt: '', width: 96, height: 72 }));
}

const contactLink = (c) => {
  const t = c.trim();
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(t)) return el('a', { href: `mailto:${t}?subject=${encodeURIComponent('Adopting through Pet Primer')}`, text: t });
  if (/^https?:\/\/\S+$/i.test(t)) return el('a', { href: t, rel: 'noopener nofollow ugc', target: '_blank', text: t });
  if (/^\+?[\d\s().-]{7,}$/.test(t)) return el('a', { href: `tel:${t.replace(/[^\d+]/g, '')}`, text: t });
  return el('span', { text: t });
};

// ================= Browse page =================
async function browse() {
  const grid = document.querySelector('[data-adopt-grid]');
  const count = document.querySelector('[data-adopt-count]');
  const more = document.querySelector('[data-adopt-more]');
  const modal = document.getElementById('adopt-modal');
  const detail = document.querySelector('[data-adopt-detail]');
  const params = new URLSearchParams(location.search);
  const state = { pet: 'all', country: 'all', area: '', page: 0, me: null, sb: null };

  function tile(p) {
    const b = el('button', { type: 'button', class: 'pet-tile', 'aria-label': `${p.name}: ${facts(p)}, ${p.area}` },
      photo(p, 'pet-tile-img'),
      el('span', { class: 'pet-tile-body' },
        el('span', { class: 'pet-tile-name' }, p.name, p.status === 'adopted' ? el('span', { class: 'pill adopt-done', text: 'Adopted' }) : null),
        el('span', { class: 'small', style: 'color: var(--ink-2)', text: facts(p) }),
        el('span', { class: 'small muted', text: `${p.area} · ${p.country}` }),
        el('span', { class: `pill ${p.lister === 'rescue' ? 'adopt-rescue' : 'adopt-owner'}`, text: p.lister === 'rescue' ? 'Rescue' : 'Owner rehoming' })));
    b.addEventListener('click', () => open(p));
    return b;
  }

  async function report(p) {
    if (!state.me) return requireSignIn();
    const reason = prompt('What’s wrong with this listing? For example: asking for money, a deposit or shipping, or the pet seems not to exist.');
    if (!reason || !reason.trim()) return;
    const { error } = await state.sb.from('reports').insert({ reporter_id: state.me.id, target_type: 'listing', target_id: p.id, reason: reason.trim().slice(0, 500) });
    toast(error ? (/duplicate/i.test(error.message) ? 'You already reported this listing.' : 'Could not send the report.') : 'Thanks. We’ll review this listing.');
  }

  async function contactBlock(p) {
    const box = el('div', { class: 'adopt-contact' });
    if (!state.me) {
      box.append(el('p', { class: 'small', style: 'color: var(--ink-2)', text: 'Sign in to see how to contact the person listing this pet. It’s free and keeps their details away from spam.' }),
        el('button', { type: 'button', class: 'btn', 'data-sign-in': '', text: 'Sign in to contact' }));
      return box;
    }
    const { data, error } = await state.sb.from('adopt_contacts').select('contact').eq('listing_id', p.id).maybeSingle();
    if (error || !data) { box.append(el('p', { class: 'small muted', text: 'Contact details aren’t available for this listing.' })); return box; }
    box.append(el('span', { class: 'eyebrow', text: p.lister === 'rescue' ? 'Contact the rescue' : 'Contact the owner' }),
      el('span', { class: 'adopt-contact-value' }, contactLink(data.contact)),
      el('span', { class: 'small muted', text: 'Say which pet you’re asking about, and tell them a little about your home.' }));
    return box;
  }

  async function open(p) {
    detail.replaceChildren(
      photo(p, 'adopt-box-img'),
      el('div', { class: 'adopt-box-main' },
        el('div', { style: 'display: flex; flex-wrap: wrap; align-items: center; gap: 10px' },
          el('h2', { id: 'adopt-modal-title', tabindex: '-1', style: 'font-size: 30px; outline: none', text: p.name }),
          p.status === 'adopted' ? el('span', { class: 'pill adopt-done', text: 'Adopted' }) : null,
          el('span', { class: `pill ${p.lister === 'rescue' ? 'adopt-rescue' : 'adopt-owner'}`, text: p.lister === 'rescue' ? 'Rescue' : 'Owner rehoming' })),
        el('p', { style: 'color: var(--ink-2); font-weight: 600', text: facts(p) }),
        el('p', { class: 'small muted', text: `${p.area}, ${p.country} · Listed ${timeAgo(p.created_at)}` }),
        el('p', { style: 'white-space: pre-line', text: p.about }),
        p.good_with ? el('p', { class: 'small' }, el('strong', { text: 'Good with: ' }), p.good_with) : null,
        p.status === 'adopted' ? el('p', { class: 'small muted', text: 'This pet has found a home.' }) : await contactBlock(p),
        el('p', { class: 'small adopt-warn', text: 'Never send money for a deposit, “holding” or shipping before you’ve met the pet in person.' }),
        el('div', { style: 'display: flex; flex-wrap: wrap; gap: 10px; justify-content: space-between' },
          el('button', { type: 'button', class: 'btn plain', style: 'padding: 0', text: 'Report this listing', onclick: () => report(p) }),
          el('button', { type: 'button', class: 'btn ghost', 'data-close-modal': '', text: 'Close' }))));
    modal.hidden = false;
    const u = new URL(location.href); u.searchParams.set('pet', p.id); history.replaceState(null, '', u);
    detail.querySelector('h2').focus({ preventScroll: true });
  }
  // Drop ?pet= from the address when the window closes.
  new MutationObserver(() => { if (modal.hidden) { const u = new URL(location.href); if (u.searchParams.has('pet')) { u.searchParams.delete('pet'); history.replaceState(null, '', u); } } }).observe(modal, { attributes: true, attributeFilter: ['hidden'] });

  async function load(reset) {
    if (reset) state.page = 0;
    if (!state.sb) { grid.replaceChildren(emptyBox('Adoption listings open very soon.')); count.textContent = ''; return; }
    let q = state.sb.from('adopt_listings').select(COLS, { count: 'exact' }).eq('removed', false)
      .order('status', { ascending: false }).order('created_at', { ascending: false }).range(0, (state.page + 1) * PAGE - 1);
    // Adopted pets stay visible for 30 days as happy endings, then drop off.
    q = q.or(`status.eq.available,updated_at.gte.${new Date(Date.now() - 30 * 864e5).toISOString()}`);
    if (state.pet !== 'all') q = q.eq('pet', state.pet);
    if (state.country !== 'all') q = q.eq('country', state.country);
    if (state.area) q = q.ilike('area', `%${state.area.replace(/[%_,()]/g, '')}%`);
    const { data, error, count: total } = await q;
    if (error) {
      grid.replaceChildren(emptyBox(notReady(error) ? 'Adoption listings open very soon.' : 'Pets could not load right now. Please refresh in a moment.'));
      count.textContent = ''; more.hidden = true; if (!notReady(error)) console.error(error); return;
    }
    const filtered = state.pet !== 'all' || state.country !== 'all' || state.area;
    grid.replaceChildren(...(data.length ? data.map(tile) : [emptyBox(filtered ? 'No pets match yet. Try another area, or check back soon.' : 'No pets listed yet. Need to rehome a dog or cat?',
      el('a', { class: 'btn', href: '/adopt/list/', text: 'List a pet' }))]));
    count.textContent = data.length ? `${total} ${total === 1 ? 'pet' : 'pets'}` : '';
    more.hidden = data.length >= (total || 0);
    const want = params.get('pet');
    if (want && reset) { params.delete('pet'); const hit = data.find((x) => x.id === want) || (await state.sb.from('adopt_listings').select(COLS).eq('id', want).maybeSingle()).data; if (hit) open(hit); }
  }

  const chips = (attr, key) => document.querySelectorAll(`[${attr}]`).forEach((b) => b.addEventListener('click', () => {
    state[key] = b.getAttribute(attr);
    document.querySelectorAll(`[${attr}]`).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    load(true);
  }));
  chips('data-adopt-pet', 'pet');
  chips('data-adopt-country', 'country');
  const area = document.querySelector('[data-adopt-area]');
  let t;
  area.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { state.area = area.value.trim(); load(true); }, 300); });
  more.addEventListener('click', () => { state.page++; load(false); });

  state.sb = await getClient();
  state.me = await currentProfile();
  load(true);
}

// ================= List-a-pet page =================
async function listPage() {
  const slot = document.querySelector('[data-adopt-form-slot]');
  const mine = document.querySelector('[data-adopt-mine]');
  const sb = await getClient();
  const me = await currentProfile();

  if (!sb) { slot.replaceChildren(emptyBox('Listing opens very soon. Follow Pet Primer on Instagram or X to hear first.')); return; }
  if (!me) {
    slot.replaceChildren(el('div', { class: 'panel', style: 'align-items: flex-start' },
      el('strong', { style: 'font-size: 18px', text: 'Sign in to list a pet' }),
      el('p', { class: 'muted', text: 'We email you a sign-in link, no password needed. Your listing stays under your account so you can mark the pet adopted or remove the listing at any time.' }),
      el('button', { type: 'button', class: 'btn', 'data-sign-in': '', text: 'Sign in' })));
    return;
  }

  const field = (label, input, hint) => el('div', { class: 'tool-row' }, el('label', { for: input.id, text: label }), input, hint ? el('span', { class: 'small muted', text: hint }) : null);
  const select = (id, opts) => el('select', { id, class: 'field' }, ...opts.map(([v, t]) => el('option', { value: v, text: t })));
  const radio = (name, v, t, checked) => el('label', { class: 'adopt-radio' }, el('input', { type: 'radio', name, value: v, checked }), el('span', { text: t }));

  const name = el('input', { id: 'l-name', class: 'field', required: true, maxlength: 40, placeholder: 'e.g. Biscuit' });
  const age = el('input', { id: 'l-age', class: 'field', maxlength: 30, placeholder: 'e.g. 2 years, or 4 months' });
  const pet = select('l-pet', [['dogs', 'Dog'], ['cats', 'Cat']]);
  const sex = select('l-sex', [['unknown', 'Not sure'], ['female', 'Female'], ['male', 'Male']]);
  const size = select('l-size', [['', 'Not sure'], ['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']]);
  const country = select('l-country', [['US', 'United States'], ['UK', 'United Kingdom']]);
  const area = el('input', { id: 'l-area', class: 'field', required: true, minlength: 2, maxlength: 60, placeholder: 'e.g. Austin, TX or Leeds', autocomplete: 'address-level2' });
  const about = el('textarea', { id: 'l-about', class: 'field', required: true, minlength: 20, maxlength: 1500, rows: 6, placeholder: 'Personality, routine, health and vaccinations, why they need a new home, and what kind of home would suit them.' });
  const good = el('input', { id: 'l-good', class: 'field', maxlength: 120, placeholder: 'e.g. children, other dogs, cats' });
  const contact = el('input', { id: 'l-contact', class: 'field', required: true, minlength: 3, maxlength: 200, placeholder: 'Email, phone number or website' });
  const file = el('input', { id: 'l-photo', type: 'file', accept: 'image/*', class: 'field' });
  const preview = el('img', { class: 'adopt-preview', alt: 'Photo preview', hidden: true });
  file.addEventListener('change', () => { const f = file.files[0]; if (f) { preview.src = URL.createObjectURL(f); preview.hidden = false; } else preview.hidden = true; });
  const agree = el('input', { type: 'checkbox', id: 'l-agree', required: true });
  const status = el('p', { class: 'small muted', role: 'status' });
  const submit = el('button', { type: 'submit', class: 'btn big', text: 'Post listing' });

  const form = el('form', { class: 'tool-form adopt-form' },
    el('fieldset', { class: 'adopt-fieldset' }, el('legend', { text: 'Who is listing?' }),
      el('div', { class: 'adopt-radios' }, radio('lister', 'owner', 'I’m rehoming my own pet', true), radio('lister', 'rescue', 'I’m posting for a rescue or shelter', false))),
    el('div', { class: 'adopt-cols' }, field('Pet', pet), field('Name', name), field('Age', age), field('Sex', sex), field('Size', size), field('Country', country)),
    field('Town or city', area, 'Shown on the listing. Don’t give your street address.'),
    field('About this pet', about, 'At least 20 characters.'),
    field('Good with (optional)', good),
    el('div', { class: 'tool-row' }, el('label', { for: 'l-photo', text: 'Photo (recommended)' }), file, preview, el('span', { class: 'small muted', text: 'A clear photo you took yourself. Listings with photos get far more replies.' })),
    field('How should people contact you?', contact, 'Shown only to signed-in visitors.'),
    el('label', { class: 'adopt-agree', for: 'l-agree' }, agree, el('span', { text: 'I’m not selling this pet. I won’t ask for a deposit, shipping or “holding” fee. If I’m a rescue, any adoption fee goes to the rescue.' })),
    submit, status);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (about.value.trim().length < 20) { status.textContent = 'Tell adopters a bit more about the pet (at least 20 characters).'; about.focus(); return; }
    submit.disabled = true; status.textContent = 'Posting…';
    try {
      let photo_url = null;
      if (file.files[0]) {
        const blob = await shrinkImage(file.files[0]);
        const path = `${me.id}/adopt-${Date.now()}.jpg`;
        const up = await sb.storage.from('photos').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
        if (up.error) throw up.error;
        photo_url = sb.storage.from('photos').getPublicUrl(path).data.publicUrl;
      }
      const row = { owner_id: me.id, lister: form.lister.value, pet: pet.value, name: name.value.trim(), age: age.value.trim(), sex: sex.value, size: size.value, country: country.value, area: area.value.trim(), about: about.value.trim(), good_with: good.value.trim(), photo_url, no_sale: agree.checked };
      const { data, error } = await sb.from('adopt_listings').insert(row).select('id').single();
      if (error) throw error;
      const c = await sb.from('adopt_contacts').insert({ listing_id: data.id, contact: contact.value.trim() });
      if (c.error) { await sb.from('adopt_listings').delete().eq('id', data.id); throw c.error; }
      form.reset(); preview.hidden = true; status.textContent = '';
      toast('Your pet is listed');
      location.href = `/adopt/?pet=${data.id}`;
    } catch (err) {
      status.textContent = notReady(err) ? 'Listing opens very soon. Please try again in a day or two.' : 'Could not post: ' + (err.message || err);
      submit.disabled = false;
    }
  });
  slot.replaceChildren(form);

  // Your listings
  async function loadMine() {
    const { data, error } = await sb.from('adopt_listings').select(COLS + ', removed').eq('owner_id', me.id).order('created_at', { ascending: false });
    if (error || !data || !data.length) { mine.replaceChildren(); return; }
    const setStatus = async (p, s) => { const { error: er } = await sb.from('adopt_listings').update({ status: s }).eq('id', p.id); toast(er ? 'Could not update.' : s === 'adopted' ? 'Marked as adopted. Congratulations!' : 'Listed again'); loadMine(); };
    const remove = async (p) => { if (!confirm(`Remove ${p.name}’s listing? This can’t be undone.`)) return; const { error: er } = await sb.from('adopt_listings').delete().eq('id', p.id); toast(er ? 'Could not remove.' : 'Listing removed'); loadMine(); };
    mine.replaceChildren(el('h2', { style: 'font-size: 26px; margin-bottom: 14px', text: 'Your listings' }),
      el('div', { class: 'adopt-mine' }, ...data.map((p) => el('div', { class: 'panel adopt-mine-row' },
        photo(p, 'adopt-mine-img'),
        el('div', { style: 'flex: 1 1 200px; display: flex; flex-direction: column; gap: 4px' },
          el('a', { href: `/adopt/?pet=${p.id}`, style: 'font-weight: 600; font-size: 18px', text: p.name }),
          el('span', { class: 'small muted', text: `${facts(p)} · ${p.area} · listed ${timeAgo(p.created_at)}` }),
          p.removed ? el('span', { class: 'small adopt-warn', text: 'Hidden after reports. We’re reviewing it.' }) : el('span', { class: 'small', text: p.status === 'adopted' ? 'Adopted' : 'Available' })),
        el('div', { style: 'display: flex; flex-wrap: wrap; gap: 8px' },
          p.status === 'adopted'
            ? el('button', { type: 'button', class: 'btn ghost', text: 'List again', onclick: () => setStatus(p, 'available') })
            : el('button', { type: 'button', class: 'btn', text: 'Mark adopted', onclick: () => setStatus(p, 'adopted') }),
          el('button', { type: 'button', class: 'btn plain', text: 'Remove', onclick: () => remove(p) }))))));
  }
  loadMine();
}

if (document.querySelector('[data-adopt-grid]')) browse();
if (document.querySelector('[data-adopt-form-slot]')) listPage();

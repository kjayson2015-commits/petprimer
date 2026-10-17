// Pet Primer tools: chocolate risk calculator, dog age calculator, Myth or Fact quiz.
import { el, toast } from '/assets/js/app.js';

const num = (id) => parseFloat(String(document.getElementById(id).value).replace(',', '.'));
const show = (box, ...kids) => { box.replaceChildren(...kids); box.hidden = false; box.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); box.focus({ preventScroll: true }); };

// ---------- Chocolate ----------
const choc = document.querySelector('[data-choc]');
if (choc) {
  const box = document.querySelector('[data-choc-result]');
  box.tabIndex = -1;
  choc.addEventListener('submit', (e) => {
    e.preventDefault();
    let kg = num('c-weight'); let grams = num('c-amount');
    if (!(kg > 0) || !(grams >= 0)) return;
    if (document.getElementById('c-wunit').value === 'lb') kg *= 0.4536;
    if (document.getElementById('c-aunit').value === 'oz') grams *= 28.35;
    const perGram = parseFloat(document.getElementById('c-type').value);
    const dose = (grams * perGram) / kg;
    const levels = [
      [60, 'Seizure range', 'lvl-4', 'This is in the range where seizures are possible. Call your vet or an emergency vet now.'],
      [40, 'Heart effects possible', 'lvl-3', 'This is in the range where a racing or irregular heartbeat can happen. Call your vet now.'],
      [20, 'Mild signs likely', 'lvl-2', 'Vomiting, diarrhoea and thirst are likely. Call your vet or a pet poison line now for advice.'],
      [0, 'Below the usual danger level', 'lvl-1', 'Serious signs are unlikely at this amount, but every dog is different. Watch closely for 24 hours and call your vet if you see restlessness, vomiting or a fast heartbeat, or if you’re unsure how much was eaten.']];
    const [, label, cls, advice] = levels.find(([min]) => dose >= min);
    show(box,
      el('div', { class: `tool-verdict ${cls}` },
        el('span', { class: 'tool-big', text: `${dose < 1 ? dose.toFixed(1) : Math.round(dose)} mg/kg` }),
        el('strong', { text: label })),
      el('p', { text: advice }),
      el('p', { class: 'small muted', text: `About ${Math.round(grams * perGram)} mg of theobromine for a ${kg.toFixed(1)} kg dog. Signs usually start 6 to 12 hours after eating.` }),
      el('a', { class: 'btn', href: '/emergency/', text: 'Poison line numbers' }));
  });
}

// ---------- Dog age ----------
const age = document.querySelector('[data-age]');
if (age) {
  const box = document.querySelector('[data-age-result]');
  box.tabIndex = -1;
  age.addEventListener('submit', (e) => {
    e.preventDefault();
    const years = (num('a-years') || 0) + (num('a-months') || 0) / 12;
    if (!(years > 0)) return;
    if (years < 1) {
      show(box, el('p', { text: 'The formula only works well for dogs aged 1 and over. In their first year, puppies grow up very fast: by their first birthday they are, in DNA terms, roughly like a 31-year-old person.' }));
      return;
    }
    const human = Math.round(16 * Math.log(years) + 31);
    show(box,
      el('div', { class: 'tool-verdict lvl-1' },
        el('span', { class: 'tool-big', text: `About ${human}` }),
        el('strong', { text: 'in human years' })),
      el('p', { text: `The old “times seven” rule would have said ${Math.round(years * 7)}.` }),
      el('p', { class: 'small muted', text: 'Based on one study of Labrador retrievers, so treat it as a fun estimate.' }));
  });
}

// ---------- Myth or Fact quiz ----------
const quiz = document.querySelector('[data-quiz]');
if (quiz) {
  let all = [];
  try { all = JSON.parse(document.getElementById('quiz-data').textContent); } catch (e) { all = []; }
  const ROUND = Math.min(10, all.length);
  let qs = []; let i = 0; let score = 0;
  const shuffle = (a) => { a = a.slice(); for (let k = a.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [a[k], a[j]] = [a[j], a[k]]; } return a; };
  const start = () => { qs = shuffle(all).slice(0, ROUND); i = 0; score = 0; ask(); };
  function ask() {
    const q = qs[i];
    const answer = (pick) => {
      const right = pick === q.a;
      if (right) score++;
      quiz.replaceChildren(
        el('p', { class: 'quiz-step', text: `Question ${i + 1} of ${qs.length}` }),
        el('p', { class: 'quiz-statement', text: `“${q.s}”` }),
        el('div', { class: `quiz-feedback ${right ? 'ok' : 'no'}`, role: 'status' },
          el('strong', { text: `${right ? 'Right' : 'Not quite'}: it’s a ${q.a}.` }),
          q.why ? el('p', { text: q.why }) : null,
          q.url ? el('a', { href: q.url, text: 'See the evidence' }) : null),
        el('button', { type: 'button', class: 'btn', onclick: () => { i++; if (i < qs.length) ask(); else end(); }, text: i + 1 < qs.length ? 'Next question' : 'See my score' }));
      quiz.querySelector('.btn').focus();
    };
    quiz.replaceChildren(
      el('p', { class: 'quiz-step', text: `Question ${i + 1} of ${qs.length} · Score ${score}` }),
      el('p', { class: 'quiz-statement', text: `“${q.s}”` }),
      el('div', { class: 'quiz-choices' },
        el('button', { type: 'button', class: 'btn quiz-btn', onclick: () => answer('myth'), text: 'Myth' }),
        el('button', { type: 'button', class: 'btn quiz-btn', onclick: () => answer('fact'), text: 'Fact' })));
    if (i > 0) quiz.querySelector('.quiz-btn').focus();
  }
  function end() {
    const text = `I scored ${score}/${qs.length} on the Pet Primer Myth or Fact quiz. Can you beat it?`;
    quiz.replaceChildren(
      el('p', { class: 'quiz-statement', text: `You scored ${score} out of ${qs.length}` }),
      el('p', { class: 'muted', text: score === qs.length ? 'Perfect. You know your pets.' : score >= qs.length * 0.7 ? 'Great score. A few myths almost got you.' : 'Plenty of owners believe these. Now you know.' }),
      el('div', { class: 'quiz-choices' },
        el('button', { type: 'button', class: 'btn', onclick: start, text: 'Play again' }),
        el('button', { type: 'button', class: 'btn ghost', text: 'Share my score', onclick: async () => {
          const url = location.origin + '/tools/myth-quiz/';
          try { if (navigator.share) await navigator.share({ title: 'Myth or Fact?', text, url }); else { await navigator.clipboard.writeText(`${text} ${url}`); toast('Copied, ready to paste'); } } catch (e) { /* closed */ }
        } }),
        el('a', { class: 'btn plain', href: '/myths/', text: 'Read the myth checks' })));
    quiz.querySelector('.btn').focus();
  }
  if (ROUND) start(); else quiz.replaceChildren(el('p', { class: 'muted', text: 'The quiz is being written. Check back soon.' }));
}

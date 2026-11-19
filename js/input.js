// Read and listen: the tutor's own sentences, grouped by grammar point, with the forms of that point highlighted.
// Many examples, read and heard, so the endings become familiar before they are drilled.
import { esc, ruHtml, icon, json, shuffle } from './ui.js';
import * as store from './store.js';
import { sayWait } from './tts.js';
import { locked } from './vault.js';
import { lockScreen } from './tutor.js';
import { POINTS } from './practice.js';

const RATES = [0.6, 0.85, 1, 1.2];
const isRead = e => !!store.get().done['in:' + e.id];
let playing = false;

export async function view(main, tag) {
  if (await locked()) return lockScreen(main, () => view(main, tag), 'Read and listen');
  const data = await json('data/input.json');
  return tag ? point(main, data, tag) : list(main, data);
}

function list(main, { sentences }) {
  const row = (k, t, s) => {
    const es = k === 'all' ? sentences : sentences.filter(e => e.tags.includes(k)), read = es.filter(isRead).length;
    return es.length
      ? `<a class="item" href="#/practice/input/${k}"><span class="body"><span class="title">${t}</span><span class="sub">${es.length} sentences · ${read} read</span></span><span class="chev">${icon('chev')}</span></a>`
      : `<div class="item later"><span class="body"><span class="title">${t}</span><span class="sub">No tutor sentences yet${s ? '. They appear as new sheets are added.' : ''}</span></span></div>`;
  };
  main.innerHTML = `<a class="back" href="#/practice">← Practice</a><div class="top"><h1>Read and listen</h1></div>
  <p class="lead">Sentences from your tutor's sheets, one grammar point at a time. Read them, listen to them, and notice the highlighted endings. No questions.</p>
  <div class="list">${POINTS.map(([k, t]) => row(k, t, true)).join('')}${row('all', 'All sentences')}</div>
  <p class="small muted" style="margin-top:14px">The sentences are copied from the sheets as they are. The highlighted words are found by a dictionary program (OpenCorpora), so a few forms may be left unmarked.</p>`;
}

function point(main, { sentences, gloss }, tag) {
  const name = tag === 'all' ? 'All sentences' : (POINTS.find(p => p[0] === tag) || [, tag])[1];
  const es = tag === 'all' ? sentences : sentences.filter(e => e.tags.includes(tag));
  const order = [...shuffle(es.filter(e => !isRead(e))), ...shuffle(es.filter(isRead))];
  const rate = () => store.get().settings.inRate || 0.85;
  const sent = e => e.toks.map((t, i) => {
    const m = e.marks[i], w = /[А-Яа-яЁё]/.test(t);
    if (!w) return esc(t);
    const on = m && (tag === 'all' || m === tag);
    return `<span class="w${on ? ' hl' : ''}" data-w="${esc(t.replace(/́/g, '').toLowerCase())}">${ruHtml(t)}</span>`;
  }).join('');
  main.innerHTML = `<a class="back" href="#/practice/input">← Read and listen</a><div class="top"><h1>${esc(name)}</h1></div>
  <p class="lead">${es.length} sentences from your tutor's sheets. Tap a word for its meaning.</p>
  <div class="in-bar"><button class="btn primary sm" id="all">${icon('sound')}Play all</button>
   <div class="seg sm" role="group" aria-label="Speed">${RATES.map(r => `<a href="#" data-r="${r}" ${r === rate() ? 'aria-selected="true"' : ''}>${r}×</a>`).join('')}</div></div>
  <div class="in-list">${order.map(e => `<div class="in-card${isRead(e) ? ' read' : ''}" data-id="${e.id}"><p class="ru in-ru">${sent(e)}</p>
   <div class="in-foot"><button class="btn secondary sm sound" data-play aria-label="Play">${icon('sound')}</button><span class="small faint">${esc(e.sheet)}</span></div><div class="in-gl" hidden></div></div>`).join('')}</div>`;
  const byId = Object.fromEntries(es.map(e => [e.id, e]));
  const mark = card => { store.markDone('in:' + card.dataset.id); card.classList.add('read'); };
  const play = async card => { card.classList.add('now'); mark(card); await sayWait(byId[card.dataset.id].ru, rate()); card.classList.remove('now'); };
  main.querySelector('.seg').onclick = e => {
    const a = e.target.closest('[data-r]'); if (!a) return; e.preventDefault();
    store.setSetting('inRate', +a.dataset.r);
    main.querySelectorAll('[data-r]').forEach(x => x.toggleAttribute('aria-selected', x === a));
  };
  const allBtn = main.querySelector('#all');
  allBtn.onclick = async () => {
    if (playing) { playing = false; speechSynthesis?.cancel?.(); return; }
    playing = true; allBtn.lastChild.textContent = 'Stop';
    for (const card of main.querySelectorAll('.in-card')) {
      if (!playing || !card.isConnected) break;
      card.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      await play(card);
      await new Promise(r => setTimeout(r, 700));
    }
    playing = false; if (allBtn.isConnected) allBtn.lastChild.textContent = 'Play all';
  };
  addEventListener('hashchange', () => { playing = false; speechSynthesis?.cancel?.(); }, { once: true });
  main.querySelector('.in-list').onclick = e => {
    const card = e.target.closest('.in-card'); if (!card) return;
    if (e.target.closest('[data-play]')) return play(card);
    const w = e.target.closest('[data-w]'); if (!w) return;
    const g = gloss[w.dataset.w], box = card.querySelector('.in-gl');
    box.hidden = false; mark(card);
    box.innerHTML = g ? `<span class="ru">${esc(w.textContent)}</span> → <b class="ru">${esc(g[0])}</b>${g[1] ? ` · ${esc(g[1])}` : ''}` : `<span class="ru">${esc(w.textContent)}</span>`;
  };
}

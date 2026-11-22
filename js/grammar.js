// Course: units 0–16 (A1–A2, all six cases). Hidden B1/B2 units stay in the data for later.
import { json, esc, ruHtml, toast, icon } from './ui.js';
import { say } from './tts.js';
import * as store from './store.js';
import { loadVocab, VOCAB, runSteps, stepDrill } from './session.js';
import { isLearned } from './srs.js';
import { go } from './router.js';

let G = null;
export const loadGrammar = async () => (G ||= (await json('data/grammar.json')).filter(g => !g.hidden));
const caseName = { nom: 'Nominative', gen: 'Genitive', dat: 'Dative', acc: 'Accusative', ins: 'Instrumental', prep: 'Prepositional' };
export const isDone = g => !!store.get().done['g:' + g.id];
/** The unit to work on: the first unfinished one at or after the chosen starting point. */
export const currentUnit = gs => gs.find(g => g.week >= (store.get().settings.startUnit || 0) && !isDone(g)) || gs[gs.length - 1];
/** Topics of units before `u` (their unseen words are next in line). */
export const earlierTopics = (gs, u) => gs.filter(g => g.week < u.week).flatMap(g => g.topics || []);

const tableHtml = g => g.table.length ? `<div class="card scroll-x" style="padding:4px 4px"><table class="tbl"><thead><tr>${g.table[0].map(c => `<th>${ruHtml(c)}</th>`).join('')}</tr></thead><tbody>${g.table.slice(1).map(r => `<tr>${r.map(c => `<td>${ruHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '';
const partsHtml = g => g.parts.map(p => `<div class="part"><h3>${ruHtml(p.h)}</h3><p>${ruHtml(p.p)}</p></div>`).join('');
export const lessonSeen = g => !!store.get().done['seen:' + g.id];

/** Session step: read the unit's explanation once, before its first questions. */
export const stepLesson = g => el => new Promise(res => {
  el.innerHTML = `<div class="kind">New unit · Unit ${g.week}</div><h1 style="margin-bottom:4px">${esc(g.en)}</h1><p class="ru muted" style="margin-bottom:18px">${ruHtml(g.title)}</p>
    <p class="why">${esc(g.why)}</p>${partsHtml(g)}${tableHtml(g)}<p class="small muted">Tap any Russian word in the table to hear it. This explanation stays in Course.</p>
    <div class="actions"><button class="btn primary block big" id="nx">I've read it</button></div>`;
  el.querySelector('.tbl')?.addEventListener('click', e => { const td = e.target.closest('td'); if (td && /[А-Яа-яЁё]/.test(td.textContent)) say(td.textContent); });
  el.querySelector('#nx').onclick = () => { store.markDone('seen:' + g.id); res(); };
});

export async function viewList(main) {
  const gs = await loadGrammar(), cur = currentUnit(gs);
  const row = g => {
    const state = isDone(g) ? 'done' : g === cur ? 'current' : 'later';
    return `<a class="item ${state}" href="#/course/${g.id}"><span class="num">${state === 'done' ? '✓' : g.week}</span>
      <span class="body"><span class="title">${esc(g.en)}</span><span class="sub ru">${ruHtml(g.title)}</span></span>
      ${state === 'current' ? '<span class="meta" style="color:var(--accent)">Next</span>' : ''}<span class="chev">${icon('chev')}</span></a>`;
  };
  main.innerHTML = `<div class="top"><h1>Course</h1><a href="#/words">All words</a></div>
  <p class="lead">${gs.filter(isDone).length} of ${gs.length} units done. Each unit: a short explanation, a table, then practice.</p>
  <div class="section">A1 · Beginner</div><div class="list">${gs.filter(g => g.level === 'A1').map(row).join('')}</div>
  <div class="section">A2 · Elementary</div><div class="list">${gs.filter(g => g.level === 'A2').map(row).join('')}</div>`;
}

export async function viewUnit(main, id) {
  const gs = await loadGrammar(); await loadVocab();
  const g = gs.find(x => x.id === id) || gs[0], i = gs.indexOf(g);
  const cards = store.get().cards, words = VOCAB.filter(w => (g.topics || []).includes(w.topic));
  main.innerHTML = `<a class="back" href="#/course">← Course</a>
   <div class="muted small">Unit ${g.week} · ${g.level}${g.case ? ` · <span class="case c-${g.case}">${caseName[g.case]}</span>` : ''}</div>
   <h1 style="margin:6px 0 4px">${esc(g.en)}</h1><p class="ru muted" style="font-size:1.1rem;margin-bottom:20px">${ruHtml(g.title)}</p>
   <p class="why">${esc(g.why)}</p>
   ${partsHtml(g)}${tableHtml(g)}
   <div class="actions stack"><button class="btn primary block big" id="go">Practise this unit · ${g.drills.length} questions</button>
   ${isDone(g) ? '<p class="small muted center" style="margin:0">Done. You can practise it again any time.</p>' : '<button class="btn text" id="skip">I already know this unit</button>'}</div>
   ${g.tutor?.length ? `<div class="section">From Valeria's lessons</div><div class="list">${g.tutor.map(t => `<a class="item" href="#/tutor/${t.key}/${encodeURIComponent(t.stem)}"><span class="body"><span class="title">${esc(t.stem.replace(/_/g, ' '))}</span></span><span class="chev">${icon('chev')}</span></a>`).join('')}</div>` : ''}
   ${words.length ? `<div class="section">Words for this unit · ${words.length}</div><div class="list words">${words.map(w => `<button class="word" data-ru="${esc(w.ru)}"><span class="ru">${ruHtml(w.st)}</span><span class="en">${esc(w.en)}</span>${isLearned(cards[w.id]) ? '<span class="ok-mark">learned</span>' : ''}</button>`).join('')}</div><p class="small muted">Tap a word to hear it. New words come into your daily session automatically.</p>` : ''}
   ${gs[i + 1] ? `<div class="actions end"><a class="btn text" href="#/course/${gs[i + 1].id}">Next unit: ${esc(gs[i + 1].en)} →</a></div>` : ''}`;
  main.querySelector('.words')?.addEventListener('click', e => { const b = e.target.closest('[data-ru]'); if (b) say(b.dataset.ru); });
  main.querySelector('#skip')?.addEventListener('click', () => { store.markDone('g:' + g.id); toast('Marked as done'); go('course'); });
  main.querySelector('#go').onclick = () => practiseUnit(main, g);
  store.markDone('seen:' + g.id);
  main.querySelector('.tbl')?.addEventListener('click', e => { const td = e.target.closest('td'); if (td && /[А-Яа-яЁё]/.test(td.textContent)) say(td.textContent); });
}

/** Full unit practice: all questions; 60 % or more marks the unit done. */
async function practiseUnit(main, g) {
  const out = { right: 0 };
  const sum = await runSteps(main, g.drills.map(d => stepDrill(d, g, out)), { exitTo: `course/${g.id}` });
  if (!sum) return;
  const pass = out.right >= Math.ceil(g.drills.length * 0.6);
  if (pass) store.markDone('g:' + g.id);
  store.finishSession();
  const gs = await loadGrammar(), next = gs[gs.indexOf(g) + 1];
  main.innerHTML = `<div class="done"><div class="mark">${pass ? '✓' : '–'}</div><h1>${out.right} of ${g.drills.length} correct</h1>
    <p class="muted">${pass ? 'Unit done.' : 'You need 60 % to finish the unit. Read the explanation again, then retry.'}</p>
    <div class="actions stack" style="max-width:360px;margin:24px auto 0">${pass && next ? `<a class="btn primary block big" href="#/course/${next.id}">Next unit</a>` : `<button class="btn primary block big" id="re">Try again</button>`}
    <button class="btn secondary block" id="back">Back to the unit</button></div></div>`;
  main.querySelector('#re')?.addEventListener('click', () => practiseUnit(main, g));
  main.querySelector('#back').onclick = () => go(`course/${g.id}`);
}

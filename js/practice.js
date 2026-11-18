// Practice: extra rounds outside the daily session. Four choices, nothing else.
import { esc, ruHtml, sample, shuffle, icon, json } from './ui.js';
import * as store from './store.js';
import { weakIds } from './srs.js';
import { loadVocab, VOCAB, byId, dueWords, runSteps, stepReview, stepQuiz } from './session.js';
import { say } from './tts.js';

export async function view(main, mode) {
  await loadVocab();
  if (mode) return start(main, mode);
  const due = dueWords(99).length, weak = weakIds(10).length, known = Object.keys(store.get().cards).length;
  const row = (k, t, s, meta = '', off = false) => off
    ? `<div class="item later"><span class="body"><span class="title">${t}</span><span class="sub">${s}</span></span></div>`
    : `<a class="item" href="#/practice/${k}"><span class="body"><span class="title">${t}</span><span class="sub">${s}</span></span>${meta ? `<span class="meta">${meta}</span>` : ''}<span class="chev">${icon('chev')}</span></a>`;
  main.innerHTML = `<div class="top"><h1>Practice</h1></div><p class="lead">Short extra rounds. Pick one.</p>
  <div class="list">
    ${row('review', 'Review words', due ? 'Words that are due now' : 'Nothing is due right now', due || '', !due)}
    ${row('hard', 'Hard words', weak ? 'Words you have missed before' : 'No hard words yet', weak || '', !weak)}
    ${row('listen', 'Listening', known >= 4 ? 'Hear a word, choose its meaning · 10 words' : 'Learn a few words first', '', known < 4)}
    ${row('read', 'Short reading', 'A short text with true / false questions')}
  </div>`;
}

async function start(main, mode) {
  let steps = [];
  if (mode === 'review') steps = dueWords(20).map(stepReview);
  if (mode === 'hard') steps = weakIds(10).map(byId).filter(Boolean).map((w, i) => stepQuiz(w, i % 2 ? 'type' : 'pic'));
  if (mode === 'listen') steps = sample(Object.keys(store.get().cards).map(byId).filter(w => w && VOCAB.includes(w)), 10).map(w => stepQuiz(w, 'listen', false));
  if (mode === 'read') return reading(main);
  if (!steps.length) { location.hash = '#/practice'; return; }
  const sum = await runSteps(main, steps, { exitTo: 'practice' });
  if (sum) finish(main, sum);
}

function finish(main, sum) {
  const pct = sum.total ? Math.round((sum.right / sum.total) * 100) : 100;
  main.innerHTML = `<div class="done"><div class="mark">✓</div><h1>Round done</h1><p class="muted">${sum.right} of ${sum.total} correct (${pct}%).</p>
   <div class="actions stack" style="max-width:360px;margin:24px auto 0"><a class="btn primary block big" href="#/practice">Back to Practice</a></div></div>`;
}

async function reading(main) {
  const rs = await json('data/readings.json'), done = store.get().done;
  const r = rs.slice().sort((a, b) => (done['r:' + a.title] || 0) - (done['r:' + b.title] || 0) || Math.random() - .5)[0];
  const step = (el, ctx) => new Promise(res => {
    el.innerHTML = `<div class="kind">Reading · ${esc(r.level)}</div><h2 class="ru" style="font-family:var(--serif)">${esc(r.title)}</h2>
     <p class="ru" style="font-size:1.2rem;line-height:1.6">${ruHtml(r.text)}</p><button class="btn secondary sm sound" id="s">${icon('sound')}Listen</button>
     <div class="section">True or false?</div>
     ${r.qs.map((x, i) => `<div class="card" style="padding:14px 16px"><p style="margin-bottom:10px">${esc(x.q)}</p><div class="actions" style="margin:0" data-q="${i}"><button class="btn secondary sm" data-v="1">True</button><button class="btn secondary sm" data-v="0">False</button><span class="small muted" style="align-self:center"></span></div></div>`).join('')}
     <div class="actions"><button class="btn primary block big" id="n">Finish</button></div>`;
    el.querySelector('#s').onclick = () => say(r.text);
    const answered = new Set();
    el.querySelectorAll('[data-q]').forEach(row => row.addEventListener('click', e => {
      const b = e.target.closest('[data-v]'); if (!b || b.disabled) return;
      const good = (b.dataset.v === '1') === r.qs[+row.dataset.q].a;
      if (!answered.has(row.dataset.q)) { answered.add(row.dataset.q); ctx.score(good); }
      row.querySelectorAll('button').forEach(x => { x.disabled = true; });
      b.style.borderColor = good ? 'var(--ok)' : 'var(--bad)';
      row.querySelector('span').textContent = good ? 'Correct' : `No, it's ${r.qs[+row.dataset.q].a ? 'true' : 'false'}`;
    }));
    el.querySelector('#n').onclick = res;
  });
  const sum = await runSteps(main, [step], { exitTo: 'practice' });
  if (!sum) return;
  store.markDone('r:' + r.title, (done['r:' + r.title] || 0) + 1);
  finish(main, sum);
}

// Practice: extra rounds outside the daily session. Four choices, nothing else.
import { esc, ruHtml, sample, shuffle, icon, json } from './ui.js';
import * as store from './store.js';
import { weakIds } from './srs.js';
import { loadVocab, VOCAB, byId, dueWords, pickNew, runSteps, stepReview, stepQuiz, stepLearn, stepDrill, stepTutor, drillTag, tutorItemsFor } from './session.js';
import { loadGrammar } from './grammar.js';
import { say } from './tts.js';

/** Grammar points for review, with the unit that explains each. */
export const POINTS = [
  ['prep', 'Prepositional', 'где? о ком? · в / на / о', 'g04'], ['acc', 'Accusative', 'кого? что? куда?', 'g05'],
  ['gen', 'Genitive', 'нет, у, из · кого? чего?', 'g07'], ['dat', 'Dative', 'кому? · к', 'g09'],
  ['ins', 'Instrumental', 'с кем? чем? кем?', 'g10'], ['nom-pl', 'Nominative plural', 'столы́, кни́ги, о́кна', 'g02'],
  ['pres', 'Present tense', 'чита́ю, говори́шь…', 'g03'], ['past', 'Past tense', 'чита́л, чита́ла, чита́ли', 'g06'],
];
const CASES = ['prep', 'acc', 'gen', 'dat', 'ins'];

export async function view(main, mode, sub) {
  await loadVocab();
  if (mode === 'grammar') return sub ? review(main, sub) : grammarList(main);
  if (mode === 'input') return (await import('./input.js')).view(main, sub);
  if (mode) return start(main, mode);
  const due = dueWords(99).length, weak = weakIds(10).length, known = Object.keys(store.get().cards).length;
  const row = (k, t, s, meta = '', off = false) => off
    ? `<div class="item later"><span class="body"><span class="title">${t}</span><span class="sub">${s}</span></span></div>`
    : `<a class="item" href="#/practice/${k}"><span class="body"><span class="title">${t}</span><span class="sub">${s}</span></span>${meta ? `<span class="meta">${meta}</span>` : ''}<span class="chev">${icon('chev')}</span></a>`;
  main.innerHTML = `<div class="top"><h1>Practice</h1></div><p class="lead">Short extra rounds. Pick one.</p>
  <div class="list">
    ${row('grammar', 'Grammar review', 'Pick a case or verb form and practise it')}
    ${row('input', 'Read and listen', "Many example sentences from your tutor's sheets, one grammar point at a time")}
    ${row('common', 'Common words', 'The next 5 of the 2000 most common words')}
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
  if (mode === 'common') {
    const ws = pickNew(5, [], []).filter(w => w.rank);
    steps = [...ws.map(stepLearn), ...ws.map((w, i) => stepQuiz(w, ['pic', 'listen', 'type'][i % 3]))];
  }
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

const pctOf = g => (g?.total ? Math.round((g.right / g.total) * 100) : null);
const weak = g => g && g.total >= 8 && g.right / g.total < 0.7;

async function grammarList(main) {
  const gram = store.get().gram || {};
  const pts = POINTS.slice().sort((a, b) => weak(gram[b[0]]) - weak(gram[a[0]]));
  const row = ([k, t, s]) => {
    const g = gram[k], p = pctOf(g);
    const meta = p === null ? 'Not practised' : `${p} % · ${g.last === store.today() ? 'today' : new Date(g.last).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
    return `<a class="item" href="#/practice/grammar/${k}"><span class="body"><span class="title">${t}${weak(g) ? ' <span class="tag-weak">Needs work</span>' : ''}</span><span class="sub ru">${ruHtml(s)}</span></span><span class="meta">${meta}</span><span class="chev">${icon('chev')}</span></a>`;
  };
  main.innerHTML = `<a class="back" href="#/practice">← Practice</a><div class="top"><h1>Grammar review</h1></div>
  <p class="lead">12 questions on one point. Practise the ones you find hard as often as you like. Missed questions come back at the end of the round.</p>
  <div class="list">${pts.map(row).join('')}<a class="item" href="#/practice/grammar/mixed"><span class="body"><span class="title">All cases mixed</span><span class="sub">Prepositional, accusative, genitive, dative, instrumental</span></span><span class="chev">${icon('chev')}</span></a></div>
  <p class="small muted" style="margin-top:14px">Answer forms are checked against two dictionaries (OpenRussian.org and OpenCorpora).</p>`;
}

async function review(main, tag) {
  const pt = POINTS.find(p => p[0] === tag), tags = tag === 'mixed' ? CASES : [tag];
  if (!pt && tag !== 'mixed') { location.hash = '#/practice/grammar'; return; }
  const [bank, gs] = await Promise.all([json('data/drills.json'), loadGrammar()]);
  const unitDrills = gs.flatMap(u => u.drills.map(d => ({ d, u }))).filter(x => tags.includes(drillTag(x.d, x.u)));
  const label = { id: 'rev', en: pt ? pt[1] : 'All cases' };
  const tutor = tag === 'mixed' ? [] : await tutorItemsFor(tag, 3);
  const pool = shuffle([...unitDrills, ...shuffle(bank.filter(d => tags.includes(d.tag))).map(d => ({ d, u: label }))]).slice(0, 12 - tutor.length);
  const out = { right: 0, again: true };
  const steps = [...pool.map(x => stepDrill(x.d, x.u, out)), ...tutor.map(t => stepTutor(t.item, t.title, tag))];
  const sum = await runSteps(main, steps, { exitTo: 'practice/grammar' });
  if (!sum) return;
  store.finishSession();
  const unit = pt && gs.find(u => u.id === pt[3]);
  main.innerHTML = `<div class="done"><div class="mark">✓</div><h1>Round done</h1><p class="muted">${sum.right} of ${sum.total} answers correct, including the repeats.</p>
   <div class="actions stack" style="max-width:360px;margin:24px auto 0"><button class="btn primary block big" id="re">Another round</button>
   ${unit ? `<a class="btn secondary block" href="#/course/${unit.id}">Read the explanation: ${esc(unit.en)}</a>` : ''}
   <a class="btn text" href="#/practice/grammar">Back to Grammar review</a></div></div>`;
  main.querySelector('#re').onclick = () => review(main, tag);
}

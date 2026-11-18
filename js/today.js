// Today: one thing to do. A ~10-minute session built from the course position, due reviews and the tutor's latest sheet.
import { esc, sample } from './ui.js';
import * as store from './store.js';
import { isLearned } from './srs.js';
import { loadVocab, dueWords, pickNew, runSteps, stepLearn, stepReview, stepQuiz, stepDrill, stepTutor, tutorItems } from './session.js';
import { loadGrammar, currentUnit, earlierTopics, lessonSeen, stepLesson } from './grammar.js';
import { go } from './router.js';

const practised = d => d && ((d.minutes || 0) >= 1 || (d.total || 0) > 0);
/** Monday-first dots for this week. */
function weekDots() {
  const now = new Date(), dow = (now.getDay() + 6) % 7, out = [];
  let n = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow + i), on = practised(store.get().days[store.today(d)]);
    if (on) n++;
    out.push(`<i class="${on ? 'on' : ''} ${i === dow ? 'now' : ''}"></i>`);
  }
  return { html: `<span class="dots" aria-hidden="true">${out.join('')}</span>`, n };
}

async function plan() {
  await loadVocab();
  const gs = await loadGrammar(), u = currentUnit(gs);
  const due = dueWords(15), fresh = pickNew(5, u.topics || [], earlierTopics(gs, u));
  const drills = sample(u.drills, Math.min(5, u.drills.length));
  const tutor = u.week === 0 ? [] : await tutorItems(3);
  const mins = Math.max(5, Math.round((lessonSeen(u) ? 0 : 3) + due.length * 0.3 + fresh.length * 1 + drills.length * 0.6 + tutor.length * 0.6));
  return { u, due, fresh, drills, tutor, mins };
}

export async function view(main) {
  const p = await plan(), st = store.get();
  const doneToday = !!st.done['daily:' + store.today()];
  const learned = Object.values(st.cards).filter(isLearned).length, wk = weekDots();
  const parts = [!lessonSeen(p.u) && `a short explanation`, p.due.length && `${p.due.length} ${p.due.length === 1 ? 'word' : 'words'} to review`,
    p.fresh.length && `${p.fresh.length} new ${p.fresh.length === 1 ? 'word' : 'words'}`,
    `${p.drills.length} ${p.u.id === 'g00' ? 'reading' : p.u.id === 'g00c' ? 'word' : 'grammar'} questions`, p.tutor.length && `${p.tutor.length} from your tutor's sheet`].filter(Boolean);
  main.innerHTML = `<div class="home"><div class="top"><span class="date">${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</span><a href="#/progress">Progress</a></div>
   <div class="next">${doneToday
    ? `<div class="label">Today</div><h2>Today's session is done</h2><p class="what">Words come back for review when they are due. Tomorrow's session is ready tomorrow.</p><button class="btn secondary block big" id="go">One more round · ${p.mins} min</button>`
    : `<div class="label">Today's session · about ${p.mins} min</div><h2>Unit ${p.u.week}: ${esc(p.u.en)}</h2><p class="what">${(s => s[0].toUpperCase() + s.slice(1))(parts.join(', '))}.</p><button class="btn primary block big" id="go">Start</button>`}</div>
   <div class="quiet"><div>${wk.html}<div style="margin-top:6px">Practised <b>${wk.n}</b> of 7 days this week</div></div><div><b>${learned}</b> ${learned === 1 ? 'word' : 'words'} learned</div></div></div>`;
  main.querySelector('#go').onclick = () => run(main, p);
}

async function run(main, p) {
  const steps = lessonSeen(p.u) ? [] : [stepLesson(p.u)];
  p.due.forEach(w => steps.push(stepReview(w)));
  // Learn two words, then test them straight away, each a different way.
  const kinds = ['pic', 'listen', 'type'];
  for (let i = 0; i < p.fresh.length; i += 2) {
    const pair = p.fresh.slice(i, i + 2);
    pair.forEach(w => steps.push(stepLearn(w)));
    pair.forEach((w, j) => steps.push(stepQuiz(w, kinds[(i + j) % 3])));
  }
  const g = { right: 0 };
  p.drills.forEach(d => steps.push(stepDrill(d, p.u, g)));
  p.tutor.forEach(t => steps.push(stepTutor(t.item, t.title)));
  const t0 = Date.now();
  const sum = await runSteps(main, steps, { exitTo: 'today' });
  if (!sum) return;
  store.markDone('daily:' + store.today()); store.finishSession();
  // The unit counts as done once its questions go well in a session (80 %+), the same bar as a careful pass in Course.
  const unitDone = !store.get().done['g:' + p.u.id] && g.right >= Math.ceil(p.drills.length * 0.8);
  if (unitDone) store.markDone('g:' + p.u.id);
  const pct = sum.total ? Math.round((sum.right / sum.total) * 100) : 100, mins = Math.max(1, Math.round((Date.now() - t0) / 60000));
  setTimeout(() => main.querySelector('#fin').onclick = () => go('today'));
  main.innerHTML = `<div class="done"><div class="mark">✓</div><h1>Session done</h1><p class="muted">${unitDone ? `Unit ${p.u.week} is done. Next time you start the next unit.` : `That's today's practice.`}</p>
    <div class="stats"><div><b>${pct}%</b><span>correct</span></div><div><b>${p.fresh.length}</b><span>new words</span></div><div><b>${mins}</b><span>min</span></div></div>
    <div class="actions stack" style="max-width:360px;margin:0 auto"><button class="btn primary block big" id="fin">Finish</button></div></div>`;
}

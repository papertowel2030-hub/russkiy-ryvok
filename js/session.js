// Session engine: one task per screen. Words (learn, review, quiz), grammar gaps and tutor questions.
import { json, esc, ruHtml, strip, norm, picHtml, shuffle, keys, icon } from './ui.js';
import * as store from './store.js';
import { grade, Rating, dueIds } from './srs.js';
import { say } from './tts.js';
import { go } from './router.js';
import { ins, lbl, gloss } from './cue.js';

export let VOCAB = [];
export const byId = id => VOCAB.find(w => w.id === id) || store.get().custom?.[id];
export async function loadVocab() { if (!VOCAB.length) VOCAB = await json('data/vocab.json'); return VOCAB; }

/** Several words share one picture, so options must differ by picture AND by spelling. */
export const picKey = w => w.pic || w.emoji || w.id;
/** Topics whose picture alone names the word. Other words get the English meaning as the cue, and no picture. */
const CONCRETE = new Set(['food', 'home', 'things', 'clothes', 'animals', 'city', 'transport', 'nature', 'body', 'family']);
export const concrete = w => CONCRETE.has(w.topic);
const picOf = w => (concrete(w) && w.pic ? `<div class="pic">${picHtml(w, 88)}</div>` : '');
const sound = (label = 'Listen') => `<button class="btn secondary sm sound" data-say>${icon('sound')}${label}</button>`;

/** Pick n distractors that differ from `w` (and each other) in picture and spelling. */
export function distractors(pool, w, n = 3) {
  const out = [], used = new Set([picKey(w)]), spelled = new Set([w.ru]), meant = new Set([w.en]);
  for (const x of shuffle(pool)) {
    if (out.length >= n) break;
    if (used.has(picKey(x)) || spelled.has(x.ru) || meant.has(x.en)) continue;
    used.add(picKey(x)); spelled.add(x.ru); meant.add(x.en); out.push(x);
  }
  return out;
}
function options(w) {
  let d = distractors(VOCAB.filter(x => x.topic === w.topic), w);
  if (d.length < 3) d = d.concat(distractors(VOCAB.filter(x => !d.includes(x)), w, 3 - d.length));
  return shuffle([w, ...d]);
}

/** New words: the current unit's topics first, then earlier units', then anything unseen. */
export function pickNew(n, topics = [], earlier = []) {
  const seen = store.get().cards, fresh = VOCAB.filter(w => !seen[w.id]);
  const lvl = w => (w.lvl === 'A1' ? 0 : 1);
  const tiers = [fresh.filter(w => topics.includes(w.topic)), fresh.filter(w => earlier.includes(w.topic)), fresh];
  const out = [];
  for (const t of tiers) for (const w of t.sort((a, b) => lvl(a) - lvl(b))) { if (out.length >= n) return out; if (!out.includes(w)) out.push(w); }
  return out;
}
export const dueWords = (max = 15) => shuffle(dueIds().map(byId).filter(Boolean)).slice(0, max);

/** Run steps full-screen. Steps may be appended while running (missed words come back at the end).
 *  Resolves {right,total}, or null if the learner leaves with ✕ (everything answered so far is already saved). */
export async function runSteps(root, steps, { title = '', exitTo = 'today' } = {}) {
  const sum = { right: 0, total: 0 };
  const ctx = { again: s => steps.push(s), score: ok => { sum.total++; if (ok) sum.right++; store.tally(ok); } };
  document.body.classList.add('in-session');
  root.innerHTML = `<div class="sess-head"><button class="x" id="x" aria-label="Leave session">✕</button><div class="bar" aria-hidden="true"><i></i></div></div><div id="step"></div>`;
  const bar = root.querySelector('.bar i'), box = root.querySelector('#step');
  let left = false;
  const exit = new Promise(r => root.querySelector('#x').addEventListener('click', () => { left = true; r(); }, { once: true }));
  for (let i = 0; i < steps.length; i++) {
    bar.style.width = `${(i / steps.length) * 100}%`;
    box.innerHTML = '';
    await Promise.race([steps[i](box, ctx), exit]);
    if (left) { speechSynthesis?.cancel?.(); go(exitTo); return null; }
    window.scrollTo(0, 0);
  }
  document.body.classList.remove('in-session');
  return sum;
}

const once = (el, sel) => new Promise(r => el.querySelector(sel).addEventListener('click', r, { once: true }));
const wireSay = (el, text) => el.querySelectorAll('[data-say]').forEach(b => { b.onclick = () => say(text); });

const ok = () => `${ins('Пра́вильно.', 'Correct.', 'пра́вильно')}`;
const no = () => `${ins('Непра́вильно.', 'Not quite.', 'непра́вильно')}`;
const ans = () => `${ins('Отве́т:', 'Answer:', 'отве́т')}`;

/** Feedback + one "Next" button. Enter continues. */
function feedback(el, good, html) {
  el.querySelector('#fb').innerHTML = `<div class="feedback ${good ? 'ok' : 'bad'}">${html}</div><div class="actions"><button class="btn block big" id="next">${lbl('Да́льше', 'Next')}</button></div>`;
  const next = el.querySelector('#next'); next.focus({ preventScroll: true });
  return new Promise(res => { const off = keys({ Enter: () => next.click() }); next.onclick = () => { off(); res(); }; });
}

/** Teach a new word: picture (things only), sound, meaning. It enters the scheduler when it is tested. */
export const stepLearn = w => async el => {
  el.innerHTML = `<div class="task"><div class="kind">New word</div>${picOf(w)}<div class="big-ru">${ruHtml(w.st)}</div><p class="gloss">${esc(w.en)}</p>${sound()}
    <div class="actions"><button class="btn block big" id="nx">${lbl('Да́льше', 'Next')}</button></div></div>`;
  wireSay(el, w.ru); say(w.ru);
  const off = keys({ Enter: () => el.querySelector('#nx').click() });
  await once(el, '#nx'); off();
};

/** Review a known card: recall first, then say honestly how it went. "Didn't know" brings it back at the end. */
export const stepReview = w => async (el, ctx) => {
  el.innerHTML = `<div class="task"><div class="kind">Review</div>${picOf(w)}<p class="cue">${esc(w.en)}</p><p class="muted small">Say the Russian word, then check.</p>
    <div id="ans" hidden><div class="big-ru">${ruHtml(w.st)}</div></div>
    <div class="actions"><button class="btn block big" id="show">Show answer</button></div>
    <div class="rate" hidden><button class="btn secondary" data-g="1">Didn't know</button><button class="btn" data-g="3">Knew it</button><button class="btn secondary" data-g="2" style="grid-column:span 2">Knew it, but slowly</button></div></div>`;
  let off = keys({ Space: () => el.querySelector('#show').click(), Enter: () => el.querySelector('#show').click() });
  await once(el, '#show'); off();
  el.querySelector('#ans').hidden = false; el.querySelector('#show').parentElement.hidden = true; el.querySelector('.rate').hidden = false; say(w.ru);
  off = keys({ 1: () => el.querySelector('[data-g="1"]').click(), 2: () => el.querySelector('[data-g="3"]').click() });
  const g = await new Promise(r => el.querySelectorAll('[data-g]').forEach(b => b.addEventListener('click', () => r(+b.dataset.g), { once: true })));
  off();
  grade(w.id, g); ctx?.score(g > 1);
  if (g === 1) ctx?.again(stepQuiz(w, 'pic', false));
};

/** Test a word (pick / listen / type). Missed words come back at the end of the session, at most twice. */
export const stepQuiz = (w, kind = 'pic', grading = true, tries = 0) => async (el, ctx) => {
  const run = { pic: quizPick, listen: quizListen, type: quizType }[kind] || quizPick;
  const { ok, hints } = await run(w, el);
  if (grading) grade(w.id, ok ? (hints ? Rating.Hard : Rating.Good) : Rating.Again);
  ctx?.score(ok);
  if (!ok && tries < 2) ctx?.again(stepQuiz(w, kind === 'type' ? 'type' : 'pic', false, tries + 1));
};

async function quizPick(w, el) {
  el.innerHTML = `<div class="task"><p class="instr">${ins('Вы́берите сло́во', 'Choose the Russian word', 'вы́берите')}</p>${picOf(w)}<p class="cue">${esc(w.en)}</p><div class="opts" id="o"></div><div id="fb"></div></div>`;
  return { ok: await choose(el, options(w).map(o => ({ id: o.id, html: ruHtml(o.st) })), w.id, w) };
}
async function quizListen(w, el) {
  el.innerHTML = `<div class="task"><p class="instr">${ins('Послу́шайте и вы́берите', 'Listen and choose the meaning', 'послу́шайте')}</p>${sound('Play again')}<div class="opts" id="o"></div><div id="fb"></div></div>`;
  wireSay(el, w.ru); say(w.ru);
  return { ok: await choose(el, options(w).map(o => ({ id: o.id, html: esc(o.en), en: true })), w.id, w) };
}
async function quizType(w, el) {
  el.innerHTML = `<div class="task"><p class="instr">${ins('Напиши́те по-ру́сски', 'Type it in Russian', 'напиши́те')}</p>${picOf(w)}<p class="cue">${esc(w.en)}</p>
    <input class="input" id="in" autocomplete="off" autocapitalize="off" spellcheck="false" lang="ru" aria-label="Russian word">
    <div class="actions"><button class="btn block big" id="go">${lbl('Прове́рить', 'Check')}</button><button class="btn text" id="hint">Show first letter</button></div><div id="fb"></div></div>`;
  const inp = el.querySelector('#in'); inp.focus();
  let hints = 0;
  el.querySelector('#hint').onclick = () => { hints++; const t = strip(w.ru); inp.placeholder = t.slice(0, Math.min(hints, t.length)) + '…'; inp.focus(); };
  const good = await new Promise(r => {
    const check = () => { if (!inp.value.trim()) return inp.focus(); r(norm(inp.value) === norm(w.ru)); };
    el.querySelector('#go').onclick = check;
    inp.onkeydown = e => { if (e.key === 'Enter') check(); };
  });
  inp.classList.add(good ? 'ok' : 'bad'); inp.readOnly = true; el.querySelector('.actions').hidden = true; say(w.ru);
  await feedback(el, good, good ? ok() : `${no()} ${ans()} <strong class="ru">${ruHtml(w.st)}</strong>`);
  return { ok: good, hints };
}

/** Multiple choice: 1–4 pick, Enter continues. Resolves true/false after feedback. */
export function choose(el, opts, correctId, word) {
  const box = el.querySelector('#o');
  box.innerHTML = opts.map((o, i) => `<button class="opt ${o.en ? 'en' : ''}" data-id="${esc(o.id)}"><kbd>${i + 1}</kbd><span>${o.html}</span></button>`).join('');
  return new Promise(res => {
    const off = keys(Object.fromEntries(opts.map((o, i) => [String(i + 1), () => box.querySelectorAll('.opt')[i]?.click()])));
    box.querySelectorAll('.opt').forEach(b => b.addEventListener('click', async () => {
      off();
      const good = b.dataset.id === String(correctId);
      box.querySelectorAll('.opt').forEach(x => { x.disabled = true; if (x.dataset.id === String(correctId)) x.classList.add('ok'); });
      if (!good) b.classList.add('bad');
      if (word) say(word.ru);
      await feedback(el, good, good ? ok() : word ? `${no()} ${ans()} <strong class="ru">${ruHtml(word.st)}</strong>: ${esc(word.en)}` : no());
      res(good);
    }, { once: true }));
  });
}

/** One grammar gap. `u` = the unit (for the label). */
export const stepDrill = (d, u, out) => async (el, ctx) => {
  const ru = /[А-Яа-яЁё]/.test(d.a[0]), gap = d.q.includes('___');
  el.innerHTML = `<div class="task" style="text-align:left"><div class="kind">${u.id === 'g00' ? 'Reading' : u.id === 'g00c' ? 'Classroom words' : 'Grammar'} · ${esc(u.en || u.title)}</div>
    ${gap ? `<p class="instr">${ins('Вста́вьте сло́во', 'Fill in the gap', 'вста́вьте')}</p>` : ''}
    <p class="prompt">${ruHtml(d.q).replace('___', '<span class="faint">_____</span>')}</p>
    <input class="input" id="a" autocomplete="off" autocapitalize="off" spellcheck="false" lang="${ru ? 'ru' : 'en'}" aria-label="Answer">
    <div class="actions"><button class="btn block big" id="ok">${lbl('Прове́рить', 'Check')}</button><button class="btn text" id="hint">Hint</button></div><div id="h" class="muted small"></div><div id="fb"></div></div>`;
  const inp = el.querySelector('#a'); inp.focus();
  el.querySelector('#hint').onclick = () => { el.querySelector('#h').innerHTML = ruHtml(d.hint); };
  const good = await new Promise(r => {
    const check = () => { if (!inp.value.trim()) return inp.focus(); r(d.a.some(a => norm(a) === norm(inp.value))); };
    el.querySelector('#ok').onclick = check;
    inp.onkeydown = e => { if (e.key === 'Enter') check(); };
  });
  inp.classList.add(good ? 'ok' : 'bad'); inp.readOnly = true; el.querySelector('.actions').hidden = true;
  say(d.say || d.q.replace('___', d.a[0]).replace(/\(.*?\)/g, ''));
  ctx?.score(good); if (out) out.right += good ? 1 : 0;
  await feedback(el, good, good ? ok() : `${no()} ${ans()} <strong class="${ru ? 'ru' : ''}">${esc(d.a[0])}</strong>. <span class="muted">${ruHtml(d.hint)}</span>`);
};

/** A question from the tutor's sheet: answer aloud, reveal, mark honestly. */
export const stepTutor = (item, sheet) => async (el, ctx) => {
  el.innerHTML = `<div class="task" style="text-align:left"><div class="kind">From your tutor · ${esc(sheet)}</div>
    ${item.prompt ? `<p class="muted small">${gloss(tidy(item.prompt))}</p>` : ''}<p class="prompt">${tidy(item.q)}</p>
    ${item.options?.length ? `<p class="muted">${item.options.map(o => ruHtml(o)).join(' / ')}</p>` : ''}
    <p class="muted small">Answer out loud first, then check.</p>
    <div id="ans" hidden><div class="feedback ok"><span class="ru" style="font-size:1.2rem">${ruHtml(String(item.answer))}</span></div></div>
    <div class="actions"><button class="btn block big" id="show">Show answer</button></div>
    <div class="rate" hidden><button class="btn secondary" data-ok="0">I got it wrong</button><button class="btn" data-ok="1">I got it right</button></div></div>`;
  await once(el, '#show');
  el.querySelector('#ans').hidden = false; el.querySelector('#show').parentElement.hidden = true; el.querySelector('.rate').hidden = false;
  const ok = await new Promise(r => el.querySelectorAll('[data-ok]').forEach(b => b.addEventListener('click', () => r(b.dataset.ok === '1'), { once: true })));
  ctx?.score(ok); store.markDone(item.key, (store.get().done[item.key] || 0) + 1);
};

/** A tutor question works as text only if it has real Russian in it and doesn't point at a picture. */
export const usable = it => {
  if (!it.q || !it.answer || /example/i.test(String(it.answer)) || /^образец/i.test(it.q)) return false;
  if (/picture|photo|image|рисун|картин|(^|\s)фото(\s|$)/i.test(it.q)) return false;
  const t = it.q.replace(/\(.*?\)/g, '').replace(/~~.*?~~/g, '');
  return t.includes('___') ? /[А-Яа-яЁё]{2,}/.test(t) : /[А-Яа-яЁё]{2,}\S*\s+\S*[А-Яа-яЁё]{2,}/.test(t);
};
/** Transcription marks: ~~crossed out~~ → strikethrough. */
export const tidy = s => ruHtml(String(s ?? '')).replace(/~~(.*?)~~/g, '<s>$1</s>');

/** Tutor sheets in the order they were added (the ingest ledger appends new files last): stem → index. */
export async function recency() {
  const led = await json('data/tutor/ledger.json').catch(() => ({ files: {} }));
  return Object.fromEntries(Object.keys(led.files).map((k, i) => [k, i]));
}

/** Up to n answered questions from the most recent tutor sheets, least-practised first. */
export async function tutorItems(n = 3) {
  const idx = await json('data/weeks/index.json').catch(() => []);
  const order = await recency();
  const files = idx.flatMap(g => g.files.map(f => ({ ...f, key: g.key }))).filter(f => f.status !== 'pending' && f.items);
  files.sort((a, b) => (order[b.stem] ?? -1) - (order[a.stem] ?? -1));
  const done = store.get().done, out = [];
  for (const f of files) {
    const grp = await json(`data/weeks/${encodeURIComponent(f.key)}.json`).catch(() => null);
    const sheet = grp?.files.find(x => x.stem === f.stem); if (!sheet) continue;
    const items = sheet.exercises.flatMap(x => (x.items || []).filter(usable).map(it => ({ ...it, prompt: x.prompt, key: `ti:${f.stem}:${it.q}` })));
    items.sort((a, b) => (done[a.key] || 0) - (done[b.key] || 0) || Math.random() - .5);
    for (const it of items) { if (out.length >= n) break; out.push({ item: it, title: sheet.title }); }
    if (out.length >= n) break;
  }
  return out;
}

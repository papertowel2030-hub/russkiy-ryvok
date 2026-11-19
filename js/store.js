// Progress store: localStorage with JSON export/import. All reads/writes are try/catch-wrapped.
const KEY = 'rr.v1';
const blank = () => ({ v: 1, cards: {}, xp: 0, streak: 0, lastDay: null, days: {}, settings: { theme: 'auto', voice: true, goal: 30, onboarded: false, startUnit: 0 }, done: {}, gram: {}, started: null });
let state = blank();
const subs = new Set();

export const today = (d = new Date()) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};

export function load() {
  try { const raw = localStorage.getItem(KEY); if (raw) state = clean(JSON.parse(raw)); } catch (e) { state = blank(); }
  if (!state.started) { state.started = today(); save(); }
  return state;
}
export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage blocked: keep in memory */ }
  subs.forEach(f => f(state));
}
export const get = () => state;
export const subscribe = f => (subs.add(f), () => subs.delete(f));

/** Today's log: xp, reviews, minutes (active study time), right/total answers, sessions finished. */
export const day = (t = today()) => {
  const d = (state.days[t] ||= {});
  for (const k of ['xp', 'reviews', 'minutes', 'right', 'total', 'sessions']) if (!Number.isFinite(d[k])) d[k] = 0;
  return d;
};
/** Any study activity keeps the streak alive. */
function touch() {
  const t = today();
  if (state.lastDay !== t) {
    const y = today(new Date(Date.now() - 864e5));
    state.streak = state.lastDay === y ? state.streak + 1 : 1;
    state.lastDay = t;
  }
}
export function addXp(n) { state.xp += n; day().xp += n; touch(); save(); }
/** Record one checked answer (for accuracy stats). */
export function tally(ok) { const d = day(); d.total++; if (ok) d.right++; save(); }
/** Active study time, in seconds (called by the activity heartbeat). */
export function addTime(sec) { day().minutes = Math.round((day().minutes + sec / 60) * 100) / 100; save(); }
export function finishSession() { day().sessions++; touch(); save(); }
/** Accuracy per grammar point (prep, acc, pres…), for Grammar review. */
export function gramTally(tag, ok) { const g = (state.gram[tag] ||= { right: 0, total: 0, last: null }); g.total++; if (ok) g.right++; g.last = today(); save(); }
export function markDone(key, val = true) { state.done[key] = val; save(); }
export function setSetting(k, v) { state.settings[k] = v; save(); }

const isObj = x => !!x && typeof x === 'object' && !Array.isArray(x);
const isDay = x => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x);
/** Validate a stored/imported state and fill gaps with defaults; throws when the shape is unusable. */
function clean(o) {
  if (!isObj(o) || o.v !== 1 || !isObj(o.cards)) throw new Error('Not a Русский Рывок backup');
  const b = blank();
  for (const c of Object.values(o.cards)) if (!isObj(c) || !['s', 'd', 'reps', 'due'].every(k => Number.isFinite(c[k]))) throw new Error('Backup has damaged cards');
  return {
    ...b, ...o,
    cards: o.cards,
    settings: { ...b.settings, ...(isObj(o.settings) ? o.settings : {}) },
    days: isObj(o.days) ? o.days : {}, done: isObj(o.done) ? o.done : {}, gram: isObj(o.gram) ? o.gram : {}, custom: isObj(o.custom) ? o.custom : {},
    xp: Number.isFinite(o.xp) ? o.xp : 0, streak: Number.isFinite(o.streak) ? o.streak : 0,
    lastDay: isDay(o.lastDay) ? o.lastDay : null, started: isDay(o.started) ? o.started : null,
  };
}
/** Streak as shown: it only counts while the last active day is today or yesterday. */
export function streak() {
  const t = today(), y = today(new Date(Date.now() - 864e5));
  return state.lastDay === t || state.lastDay === y ? state.streak : 0;
}

export function exportJSON() { return JSON.stringify(state, null, 1); }
export function importJSON(text) {
  let o;
  try { o = JSON.parse(text); } catch (e) { throw new Error('Not a Русский Рывок backup'); }
  state = clean(o);
  if (!state.started) state.started = today();
  save();
}
export function reset() { state = blank(); state.started = today(); save(); }

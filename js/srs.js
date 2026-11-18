// FSRS-4.5 scheduler (open spaced-repetition algorithm), compact port with default weights.
import { get, save, day } from './store.js';

const W = [0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755];
const DECAY = -0.5, FACTOR = 19 / 81, RETENTION = 0.9, MAXI = 365;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const Rating = { Again: 1, Hard: 2, Good: 3, Easy: 4 };

const retrievability = (t, s) => Math.pow(1 + FACTOR * t / s, DECAY);
const d0 = g => clamp(W[4] - W[5] * (g - 3), 1, 10);
const interval = s => clamp(Math.round(s / FACTOR * (Math.pow(RETENTION, 1 / DECAY) - 1)), 1, MAXI);

export function schedule(card, grade, now = Date.now()) {
  const c = card ? { ...card } : { s: 0, d: 0, reps: 0, lapses: 0, due: now, last: null, born: now };
  const elapsed = c.last ? Math.max(0, (now - c.last) / 864e5) : 0;
  if (!c.reps) {
    c.s = W[grade - 1]; c.d = d0(grade);
  } else {
    const r = retrievability(elapsed, c.s);
    const nd = c.d - W[6] * (grade - 3);
    c.d = clamp(W[7] * d0(4) + (1 - W[7]) * nd, 1, 10);
    if (grade === 1) {
      c.s = Math.min(c.s, W[11] * Math.pow(c.d, -W[12]) * (Math.pow(c.s + 1, W[13]) - 1) * Math.exp((1 - r) * W[14]));
      c.lapses++;
    } else {
      const hard = grade === 2 ? W[15] : 1, easy = grade === 4 ? W[16] : 1;
      c.s = c.s * (1 + Math.exp(W[8]) * (11 - c.d) * Math.pow(c.s, -W[9]) * (Math.exp((1 - r) * W[10]) - 1) * hard * easy);
    }
  }
  c.reps++; c.last = now;
  c.due = grade === 1 ? now + 10 * 60000 : now + interval(c.s) * 864e5;
  return c;
}

export function grade(id, g) {
  const st = get();
  st.cards[id] = schedule(st.cards[id], g);
  day().reviews++;
  save();
  return st.cards[id];
}
export const isDue = (id, now = Date.now()) => { const c = get().cards[id]; return !!c && c.due <= now; };
export const isNew = id => !get().cards[id];
export const dueIds = (now = Date.now()) => Object.keys(get().cards).filter(id => get().cards[id].due <= now);
/** A word counts as learned once it has a card that is not currently failed (stability ≥ 1 day). */
export const isLearned = c => !!c && c.s >= 1;
/** Words that keep slipping: forgotten at least once, worst first. */
export const weakIds = (n = 12) => Object.entries(get().cards).filter(([, c]) => c.lapses > 0).sort((a, b) => b[1].lapses - a[1].lapses || a[1].s - b[1].s).slice(0, n).map(([id]) => id);
/** Cards that come due before the end of tomorrow. */
export const dueTomorrow = () => { const end = new Date(); end.setHours(48, 0, 0, 0); return Object.values(get().cards).filter(c => c.due > Date.now() && c.due < end.getTime()).length; };
export const knownCount = () => Object.values(get().cards).filter(c => c.s >= 21).length;
export const learningCount = () => Object.keys(get().cards).length;

// Small DOM helpers shared by all views.
import { isVaulted, text } from './vault.js';
export const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ACUTE = '́';
/** Russian text with the stressed vowel highlighted in gilt. Accepts U+0301 marks. */
export const ruHtml = s => esc(s).replace(/([А-Яа-яЁё])́/g, '<span class="st">$1́</span>').replace(/[Ёё](?!́|<\/span>)/g, '<span class="st">$&</span>');
export const strip = s => String(s).replace(/́/g, '');
export const norm = s => strip(s).toLowerCase().replace(/ё/g, 'е').replace(/[.,!?;:«»"'—\-]/g, ' ').replace(/\s+/g, ' ').trim();

/** Picture for a word. size: px of the image; lazy only for long lists (lesson cards must not pop in). */
export const picHtml = (w, size = 120, lazy = false) => w.pic
  ? `<img src="assets/openmoji/${w.pic}.svg" alt="" width="${size}" height="${size}"${lazy ? ' loading="lazy"' : ''}>`
  : '';

/** Laptop keyboard shortcuts while a step is on screen. Ignores keys typed into fields. Returns a remover. */
export function keys(map) {
  const h = e => {
    if (e.target.closest?.('input,textarea,select') || e.metaKey || e.ctrlKey || e.altKey) return;
    const f = map[e.key === ' ' ? 'Space' : e.key];
    if (f) { e.preventDefault(); f(e); }
  };
  document.addEventListener('keydown', h);
  return () => document.removeEventListener('keydown', h);
}
export const fmtMin = m => m < 1 ? "0" : m < 60 ? String(Math.round(m)) : `${Math.floor(m / 60)} ч ${Math.round(m % 60)} м`;

export const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export const sample = (a, n) => shuffle(a).slice(0, n);

let toastTimer;
export function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

export async function json(path) {
  if (isVaulted(path)) { const t = await text(path); if (t === null) throw new Error(`${path}: locked`); if (t !== undefined) return JSON.parse(t); }
  const r = await fetch(path);
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
}
const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const icon = name => ({
  today: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  course: svg('<path d="M4 5.5h6a2 2 0 0 1 2 2V19a2 2 0 0 0-2-2H4zM20 5.5h-6a2 2 0 0 0-2 2V19a2 2 0 0 1 2-2h6z"/>'),
  practice: svg('<path d="M4 12a8 8 0 0 1 13.7-5.6L20 9M20 4.5V9h-4.5M20 12a8 8 0 0 1-13.7 5.6L4 15M4 19.5V15h4.5"/>'),
  tutor: svg('<path d="M6 3.5h9l3 3v14H6z"/><path d="M9 10h6M9 13.5h6M9 17h4"/>'),
  sound: svg('<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>'),
  chev: svg('<path d="M9 6l6 6-6 6"/>'),
}[name] || '');
/** Russian plural: plural(5, ['день', 'дня', 'дней']) → 'дней'. */
export const plural = (n, [one, few, many]) => { const a = Math.abs(n) % 100, b = a % 10; return a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many; };
export const DAYS = ['день', 'дня', 'дней'];

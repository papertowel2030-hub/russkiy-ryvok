import * as store from './store.js';
import { route, start } from './router.js';
import { icon } from './ui.js';

const NAV = [['today', 'Today'], ['course', 'Course'], ['practice', 'Practice'], ['tutor', 'Tutor']];
const nav = document.getElementById('nav');
nav.innerHTML = `<div class="brand">Русский Рывок</div>` + NAV.map(([k, t]) => `<a href="#/${k}" data-k="${k}">${icon(k)}<span>${t}</span></a>`).join('');

const theme = () => { const t = store.get().settings.theme; if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.dataset.theme = t; };
store.load(); theme();

route('welcome', async (m, step) => (await import('./onboarding.js')).view(m, step));
route('today', async m => (await import('./today.js')).view(m));
route('course', async (m, id) => { const c = await import('./grammar.js'); return id ? c.viewUnit(m, id) : c.viewList(m); });
route('words', async m => (await import('./words.js')).view(m));
route('practice', async (m, mode) => (await import('./practice.js')).view(m, mode));
route('tutor', async (m, ...a) => (await import('./tutor.js')).view(m, ...a));
route('progress', async m => (await import('./progress.js')).view(m));

const guard = name => (!store.get().settings.onboarded && name !== 'welcome' ? 'welcome' : null);
start(document.getElementById('main'), name => {
  nav.hidden = name === 'welcome';
  const tab = { words: 'course', progress: 'today' }[name] || name;
  nav.querySelectorAll('a').forEach(a => a.toggleAttribute('aria-current', false) || (a.dataset.k === tab && a.setAttribute('aria-current', 'page')));
}, guard);

// Study-time tracker: counts 15 s at a time while the page is visible and touched in the last 90 s.
let lastAct = Date.now();
['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach(e => addEventListener(e, () => { lastAct = Date.now(); }, { passive: true }));
setInterval(() => { if (document.visibilityState === 'visible' && Date.now() - lastAct < 90000) store.addTime(15); }, 15000);

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});

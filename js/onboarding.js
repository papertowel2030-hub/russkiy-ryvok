// First run: three short screens, then home.
import * as store from './store.js';
import { ruHtml } from './ui.js';
import { say } from './tts.js';
import { go } from './router.js';

const SCREENS = [
  () => `<div class="step">1 of 3</div><h1>Learn Russian a little every day</h1>
    <p>This app takes you from the alphabet to A2: all six cases, the main verb forms and about 300 core words.</p>
    <div class="sample ru">${ruHtml('Приве́т!')}</div>
    <div class="actions stack"><button class="btn primary block big" data-next>Continue</button><button class="btn text" data-say="Привет">Hear it</button></div>`,
  () => `<div class="step">2 of 3</div><h1>How a day works</h1>
    <ol><li>Open <b>Today</b> and press <b>Start</b>.</li><li>About ten minutes: review old words, learn a few new ones, answer some grammar questions.</li><li>Stop whenever you need to. Your answers are saved.</li></ol>
    <p class="small">Want more? <b>Course</b> has every unit, <b>Practice</b> has extra rounds, <b>Valeria</b> has her lesson sheets.</p>
    <div class="actions stack"><button class="btn primary block big" data-next>Continue</button></div>`,
  () => `<div class="step">3 of 3</div><h1>Can you read this?</h1>
    <div class="sample ru">${ruHtml('Москва́, ма́ма, рестора́н')}</div>
    <div class="actions stack"><button class="btn primary block big" data-start="1">Yes, I can read Cyrillic</button><button class="btn secondary block big" data-start="0">Not yet. Teach me the alphabet</button></div>`,
];

export function view(main, step = '0') {
  const i = Math.max(0, Math.min(SCREENS.length - 1, +step || 0));
  main.innerHTML = `<div class="onb">${SCREENS[i]()}</div>`;
  main.querySelector('[data-next]')?.addEventListener('click', () => go(`welcome/${i + 1}`));
  main.querySelector('[data-say]')?.addEventListener('click', e => say(e.currentTarget.dataset.say));
  main.querySelectorAll('[data-start]').forEach(b => b.addEventListener('click', () => {
    const unit = +b.dataset.start;
    store.setSetting('startUnit', unit); store.setSetting('onboarded', true);
    if (unit === 1) store.markDone('g:g00');
    go('today');
  }));
}

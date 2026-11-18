// All words: one searchable list. Tap to hear.
import { esc, ruHtml } from './ui.js';
import { loadVocab, VOCAB } from './session.js';
import { isLearned } from './srs.js';
import { say } from './tts.js';
import * as store from './store.js';

export async function view(main) {
  await loadVocab();
  const cards = store.get().cards;
  const learned = VOCAB.filter(w => isLearned(cards[w.id])).length;
  main.innerHTML = `<a class="back" href="#/course">← Course</a><div class="top"><h1>All words</h1></div>
  <p class="lead">${VOCAB.length} words · ${learned} learned. Tap a word to hear it.</p>
  <input class="input search" id="q" type="search" placeholder="Search in Russian or English" aria-label="Search words" style="font-family:var(--sans);font-size:1rem">
  <div class="list words" id="list"></div>`;
  const list = main.querySelector('#list');
  const render = q => {
    const ws = VOCAB.filter(w => !q || w.ru.toLowerCase().includes(q) || w.en.toLowerCase().includes(q));
    list.innerHTML = ws.map(w => `<button class="word" data-ru="${esc(w.ru)}"><span class="ru">${ruHtml(w.st)}</span><span class="en">${esc(w.en)}</span>${isLearned(cards[w.id]) ? '<span class="ok-mark">learned</span>' : ''}</button>`).join('') || '<p class="muted" style="padding:16px;margin:0">No words found.</p>';
  };
  main.querySelector('#q').oninput = e => render(e.target.value.trim().toLowerCase());
  list.onclick = e => { const b = e.target.closest('[data-ru]'); if (b) say(b.dataset.ru); };
  render('');
}

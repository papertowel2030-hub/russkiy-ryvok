// All words: course words by topic, or the 2000 most common words in corpus order. Tap to hear.
import { esc, ruHtml } from './ui.js';
import { loadVocab, VOCAB, FREQ, freqCard } from './session.js';
import { isLearned } from './srs.js';
import { say } from './tts.js';
import * as store from './store.js';

const SRC = `Order: Lyashevskaya &amp; Sharov, <i>Frequency dictionary of modern Russian</i> (Russian National Corpus), 2009.
  Stress and meanings: <a href="https://github.com/Badestrand/russian-dictionary" target="_blank" rel="noopener">OpenRussian.org dataset</a>, CC BY-SA 4.0.
  A few very common words missing from that dataset (наш, ваш, до́лжен…) were added by hand.`;

export async function view(main, mode) {
  await loadVocab();
  const cards = store.get().cards, common = mode === 'common';
  const course = VOCAB.filter(w => w.lvl !== 'freq');
  const head = common
    ? (() => {
      const known = FREQ.filter(e => isLearned(cards[freqCard(e)]));
      const pct = known.reduce((s, e) => s + e.ipm, 0) / 1e4;
      return `${known.length} of ${FREQ.length} learned. Together they make up ${pct < 0.1 ? 'under 0.1' : pct < 10 ? pct.toFixed(1) : Math.round(pct)} % of the words in the corpus.`;
    })()
    : `${course.length} words · ${course.filter(w => isLearned(cards[w.id])).length} learned.`;
  main.innerHTML = `<a class="back" href="#/course">← Course</a><div class="top"><h1>Words</h1></div>
  <div class="seg" role="tablist"><a href="#/words" role="tab" ${common ? '' : 'aria-selected="true"'}>Course words</a><a href="#/words/common" role="tab" ${common ? 'aria-selected="true"' : ''}>Most common</a></div>
  <p class="lead">${head} ${common ? 'New words in your daily session follow this order once the course words are learned.' : ''} Tap a word to hear it.</p>
  <input class="input search" id="q" type="search" placeholder="Search in Russian or English" aria-label="Search words" style="font-family:var(--sans);font-size:1rem">
  <div class="list words" id="list"></div>${common ? `<p class="small muted" style="margin-top:14px">${SRC}</p>` : ''}`;
  const list = main.querySelector('#list');
  const row = (w, id, rank) => `<button class="word" data-ru="${esc(w.ru)}">${rank ? `<span class="rank">${rank}</span>` : ''}<span class="ru">${ruHtml(w.st)}</span><span class="en">${esc(w.en)}</span>${isLearned(cards[id]) ? '<span class="ok-mark">learned</span>' : ''}</button>`;
  const render = q => {
    const hit = w => !q || w.ru.toLowerCase().includes(q) || w.en.toLowerCase().includes(q);
    const ws = common ? FREQ.filter(hit).slice(0, q ? 200 : 2000) : course.filter(hit);
    list.innerHTML = ws.map(w => common ? row(w, freqCard(w), w.rank) : row(w, w.id)).join('') || '<p class="muted" style="padding:16px;margin:0">No words found.</p>';
  };
  main.querySelector('#q').oninput = e => render(e.target.value.trim().toLowerCase());
  list.onclick = e => { const b = e.target.closest('[data-ru]'); if (b) say(b.dataset.ru); };
  render('');
}

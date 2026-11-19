// Tutor: the tutor's worksheets, shelved by topic, newest shelf first. Only transcribed pages show content.
import { json, esc, ruHtml, toast, icon } from './ui.js';
import * as store from './store.js';
import { Rating, grade } from './srs.js';
import { say } from './tts.js';
import { recency, runSteps, stepTutor, usable, tidy } from './session.js';
import { gloss } from './cue.js';
import { locked, unlock, src } from './vault.js';

const opened = stem => !!store.get().done['t:' + stem];

export async function view(main, key, stem) {
  if (await locked()) return lockScreen(main, () => view(main, key, stem));
  const [idx, order] = await Promise.all([json('data/weeks/index.json'), recency()]);
  const newest = g => Math.max(-1, ...g.files.map(f => order[f.stem] ?? -1));
  if (!key) {
    const shelves = idx.slice().sort((a, b) => newest(b) - newest(a));
    main.innerHTML = `<div class="top"><h1>Tutor</h1></div>
    <p class="lead">Your tutor's sheets, newest topic first. Answers stay hidden until you tap them.</p>
    <div class="list">${shelves.map((g, i) => {
      const unseen = g.files.filter(f => !opened(f.stem)).length;
      return `<a class="item" href="#/tutor/${g.key}"><span class="body"><span class="title">${esc(g.en || g.label)}</span><span class="sub ru">${esc(g.label)}</span></span>
        <span class="meta">${i === 0 ? '<span style="color:var(--accent)">Latest</span> · ' : ''}${g.files.length} ${g.files.length === 1 ? 'sheet' : 'sheets'}${unseen ? ` · ${unseen} new` : ''}</span><span class="chev">${icon('chev')}</span></a>`;
    }).join('')}</div>`;
    return;
  }
  const grp = await json(`data/weeks/${encodeURIComponent(key)}.json`);
  const files = grp.files.slice().sort((a, b) => (order[b.stem] ?? -1) - (order[a.stem] ?? -1));
  main.innerHTML = `<a class="back" href="#/tutor">← Tutor</a><h1 style="margin-bottom:4px">${esc(grp.en || grp.label)}</h1><p class="ru muted" style="margin-bottom:20px">${esc(grp.label)}</p>`;
  for (const f of files) { const c = sheet(f, main); if (f.stem === stem) { c.open = true; requestAnimationFrame(() => c.scrollIntoView()); } main.append(c); }
}

function sheet(f, main) {
  const el = document.createElement('details'); el.className = 'sheet';
  const qa = f.exercises.flatMap(x => (x.items || []).filter(usable).map(it => ({ ...it, prompt: x.prompt, key: `ti:${f.stem}:${it.q}` })));
  const meta = [f.vocab.length && `${f.vocab.length} words`, qa.length && `${qa.length} questions`].filter(Boolean).join(' · ');
  const head = `<summary><span class="seen-dot ${opened(f.stem) ? 'on' : ''}" title="${opened(f.stem) ? 'Opened' : 'Not opened yet'}"></span><span class="body"><span class="title">${esc(f.title)}</span><span class="sub">${f.status === 'pending' ? 'Not read yet' : f.status === 'partial' ? 'Some pages only · ' + meta : meta}</span></span><span class="chev">${icon('chev')}</span></summary>`;
  if (f.status === 'pending') { el.innerHTML = `${head}<div class="inner"><p class="muted" style="margin-top:14px">This file has not been read yet, or the page was not legible. Nothing is guessed.</p></div>`; return el; }
  el.innerHTML = `${head}<div class="inner">
   ${qa.length ? `<div class="actions"><button class="btn primary block" data-practise>Practise this sheet · ${Math.min(10, qa.length)} questions</button></div>` : ''}
   ${f.vocab.length ? `<h3>Words</h3><div class="chips">${f.vocab.map((v, i) => `<button class="chip-btn" data-v="${i}"><span class="ru">${ruHtml(v.stress || v.ru)}</span>${v.en ? `<span class="en">${esc(v.en)}</span>` : ''}</button>`).join('')}</div>
     <div class="actions"><button class="btn secondary sm" data-add>Add these words to my reviews</button></div>` : ''}
   ${f.rules.map(r => `<div>${r.title ? `<h3>${ruHtml(r.title)}</h3>` : ''}${r.body ? `<p>${ruHtml(r.body)}</p>` : ''}${(r.table || []).length ? `<div class="scroll-x"><table class="tbl"><tbody>${r.table.map((row, i) => `<tr>${row.map(c => i ? `<td>${ruHtml(c)}</td>` : `<th>${ruHtml(c)}</th>`).join('')}</tr>`).join('')}</tbody></table></div>` : ''}</div>`).join('')}
   ${f.exercises.map(x => `<div><h3>${gloss(tidy(x.prompt || x.type || ''))}</h3>${(x.items || []).slice(0, 60).map(it => `<p class="ex-item">${tidy(it.q || '')}${it.options?.length ? ` <span class="muted small">(${it.options.map(esc).join(' / ')})</span>` : ''}${it.answer ? ` <button class="reveal" aria-label="Show answer">${ruHtml(String(it.answer))}</button>` : ''}</p>`).join('')}</div>`).join('')}
   ${f.images.length ? `<h3>The sheet</h3>${f.images.map(im => `<figure style="margin:0 0 12px"><img class="tutor-pic" loading="lazy" src="${esc(src('assets/tutor/' + im.file))}" alt="${esc(im.caption || im.label)}"><figcaption class="small muted">${esc(im.label)}</figcaption></figure>`).join('')}` : ''}
   ${f.notes ? `<p class="small faint" style="margin-top:14px">Transcription notes: ${esc(f.notes)}</p>` : ''}</div>`;
  el.addEventListener('toggle', () => { if (el.open && !opened(f.stem)) store.markDone('t:' + f.stem); });
  el.querySelector('[data-add]')?.addEventListener('click', () => {
    const st = store.get(); st.custom ||= {}; let n = 0;
    f.vocab.forEach((v, i) => { const id = `t:${f.stem}:${i}`; if (!st.cards[id]) { st.custom[id] = { id, ru: v.ru, st: v.stress || v.ru, en: v.en || '', topic: 'tutor' }; grade(id, Rating.Hard); n++; } });
    store.save(); toast(n ? `${n} words added. They come up for review from tomorrow.` : 'These words are already in your reviews');
  });
  el.querySelector('[data-practise]')?.addEventListener('click', async () => {
    const done = store.get().done, items = qa.slice().sort((a, b) => (done[a.key] || 0) - (done[b.key] || 0)).slice(0, 10);
    const sum = await runSteps(main, items.map(it => stepTutor(it, f.title)), { exitTo: 'tutor' });
    if (!sum) return;
    main.innerHTML = `<div class="done"><div class="mark">✓</div><h1>Sheet practised</h1><p class="muted">${sum.right} of ${sum.total} right.</p>
      <div class="actions stack" style="max-width:360px;margin:24px auto 0"><a class="btn primary block big" href="#/tutor">Back to Tutor</a></div></div>`;
  });
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-v]'); if (b) say(f.vocab[+b.dataset.v].ru);
    const r = e.target.closest('.reveal'); if (r) { r.classList.add('shown'); r.setAttribute('aria-label', 'Answer'); }
  });
  return el;
}

/** Shared build: the tutor's sheets need a code, asked once per device. */
export function lockScreen(main, then, title = 'Tutor') {
  main.innerHTML = `<div class="top"><h1>${title}</h1></div>
  <p class="lead">These are a tutor's private sheets. Enter the code to open them on this device.</p>
  <form id="lk" class="actions stack" style="max-width:360px"><input id="code" class="input" type="password" inputmode="numeric" autocomplete="off" placeholder="Code" aria-label="Code">
  <button class="btn primary block big">Open</button><p id="msg" class="small muted" role="status"></p></form>`;
  main.querySelector('#lk').onsubmit = async e => {
    e.preventDefault(); const msg = main.querySelector('#msg'); msg.textContent = 'Checking…';
    if (await unlock(main.querySelector('#code').value.trim())) then();
    else msg.textContent = 'That code is not right.';
  };
}

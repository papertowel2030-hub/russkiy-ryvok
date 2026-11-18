// Progress: plain figures, a calendar, course position, settings and backup.
import * as store from './store.js';
import { isLearned, weakIds, dueTomorrow } from './srs.js';
import { loadGrammar, isDone } from './grammar.js';
import { loadVocab, VOCAB, byId } from './session.js';
import { toast, esc, ruHtml, fmtMin } from './ui.js';
import { go } from './router.js';

const practised = d => d && ((d.minutes || 0) >= 1 || (d.total || 0) > 0);
function heatmap(days, weeks = 16) {
  const now = new Date(), dow = (now.getDay() + 6) % 7;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow - (weeks - 1) * 7), cells = [];
  for (let w = 0; w < weeks; w++) for (let d = 0; d < 7; d++) {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + d), k = store.today(day), v = days[k] || {};
    const m = v.minutes || 0, lvl = day > now ? '-1' : m >= 30 ? 4 : m >= 15 ? 3 : m >= 5 ? 2 : practised(v) ? 1 : 0;
    cells.push(`<i class="h${lvl}" title="${k}: ${Math.round(m)} min"></i>`);
  }
  return `<div class="heat" style="grid-template-columns:repeat(${weeks},1fr)" role="img" aria-label="Days practised, last ${weeks} weeks">${cells.join('')}</div>
   <p class="small muted" style="margin:10px 0 0">Darker = more minutes that day.</p>`;
}

export async function view(main) {
  await loadVocab();
  const st = store.get(), gs = await loadGrammar(), days = st.days, logs = Object.entries(days);
  const totalMin = logs.reduce((n, [, d]) => n + (d.minutes || 0), 0);
  const last7 = logs.filter(([k]) => Date.parse(k) > Date.now() - 7 * 864e5);
  const r7 = last7.reduce((n, [, d]) => n + (d.right || 0), 0), t7 = last7.reduce((n, [, d]) => n + (d.total || 0), 0);
  const learned = Object.values(st.cards).filter(isLearned).length;
  const unitsDone = gs.filter(isDone).length;
  const lvl = l => { const ws = VOCAB.filter(w => w.lvl === l); return [ws.filter(w => isLearned(st.cards[w.id])).length, ws.length]; };
  const weak = weakIds(8).map(id => byId(id)).filter(Boolean);
  const meter = (label, n, t) => `<div class="meter"><span>${label}</span><span class="muted">${n} / ${t}</span></div><div class="bar"><i style="width:${t ? (n / t) * 100 : 0}%"></i></div>`;
  const seg = (name, cur, opts) => `<div class="seg" role="group">${opts.map(([k, t]) => `<button data-${name}="${k}" aria-pressed="${cur === k}">${t}</button>`).join('')}</div>`;

  main.innerHTML = `<a class="back" href="#/today">← Today</a><div class="top"><h1>Progress</h1></div>
  <div class="figures">
    <div class="fig"><b>${learned}</b><span>words learned</span></div>
    <div class="fig"><b>${unitsDone} / ${gs.length}</b><span>units done</span></div>
    <div class="fig"><b>${t7 ? Math.round((r7 / t7) * 100) + '%' : '–'}</b><span>correct, last 7 days</span></div>
    <div class="fig"><b>${fmtMin(totalMin).replace(' ч ', ' h ').replace(' м', ' min')}${totalMin < 60 ? ' min' : ''}</b><span>total practice</span></div>
  </div>
  <div class="card"><h2>Calendar</h2>${heatmap(days)}</div>
  <div class="card"><h2>Words</h2>${meter('A1 words', ...lvl('A1'))}${meter('A2 words', ...lvl('A2'))}
    <p class="small muted" style="margin:12px 0 0">Due for review tomorrow: ${dueTomorrow()}.</p></div>
  ${weak.length ? `<div class="card"><h2>Hard words</h2><p class="ru" style="font-size:1.1rem">${weak.map(w => ruHtml(w.st)).join(', ')}</p><a class="btn secondary sm" href="#/practice/hard">Practise them</a></div>` : ''}
  ${(st.writing || []).length ? `<div class="card"><h2>Your sentences</h2>${st.writing.slice(-5).reverse().map(x => `<p class="ru"><span class="small faint">${esc(x.d)}</span><br>${esc(x.t)}</p>`).join('')}</div>` : ''}
  <div class="section">Settings</div>
  <div class="card"><h3>Theme</h3>${seg('theme', st.settings.theme, [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']])}</div>
  <div class="card"><h3>Move progress to another device</h3><p class="small muted">Progress is saved in this browser only. Save a file here, then load it on the other device.</p>
    <div class="actions" style="margin-top:8px"><button class="btn secondary sm" id="exp">Save file</button><label class="btn secondary sm">Load file<input type="file" id="imp" accept="application/json,.json" hidden></label></div></div>
  <div class="card"><h3>Start again</h3><div class="actions" style="margin-top:8px"><button class="btn secondary sm" id="intro">Show the introduction</button><button class="btn text danger" id="rst">Erase all progress</button></div></div>
  <p class="small faint" style="margin-top:20px">Word pictures: OpenMoji (CC BY-SA 4.0). Fonts: PT Sans and PT Serif by ParaType (SIL OFL).</p>`;

  main.querySelectorAll('[data-theme]').forEach(b => b.onclick = () => { store.setSetting('theme', b.dataset.theme); if (b.dataset.theme === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.dataset.theme = b.dataset.theme; view(main); });
  main.querySelector('#exp').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([store.exportJSON()], { type: 'application/json' })); a.download = `russian-progress-${store.today()}.json`; a.click(); toast('File saved'); };
  main.querySelector('#imp').onchange = async e => { try { store.importJSON(await e.target.files[0].text()); toast('Progress loaded'); view(main); } catch (err) { toast(err.message); } };
  main.querySelector('#intro').onclick = () => { store.setSetting('onboarded', false); go('welcome'); };
  main.querySelector('#rst').onclick = () => { if (confirm('Erase all progress on this device? This cannot be undone.')) { store.reset(); go('welcome'); } };
}

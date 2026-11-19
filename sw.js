// Offline shell: network-first (always fresh when online), cache fallback when offline.
const V = 'rr-v9';
const SHELL = ['./', 'index.html', 'css/app.css', 'manifest.webmanifest', 'assets/icon.svg',
  'js/app.js', 'js/router.js', 'js/ui.js', 'js/store.js', 'js/srs.js', 'js/tts.js', 'js/session.js', 'js/cue.js', 'js/today.js', 'js/grammar.js', 'js/words.js', 'js/practice.js', 'js/onboarding.js', 'js/tutor.js', 'js/vault.js', 'js/progress.js', 'js/input.js',
  'data/vocab.json', 'data/grammar.json', 'data/readings.json', 'data/freq.json', 'data/drills.json',
  ...['pt-sans', 'pt-serif'].flatMap(f => ['cyrillic', 'latin'].flatMap(s => [400, 700].map(w => `assets/fonts/${f}-${s}-${w}.woff2`)))];
// Core shell must cache or install fails; pictures and week files (data/precache.json) are best-effort so one bad file cannot block offline use.
const extras = c => fetch('data/precache.json').then(r => r.json()).then(list => Promise.allSettled(list.map(u => c.add(u)))).catch(() => {});
self.addEventListener('install', e => e.waitUntil(caches.open(V).then(c => c.addAll(SHELL).then(() => extras(c))).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { if (r.ok) { const c = r.clone(); caches.open(V).then(x => x.put(e.request, c)); } return r; }).catch(() => caches.match(e.request)));
});

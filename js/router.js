// Hash router: #/today, #/course/<id>, #/tutor/<shelf>/<stem>, ...
const routes = {}, alias = { grammar: 'course', games: 'practice' };
let current = null, rerun = () => {};
export const route = (name, fn) => { routes[name] = fn; };
/** Navigate; re-renders even when the hash is already the target (e.g. leaving a session started from that page). */
export const go = path => { if (location.hash === '#/' + path) rerun(); else location.hash = '#/' + path; };
export function start(main, onChange, guard) {
  rerun = async () => {
    let [name = 'today', ...args] = (location.hash.replace(/^#\/?/, '') || 'today').split('/');
    name = alias[name] || name;
    const redirect = guard?.(name);
    if (redirect && redirect !== name) { location.hash = '#/' + redirect; return; }
    const fn = routes[name] || routes.today;
    current = routes[name] ? name : 'today';
    document.body.classList.remove('in-session');
    main.innerHTML = '';
    onChange?.(current);
    try { await fn(main, ...args.map(decodeURIComponent)); }
    catch (e) { console.error(e); main.innerHTML = `<div class="card"><h2>This page did not load</h2><p class="muted">${String(e.message).replace(/</g, '&lt;')}</p></div>`; }
    main.focus({ preventScroll: true }); window.scrollTo(0, 0);
  };
  addEventListener('hashchange', rerun); rerun();
}
export const currentRoute = () => current;

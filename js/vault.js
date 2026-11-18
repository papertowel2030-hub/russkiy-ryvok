// Tutor lock for the shared (public) build: the tutor's sheets, ledger and pictures ship as one encrypted file
// (data/vault.bin, AES-GCM, key from the code via PBKDF2). Without data/vault.json (the local copy) nothing is locked.
const KEY = 'rr.tutorCode';
let meta = null, open = null;
const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const getMeta = () => (meta ||= fetch('data/vault.json').then(r => r.ok ? r.json() : null).catch(() => null));
const saved = () => { try { return localStorage.getItem(KEY); } catch { return null; } };

export const isVaulted = p => /^(data\/(weeks|tutor)\/|assets\/tutor\/)/.test(p);

/** Try a code. True if it opens the vault (and remembers it on this device). */
export async function unlock(code) {
  const m = await getMeta(); if (!m) return true;
  try {
    const buf = await (await fetch('data/vault.bin')).arrayBuffer();
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(code), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: b64(m.salt), iterations: m.iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    const files = JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(m.iv) }, key, buf)));
    for (const [p, f] of Object.entries(files)) if (f.mime) f.url = URL.createObjectURL(new Blob([b64(f.data)], { type: f.mime }));
    open = files;
    try { localStorage.setItem(KEY, code); } catch {}
    return true;
  } catch { return false; }
}

/** Locked = this build has a vault and it isn't open yet (a code saved on this device opens it silently). */
export async function locked() {
  if (open || !(await getMeta())) return false;
  const c = saved(); if (c && await unlock(c)) return false;
  return true;
}

/** Text of a vaulted file: undefined = no vault in this build (fetch normally); null = locked or missing. */
export async function text(path) {
  if (!(await getMeta())) return undefined;
  if (await locked()) return null;
  return open[decodeURIComponent(path)]?.data ?? null;
}

/** Picture URL: a blob URL from the vault when open, else the plain path. */
export const src = path => open?.[path]?.url || path;

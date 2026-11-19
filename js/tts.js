// Web Speech ru-RU. Degrades silently when no Russian voice is installed.
let voice = null;
const pick = () => {
  const vs = speechSynthesis.getVoices();
  voice = vs.find(v => /^ru/i.test(v.lang) && /milena|yuri|katya|pavel|google/i.test(v.name)) || vs.find(v => /^ru/i.test(v.lang)) || null;
};
export const supported = () => 'speechSynthesis' in window;
if (supported()) { pick(); speechSynthesis.addEventListener?.('voiceschanged', pick); }
export const hasVoice = () => !!voice;
export function say(text, rate = 0.85) {
  if (!supported()) return false;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/́/g, ''));
  u.lang = 'ru-RU'; u.rate = rate; if (voice) u.voice = voice;
  speechSynthesis.speak(u);
  return true;
}
/** Speak and resolve when finished (or at once if speech is unavailable). */
export function sayWait(text, rate = 0.85) {
  return new Promise(res => {
    if (!supported()) return res(false);
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/\u0301/g, ''));
    u.lang = 'ru-RU'; u.rate = rate; if (voice) u.voice = voice;
    u.onend = () => res(true); u.onerror = () => res(false);
    speechSynthesis.speak(u);
  });
}

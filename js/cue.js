// Classroom words (unit «Слова на уроке»): instructions and buttons in Russian, with English underneath
// until the learner knows the word; after that, Russian only, and a tap shows the English.
import * as store from './store.js';
import { esc, ruHtml, strip } from './ui.js';
import { VOCAB } from './session.js';

const plain = s => strip(s).toLowerCase().replace(/ё/g, 'е');
/** Known = its card has held for a few days (FSRS stability ≥ 3). */
export const knows = key => {
  const w = VOCAB.find(x => x.topic === 'class' && plain(x.ru) === plain(key));
  const c = w && store.get().cards[w.id];
  return !!c && c.s >= 3;
};

/** Inline instruction. `key` is the classroom word that decides whether English still shows. */
export const ins = (ru, en, key = ru) => knows(key)
  ? `<button type="button" class="ins tap" data-en="${esc(en)}"><span class="ru">${ruHtml(ru)}</span></button>`
  : `<span class="ins"><span class="ru">${ruHtml(ru)}</span> <span class="ins-en">${esc(en)}</span></span>`;

/** Button label: Russian, with a small English line until known. */
export const lbl = (ru, en, key = ru) => knows(key) ? `<span>${ruHtml(ru)}</span>` : `<span class="two"><span>${ruHtml(ru)}</span><small>${esc(en)}</small></span>`;

// Instruction words as they appear on the tutor's sheets (several forms of one word). Meanings only, no guesses.
const GLOSS = {
  'послушайте': 'listen', 'слушайте': 'listen', 'прочитайте': 'read', 'читайте': 'read', 'напишите': 'write', 'пишите': 'write',
  'скажите': 'say', 'расскажите': 'tell about', 'ответьте': 'answer', 'отвечайте': 'answer', 'выберите': 'choose', 'вставьте': 'fill in',
  'дополните': 'complete', 'соедините': 'match', 'используйте': 'use', 'заполните': 'fill in', 'смотрите': 'look', 'посмотрите': 'look',
  'сделайте': 'make', 'составьте': 'make up', 'проверьте': 'check', 'вопросы': 'questions', 'вопрос': 'question', 'ответа': 'answer',
  'ответ': 'answer', 'задание': 'task', 'задания': 'tasks', 'упражнение': 'exercise', 'образец': 'model', 'модель': 'model',
  'текст': 'text', 'тексты': 'texts', 'диалог': 'dialogue', 'диалоги': 'dialogues', 'слова': 'words', 'слово': 'word',
  'предложения': 'sentences', 'глагол': 'verb', 'глаголы': 'verbs', 'вариант': 'option', 'правильной': 'correct', 'правильную': 'correct',
  'форме': 'form', 'форму': 'form', 'пропуски': 'gaps', 'окончания': 'endings',
};
/** Make instruction words in rendered HTML tappable (shows the English). Only touches text, not tags. */
export const gloss = html => html.replace(/(^|>)([^<]+)/g, (m, a, text) => a + text.replace(/[А-Яа-яЁё]+/g, w => {
  const en = GLOSS[plain(w)];
  return en ? `<button type="button" class="tap gl" data-en="${esc(en)}">${w}</button>` : w;
}));

document.addEventListener('click', e => {
  const t = e.target.closest('.tap[data-en]'); if (!t) return;
  const open = t.nextElementSibling?.classList.contains('tap-en');
  if (open) t.nextElementSibling.remove();
  else t.insertAdjacentHTML('afterend', `<span class="tap-en">${t.dataset.en}</span>`);
});

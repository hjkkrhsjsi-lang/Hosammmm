// ============ الألعاب: !تحدي ، من فينا ، !دين ============
// نفس الأسئلة والبانرات والمنطق بالضبط من index.js القديم.

const fs = require('fs');
const path = require('path');

// ============ نظام التحدي (تريفيا سريعة بالجروب) ============
// أول واحد يجاوب صح ياخد XP إضافي. فيه مؤقت (60 ثانية) لو محد جاوب، البوت يكشف الجواب لحاله.
const CHALLENGE_BONUS_XP = 20;
const CHALLENGE_TIMEOUT_MS = 60 * 1000;

// المفتاح: chatId ، القيمة: { question, answer, askedBy, timer }
const pendingChallenges = new Map();

const CHALLENGE_QUESTIONS = [
  { question: 'شنو أكبر محيط بالعالم؟', answer: 'الهادي' },
  { question: 'كم عدد قارات العالم؟', answer: '7' },
  { question: 'شنو عاصمة اليابان؟', answer: 'طوكيو' },
  { question: 'شنو أسرع حيوان بري؟', answer: 'الفهد' },
  { question: 'كم عدد أيام السنة الكبيسة؟', answer: '366' },
  { question: 'شنو أطول نهر بالعالم؟', answer: 'النيل' },
  { question: 'شنو الكوكب الأقرب للشمس؟', answer: 'عطارد' },
  { question: 'كم عدد أرجل العنكبوت؟', answer: '8' },
  { question: 'شنو عاصمة فرنسا؟', answer: 'باريس' },
  { question: 'شنو أكبر صحراء حارة بالعالم؟', answer: 'الصحراء الكبرى' },
  { question: 'كم لاعب بفريق كرة القدم الواحد بالملعب؟', answer: '11' },
  { question: 'شنو أصغر كوكب بالمجموعة الشمسية؟', answer: 'عطارد' },
  { question: 'شنو لون الزرافة الأساسي مع البقع؟', answer: 'اصفر' },
  { question: 'كم عدد حروف اللغة العربية؟', answer: '28' },
  { question: 'شنو أعلى جبل بالعالم؟', answer: 'ايفرست' }
];

function normalizeAnswer(text) {
  return (text || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u0652]/g, '')
    .replace(/[إأآا]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\s.,،؟!?]+/g, '');
}

function challengeBanner(question) {
  return [
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬',
    '🧠⃝⚡ *تـحـدي جـديـد!*',
    '',
    `❓ ${question}`,
    '',
    `⏱️ عندكم دقيقة، أول واحد يجاوب صح ياخد +${CHALLENGE_BONUS_XP} XP`,
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬'
  ].join('\n');
}

function challengeWinnerBanner(winnerLine, answer) {
  return [
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬',
    '🏆⃝⚡ *جـاوب صـح!*',
    `👤⃝⚡ *الفـائـز:* ${winnerLine}`,
    `✅ الجـواب: ${answer}`,
    `⭐ حصل على +${CHALLENGE_BONUS_XP} XP`,
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬'
  ].join('\n');
}

function challengeTimeoutBanner(answer) {
  return [
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬',
    '⌛⃝⚡ *خـلـص الـوقـت!*',
    `محد جاوب صح، الجواب كان: *${answer}*`,
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬'
  ].join('\n');
}

// ============ لعبة "من فينا" (ترشيح عشوائي مرح بالجروب) ============
const MIN_FIINA_QUESTIONS = [
  'مين أكثر واحد بالجروب ينام بالصبح؟ 😴',
  'مين أكثر واحد بيرد بسرعة على الرسائل؟ ⚡',
  'مين أكثر واحد يضحك من نفسه؟ 😂',
  'مين أكثر واحد صاحب دراما بالجروب؟ 🎭',
  'مين أكثر واحد بيهرب من الردود؟ 👻',
  'مين أكثر واحد يطلع فكرة بايخة وناس تضحك عليها؟ 🤡',
  'مين أكثر واحد يستاهل لقب "ملك التأخير"؟ ⏰',
  'مين أكثر واحد بيحب ياكل؟ 🍔',
  'مين أكثر واحد شكله جدي بس قلبه طفل؟ 🧸',
  'مين أكثر واحد لو غاب حد يحس فيه؟ 🕵️'
];

function minFiinaBanner(question, targetLine) {
  return [
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬',
    '🎲⃝⚡ *مـن فـيـنـا؟*',
    '',
    question,
    '',
    `👉 الجواب: ${targetLine}`,
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬'
  ].join('\n');
}

// ============ نظام السؤال الديني (!دين) - نفس فكرة !تحدي بس بأسئلة دينية من ملف dean.json ============
const DEAN_BONUS_XP = 25;
const DEAN_TIMEOUT_MS = 60 * 1000;

// المفتاح: chatId ، القيمة: { question, answer, askedBy, timer }
const pendingDeanQuestions = new Map();

function loadDeanQuestions(baseDir) {
  try {
    const deanRaw = fs.readFileSync(path.join(baseDir, 'lib', 'dean.json'), 'utf8');
    return JSON.parse(deanRaw);
  } catch (err) {
    console.error('⚠️ ما قدرت أحمّل ملف dean.json (تأكد إنه بنفس مجلد المشروع):', err.message);
    return [];
  }
}

function deanBanner(question) {
  return [
    '╔═══ ✦『 🕌 𝘿𝙄𝙉 𝙌𝙐𝙄𝙕 』✦ ═══╗',
    '║',
    '║ *🕌 ســؤال ديــنــي جــديــد*',
    '║',
    `║   ❓*الــســؤال :* ${question}`,
    '║',
    `║   🕒 *الوقت:* ${DEAN_TIMEOUT_MS / 1000} ثانية`,
    '║',
    '║   💡*حــاول الــإجــابــة بــشــكــل صــحــيــح*',
    '║',
    '╚════════════════════╝',
    '',
    '> *ᴘᴏᴡᴇʀᴇᴅ:* 🤖 𝗧𝗢𝗝𝗜 𝗕𝗢𝗧 𖤍'
  ].join('\n');
}

function deanWinnerBanner(winnerLine, answer) {
  return [
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬',
    '🏆⃝⚡ *جـاوب صـح!*',
    `👤⃝⚡ *الفـائـز:* ${winnerLine}`,
    `✅ الجـواب: ${answer}`,
    `⭐ حصل على +${DEAN_BONUS_XP} XP`,
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬'
  ].join('\n');
}

function deanTimeoutBanner(answer) {
  return [
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬',
    '⌛⃝⚡ *خـلـص الـوقـت!*',
    `محد جاوب صح، الجواب كان: *${answer}*`,
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬'
  ].join('\n');
}

module.exports = {
  // تحدي
  CHALLENGE_BONUS_XP,
  CHALLENGE_TIMEOUT_MS,
  pendingChallenges,
  CHALLENGE_QUESTIONS,
  normalizeAnswer,
  challengeBanner,
  challengeWinnerBanner,
  challengeTimeoutBanner,
  // من فينا
  MIN_FIINA_QUESTIONS,
  minFiinaBanner,
  // دين
  DEAN_BONUS_XP,
  DEAN_TIMEOUT_MS,
  pendingDeanQuestions,
  loadDeanQuestions,
  deanBanner,
  deanWinnerBanner,
  deanTimeoutBanner
};

// ============ !خيروك - لو خيروك بين شيئين (تصويت جماعي) ============

const { normalizeArabicText } = require('./arabic-utils');

const WYR_TIMEOUT_MS = 30000; // 30 ثانية

const WYR_QUESTIONS = [
  { optionA: 'تعيش بدون نت طول عمرك', optionB: 'تعيش بدون أكل المفضل عندك طول عمرك' },
  { optionA: 'تعرف كل شي رح يصير بمستقبلك', optionB: 'تعرف كل شي صار بماضي أي حد' },
  { optionA: 'تقدر تطير', optionB: 'تقدر تختفي' },
  { optionA: 'تخسر كل صورك القديمة', optionB: 'تخسر كل أرقام جهات اتصالك' },
  { optionA: 'تعيش بلا موسيقى', optionB: 'تعيش بلا أفلام ومسلسلات' },
  { optionA: 'تكون أذكى واحد بالعالم', optionB: 'تكون أغنى واحد بالعالم' },
  { optionA: 'تاكل نفس الأكلة كل يوم لبقية حياتك', optionB: 'ما تاكل أكلتك المفضلة أبداً تاني' },
  { optionA: 'تعرف متى رح تموت', optionB: 'ما تعرف كيف رح تموت' },
  { optionA: 'تكون مشهور بس فقير', optionB: 'تكون غني بس مجهول' },
  { optionA: 'تعيش بلا واتساب', optionB: 'تعيش بلا يوتيوب' }
];

// chatId -> { question, votes: Map(number -> 'A'|'B'), timer }
const pendingWYR = new Map();

function pickQuestion() {
  return WYR_QUESTIONS[Math.floor(Math.random() * WYR_QUESTIONS.length)];
}

// بيحول جواب المستخدم النصي لـ 'A' أو 'B' أو null
function normalizeWYRVote(text) {
  const clean = normalizeArabicText(text);
  if (['1', '١', 'a', 'الاول'].includes(clean)) return 'A';
  if (['2', '٢', 'b', 'الثاني', 'التاني'].includes(clean)) return 'B';
  return null;
}

function wyrBanner(q) {
  return [
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬',
    '🤔 *لـو خـيـروك...*',
    '',
    `1️⃣ ${q.optionA}`,
    'ولا',
    `2️⃣ ${q.optionB}`,
    '',
    'صوّت برقم 1 أو 2',
    '⏱️ عندكم 30 ثانية',
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬'
  ].join('\n');
}

function wyrResultBanner(q, votesA, votesB) {
  const total = votesA + votesB;
  const pctA = total > 0 ? Math.round((votesA / total) * 100) : 0;
  const pctB = total > 0 ? Math.round((votesB / total) * 100) : 0;
  return [
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬',
    '📊 *نـتـيـجـة الـتـصـويـت*',
    '',
    `1️⃣ ${q.optionA}: ${votesA} صوت (${pctA}%)`,
    `2️⃣ ${q.optionB}: ${votesB} صوت (${pctB}%)`,
    '',
    total === 0 ? 'محدا صوّت 😅' : 'شكراً لتصويتكم!',
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬'
  ].join('\n');
}

module.exports = {
  WYR_TIMEOUT_MS,
  pendingWYR,
  pickQuestion,
  normalizeWYRVote,
  wyrBanner,
  wyrResultBanner
};

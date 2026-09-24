// ============ !صح_غلط - تريڤيا صح/غلط بنقاط تراكمية ============

const fs = require('fs');
const path = require('path');

const TF_TIMEOUT_MS = 20000; // 20 ثانية

const TF_QUESTIONS = [
  { question: 'الشمس أكبر من الأرض', answer: true },
  { question: 'القاهرة عاصمة السعودية', answer: false },
  { question: 'جسم الإنسان فيه 206 عظمة تقريباً', answer: true },
  { question: 'الفيل أصغر من الفأر', answer: false },
  { question: 'الماء يتجمد عند صفر درجة مئوية', answer: true },
  { question: 'القمر كوكب', answer: false },
  { question: 'اللغة العربية من أقدم اللغات', answer: true },
  { question: 'يوجد 7 قارات بالعالم', answer: true },
  { question: 'الأخطبوط له قلبين بس', answer: false },
  { question: 'مكة المكرمة بالسعودية', answer: true }
];

// chatId -> { question, answer, askedBy, timer }
const pendingTF = new Map();

function scoresFilePath(persistDir) {
  return path.join(persistDir, 'trivia-tf-scores.json');
}

function readScores(persistDir) {
  try {
    const raw = fs.readFileSync(scoresFilePath(persistDir), 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    return {};
  }
}

function writeScores(persistDir, scores) {
  try {
    fs.writeFileSync(scoresFilePath(persistDir), JSON.stringify(scores, null, 2), 'utf8');
  } catch (err) {
    console.error('خطأ بحفظ نقاط تريڤيا صح/غلط:', err.message);
  }
}

// يضيف نقطة للرقم ويرجع مجموع نقاطه الجديد
function addPoint(persistDir, number) {
  const scores = readScores(persistDir);
  scores[number] = (scores[number] || 0) + 1;
  writeScores(persistDir, scores);
  return scores[number];
}

function pickQuestion() {
  return TF_QUESTIONS[Math.floor(Math.random() * TF_QUESTIONS.length)];
}

// يحول جواب المستخدم النصي لـ true/false، أو null لو ما فهم الجواب
function normalizeTFAnswer(text) {
  const clean = (text || '').trim().toLowerCase();
  const trueWords = ['صح', 'صحيح', 'اه', 'ايوه', 'نعم', 'true', 'yes'];
  const falseWords = ['غلط', 'خطأ', 'خطا', 'لا', 'false', 'no'];
  if (trueWords.includes(clean)) return true;
  if (falseWords.includes(clean)) return false;
  return null;
}

function tfBanner(question) {
  return [
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬',
    '❓ *صـح ولا غـلـط؟*',
    '',
    `📌 ${question}`,
    '',
    'جاوب: صح / غلط',
    '⏱️ عندكم 20 ثانية',
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬'
  ].join('\n');
}

function tfWinnerBanner(nameTag, correctAnswer, totalScore) {
  const label = correctAnswer ? 'صح ✅' : 'غلط ❌';
  return [
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬',
    '🎉 *إجـابـة صـحـيـحـة!*',
    '',
    `> ${nameTag} جاوب صح (${label})`,
    `⭐ مجموع نقاطك: ${totalScore}`,
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬'
  ].join('\n');
}

function tfTimeoutBanner(correctAnswer) {
  const label = correctAnswer ? 'صح ✅' : 'غلط ❌';
  return [
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬',
    '⏱️ *خـلـص الـوقـت، محدا جاوب صح*',
    '',
    `الجواب الصحيح كان: ${label}`,
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬'
  ].join('\n');
}

module.exports = {
  TF_TIMEOUT_MS,
  pendingTF,
  addPoint,
  pickQuestion,
  normalizeTFAnswer,
  tfBanner,
  tfWinnerBanner,
  tfTimeoutBanner
};

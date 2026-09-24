// ============ !مثل - تكملة المثل الشعبي ============

const fs = require('fs');
const path = require('path');
const { normalizeArabicText } = require('./arabic-utils');

const PROVERB_TIMEOUT_MS = 30000; // 30 ثانية

// كل عنصر: بداية المثل (تظهر للاعبين) والتكملة الصحيحة
const PROVERB_SETS = [
  { start: 'الصبر مفتاح', answer: 'الفرج' },
  { start: 'اللي فات', answer: 'مات' },
  { start: 'رب ضارة', answer: 'نافعة' },
  { start: 'دام الحال ما', answer: 'زال' },
  { start: 'الطيور على أشكالها', answer: 'تقع' },
  { start: 'من جد', answer: 'وجد' },
  { start: 'العقل زينة', answer: 'والأدب كنز' },
  { start: 'القناعة كنز', answer: 'لا يفنى' },
  { start: 'خير الكلام ما', answer: 'قل ودل' },
  { start: 'يد وحدة', answer: 'ما تصفق' }
];

// chatId -> { set, timer }
const pendingProverb = new Map();

function scoresFilePath(persistDir) {
  return path.join(persistDir, 'games-proverb-scores.json');
}

function readScores(persistDir) {
  try {
    return JSON.parse(fs.readFileSync(scoresFilePath(persistDir), 'utf8'));
  } catch (err) {
    return {};
  }
}

function writeScores(persistDir, scores) {
  try {
    fs.writeFileSync(scoresFilePath(persistDir), JSON.stringify(scores, null, 2), 'utf8');
  } catch (err) {
    console.error('خطأ بحفظ نقاط لعبة مثل:', err.message);
  }
}

function addPoint(persistDir, number) {
  const scores = readScores(persistDir);
  scores[number] = (scores[number] || 0) + 1;
  writeScores(persistDir, scores);
  return scores[number];
}

function pickSet() {
  return PROVERB_SETS[Math.floor(Math.random() * PROVERB_SETS.length)];
}

function checkProverbAnswer(text, answer) {
  const clean = normalizeArabicText(text);
  const normAnswer = normalizeArabicText(answer);
  return clean.length > 0 && (clean === normAnswer || clean.includes(normAnswer));
}

function proverbBanner(set) {
  return [
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬',
    '📜 *كـمّـل الـمـثـل!*',
    '',
    `"${set.start} ...؟"`,
    '',
    'اكتب باقي المثل',
    '⏱️ عندكم 30 ثانية',
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬'
  ].join('\n');
}

function proverbWinnerBanner(nameTag, set, totalScore) {
  return [
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬',
    '🎉 *كـمّـلـهـا صـح!*',
    '',
    `> ${nameTag} عرف: "${set.start} ${set.answer}" ✅`,
    `⭐ مجموع نقاطك: ${totalScore}`,
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬'
  ].join('\n');
}

function proverbTimeoutBanner(set) {
  return [
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬',
    '⏱️ *خـلـص الـوقـت، محدا كملها*',
    '',
    `المثل: "${set.start} ${set.answer}" 📜`,
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬'
  ].join('\n');
}

module.exports = {
  PROVERB_TIMEOUT_MS,
  pendingProverb,
  addPoint,
  pickSet,
  checkProverbAnswer,
  proverbBanner,
  proverbWinnerBanner,
  proverbTimeoutBanner
};

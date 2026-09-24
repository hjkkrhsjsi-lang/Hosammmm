// ============ !كنز - الغميضة الرقمية (كلمة سر بتلميح) ============

const fs = require('fs');
const path = require('path');
const { normalizeArabicText } = require('./arabic-utils');

const TREASURE_TIMEOUT_MS = 90000; // دقيقة ونص

// كل عنصر: الكلمة السرية والتلميح
const TREASURE_SETS = [
  { secret: 'حب', hint: 'كلمة بتتكرر كتير بالأفلام الرومانسية' },
  { secret: 'شمس', hint: 'بتطلع كل صبح وبتغيب كل مغرب' },
  { secret: 'قهوة', hint: 'أكتر مشروب الناس بتصحى عليه الصبح' },
  { secret: 'سفر', hint: 'أكتر شي الناس بتحلم فيه وقت الإجازات' },
  { secret: 'صداقة', hint: 'أثمن شي بين الأصحاب' },
  { secret: 'موسيقى', hint: 'بتخلي المزاج يتغير بثواني' },
  { secret: 'بحر', hint: 'أزرق وكبير وفيه ملح' },
  { secret: 'كتاب', hint: 'صديقك وقت الملل، فيه صفحات وحروف' },
  { secret: 'وقت', hint: 'أغلى شي عند الإنسان وما بيرجع' },
  { secret: 'ابتسامة', hint: 'أرخص هدية بس أغلى أثر' }
];

// chatId -> { set, timer }
const pendingTreasure = new Map();

function scoresFilePath(persistDir) {
  return path.join(persistDir, 'games-treasure-scores.json');
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
    console.error('خطأ بحفظ نقاط لعبة كنز:', err.message);
  }
}

// جايزة الكنز أكبر من الألعاب العادية (لعبة أطول وأصعب)
function addPoints(persistDir, number, amount) {
  const scores = readScores(persistDir);
  scores[number] = (scores[number] || 0) + amount;
  writeScores(persistDir, scores);
  return scores[number];
}

function pickSet() {
  return TREASURE_SETS[Math.floor(Math.random() * TREASURE_SETS.length)];
}

function checkTreasureAnswer(text, secret) {
  const clean = normalizeArabicText(text);
  return clean.length > 0 && clean === normalizeArabicText(secret);
}

function treasureBanner(set) {
  return [
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬',
    '💎 *الـغـمـيـضـة الـرقـمـيـة!*',
    '',
    'خبيت كنز اليوم بمكان ما بهالجروب...',
    `🔍 تلميح: "${set.hint}"`,
    '',
    'اكتب تخمينك عادي بالشات',
    '⏱️ عندكم دقيقة ونص',
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬'
  ].join('\n');
}

function treasureWinnerBanner(nameTag, secret, totalScore) {
  return [
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬',
    '💎 *لـقـى الـكـنـز!*',
    '',
    `> ${nameTag} لقى الكلمة: "${secret}" ✅`,
    `⭐ مجموع نقاطك: ${totalScore}`,
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬'
  ].join('\n');
}

function treasureTimeoutBanner(secret) {
  return [
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬',
    '😢 *مـحـدا لـقـى الـكـنـز الـيـوم*',
    '',
    `الكلمة كانت: "${secret}" 💎`,
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬'
  ].join('\n');
}

module.exports = {
  TREASURE_TIMEOUT_MS,
  pendingTreasure,
  addPoints,
  pickSet,
  checkTreasureAnswer,
  treasureBanner,
  treasureWinnerBanner,
  treasureTimeoutBanner
};

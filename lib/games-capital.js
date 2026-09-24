// ============ !عاصمة - احزر العاصمة ============

const fs = require('fs');
const path = require('path');
const { normalizeArabicText } = require('./arabic-utils');

const CAPITAL_TIMEOUT_MS = 20000; // 20 ثانية

// كل عنصر: اسم الدولة والعاصمة الصحيحة
const CAPITAL_SETS = [
  { country: 'مصر', capital: 'القاهرة' },
  { country: 'السعودية', capital: 'الرياض' },
  { country: 'الأردن', capital: 'عمان' },
  { country: 'العراق', capital: 'بغداد' },
  { country: 'سوريا', capital: 'دمشق' },
  { country: 'لبنان', capital: 'بيروت' },
  { country: 'المغرب', capital: 'الرباط' },
  { country: 'الجزائر', capital: 'الجزائر' },
  { country: 'تونس', capital: 'تونس' },
  { country: 'ليبيا', capital: 'طرابلس' },
  { country: 'اليمن', capital: 'صنعاء' },
  { country: 'قطر', capital: 'الدوحة' },
  { country: 'الكويت', capital: 'الكويت' },
  { country: 'الإمارات', capital: 'أبوظبي' },
  { country: 'عمان', capital: 'مسقط' },
  { country: 'تركيا', capital: 'أنقرة' },
  { country: 'فرنسا', capital: 'باريس' },
  { country: 'اليابان', capital: 'طوكيو' },
  { country: 'إسبانيا', capital: 'مدريد' },
  { country: 'ألمانيا', capital: 'برلين' }
];

// chatId -> { set, timer }
const pendingCapital = new Map();

function scoresFilePath(persistDir) {
  return path.join(persistDir, 'games-capital-scores.json');
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
    console.error('خطأ بحفظ نقاط لعبة عاصمة:', err.message);
  }
}

function addPoint(persistDir, number) {
  const scores = readScores(persistDir);
  scores[number] = (scores[number] || 0) + 1;
  writeScores(persistDir, scores);
  return scores[number];
}

function pickSet() {
  return CAPITAL_SETS[Math.floor(Math.random() * CAPITAL_SETS.length)];
}

function checkCapitalAnswer(text, capital) {
  const clean = normalizeArabicText(text);
  return clean.length > 0 && clean === normalizeArabicText(capital);
}

function capitalBanner(set) {
  return [
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬',
    '🌍 *احـزر الـعـاصـمـة!*',
    '',
    `👉 وش عاصمة "${set.country}"؟`,
    '',
    '⏱️ عندكم 20 ثانية',
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬'
  ].join('\n');
}

function capitalWinnerBanner(nameTag, set, totalScore) {
  return [
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬',
    '🎉 *جـاوب صـح!*',
    '',
    `> ${nameTag} عرف إن عاصمة ${set.country} هي "${set.capital}" ✅`,
    `⭐ مجموع نقاطك: ${totalScore}`,
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬'
  ].join('\n');
}

function capitalTimeoutBanner(set) {
  return [
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬',
    '⏱️ *خـلـص الـوقـت، محدا عرفها*',
    '',
    `عاصمة ${set.country} هي: "${set.capital}" 🌍`,
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬'
  ].join('\n');
}

module.exports = {
  CAPITAL_TIMEOUT_MS,
  pendingCapital,
  addPoint,
  pickSet,
  checkCapitalAnswer,
  capitalBanner,
  capitalWinnerBanner,
  capitalTimeoutBanner
};

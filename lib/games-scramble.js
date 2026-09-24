// ============ !حروف - أسرع واحد (رتب الحروف المبعثرة) ============

const fs = require('fs');
const path = require('path');
const { normalizeArabicText } = require('./arabic-utils');

const SCRAMBLE_TIMEOUT_MS = 30000; // 30 ثانية

const SCRAMBLE_WORDS = [
  'قهوة', 'مدرسة', 'سيارة', 'حاسوب', 'هاتف', 'مفتاح',
  'شمس', 'قمر', 'كرسي', 'نافذة', 'حديقة', 'مكتبة',
  'طائرة', 'دراجة', 'ساعة', 'صديق'
];

// chatId -> { word, scrambled, timer }
const pendingScramble = new Map();

function scoresFilePath(persistDir) {
  return path.join(persistDir, 'games-scramble-scores.json');
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
    console.error('خطأ بحفظ نقاط لعبة حروف:', err.message);
  }
}

function addPoint(persistDir, number) {
  const scores = readScores(persistDir);
  scores[number] = (scores[number] || 0) + 1;
  writeScores(persistDir, scores);
  return scores[number];
}

function scrambleWord(word) {
  const letters = word.split('');
  let scrambled = word;
  let attempts = 0;
  while (scrambled === word && attempts < 10) {
    for (let i = letters.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [letters[i], letters[j]] = [letters[j], letters[i]];
    }
    scrambled = letters.join('');
    attempts++;
  }
  return scrambled;
}

function pickSet() {
  const word = SCRAMBLE_WORDS[Math.floor(Math.random() * SCRAMBLE_WORDS.length)];
  return { word, scrambled: scrambleWord(word) };
}

function checkScrambleAnswer(text, word) {
  const clean = normalizeArabicText(text);
  return clean.length > 0 && clean === normalizeArabicText(word);
}

function scrambleBanner(set) {
  return [
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬',
    '🔤 *أسـرع واحـد!*',
    '',
    'رتب الحروف وكوّن الكلمة الصحيحة:',
    `👉 ${set.scrambled.split('').join(' - ')}`,
    '',
    '⏱️ عندكم 30 ثانية',
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬'
  ].join('\n');
}

function scrambleWinnerBanner(nameTag, word, totalScore) {
  return [
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬',
    '🎉 *رتـبـهـا صـح!*',
    '',
    `> ${nameTag} عرف الكلمة: "${word}" ✅`,
    `⭐ مجموع نقاطك: ${totalScore}`,
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬'
  ].join('\n');
}

function scrambleTimeoutBanner(word) {
  return [
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬',
    '⏱️ *خـلـص الـوقـت، محدا رتبها*',
    '',
    `الكلمة كانت: "${word}" 🔤`,
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬'
  ].join('\n');
}

module.exports = {
  SCRAMBLE_TIMEOUT_MS,
  pendingScramble,
  addPoint,
  pickSet,
  checkScrambleAnswer,
  scrambleBanner,
  scrambleWinnerBanner,
  scrambleTimeoutBanner
};

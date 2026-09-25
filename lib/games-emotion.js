// ============ !شعور - احزر المشاعر من إيموجي واحد ============

const fs = require('fs');
const path = require('path');
const { normalizeArabicText } = require('./arabic-utils');

const EMOTION_TIMEOUT_MS = 25000; // 25 ثانية

// كل عنصر: إيموجي وقائمة إجابات مقبولة (بأشكال مختلفة)
const EMOTION_SETS = [
  { emoji: '😭', answers: ['حزن', 'بكاء', 'زعل', 'حزين'] },
  { emoji: '😡', answers: ['غضب', 'زعل', 'عصبية', 'غاضب'] },
  { emoji: '😴', answers: ['نوم', 'تعب', 'نعسان', 'نعس'] },
  { emoji: '😱', answers: ['خوف', 'صدمة', 'رعب', 'خايف'] },
  { emoji: '🥳', answers: ['فرح', 'احتفال', 'سعادة', 'فرحان'] },
  { emoji: '😍', answers: ['حب', 'إعجاب', 'اعجاب', 'عشق'] },
  { emoji: '🤢', answers: ['قرف', 'اشمئزاز', 'مقرف'] },
  { emoji: '😳', answers: ['حرج', 'خجل', 'محرج'] },
  { emoji: '😤', answers: ['غيظ', 'انزعاج', 'زعل', 'غضب'] },
  { emoji: '🤩', answers: ['انبهار', 'إعجاب', 'اعجاب', 'حماس'] },
  { emoji: '😂', answers: ['ضحك', 'مضحك', 'كوميدي'] },
  { emoji: '🥺', answers: ['توسل', 'استعطاف', 'حزن', 'شفقة'] }
];

// chatId -> { set, timer }
const pendingEmotion = new Map();

function scoresFilePath(persistDir) {
  return path.join(persistDir, 'games-emotion-scores.json');
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
    console.error('خطأ بحفظ نقاط لعبة شعور:', err.message);
  }
}

function addPoint(persistDir, number) {
  const scores = readScores(persistDir);
  scores[number] = (scores[number] || 0) + 1;
  writeScores(persistDir, scores);
  return scores[number];
}

function pickSet() {
  return EMOTION_SETS[Math.floor(Math.random() * EMOTION_SETS.length)];
}

function checkEmotionAnswer(text, acceptedAnswers) {
  const clean = normalizeArabicText(text);
  if (!clean) return false;
  return acceptedAnswers.some((a) => {
    const normA = normalizeArabicText(a);
    return clean === normA || clean.includes(normA);
  });
}

function emotionBanner(set) {
  return [
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬',
    '🎭 *احـزر الـشـعـور!*',
    '',
    set.emoji,
    '',
    'شنو الشعور اللي بيعبر عنه هالإيموجي؟',
    '⏱️ عندكم 25 ثانية',
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬'
  ].join('\n');
}

function emotionWinnerBanner(nameTag, correctAnswer, totalScore) {
  return [
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬',
    '🎉 *جـاوب صـح!*',
    '',
    `> ${nameTag} عرف الشعور: "${correctAnswer}" ✅`,
    `⭐ مجموع نقاطك: ${totalScore}`,
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬'
  ].join('\n');
}

function emotionTimeoutBanner(correctAnswer) {
  return [
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬',
    '⏱️ *خـلـص الـوقـت، محدا عرفها*',
    '',
    `الشعور كان: "${correctAnswer}" 🎭`,
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬'
  ].join('\n');
}

module.exports = {
  EMOTION_TIMEOUT_MS,
  pendingEmotion,
  addPoint,
  pickSet,
  checkEmotionAnswer,
  emotionBanner,
  emotionWinnerBanner,
  emotionTimeoutBanner
};

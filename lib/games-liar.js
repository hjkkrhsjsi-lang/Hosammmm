// ============ !كذبة - من فينا الكاذب (٣ معلومات، وحدة كذب) ============

const fs = require('fs');
const path = require('path');
const { normalizeArabicText } = require('./arabic-utils');

const LIAR_TIMEOUT_MS = 30000; // 30 ثانية

// كل عنصر: 3 معلومات (statements) ورقم الكذبة (lieIndex من 1 إلى 3)
const LIAR_SETS = [
  { statements: ['الزرافة نايمة ساعتين بس باليوم', 'القطط بتنام أكتر من 12 ساعة باليوم', 'الفيل ما بينام واقف أبداً'], lieIndex: 3 },
  { statements: ['العسل ما بيخرب أبداً حتى بعد آلاف السنين', 'الموز نوع من التوت علمياً', 'البطيخ فيه بذور أكتر من أي فاكهة تانية'], lieIndex: 3 },
  { statements: ['اليابان فيها أكتر من 6000 جزيرة', 'روسيا أكبر دولة بالعالم من ناحية المساحة', 'كندا أكبر دولة بالعالم من ناحية المساحة'], lieIndex: 3 },
  { statements: ['قلب الحوت الأزرق بحجم سيارة صغيرة', 'الأخطبوط عنده 3 قلوب', 'الأخطبوط عنده قلب واحد بس'], lieIndex: 3 },
  { statements: ['برج إيفل بيطول شوي بالصيف بسبب الحرارة', 'مصر فيها أكتر من هرم واحد', 'الهرم الأكبر بمصر اتبنى بـ10 سنين بس'], lieIndex: 3 },
  { statements: ['الموناليزا مرسومة بألوان زيتية', 'اللوحة موجودة بمتحف اللوفر بباريس', 'اللوحة رسمها مايكل أنجلو'], lieIndex: 3 },
  { statements: ['الضوء أسرع من الصوت', 'الصوت بينتقل بالفضاء زي الأرض بالظبط', 'الصوت ما بينتقل بالفضاء لعدم وجود هواء'], lieIndex: 2 },
  { statements: ['السعودية أكبر دولة عربية من ناحية المساحة', 'الجزائر أكبر دولة عربية من ناحية المساحة', 'الجزائر أكبر دولة بأفريقيا من ناحية المساحة'], lieIndex: 1 }
];

// chatId -> { set, askedBy, timer }
const pendingLiar = new Map();

function scoresFilePath(persistDir) {
  return path.join(persistDir, 'games-liar-scores.json');
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
    console.error('خطأ بحفظ نقاط لعبة كذبة:', err.message);
  }
}

function addPoint(persistDir, number) {
  const scores = readScores(persistDir);
  scores[number] = (scores[number] || 0) + 1;
  writeScores(persistDir, scores);
  return scores[number];
}

function pickSet() {
  return LIAR_SETS[Math.floor(Math.random() * LIAR_SETS.length)];
}

// بيحول جواب المستخدم النصي لرقم (1/2/3) أو null لو ما فهم
function normalizeLiarAnswer(text) {
  const clean = normalizeArabicText(text);
  if (['1', '١', 'واحد', 'الاولي', 'الاولى'].includes(clean)) return 1;
  if (['2', '٢', 'اتنين', 'الثانيه', 'التانيه'].includes(clean)) return 2;
  if (['3', '٣', 'تلاته', 'ثلاثه', 'الثالثه', 'التالته'].includes(clean)) return 3;
  return null;
}

function liarBanner(set) {
  return [
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬',
    '🎭 *مـن فـيـنـا الـكـاذب؟*',
    '',
    'وحدة من هالـ3 معلومات كذب، لاقوها:',
    '',
    `1️⃣ ${set.statements[0]}`,
    `2️⃣ ${set.statements[1]}`,
    `3️⃣ ${set.statements[2]}`,
    '',
    'جاوب برقم الكذبة (1 أو 2 أو 3)',
    '⏱️ عندكم 30 ثانية',
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬'
  ].join('\n');
}

function liarWinnerBanner(nameTag, lieIndex, totalScore) {
  return [
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬',
    '🎉 *لـقـى الـكـذبـة!*',
    '',
    `> ${nameTag} عرف إن رقم ${lieIndex} هي الكذبة ✅`,
    `⭐ مجموع نقاطك: ${totalScore}`,
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬'
  ].join('\n');
}

function liarTimeoutBanner(lieIndex) {
  return [
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬',
    '⏱️ *خـلـص الـوقـت، محدا لقاها*',
    '',
    `الكذبة كانت رقم ${lieIndex} 🎭`,
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬'
  ].join('\n');
}

module.exports = {
  LIAR_TIMEOUT_MS,
  pendingLiar,
  addPoint,
  pickSet,
  normalizeLiarAnswer,
  liarBanner,
  liarWinnerBanner,
  liarTimeoutBanner
};

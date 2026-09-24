// ============ !سباق - سباق سرعة كتابة (يكتب الجملة بالظبط بأسرع وقت) ============

const RACE_TIMEOUT_MS = 30000; // 30 ثانية

const SENTENCES = [
  'البوت الأسرع بالحي كله',
  'الصبر مفتاح الفرج',
  'كل يوم بخير يا جماعة',
  'الوقت كالسيف إن لم تقطعه قطعك',
  'اللي يزرع خير يحصد خير',
  'حياتك بايدك اصنعها بنفسك',
  'التعاون أساس النجاح',
  'ابتسامتك تفرق مع غيرك',
  'العلم نور والجهل ظلام',
  'خطوة اليوم أحسن من ندم بكرة'
];

// chatId -> { sentence, startedAt, timer }
const pendingRaces = new Map();

function normalizeText(text) {
  return (text || '').trim().replace(/\s+/g, ' ');
}

function pickSentence() {
  return SENTENCES[Math.floor(Math.random() * SENTENCES.length)];
}

function raceBanner(sentence) {
  return [
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬',
    '⌨️ *سـبـاق سـرعـة الـكـتـابـة!*',
    '',
    'اكتب الجملة هاي بالظبط، أول واحد يفوز 👇',
    '',
    `📝 ${sentence}`,
    '',
    '⏱️ عندكم 30 ثانية',
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬'
  ].join('\n');
}

function raceWinnerBanner(nameTag, ms) {
  const seconds = (ms / 1000).toFixed(1);
  return [
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬',
    '🏆 *فـاز بـالـسـبـاق:*',
    '',
    `> ${nameTag} كتبها بـ ${seconds} ثانية ⚡`,
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬'
  ].join('\n');
}

function raceTimeoutBanner(sentence) {
  return [
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬',
    '⏱️ *خـلـص الـوقـت، محدا فاز*',
    '',
    `الجملة كانت: ${sentence}`,
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬'
  ].join('\n');
}

module.exports = {
  RACE_TIMEOUT_MS,
  pendingRaces,
  normalizeText,
  pickSentence,
  raceBanner,
  raceWinnerBanner,
  raceTimeoutBanner
};

// ============ !فرق - لاقي الفرق بين القائمتين ============

const { normalizeArabicText } = require('./arabic-utils');

const DIFF_TIMEOUT_MS = 30000; // 30 ثانية

// كل عنصر: قائمة قبل، قائمة بعد (فرق عنصر واحد بس)، والجواب الصحيح (العنصر الجديد)
const DIFF_SETS = [
  {
    before: ['تفاح 🍎', 'موز 🍌', 'برتقال 🍊', 'عنب 🍇', 'فراولة 🍓'],
    after: ['تفاح 🍎', 'موز 🍌', 'برتقال 🍊', 'عنب 🍇', 'أناناس 🍍'],
    answer: 'أناناس'
  },
  {
    before: ['قطة 🐱', 'كلب 🐶', 'أرنب 🐰', 'حصان 🐴', 'دجاجة 🐔'],
    after: ['قطة 🐱', 'كلب 🐶', 'أرنب 🐰', 'حصان 🐴', 'بطة 🦆'],
    answer: 'بطة'
  },
  {
    before: ['أحمر 🔴', 'أزرق 🔵', 'أصفر 🟡', 'أخضر 🟢', 'بنفسجي 🟣'],
    after: ['أحمر 🔴', 'أزرق 🔵', 'أصفر 🟡', 'أخضر 🟢', 'برتقالي 🟠'],
    answer: 'برتقالي'
  },
  {
    before: ['مصر 🇪🇬', 'الأردن 🇯🇴', 'السعودية 🇸🇦', 'ليبيا 🇱🇾', 'الجزائر 🇩🇿'],
    after: ['مصر 🇪🇬', 'الأردن 🇯🇴', 'قطر 🇶🇦', 'ليبيا 🇱🇾', 'الجزائر 🇩🇿'],
    answer: 'قطر'
  },
  {
    before: ['كرة قدم ⚽', 'كرة سلة 🏀', 'تنس 🎾', 'كرة طائرة 🏐', 'بيسبول ⚾'],
    after: ['كرة قدم ⚽', 'كرة سلة 🏀', 'تنس 🎾', 'بولينج 🎳', 'بيسبول ⚾'],
    answer: 'بولينج'
  },
  {
    before: ['شمس ☀️', 'قمر 🌙', 'نجمة ⭐', 'سحابة ☁️', 'قوس قزح 🌈'],
    after: ['شمس ☀️', 'قمر 🌙', 'نجمة ⭐', 'برق ⚡', 'قوس قزح 🌈'],
    answer: 'برق'
  }
];

// chatId -> { set, askedBy, timer }
const pendingDiff = new Map();

function pickSet() {
  return DIFF_SETS[Math.floor(Math.random() * DIFF_SETS.length)];
}

// بيتحقق لو النص فيه اسم العنصر الجديد (تطابق مرن، مش لازم يكون مطابقة تامة)
function checkDiffAnswer(text, correctAnswer) {
  const clean = normalizeArabicText(text);
  return clean.length > 0 && clean.includes(normalizeArabicText(correctAnswer));
}

function diffBanner(set) {
  return [
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬',
    '🔍 *لاقـي الـفـرق!*',
    '',
    '📋 القائمة الأولى:',
    set.before.join(' - '),
    '',
    '📋 القائمة الثانية:',
    set.after.join(' - '),
    '',
    'شنو العنصر الجديد اللي دخل بالقائمة التانية؟',
    '⏱️ عندكم 30 ثانية',
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬'
  ].join('\n');
}

function diffWinnerBanner(nameTag, correctAnswer) {
  return [
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬',
    '🎉 *لـقـى الـفـرق!*',
    '',
    `> ${nameTag} عرف إن الفرق هو "${correctAnswer}" ✅`,
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬'
  ].join('\n');
}

function diffTimeoutBanner(correctAnswer) {
  return [
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬',
    '⏱️ *خـلـص الـوقـت، محدا لاقاه*',
    '',
    `الفرق كان: "${correctAnswer}" 🔍`,
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬'
  ].join('\n');
}

module.exports = {
  DIFF_TIMEOUT_MS,
  pendingDiff,
  pickSet,
  checkDiffAnswer,
  diffBanner,
  diffWinnerBanner,
  diffTimeoutBanner
};

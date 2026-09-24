// ============ !ستايل - تحويل نص لأشكال مزخرفة ============

function buildLatinMap(upperStart, lowerStart, digitStart) {
  const map = {};
  for (let i = 0; i < 26; i++) {
    map[String.fromCharCode(65 + i)] = String.fromCodePoint(upperStart + i);
    map[String.fromCharCode(97 + i)] = String.fromCodePoint(lowerStart + i);
  }
  if (digitStart !== null) {
    for (let i = 0; i < 10; i++) {
      map[String.fromCharCode(48 + i)] = String.fromCodePoint(digitStart + i);
    }
  }
  return map;
}

const BOLD_MAP = buildLatinMap(0x1d400, 0x1d41a, 0x1d7ce);
const FULLWIDTH_MAP = buildLatinMap(0xff21, 0xff41, 0xff10);
FULLWIDTH_MAP[' '] = '　';

// دائرية (bubble) - حروف كبيرة وصغيرة لهم رمز واحد، والأرقام أرقام محاطة بدائرة
const BUBBLE_MAP = (() => {
  const map = {};
  for (let i = 0; i < 26; i++) {
    map[String.fromCharCode(65 + i)] = String.fromCodePoint(0x24b6 + i);
    map[String.fromCharCode(97 + i)] = String.fromCodePoint(0x24d0 + i);
  }
  map['0'] = '⓪';
  for (let i = 1; i <= 9; i++) map[String.fromCharCode(48 + i)] = String.fromCodePoint(0x2460 + (i - 1));
  return map;
})();

function applyMap(text, map) {
  return text.split('').map((ch) => map[ch] || ch).join('');
}

// نفس ستايل بانرات البوت (الـمـجـمـوعـة) - تطويل بعد كل حرف عربي
function tatweelStyle(text) {
  const chars = [...text];
  return chars.map((ch, i) => {
    if (ch === ' ' || i === chars.length - 1) return ch;
    return ch + 'ـ';
  }).join('');
}

function getStyledVariants(text) {
  return {
    tatweel: tatweelStyle(text),
    bold: applyMap(text, BOLD_MAP),
    bubble: applyMap(text, BUBBLE_MAP),
    fullwidth: applyMap(text, FULLWIDTH_MAP)
  };
}

function styleBanner(text) {
  const v = getStyledVariants(text);
  // لو النص فيه حروف/أرقام لاتينية، أشكال البولد/الدائرية/العريضة تشتغل صح.
  // لو عربي بحت، هالأشكال ما تتغير (يونيكود ما فيه بولد عربي)، فنستخدم أطر زخرفية بدلها.
  const hasLatin = /[A-Za-z0-9]/.test(text);

  const lines = hasLatin
    ? [`1️⃣ ${v.tatweel}`, `2️⃣ ${v.bold}`, `3️⃣ ${v.bubble}`, `4️⃣ ${v.fullwidth}`]
    : [`1️⃣ ${v.tatweel}`, `2️⃣ 『 ${text} 』`, `3️⃣ ◈ ${text} ◈`, `4️⃣ ✦ ${text} ✦`];

  return [
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬',
    '🎨 *أشكال الكتابة:*',
    '',
    ...lines,
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬'
  ].join('\n');
}

module.exports = {
  getStyledVariants,
  styleBanner
};

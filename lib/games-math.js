// ============ !حساب - رياضيات سريعة ============

const fs = require('fs');
const path = require('path');

const MATH_TIMEOUT_MS = 15000; // 15 ثانية بس - لازم تكون سريع

// chatId -> { problem, timer }
const pendingMath = new Map();

function scoresFilePath(persistDir) {
  return path.join(persistDir, 'games-math-scores.json');
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
    console.error('خطأ بحفظ نقاط لعبة حساب:', err.message);
  }
}

function addPoint(persistDir, number) {
  const scores = readScores(persistDir);
  scores[number] = (scores[number] || 0) + 1;
  writeScores(persistDir, scores);
  return scores[number];
}

// بيولد مسألة عشوائية (جمع، طرح، أو ضرب)
function pickSet() {
  const ops = ['+', '-', '×'];
  const op = ops[Math.floor(Math.random() * ops.length)];
  let a, b, answer;

  if (op === '×') {
    a = Math.floor(Math.random() * 12) + 1;
    b = Math.floor(Math.random() * 12) + 1;
    answer = a * b;
  } else {
    a = Math.floor(Math.random() * 50) + 1;
    b = Math.floor(Math.random() * 50) + 1;
    if (op === '-' && b > a) [a, b] = [b, a]; // نتيجة سالبة
    answer = op === '+' ? a + b : a - b;
  }

  return { a, b, op, answer };
}

// يحول الأرقام العربية لإنجليزية ويطلع أول رقم بالنص
function checkMathAnswer(text, correctAnswer) {
  if (!text) return false;
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
  const converted = text.replace(/[٠-٩]/g, (d) => String(arabicDigits.indexOf(d)));
  const match = converted.match(/-?\d+/);
  if (!match) return false;
  return parseInt(match[0], 10) === correctAnswer;
}

function mathBanner(problem) {
  return [
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬',
    '🧮 *ريـاضـيـات سـريـعـة!*',
    '',
    `👉 ${problem.a} ${problem.op} ${problem.b} = ؟`,
    '',
    'أول واحد يجاوب صح يفوز',
    '⏱️ عندكم 15 ثانية بس!',
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬'
  ].join('\n');
}

function mathWinnerBanner(nameTag, problem, totalScore) {
  return [
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬',
    '🎉 *جـاوب صـح!*',
    '',
    `> ${nameTag} عرف إن الجواب ${problem.answer} ✅`,
    `⭐ مجموع نقاطك: ${totalScore}`,
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬'
  ].join('\n');
}

function mathTimeoutBanner(problem) {
  return [
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬',
    '⏱️ *خـلـص الـوقـت، محدا جاوب*',
    '',
    `الجواب كان: ${problem.answer} 🧮`,
    '⌬──══─┈•⤣⚡⤤•┈─══──⌬'
  ].join('\n');
}

module.exports = {
  MATH_TIMEOUT_MS,
  pendingMath,
  addPoint,
  pickSet,
  checkMathAnswer,
  mathBanner,
  mathWinnerBanner,
  mathTimeoutBanner
};

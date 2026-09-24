// ============ مسجل رسايل (لأغراض !اقتباس و!تحليل_شخصية) ============
// تحديث: بعد طلب المستخدم، صرنا نحفظ الأرشيف بملف على القرص (persistDir) عشان
// ما يضيعش مع كل ريستارت للبوت. لسا فيه حد أقصى لعدد الرسايل المحفوظة لكل عضو
// (MAX_PER_CONVO) ولعدد المحادثات المتتبّعة (MAX_TRACKED_CONVOS) عشان الملف ما يكبرش بلا حدود.

const fs = require('fs');
const path = require('path');

const MAX_PER_CONVO = 150; // آخر 150 رسالة لكل عضو بكل جروب
const MAX_TRACKED_CONVOS = 500;

// المفتاح: `${chatId}_${number}` ، القيمة: [{ text, ts }, ...]
const chatLogs = new Map();

let loadedLogPath = null; // آخر مسار ملف تم تحميله فيه الأرشيف (عشان ما نعيد التحميل كل مرة)

function getLogFilePath(persistDir) {
  return path.join(persistDir, 'message-logs.json');
}

function ensureLoaded(persistDir) {
  const filePath = getLogFilePath(persistDir);
  if (loadedLogPath === filePath) return; // محمّل مسبقاً بنفس المسار

  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      chatLogs.clear();
      for (const [key, arr] of Object.entries(parsed)) {
        chatLogs.set(key, arr);
      }
    }
  } catch (err) {
    console.error('خطأ بتحميل أرشيف الرسايل من القرص:', err.message);
  }
  loadedLogPath = filePath;
}

function saveToDisk(persistDir) {
  try {
    const filePath = getLogFilePath(persistDir);
    const obj = Object.fromEntries(chatLogs);
    fs.writeFileSync(filePath, JSON.stringify(obj));
  } catch (err) {
    console.error('خطأ بحفظ أرشيف الرسايل على القرص:', err.message);
  }
}

function logMessage(persistDir, chatId, number, text) {
  if (!chatId || !number || !text) return;
  ensureLoaded(persistDir);

  const key = `${chatId}_${number}`;
  if (!chatLogs.has(key)) {
    chatLogs.set(key, []);
    if (chatLogs.size > MAX_TRACKED_CONVOS) {
      const oldestKey = chatLogs.keys().next().value;
      chatLogs.delete(oldestKey);
    }
  }
  const arr = chatLogs.get(key);
  arr.push({ text, ts: Date.now() });
  while (arr.length > MAX_PER_CONVO) arr.shift();

  saveToDisk(persistDir);
}

function getMessages(persistDir, chatId, number) {
  ensureLoaded(persistDir);
  return chatLogs.get(`${chatId}_${number}`) || [];
}

function getRandomMessage(persistDir, chatId, number) {
  const arr = getMessages(persistDir, chatId, number);
  if (arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

module.exports = {
  logMessage,
  getMessages,
  getRandomMessage
};

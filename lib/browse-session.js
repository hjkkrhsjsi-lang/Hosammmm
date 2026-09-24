// ============ browse-session.js ============
// جلسة تصفح بسيطة: يخزن نتائج البحث لكل شات، وتقدر تتنقل
// بينها بأمر !تالي. تستخدمها !بن و!تك.

// chatId -> { type: 'pinterest'|'tiktok', results: [...], index: 0 }
const sessions = new Map();

function startSession(chatId, type, results) {
  sessions.set(chatId, { type, results, index: 0 });
}

function getSession(chatId) {
  return sessions.get(chatId);
}

function endSession(chatId) {
  sessions.delete(chatId);
}

function advance(chatId) {
  const s = sessions.get(chatId);
  if (!s) return null;
  s.index += 1;
  if (s.index >= s.results.length) {
    sessions.delete(chatId);
    return 'END';
  }
  return s;
}

module.exports = { startSession, getSession, endSession, advance };

// ============ نظام منع الروابط (قابل للتفعيل/التعطيل لكل جروب) + تتبع المخالفات ============
// نفس المنطق والنصوص بالضبط من index.js القديم (تخزين JSON عادي، ما كانش يعتمد على
// whatsapp-web.js أصلاً إلا بجزء الطرد اللي بيصير من نفس دالة punishProfanity/الراوتر).

const fs = require('fs');
const path = require('path');

// نمط يكشف أي رابط: http/https، www.، دومينات شائعة، وروابط دعوة واتساب
const LINK_REGEX = /(https?:\/\/|www\.)\S+|chat\.whatsapp\.com\/\S+|\b[a-zA-Z0-9-]+\.(com|net|org|io|me|co|ly|gg|tv|xyz|app|link)\b/i;

function groupSettingsFilePath(persistDir) {
  return path.join(persistDir, 'data', 'groupSettings.json');
}

function loadGroupSettings(persistDir) {
  try {
    const file = groupSettingsFilePath(persistDir);
    if (!fs.existsSync(file)) return {};
    return JSON.parse(fs.readFileSync(file, 'utf8') || '{}');
  } catch (err) {
    console.error('خطأ بقراءة إعدادات الجروب:', err.message);
    return {};
  }
}

function saveGroupSettings(persistDir, settings) {
  try {
    const file = groupSettingsFilePath(persistDir);
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(settings, null, 2), 'utf8');
  } catch (err) {
    console.error('خطأ بحفظ إعدادات الجروب:', err.message);
  }
}

function isLinksBlockEnabled(persistDir, chatId) {
  const settings = loadGroupSettings(persistDir);
  return !!(settings[chatId] && settings[chatId].blockLinks);
}

function setLinksBlockEnabled(persistDir, chatId, enabled) {
  const settings = loadGroupSettings(persistDir);
  if (!settings[chatId]) settings[chatId] = {};
  settings[chatId].blockLinks = enabled;
  saveGroupSettings(persistDir, settings);
}

function linksBanner(enabled, actorTag) {
  if (enabled) {
    return [
      '╔═══ ✦『 🛡️ 𝙇𝙄𝙉𝙆 𝙂𝙐𝘼𝙍𝘿 』✦ ═══╗',
      '║',
      '║ *🔒 تــم تــفــعــيــل مــنــع الــروابــط*',
      '║',
      '║ *⚡ الــحــالــة : مــفــعــل*',
      '║ *🛡️ الــحــمــايــة : مــســتــمــرة*',
      `║ *👤 بــواســطــة :* ${actorTag || '؟'}`,
      '║',
      '╚════════════════════╝',
      '',
      '> *ᴘᴏᴡᴇʀᴇᴅ:* 🤖 𝗧𝗢𝗝𝗜 𝗕𝗢𝗧 𖤍*'
    ].join('\n');
  }
  return [
    '╔═══ ✦『 🔓 𝙇𝙄𝙉𝙆 𝙂𝙐𝘼𝙍𝘿 』✦ ═══╗',
    '║',
    '║ *🔓 تــم إلــغــاء مــنــع الــروابــط*',
    '║',
    '║ *⚡ الــحــالــة : غــيــر مــفــعــل*',
    '║ *🛡️ الــحــمــايــة : مــتــوقــفــة*',
    `║ *👤 بــواســطــة :* ${actorTag || '؟'}`,
    '║',
    '╚════════════════════╝',
    '',
    '> *ᴘᴏᴡᴇʀᴇᴅ:* 🤖 𝗧𝗢𝗝𝗜 𝗕𝗢𝗧 𖤍*'
  ].join('\n');
}

// ============ تتبع مخالفات الروابط (3 مرات = طرد تلقائي) ============
const MAX_LINK_VIOLATIONS = 3;

function linkViolationsFilePath(persistDir) {
  return path.join(persistDir, 'data', 'linkViolations.json');
}

function loadLinkViolations(persistDir) {
  try {
    const file = linkViolationsFilePath(persistDir);
    if (!fs.existsSync(file)) return [];
    return JSON.parse(fs.readFileSync(file, 'utf8') || '[]');
  } catch (err) {
    console.error('خطأ بقراءة ملف مخالفات الروابط:', err.message);
    return [];
  }
}

function saveLinkViolations(persistDir, violations) {
  try {
    const file = linkViolationsFilePath(persistDir);
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(violations, null, 2), 'utf8');
  } catch (err) {
    console.error('خطأ بحفظ ملف مخالفات الروابط:', err.message);
  }
}

function addLinkViolation(persistDir, userId, chatId) {
  const violations = loadLinkViolations(persistDir);
  let entry = violations.find((v) => v.userId === userId && v.chatId === chatId);
  if (!entry) {
    entry = { userId, chatId, count: 0 };
    violations.push(entry);
  }
  entry.count += 1;
  saveLinkViolations(persistDir, violations);
  return entry.count;
}

function resetLinkViolations(persistDir, userId, chatId) {
  const violations = loadLinkViolations(persistDir);
  const filtered = violations.filter((v) => !(v.userId === userId && v.chatId === chatId));
  saveLinkViolations(persistDir, filtered);
}

module.exports = {
  LINK_REGEX,
  isLinksBlockEnabled,
  setLinksBlockEnabled,
  linksBanner,
  MAX_LINK_VIOLATIONS,
  addLinkViolation,
  resetLinkViolations
};

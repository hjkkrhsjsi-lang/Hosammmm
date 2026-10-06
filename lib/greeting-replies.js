'use strict';

// ============================================================================
// greeting-replies.js — ردود تلقائية على التحايا العادية بالجروب
// ============================================================================
// ملف مستقل بالكامل. مالوش علاقة بالأوامر (!...) - بيشتغل بس على رسايل عادية
// بلا "!" في أولها. كل تحية لها ردود متنوعة، والبوت يختار وحدة عشوائية.
//
// router.js بينده دالة وحدة بس: getReply(body) → ترجع نص رد جاهز، أو null
// لو النص ما طابق ولا تحية معروفة.
// ============================================================================

const fs = require('fs');
const path = require('path');

// مفتاح تشغيل/إيقاف عام لهالردود. يتحفظ بملف عشان ما يرجع يشتغل بعد إعادة التشغيل.
let enabled = true;
let stateFile = null;

function init(persistDir) {
  stateFile = path.join(persistDir, 'greeting-replies.json');
  try {
    enabled = JSON.parse(fs.readFileSync(stateFile, 'utf8')).enabled !== false;
  } catch (err) {
    enabled = true;
  }
}

function setEnabled(value, persistDir) {
  enabled = !!value;
  if (persistDir) stateFile = path.join(persistDir, 'greeting-replies.json');
  if (stateFile) {
    try {
      fs.writeFileSync(stateFile, JSON.stringify({ enabled }));
    } catch (err) {
      console.error('خطأ بحفظ حالة ردود الترحيب:', err.message);
    }
  }
}

function isEnabled() {
  return enabled;
}

// ============ الردود ============

// السلام عليكم -> وعليكم السلام
const SALAM_REPLIES = [
  'وعليكم السلام ورحمة الله وبركاته يا غالي 🌹🕊️',
  'وعليكم السلام يا قلبي، نورت الجروب ✨💛',
  'وعليكم السلام ورحمة الله، حياك الله يا حبيبي 🌙🤍',
  'وعليكم السلام والرحمة، يا هلا وغلا فيك 🥰🌷',
  'وعليكم السلام يا أحلى ناس، الجروب نوّر بيك 💫🖤',
  'وعليكم السلام ورحمة الله وبركاته، تفضل يا غالي 🌹✨',
  'وعليكم السلام يا عسل، أهلاً فيك 🍯💖',
  'وعليكم السلام ورحمة الله، منوّر يا كبير 👑🌟'
];

// صباح الخير -> صباح النور
const SABAH_REPLIES = [
  'صباح النور يا قمر ☀️🌹',
  'صباح النور والسرور يا غالي 🌅💛',
  'صباح النور يا حبيبي، يومك حلو زيك 🌞🥰',
  'صباح النور والورد، الله يسعد صباحك 🌼✨',
  'صباح النور يا أحلى ناس 🌸☀️',
  'صباح النور، يومك سعيد يا كبير 🌅👑',
  'صباح النور يا عسل، بداية موفقة 🍯🌞',
  'صباح النور والفل والياسمين 🤍🌼'
];

// تصبح/تصبحو على خير -> وانت من أهل الخير
const TESBAHO_REPLIES = [
  'وإنت من أهل الخير يا غالي 🌙💫',
  'وإنت من أهل الخير يا قلبي، نوم هنيّ 😴🤍',
  'وإنت من أهل الخير، أحلام سعيدة يا حبيبي 🌌✨',
  'وإنتو من أهل الخير جميعاً، نامو قرير العين 🌜💛',
  'وإنت من أهل الخير والجنة، ليلة سعيدة 🌠🥰',
  'وإنت من أهل الخير يا عسل، بكرة يوم أحلى 🍯🌙',
  'وإنت من أهل الخير يا كبير، تصبح على خير 👑🌃',
  'وإنت من أهل الخير، الله يهنّيك بنومك 🌙😴💖'
];

// وداع عام: باي / مع السلامة / bye
const BYE_REPLIES = [
  'مع السلامة، ننتظرك ترجع 👋',
  'باي باي، خذ بالك عالطريق 🚶',
  'تمام، خذ راحتك ورجعلنا بسرعة ⏳',
  'مع السلامة يا كبير 🖤',
  'أوك، بستناك 🕒',
  'الله معاك، تعال بسرعة 🙏',
  'باي، ما تطول علينا 😅',
  'مع السلامة، الجروب رح يوحشك 🩸'
];

// برب -> تيت، الله معك
const BARB_REPLIES = [
  'تيت، الله معك 🤍👋',
  'تيت يا غالي، الله معك 🌹🙏',
  'تيت، الله معك ولا تطوّل علينا 😅💛',
  'تيت يا قلبي، الله معك وارجع بسرعة 🥺✨'
];

// باك -> ولكم باك
const BAK_REPLIES = [
  'ولكم باك 😏🔥',
  'ولكم باك، الجروب نوّر برجعتك 🥰✨',
  'ولكم باك يا غالي، اشتقنالك 🤍🌹',
  'ولكم باك يا كبير، أحلى مين ينوّر؟ 😏👑'
];

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// توحيد النص عشان المطابقة تشتغل مهما كانت طريقة الكتابة (ى/ي، أ/إ/آ، تشكيل، تطويل)
function normalize(str) {
  return String(str || '')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '') // تشكيل + تطويل
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim();
}

// 🆕 مطابقة كلمة كاملة (مو جزء من كلمة): عشان "باكستان" و"بايدن" و"الباكر" ما تنحسب "باك" و"باي".
// يسمح بتطويل الحرف الأخير (بايييي، باااك). الحدود = بداية/نهاية النص أو أي حرف مو (عربي/إنجليزي/رقم).
const NOT_LETTER = '[^\\u0621-\\u064Aa-zA-Z0-9]';
function hasWord(text, pattern) {
  return new RegExp(`(^|${NOT_LETTER})(?:${pattern})($|${NOT_LETTER})`, 'i').test(text);
}

// ============ تحديد نوع التحية من نص الرسالة ============
function getReply(body) {
  if (!enabled) return null; // موقوفة بأمر المطور
  if (!body) return null;
  const text = normalize(body);
  const lower = text.toLowerCase();

  // "سلام عليكم" substring بيطابق "سلام عليكم" و"السلام عليكم" مع بعض
  if (text.includes('سلام عليكم')) return pickRandom(SALAM_REPLIES);

  // "صباح الخير" / "صباحو" (دارجة ليبية شائعة) / "صباح النور"
  if (text.includes('صباح الخير') || text.includes('صباحو') || text.includes('صباح النور')) {
    return pickRandom(SABAH_REPLIES);
  }

  // "تصبحو" (تصبحون / تصبحوا على خير...) أو "تصبح على خير" / "تصبح علي خير"
  if (text.includes('تصبحو') || /تصبح\S*\s+علي?\s+خير/.test(text)) {
    return pickRandom(TESBAHO_REPLIES);
  }

  // "برب" (BRB)
  if (hasWord(text, 'بر+ب+')) return pickRandom(BARB_REPLIES);

  // "باك"
  if (hasWord(text, 'با+ك+')) return pickRandom(BAK_REPLIES);

  // وداع عام: باي / مع السلامة - عربي أو إنجليزي
  if (
    hasWord(text, 'با+ي+') ||
    text.includes('مع السلامة') ||
    hasWord(lower, 'b+y+e+')
  ) {
    return pickRandom(BYE_REPLIES);
  }

  return null;
}

module.exports = { getReply, init, setEnabled, isEnabled };

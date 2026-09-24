// ============ نظام التحذيرات + فلتر السب/القذف + فلتر الصور ============
// المنطق والنصوص والقوائم كلها زي الأصل بالضبط. الشي اللي اتغيّر هو punishProfanity:
// بـ whatsapp-web.js كان بيستخدم message.delete() و chat.participants و client.info.wid.
// بـ Baileys الطريقة مختلفة: sock.sendMessage(groupJid, { delete: key }) للحذف،
// و sock.groupMetadata(groupJid) عشان نجيب المشرفين، و sock.user.id لمعرفة رقم البوت نفسه.

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { GROQ_API_KEY } = require('./config');
const { jidToNumber } = require('./util');
const wa = require('./wa-helpers');
const greetings = require('./greetings');
const R = require('./responses');

const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_TEXT_MODEL = 'openai/gpt-oss-20b'; // بديل llama-3.3-70b-versatile المتوقف
const GROQ_VISION_MODEL = 'meta-llama/llama-4-maverick-17b-128e-instruct'; // يدعم الصور

const MAX_WARNINGS = 5;

// قائمة الكلمات الممنوعة (سب/قذف كبير). الفلتر بيطابق حتى لو مكتوبة بمسافات أو تكرار حروف.
const BAD_WORDS = [
  'قحبة', 'قحبه', 'كحبة', 'كحبه', 'شرموطة', 'شرموطه', 'شرموطتي', 'شراميط', 'عاهرة', 'عاهره', 'عاهرات',
  'كس امك', 'كسامك', 'كص امك', 'كصامك', 'كصامكم', 'كس اختك', 'كساختك', 'كس ابوك', 'كسابوك', 'كس اهلك', 'كساهلك',
  'كسك', 'كصك', 'كسمك', 'كصمك', 'كسختك', 'كصختك',
  'زب', 'زبي', 'زيب', 'الزب', 'صب', 'زبك', 'زبي فيك', 'زبك فيك', 'زب فيك', 'زبتك', 'يا زب', 'طيزك', 'طيز', 'نيك', 'نيكامك', 'نيك امك', 'نياك', 'منيوكة', 'واد الزنا', 'بنت الزنا', 'ولد الحرام', 'ابن الحرام', 'بنت الحرام',
  'خول', 'خولات', 'لوطي', 'متناك', 'منيك', 'كلب ابن كلب', 'ابن كلب', 'يا كلب', 'ابن الوسخة', 'ابن القحبة', 'ابن الشرموطة',
  // إضافات (طلب حماية الجروب - 13/7/2026)
  'سكس', 'طبون', 'طبونمك', 'منيوك', 'خرا', 'حيوان قذر', 'وسخة', 'زانية', 'زاني'
];

function normalizeForFilter(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[\u064B-\u0652]/g, '')
    .replace(/[إأآا]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\s\-_.*]+/g, '');
}

const NORMALIZED_BAD_WORDS = BAD_WORDS.map(normalizeForFilter);

function containsBadWord(text) {
  const normalized = normalizeForFilter(text);
  if (!normalized) return false;
  return NORMALIZED_BAD_WORDS.some((w) => w.length > 0 && normalized.includes(w));
}

// ============ فلتر السب الذكي (يمسك الكلام المشفر/المموّه عبر Groq) - fail-open ============
async function moderateTextForProfanity(text) {
  if (!text || text.trim().length === 0) return { unsafe: false };
  try {
    const response = await axios.post(
      GROQ_CHAT_URL,
      {
        model: GROQ_TEXT_MODEL,
        messages: [
          {
            role: 'system',
            content: [
              'أنت مصنّف أمان صارم لرسائل جروب واتساب عربي فيه بنات، هدفك حماية الأعضاء من السب والقذف والإهانات الجنسية.',
              'هيدي الرسالة ممكن تكون مكتوبة بطريقة عادية أو مموّهة/مشفرة عشان تتهرب من فلتر كلمات ثابت، مثلاً:',
              '- حروف متباعدة بمسافات أو نقط أو رموز (ق ح ب ة / ق.ح.ب.ة)',
              '- أرقام أو حروف انجليزي بدل حروف عربي (q7ba, 3ahra)',
              '- تكرار حروف (قحححبة)',
              '- الكلمة ملفوفة جوه جملة طويلة أو بصيغة غير مباشرة لكن قصدها واضح إهانة أو سب جنسي',
              'رد بسطر واحد بالظبط، بدون أي شرح إضافي:',
              '- SAFE: لو الرسالة عادية ومفيهاش سب/قذف/إهانة جنسية أو شخصية خطيرة',
              '- UNSAFE: لو الرسالة فيها سب أو قذف أو إهانة جنسية أو شخصية، حتى لو مكتوبة بطريقة مموّهة',
              'لا تفسّر، لا تكتب غير الكلمة الوحيدة SAFE أو UNSAFE.'
            ].join('\n')
          },
          { role: 'user', content: text }
        ],
        max_tokens: 5,
        temperature: 0
      },
      {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_API_KEY}` },
        timeout: 8000
      }
    );
    const raw = (response.data.choices?.[0]?.message?.content || '').trim().toUpperCase();
    return { unsafe: raw.includes('UNSAFE') };
  } catch (err) {
    console.error('خطأ بفلتر السب الذكي (Groq):', err.response?.data || err.message);
    return { unsafe: false };
  }
}

// ============ فلتر الصور/الملصقات الإباحية - fail-open ============
const CRITICAL_NSFW_CATEGORIES = ['S3', 'S4']; // خطر شديد جداً - صفر تسامح

async function moderateImageBuffer(base64Data, mimeType) {
  try {
    const response = await axios.post(
      GROQ_CHAT_URL,
      {
        model: GROQ_VISION_MODEL,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: [
                'You are a strict content-safety classifier for a WhatsApp group moderation bot.',
                'Look at the image and reply with EXACTLY one line, nothing else, no explanation:',
                '- If the image has no sexual/pornographic content, reply: SAFE',
                '- If it contains sexual/pornographic content involving adults, reply: UNSAFE:SEXUAL',
                '- If it contains any sexual content involving a minor, or appears to be child sexual abuse material, reply: UNSAFE:CSAM',
                'Reply with only one of these exact tokens (SAFE / UNSAFE:SEXUAL / UNSAFE:CSAM) and nothing else.'
              ].join('\n')
            },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Data}` } }
          ]
        }],
        max_tokens: 10,
        temperature: 0
      },
      {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_API_KEY}` },
        timeout: 15000
      }
    );
    const raw = (response.data.choices?.[0]?.message?.content || '').trim().toUpperCase();
    if (raw.includes('CSAM')) return { unsafe: true, categories: ['S4'] };
    if (raw.includes('UNSAFE') || raw.includes('SEXUAL')) return { unsafe: true, categories: ['S12'] };
    return { unsafe: false, categories: [] };
  } catch (err) {
    console.error('خطأ بفحص الصورة (Groq):', err.response?.data || err.message);
    return { unsafe: false, categories: [] };
  }
}

// ============ تخزين التحذيرات ============
function warningsFilePath(persistDir) {
  return path.join(persistDir, 'data', 'warnings.json');
}

function loadWarnings(persistDir) {
  try {
    const file = warningsFilePath(persistDir);
    if (!fs.existsSync(file)) return [];
    return JSON.parse(fs.readFileSync(file, 'utf8') || '[]');
  } catch (err) {
    console.error('خطأ بقراءة ملف التحذيرات:', err.message);
    return [];
  }
}

function saveWarnings(persistDir, warnings) {
  try {
    const file = warningsFilePath(persistDir);
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(warnings, null, 2), 'utf8');
  } catch (err) {
    console.error('خطأ بحفظ ملف التحذيرات:', err.message);
  }
}

function getWarningCount(persistDir, userId, chatId) {
  const warnings = loadWarnings(persistDir);
  const entry = warnings.find((w) => w.userId === userId && w.chatId === chatId);
  return entry ? entry.count : 0;
}

function addWarning(persistDir, userId, chatId) {
  const warnings = loadWarnings(persistDir);
  let entry = warnings.find((w) => w.userId === userId && w.chatId === chatId);
  if (!entry) {
    entry = { userId, chatId, count: 0 };
    warnings.push(entry);
  }
  entry.count += 1;
  saveWarnings(persistDir, warnings);
  return entry.count;
}

function resetWarnings(persistDir, userId, chatId) {
  const warnings = loadWarnings(persistDir);
  const filtered = warnings.filter((w) => !(w.userId === userId && w.chatId === chatId));
  saveWarnings(persistDir, filtered);
}

// ============ بانرات التحذيرات/الطرد (النصوص الفعلية موجودة بـ lib/responses.js تحت R.mod) ============
function kickBanner(targetLine, executorLine) {
  return R.mod.kickBanner(targetLine, executorLine);
}

function newWarningBanner(targetLine, reasonText, count, max) {
  return R.mod.newWarningBanner(targetLine, reasonText, count, max);
}

function finalWarningKickBanner(targetLine, reasonText) {
  return R.mod.finalWarningKickBanner(targetLine, reasonText, MAX_WARNINGS, greetings.formatTripoliTime());
}

function violationDmBanner(reasonText, memberLine, count, max) {
  return R.mod.violationDmBanner(reasonText, memberLine, count, max);
}

function warningCountBanner(targetLine, count, max) {
  return R.mod.warningCountBanner(targetLine, count, max);
}

function warningsResetBanner(targetLine, adminLine) {
  return R.mod.warningsResetBanner(targetLine, adminLine);
}

// ============ تنفيذ عقوبة السب (حذف الرسالة + تحذير + طرد عند الوصول للحد) - نسخة Baileys ============
// msg: عنصر رسالة Baileys كامل (من messages.upsert) - لازم يحتوي key وmessage
async function punishProfanity(sock, persistDir, groupJid, msg, authorJid) {
  try {
    const meta = await sock.groupMetadata(groupJid);

    // المشرف مستثنى بالكامل (فحص موحّد بيجرب كل الحقول الممكنة: id/jid/lid/phoneNumber/pn)
    if (wa.isParticipantAdmin(meta, authorJid)) {
      return;
    }

    // 🔒 لو البوت نفسه مش أدمن بهاد الجروب، ما يقدر يعاقب على السب أصلاً
    // (ما يحذف، ما يسجل تحذير، ما يرد بأي رسالة) - يتجاهل تماماً لحد ما يصير أدمن
    // (نفس الفحص المصحح المستخدم بباقي الفلاتر - يدعم حالة @lid)
    if (!wa.isBotAdmin(meta, sock.user)) {
      console.error('⚠️ فلتر الألفاظ: البوت مش أدمن بالجروب (أو فشلت مطابقة الهوية) - ما راح يعاقب.', groupJid);
      return;
    }

    // حذف الرسالة المسيئة (لازم البوت يكون أدمن بالجروب)
    try {
      await sock.sendMessage(groupJid, { delete: msg.key });
    } catch (delErr) {
      console.error('ما قدرت أحذف الرسالة المسيئة:', delErr.message);
    }

    const numberTag = `@${jidToNumber(authorJid)}`;
    const newCount = addWarning(persistDir, authorJid, groupJid);

    if (newCount >= MAX_WARNINGS) {
      resetWarnings(persistDir, authorJid, groupJid);
      try {
        await sock.groupParticipantsUpdate(groupJid, [authorJid], 'remove');
        await sock.sendMessage(groupJid, {
          text: finalWarningKickBanner(numberTag, 'تجاوز الحد الأقصى للمخالفات (ألفاظ غير لائقة)'),
          mentions: [authorJid]
        });
        logKick(persistDir, {
          chatId: groupJid,
          targetNumber: jidToNumber(authorJid),
          executorLine: 'مراد 🔥 (تلقائي)',
          reason: 'تجاوز التحذيرات (سب/قذف)'
        });
      } catch (kickErr) {
        console.error('خطأ بطرد العضو تلقائي:', kickErr.message);
      }
    } else {
      await sock.sendMessage(groupJid, {
        text: newWarningBanner(numberTag, 'ألفاظ غير لائقة (سب/قذف)', newCount, MAX_WARNINGS),
        mentions: [authorJid]
      });
    }
  } catch (filterErr) {
    console.error('خطأ بفلتر الألفاظ:', filterErr.message);
  }
}

// ============ أرشيف الطرد/المخالفات (دائم على القرص - يستخدمه تبويب "سجل الطرد" باللوحة) ============
const MAX_KICK_LOG_ENTRIES = 500; // نحتفظ بآخر 500 عملية طرد بس عشان الملف ما يكبر بلا حدود

function kickLogFilePath(persistDir) {
  return path.join(persistDir, 'data', 'kick-log.json');
}

function loadKickLog(persistDir) {
  try {
    const file = kickLogFilePath(persistDir);
    if (!fs.existsSync(file)) return [];
    return JSON.parse(fs.readFileSync(file, 'utf8') || '[]');
  } catch (err) {
    console.error('خطأ بقراءة سجل الطرد:', err.message);
    return [];
  }
}

function saveKickLog(persistDir, log) {
  try {
    const file = kickLogFilePath(persistDir);
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(log, null, 2), 'utf8');
  } catch (err) {
    console.error('خطأ بحفظ سجل الطرد:', err.message);
  }
}

// entry: { chatId, chatName?, targetNumber, executorLine, reason, timestamp }
function logKick(persistDir, entry) {
  const log = loadKickLog(persistDir);
  log.unshift({ ...entry, timestamp: entry.timestamp || Date.now() });
  const trimmed = log.slice(0, MAX_KICK_LOG_ENTRIES);
  saveKickLog(persistDir, trimmed);
  return trimmed;
}

// بيرجع آخر N عملية طرد (الأحدث أول)، اختياري نفلترهم حسب جروب معين
function getKickLog(persistDir, { chatId, limit } = {}) {
  let log = loadKickLog(persistDir);
  if (chatId) log = log.filter((e) => e.chatId === chatId);
  return typeof limit === 'number' ? log.slice(0, limit) : log;
}

module.exports = {
  MAX_WARNINGS,
  BAD_WORDS,
  normalizeForFilter,
  containsBadWord,
  moderateTextForProfanity,
  moderateImageBuffer,
  CRITICAL_NSFW_CATEGORIES,
  loadWarnings,
  saveWarnings,
  getWarningCount,
  addWarning,
  resetWarnings,
  kickBanner,
  newWarningBanner,
  finalWarningKickBanner,
  violationDmBanner,
  warningCountBanner,
  warningsResetBanner,
  punishProfanity,
  logKick,
  getKickLog
};

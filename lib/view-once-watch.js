'use strict';

// ============================================================================
// view-once-watch.js — كشف رسائل "تظهر مرة وحدة" (View Once)
// ============================================================================
// ملف مستقل بالكامل، نفس فكرة deletion-watch.js تماماً بس أبسط:
// كاش مؤقت بالذاكرة لأي صورة/فيديو/صوت "تظهر مرة وحدة" فور وصوله، عشان نقدر
// نرجعه لاحقاً بأمر !كشف حتى بعد ما "يختفي" من واجهة واتساب العادية.
//
// router.js بينده دالتين بس من هون:
//   1) tryCaptureViewOnce(msg, chatId, authorId, wa)
//      → تتفحص كل رسالة توصل: لو فيها محتوى "يظهر مرة وحدة"، تحمّله وتخزنه
//        بالكاش (مربوط بـ chatId + معرف الرسالة). ما بترجع شي مهم ولا بتوقف
//        باقي المعالجة - الرسالة العادية (لو فيها نص) بتكمل مسارها الطبيعي.
//   2) getCaptured(chatId, stanzaId)
//      → ترجع { buffer, mimetype, mediaType, authorId, ts } لو لقت نسخة
//        محفوظة، وإلا null (يمكن ما كانت "تظهر مرة وحدة" أصلاً أو انتهت صلاحيتها).
// ============================================================================

const MAX_CACHE_ENTRIES = 500;              // ميديا بتاخد مساحة أكبر من نص - سقف أقل من deletion-watch
const CAPTURE_TTL_MS = 24 * 60 * 60 * 1000; // 24 ساعة كافية لأي حد يرجع يفتكر ويكشفها

// key: `${chatId}::${stanzaId}` -> { buffer, mimetype, mediaType, authorId, ts }
const captured = new Map();

function cacheKey(chatId, stanzaId) {
  return `${chatId}::${stanzaId}`;
}

function cleanupIfNeeded() {
  if (captured.size <= MAX_CACHE_ENTRIES) return;
  const now = Date.now();
  for (const [key, val] of captured) {
    if (now - val.ts > CAPTURE_TTL_MS) captured.delete(key);
  }
}

// ============ استخراج محتوى "يظهر مرة وحدة" من رسالة خام (صيغ واتساب المختلفة) ============
function extractViewOnceContent(m) {
  if (!m) return null;
  const wrapped =
    m.viewOnceMessage?.message ||
    m.viewOnceMessageV2?.message ||
    m.viewOnceMessageV2Extension?.message;
  if (wrapped) return wrapped;

  // بعض النسخ ما بتلف الرسالة بـ viewOnceMessage، بس بتحط viewOnce: true مباشرة
  if (m.imageMessage?.viewOnce) return { imageMessage: m.imageMessage };
  if (m.videoMessage?.viewOnce) return { videoMessage: m.videoMessage };
  if (m.audioMessage?.viewOnce) return { audioMessage: m.audioMessage };

  return null;
}

// ---- 1) كشف واستقبال أي رسالة "تظهر مرة وحدة" وتخزين نسخة منها ----
async function tryCaptureViewOnce(msg, chatId, authorId, wa) {
  try {
    const content = extractViewOnceContent(msg.message);
    if (!content) return false;

    const stanzaId = msg.key?.id;
    if (!chatId || !stanzaId) return false;

    // بنعيد استخدام wa.downloadMedia نفسها بس بنمررلها المحتوى المفكوك من الغلاف
    const downloaded = await wa.downloadMedia({ message: content });
    if (!downloaded) return false;

    const mediaType = wa.getMediaType({ message: content });

    captured.set(cacheKey(chatId, stanzaId), {
      buffer: downloaded.buffer,
      mimetype: downloaded.mimetype,
      mediaType,
      authorId,
      ts: Date.now()
    });
    cleanupIfNeeded();
    return true;
  } catch (err) {
    console.error('خطأ بمحاولة كشف رسالة تظهر مرة وحدة:', err.message);
    return false;
  }
}

// ---- 2) استرجاع نسخة محفوظة (تُستخدم بأمر !كشف) ----
function getCaptured(chatId, stanzaId) {
  if (!chatId || !stanzaId) return null;
  return captured.get(cacheKey(chatId, stanzaId)) || null;
}

module.exports = {
  tryCaptureViewOnce,
  getCaptured
};

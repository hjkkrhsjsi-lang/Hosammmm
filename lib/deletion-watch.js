'use strict';

// ============================================================================
// deletion-watch.js — كشف حذف الرسائل (Delete for everyone) + قرار الأدمن
// ============================================================================
// ملف مستقل بالكامل، ما يعدّل ولا يعتمد داخليًا على أي ملف موجود غير الأساسيات
// اللي بتنمرر له من router.js (wa, moderation, senderIsAdmin, jidToNumber).
// router.js بس بينده 3 دوال من هون، بثلاث نقاط استدعاء صغيرة:
//
//   1) recordMessage(chatId, stanzaId, authorId, authorNumber, text)
//      → تسجيل كل رسالة نصية بالجروب بذاكرة مؤقتة (كاش) عشان لو انحذفت
//        بعدين نعرف شو كان نصها ومين كاتبها.
//
//   2) tryHandleRevoke(sock, msg, persistDir, ctx)
//      → تتفحص أي رسالة توصل: لو كانت "بروتوكول حذف" (REVOKE) لعضو حقيقي
//        (مش حذف نفّذه البوت نفسه بأمر إداري أو فلترة تلقائية)، بتنشر بانر
//        فيه نص الرسالة المحذوفة ومنشن صاحبها، وبترجع true (يعني "انتهى
//        الأمر، لا داعي نكمل بقية المعالجة على هاي الرسالة").
//        لو مش رسالة حذف أصلاً بترجع false وروتر يكمل شغله العادي.
//
//   3) tryHandleAdminDecision(sock, msg, persistDir, ctx)
//      → تتفحص أي رد نصي (Reply) على بانر الحذف من أدمن بالجروب بكلمة
//        "نعم" أو "لا":
//          - "نعم" → نفس منطق أمر !مخالفة بالضبط (تحذير + رسالة خاص +
//                    طرد لو وصل الحد الأقصى للتحذيرات).
//          - "لا"  → البوت يحط رياكشن ✅ ويسكر الموضوع بدون أي عقوبة.
//        بترجع true لو تعامل مع الرسالة، وelse false.
// ============================================================================

const MAX_CACHE_ENTRIES = 8000;           // سقف أقصى للكاش بكل العملية (كل الجروبات مع بعض)
const MESSAGE_TTL_MS = 48 * 60 * 60 * 1000;   // 48 ساعة كافية جدًا لنافذة "حذف للكل"
const DECISION_TIMEOUT_MS = 30 * 60 * 1000;   // نص ساعة كفاية للأدمن يشوف البانر ويرد

// key: `${chatId}::${stanzaId}` -> { authorId, authorNumber, text, ts }
const recentMessages = new Map();

// key: msg.key.id (بتاع بانر البوت نفسه) -> { chatId, targetAuthorId, targetAuthorNumber, deletedText, timer }
const pendingDecisions = new Map();

function cacheKey(chatId, stanzaId) {
  return `${chatId}::${stanzaId}`;
}

// تنظيف دوري بسيط: نشيل أي إدخال أقدم من المدة المسموحة، وبس لو الكاش كبر كتير
// (ما منعمل هذا بكل رسالة عشان ما نضيف تكلفة على المسار الحرج)
function cleanupIfNeeded() {
  if (recentMessages.size <= MAX_CACHE_ENTRIES) return;
  const now = Date.now();
  for (const [key, val] of recentMessages) {
    if (now - val.ts > MESSAGE_TTL_MS) recentMessages.delete(key);
  }
}

function recordMessage(chatId, stanzaId, authorId, authorNumber, text) {
  if (!chatId || !stanzaId || !text) return;
  recentMessages.set(cacheKey(chatId, stanzaId), {
    kind: 'text',
    authorId,
    authorNumber,
    text,
    ts: Date.now()
  });
  cleanupIfNeeded();
}

// 🆕 تسجيل رسالة ملف (صورة/فيديو/ملصق/صوت/رسالة صوتية/مستند) - منخزن نوع الملف
// وكابشنه النصي لو فيه بس، بدون تحميل أو حفظ الملف الفعلي نفسه على الإطلاق.
function recordMedia(chatId, stanzaId, authorId, authorNumber, mediaType, caption) {
  if (!chatId || !stanzaId || !mediaType) return;
  recentMessages.set(cacheKey(chatId, stanzaId), {
    kind: 'media',
    authorId,
    authorNumber,
    mediaType,
    caption: caption || '',
    ts: Date.now()
  });
  cleanupIfNeeded();
}

const MEDIA_TYPE_LABELS = {
  image: '🖼️ صورة',
  video: '🎥 فيديو',
  sticker: '🎭 ملصق (استيكر)',
  ptt: '🎙️ رسالة صوتية',
  audio: '🎵 ملف صوتي',
  document: '📄 مستند'
};

function mediaTypeLabel(mediaType) {
  return MEDIA_TYPE_LABELS[mediaType] || `📎 ملف (${mediaType})`;
}

function buildDeletedBanner(authorTag, deletedText) {
  return [
    '╔═══════════════',
    '║  🗑️ *رسالة محذوفة اكتشفها البوت*',
    '╠═══════════════',
    `║  👤 *العضو:* ${authorTag}`,
    '║  💬 *النص قبل الحذف:*',
    `║  "${deletedText}"`,
    '╠═══════════════',
    '║  🛡️ *لأي أدمن:* هل هاي تستاهل تسجيل مخالفة؟',
    '║  رد (Reply) على هاي الرسالة بكلمة "نعم" أو "لا" 👇',
    '╚═══════════════'
  ].join('\n');
}

// 🆕 بانر لملف محذوف (بنبلّغ بس عن نوعه وكابشنه لو فيه - ما عنا الملف نفسه محفوظ)
function buildDeletedMediaBanner(authorTag, mediaType, caption) {
  const lines = [
    '╔═══════════════',
    '║  🗑️ *رسالة محذوفة اكتشفها البوت*',
    '╠═══════════════',
    `║  👤 *العضو:* ${authorTag}`,
    `║  📎 *نوع المحذوف:* ${mediaTypeLabel(mediaType)}`
  ];

  if (caption && caption.trim()) {
    lines.push('║  💬 *الكابشن قبل الحذف:*', `║  "${caption.trim()}"`);
  }

  lines.push(
    '╠═══════════════',
    '║  🛡️ *لأي أدمن:* هل هاي تستاهل تسجيل مخالفة؟',
    '║  رد (Reply) على هاي الرسالة بكلمة "نعم" أو "لا" 👇',
    '╚═══════════════'
  );

  return lines.join('\n');
}

// ---- 1) كشف حدث الحذف نفسه ----
// ctx المطلوب: { wa, isGroup, fromMe }
async function tryHandleRevoke(sock, msg, persistDir, ctx) {
  const { wa, isGroup, fromMe } = ctx;

  // بس بالجروبات، وبس لو الحذف مش منفّذ من البوت نفسه (أمر إداري/فلترة تلقائية
  // بتعمل sock.sendMessage({delete}) وبتولّد نفس نوع رسالة البروتوكول، فلازم نستثنيها
  // عشان ما نكرر تسجيل مخالفة على مخالفة أصلاً متعامل معها بمكان تاني بالكود).
  if (!isGroup || fromMe) return false;

  const protocolMsg = msg.message && msg.message.protocolMessage;
  const isRevoke = !!protocolMsg && (protocolMsg.type === 0 || protocolMsg.type === 'REVOKE');
  if (!isRevoke) return false;

  const revokedKey = protocolMsg.key;
  if (!revokedKey || !revokedKey.id) return true; // بروتوكول حذف بس بلا مفتاح مفهوم - نتجاهله بهدوء

  const chatId = wa.getChatId(msg);
  const key = cacheKey(chatId, revokedKey.id);
  const cached = recentMessages.get(key);

  // لو ما عندنا نص الرسالة (وصلت قبل ما البوت يشتغل، أو مو رسالة نصية، أو انتهت صلاحيتها)
  // منتجاهل بهدوء بدون أي رسالة - أحسن من بانر فاضي أو مضلل.
  if (!cached) return true;

  recentMessages.delete(key);

  try {
    const bannerText = cached.kind === 'media'
      ? buildDeletedMediaBanner(wa.tag(cached.authorId), cached.mediaType, cached.caption)
      : buildDeletedBanner(wa.tag(cached.authorId), cached.text);

    const sent = await sock.sendMessage(chatId, {
      text: bannerText,
      mentions: [cached.authorId]
    });

    if (sent && sent.key && sent.key.id) {
      const timer = setTimeout(() => {
        pendingDecisions.delete(sent.key.id);
      }, DECISION_TIMEOUT_MS);

      pendingDecisions.set(sent.key.id, {
        chatId,
        targetAuthorId: cached.authorId,
        targetAuthorNumber: cached.authorNumber,
        deletedText: cached.text,
        timer
      });
    }
  } catch (err) {
    console.error('خطأ بنشر بانر الرسالة المحذوفة:', err.message);
  }

  return true;
}

// ---- 2) رد الأدمن (نعم / لا) على البانر ----
// ctx المطلوب: { wa, isGroup, fromMe, body, authorId, senderIsAdmin, jidToNumber, moderation }
async function tryHandleAdminDecision(sock, msg, persistDir, ctx) {
  const { wa, isGroup, fromMe, body, authorId, senderIsAdmin, jidToNumber, moderation } = ctx;

  if (!isGroup || fromMe || !body) return false;
  if (!wa.hasQuotedMessage(msg)) return false;

  const quotedInfo = wa.getQuotedInfo(msg);
  const pending = pendingDecisions.get(quotedInfo.stanzaId);
  if (!pending) return false;

  const chatId = wa.getChatId(msg);
  if (chatId !== pending.chatId) return false;

  const normalized = body.trim();
  if (normalized !== 'نعم' && normalized !== 'لا') return false; // رد على البانر بنص تاني - نتجاهله، يضل البانر مفتوح

  if (!(await senderIsAdmin(sock, chatId, authorId))) {
    await wa.reply(sock, msg, 'بس الأدمن يقدر يقرر هون 🙏');
    return true;
  }

  clearTimeout(pending.timer);
  pendingDecisions.delete(quotedInfo.stanzaId);

  // -------- "لا" → إغلاق الموضوع بدون أي عقوبة --------
  if (normalized === 'لا') {
    try {
      await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } });
    } catch (reactErr) {
      console.error('خطأ برياكشن إغلاق موضوع الحذف:', reactErr.message);
    }
    return true;
  }

  // -------- "نعم" → نفس منطق !مخالفة بالضبط (تحذير + رسالة خاص + طرد لو وصل الحد) --------
  const target = pending.targetAuthorId;
  const finalReason = 'حذف رسالة بعد إرسالها (Delete for everyone)';

  const newCount = moderation.addWarning(persistDir, target, chatId);
  try {
    await sock.sendMessage(target, {
      text: moderation.violationDmBanner(finalReason, wa.tag(target), newCount, moderation.MAX_WARNINGS)
    });
  } catch (dmErr) {
    console.error('ما قدرت أبعت رسالة خاص للعضو المخالف (حذف رسالة):', dmErr.message);
  }

  if (newCount >= moderation.MAX_WARNINGS) {
    moderation.resetWarnings(persistDir, target, chatId);
    const meta = await sock.groupMetadata(chatId);
    if (wa.isBotAdmin(meta, sock.user)) {
      await sock.groupParticipantsUpdate(chatId, [target], 'remove');
      await sock.sendMessage(chatId, {
        text: moderation.finalWarningKickBanner(wa.tag(target), finalReason),
        mentions: [target, authorId]
      });
      moderation.logKick(persistDir, {
        chatId,
        targetNumber: jidToNumber(target),
        executorLine: wa.tag(authorId),
        reason: 'تجاوز التحذيرات (حذف رسالة)'
      });
    } else {
      await sock.sendMessage(chatId, {
        text: `${wa.tag(target)} وصل ${moderation.MAX_WARNINGS} تحذيرات وكان لازم يتطرد، بس أنا مش أدمن هنا، خلوني أدمن 🙏`,
        mentions: [target]
      });
    }
  } else {
    await sock.sendMessage(chatId, {
      text: moderation.newWarningBanner(wa.tag(target), finalReason, newCount, moderation.MAX_WARNINGS),
      mentions: [target]
    });
  }

  return true;
}

module.exports = {
  recordMessage,
  recordMedia,
  tryHandleRevoke,
  tryHandleAdminDecision
};

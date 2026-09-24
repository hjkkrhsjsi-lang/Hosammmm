// ============ أدوات مساعدة لاستخراج المعلومات من رسائل Baileys ============
// whatsapp-web.js كان يوفر methods جاهزة (message.body, message.getContact()...).
// Baileys بيرجع الرسالة كـ object خام، فهاي الدوال بتعمل نفس الدور يدوياً.

const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { jidToNumber, isGroupJid } = require('./util');

// ============ نص الرسالة (مكافئ message.body) ============
function getMessageText(msg) {
  const m = msg.message;
  if (!m) return '';
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    ''
  ).trim();
}

function getChatId(msg) {
  return msg.key.remoteJid;
}

// معرف كاتب الرسالة (بالجروب: participant ، بالخاص: نفس remoteJid)
function getAuthorId(msg) {
  return msg.key.participant || msg.key.remoteJid;
}

function isFromMe(msg) {
  return !!msg.key.fromMe;
}

// ============ المنشونات (مكافئ message.getMentions()) ============
function getMentionedJids(msg) {
  const ctx = msg.message?.extendedTextMessage?.contextInfo;
  return ctx?.mentionedJid || [];
}

// ============ الرسالة المقتبسة (Reply) - مكافئ hasQuotedMsg/getQuotedMessage ============
function hasQuotedMessage(msg) {
  return !!msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
}

function getQuotedInfo(msg) {
  const ctx = msg.message?.extendedTextMessage?.contextInfo;
  if (!ctx || !ctx.quotedMessage) return null;
  return {
    message: ctx.quotedMessage,
    stanzaId: ctx.stanzaId, // معرف الرسالة الأصلية (نستخدمه بدل message.id._serialized)
    participant: ctx.participant, // مين بعت الرسالة الأصلية
    fromMe: ctx.participant ? undefined : undefined // بيتحدد لاحقاً بمقارنة sock.user.id
  };
}

function getQuotedText(quotedMessage) {
  if (!quotedMessage) return '';
  return quotedMessage.conversation || quotedMessage.extendedTextMessage?.text || '';
}

// ============ نوع الميديا (صورة/صوت/فيديو/ملصق) ============
function getMediaType(msg) {
  const m = msg.message;
  if (!m) return null;
  if (m.imageMessage) return 'image';
  if (m.stickerMessage) return 'sticker';
  if (m.videoMessage) return 'video';
  if (m.audioMessage) return m.audioMessage.ptt ? 'ptt' : 'audio';
  return null;
}

// ============ تحميل الميديا (مكافئ message.downloadMedia()) ============
async function downloadMedia(msg) {
  const m = msg.message;
  if (!m) return null;
  let content = null;
  let type = null;
  let mimetype = null;

  if (m.imageMessage) { content = m.imageMessage; type = 'image'; mimetype = m.imageMessage.mimetype; }
  else if (m.stickerMessage) { content = m.stickerMessage; type = 'sticker'; mimetype = m.stickerMessage.mimetype; }
  else if (m.videoMessage) { content = m.videoMessage; type = 'video'; mimetype = m.videoMessage.mimetype; }
  else if (m.audioMessage) { content = m.audioMessage; type = 'audio'; mimetype = m.audioMessage.mimetype; }

  if (!content) return null;

  const stream = await downloadContentFromMessage(content, type);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return { buffer: Buffer.concat(chunks), mimetype };
}

// نفس فكرة downloadMedia بس للرسالة المقتبسة (quotedMessage object مش msg كامل)
async function downloadQuotedMedia(quotedMessage) {
  if (!quotedMessage) return null;
  let content = null;
  let type = null;
  let mimetype = null;

  if (quotedMessage.imageMessage) { content = quotedMessage.imageMessage; type = 'image'; mimetype = quotedMessage.imageMessage.mimetype; }
  else if (quotedMessage.videoMessage) { content = quotedMessage.videoMessage; type = 'video'; mimetype = quotedMessage.videoMessage.mimetype; }

  if (!content) return null;

  const stream = await downloadContentFromMessage(content, type);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return { buffer: Buffer.concat(chunks), mimetype };
}

// ============ تحديد الهدف: منشن أو رد (Reply) بدون منشن ============
// لو فيه منشن @شخص → نرجعه هو.
// لو ماكو منشن بس الرسالة رد (Reply) على رسالة ثانية → نرجع صاحب الرسالة المردود عليها.
// لو ماكو منشن ولا رد → نرجع array فاضي.
function resolveTargets(msg) {
  const mentioned = getMentionedJids(msg);
  if (mentioned.length > 0) return mentioned;

  const quotedInfo = getQuotedInfo(msg);
  if (quotedInfo && quotedInfo.participant) {
    return [quotedInfo.participant];
  }

  return [];
}

// ============ فحوصات الأدمن بالجروب ============
function isParticipantAdmin(groupMeta, jid) {
  if (!jid) return false;
  const targetNumber = jidToNumber(jid);
  const p = groupMeta.participants.find((pp) => {
    if (pp.id === jid) return true; // مطابقة مباشرة (أسرع مسار للحالة الشائعة)
    const candidateFields = [pp.id, pp.jid, pp.phoneNumber, pp.lid, pp.pn].filter(Boolean);
    return candidateFields.some((f) => jidToNumber(f) === targetNumber);
  });
  return !!(p && (p.admin === 'admin' || p.admin === 'superadmin'));
}

// ============ تحويل أي jid (حتى لو @lid) للـ id الحقيقي زي ما مسجل بميتاداتا الجروب ============
// نفس منطق المطابقة المستخدم بـ isParticipantAdmin (يجرب كل الحقول الممكنة:
// id/jid/lid/phoneNumber/pn) بس هون بترجع الـ id نفسه بدل true/false.
// مهمة لما نبعت jid لدوال زي groupParticipantsUpdate (ترقية/تنزيل أدمن) عشان
// نتأكد إنه بنفس الصيغة اللي واتساب متوقعها، مش الصيغة اللي جتنا بالمنشن (ممكن تكون @lid).
function resolveParticipantId(groupMeta, jid) {
  if (!jid) return jid;
  const targetNumber = jidToNumber(jid);
  const p = groupMeta.participants.find((pp) => {
    if (pp.id === jid) return true; // مطابقة مباشرة (أسرع مسار للحالة الشائعة)
    const candidateFields = [pp.id, pp.jid, pp.phoneNumber, pp.lid, pp.pn].filter(Boolean);
    return candidateFields.some((f) => jidToNumber(f) === targetNumber);
  });
  return p ? p.id : jid;
}

function isBotAdmin(groupMeta, botUser) {
  // botUser المفروض يكون كائن sock.user كامل (مش بس string رقم)، عشان نقدر نجرب
  // كل هويات البوت الممكنة: id العادي (@s.whatsapp.net) و lid (@lid) لو موجود.
  //
  // 🔧 تصحيح مهم: قبل هيك كنا نقارن نصوص JID كاملة ببعضها، وهاد كان يفشل بحالتين:
  //   1) sock.user.id بييجي أحياناً مع لاحقة جهاز زي ":40@s.whatsapp.net"، بينما
  //      نفس الرقم بقائمة المشاركين مكتوب بدون اللاحقة دي، فالمقارنة النصية الكاملة تفشل.
  //   2) واتساب صار يرجع بعض المشاركين (وحتى البوت نفسه لو صار أدمن) بمعرف lid
  //      كـ "id" رئيسي، ورقم الهاتف الحقيقي موجود بحقل "jid" جنبه، مش بالعكس.
  // الحل: نستخرج الرقم "النظيف" بس (بدون أي بادئة/لاحقة) من كل حقل ممكن (id/jid/lid/
  // phoneNumber/pn) لطرفي المقارنة (هوية البوت + كل مشارك)، ونقارن أرقام مع أرقام بس.
  const rawIdentities = [];
  if (typeof botUser === 'string') {
    rawIdentities.push(botUser);
  } else if (botUser && typeof botUser === 'object') {
    if (botUser.id) rawIdentities.push(botUser.id);
    if (botUser.lid) rawIdentities.push(botUser.lid);
  }
  if (rawIdentities.length === 0) return false;

  const identityNumbers = new Set(rawIdentities.map(jidToNumber).filter(Boolean));

  const p = groupMeta.participants.find((pp) => {
    const candidateFields = [pp.id, pp.jid, pp.phoneNumber, pp.lid, pp.pn].filter(Boolean);
    return candidateFields.some((f) => identityNumbers.has(jidToNumber(f)));
  });

  return !!(p && (p.admin === 'admin' || p.admin === 'superadmin'));
}

// ============ أفضل رقم حقيقي نعرضه للعضو (مش معرف الخصوصية @lid) ============
// المشكلة: بعض الأعضاء واتساب يرجّع p.id بتاعهم كـ "@lid" (رقم عشوائي داخلي
// لخصوصية واتساب) بدل رقم هاتفهم الحقيقي. لو استخدمنا هذا الرقم لتحديد علم
// الدولة (getCountryFlag) بيطلع غلط تماماً (رقم عشوائي مالوش علاقة بالدولة
// الحقيقية). هاي الدالة تدور على رقم الهاتف الحقيقي بالحقول البديلة أول،
// وإلا ترجع الـ id العادي كما هو.
function bestDisplayNumber(p) {
  if (!p) return '';
  if (typeof p.id === 'string' && p.id.includes('@lid')) {
    const realJid = [p.jid, p.phoneNumber, p.pn].find(
      (f) => typeof f === 'string' && f.length > 0 && !f.includes('@lid')
    );
    if (realJid) return jidToNumber(realJid);
  }
  return jidToNumber(p.id);
}

// ============ الرقم الحقيقي لصاحب الرسالة (حتى لو جا الـ participant بصيغة @lid) ============
// نفس مشكلة bestDisplayNumber بس لصاحب الرسالة الحالية (مش عضو من قائمة الجروب):
// بالجروبات الكبيرة، Baileys أحياناً يرجّع participant كـ "@lid" (معرف خصوصية داخلي)
// بدل رقم الهاتف الحقيقي، فأي مقارنة برقم ثابت (زي SOUAD_LOVED_NUMBERS) كانت تفشل.
// هاي الدالة تدور على العضو بميتاداتا الجروب وتجيب رقمه الحقيقي من الحقول البديلة،
// وإلا ترجع الاستخراج المباشر العادي (نفس السلوك القديم لو الرسالة مش من جروب أو مافيش lid).
async function resolveRealNumberForJid(sock, chatId, jid) {
  if (!jid) return '';
  if (!jid.includes('@lid')) return jidToNumber(jid);
  if (!isGroupJid(chatId)) return jidToNumber(jid);

  try {
    const meta = await sock.groupMetadata(chatId);
    const p = meta.participants.find((pp) => pp.id === jid || pp.lid === jid);
    if (p) {
      const real = bestDisplayNumber(p);
      if (real) return real;
    }
  } catch (err) {
    console.error('خطأ بجلب الرقم الحقيقي لعضو من الجروب:', err.message);
  }

  return jidToNumber(jid);
}

async function resolveRealAuthorNumber(sock, msg) {
  const authorId = getAuthorId(msg);
  if (!authorId) return '';
  return resolveRealNumberForJid(sock, getChatId(msg), authorId);
}

// ============ رد سريع (مكافئ message.reply) ============
async function reply(sock, msg, text) {
  return sock.sendMessage(getChatId(msg), { text }, { quoted: msg });
}

// ============ منشن كتاجات @رقم لعرض بالنص ============
function tag(jid) {
  return `@${jidToNumber(jid)}`;
}

module.exports = {
  getMessageText,
  getChatId,
  getAuthorId,
  isFromMe,
  getMentionedJids,
  resolveTargets,
  hasQuotedMessage,
  getQuotedInfo,
  getQuotedText,
  getMediaType,
  downloadMedia,
  downloadQuotedMedia,
  isParticipantAdmin,
  resolveParticipantId,
  isBotAdmin,
  bestDisplayNumber,
  resolveRealAuthorNumber,
  resolveRealNumberForJid,
  reply,
  tag,
  isGroupJid
};

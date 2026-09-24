// ============ send-album.js ============
// يستخدم خاصية الألبوم المدمجة بمكتبة @itsukichan/baileys (فورك غير
// رسمي معدّل خصيصاً عشان يدعم ألبومات واتساب - مو المكتبة الرسمية).
//
// ⚠️ هذا الملف يعتمد على package.json يحوّل @whiskeysockets/baileys
// لهذا الفورك (npm:@itsukichan/baileys@7.3.2). لو رجعت للمكتبة
// الرسمية لاحقاً، هذا الملف ما راح يشتغل - لازم ترجعه للطريقة
// القديمة (صورة وحدة + !تالي).

/**
 * @param {*} sock - اتصال Baileys الحالي
 * @param {string} jid - آيدي الشات
 * @param {Array<{type: 'image'|'video', data: {url: string}, caption?: string}>} medias
 * @param {{caption?: string}} options
 */
async function sendAlbumMessage(sock, jid, medias, options = {}) {
  const albumItems = medias.map((m, i) => ({
    [m.type]: m.data,
    caption: i === 0 ? options.caption || m.caption || '' : m.caption || ''
  }));

  console.log('[ألبوم] بعدد عناصر:', albumItems.length);
  const result = await sock.sendMessage(jid, { album: albumItems });
  console.log('[ألبوم] نتيجة الإرسال:', JSON.stringify(result)?.slice(0, 300));
  return result;
}

module.exports = { sendAlbumMessage };

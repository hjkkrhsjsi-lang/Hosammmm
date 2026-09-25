// Baileys يحتاج crypto متاح عالمياً (متوفر تلقائي بـ Node 20+، هذا السطر يوفره لـ Node 18)
if (!globalThis.crypto) {
  globalThis.crypto = require('crypto').webcrypto;
}

require('dotenv').config();
const path = require('path');
const fs = require('fs');

const { state, startWhatsApp, requestPairingCode } = require('./lib/whatsapp');
const { startWebServer } = require('./lib/webserver');
const media = require('./lib/media');
const greetings = require('./lib/greetings');
const banners = require('./lib/banners');
const router = require('./lib/router');
const prayer = require('./lib/prayer');

// مجلد الصور/الجيفات (بانرات الترحيب/الوداع، كرت XP، جيف !اوامر...)
// ⚠️ لازم تنسخ مجلد images/ الأصلي بتاعك جوه هذا المشروع الجديد يدوياً - ما جالنيش
// أي صور/جيفات فعلية، بس أسماء الملفات نفسها محفوظة بـ lib/media.js
const IMAGES_DIR = path.join(__dirname, 'images');

// ============ شبكة أمان على مستوى البروسيس كامل (نفس الفكرة القديمة تماماً) ============
process.on('unhandledRejection', (reason) => {
  console.error('🚨 unhandledRejection (بروميس رفض من غير catch):', reason?.stack || reason);
});
process.on('uncaughtException', (err) => {
  console.error('🚨 uncaughtException (خطأ غير متوقع خارج أي try/catch):', err?.stack || err);
});

// ============ إعدادات عامة ============
const PORT = process.env.PORT || 3000;
const PERSIST_DIR = process.env.PERSIST_DIR || path.join(__dirname, 'persist');
if (!fs.existsSync(PERSIST_DIR)) fs.mkdirSync(PERSIST_DIR, { recursive: true });

// ============ حذف جلسة واتساب القديمة (مرة وحدة، عند الطلب فقط) ============
// نفس فكرة RESET_SESSION القديمة، بس المسار الحين لمجلد baileys_auth بدل wwebjs_auth
if (process.env.RESET_SESSION === 'true') {
  const oldAuthPath = path.join(PERSIST_DIR, 'baileys_auth');
  try {
    fs.rmSync(oldAuthPath, { recursive: true, force: true });
    console.log('🗑️ تم حذف جلسة واتساب القديمة بنجاح (RESET_SESSION=true) - لازم تسوي ربط QR/كود من جديد.');
  } catch (err) {
    console.error('⚠️ خطأ أثناء محاولة حذف جلسة واتساب القديمة:', err.message);
  }
}

// تحميل أسئلة !دين مرة وحدة عند بدء التشغيل
router.initRouter(__dirname);

// ============ تشغيل السيرفر الويب (لعرض QR/كود الربط + health check) ============
startWebServer({ port: PORT, state, requestPairingCode, persistDir: PERSIST_DIR });

// ============ تشغيل الاتصال بواتساب ============
startWhatsApp({
  persistDir: PERSIST_DIR,
  onReady: (sock) => {
    prayer.startPrayerScheduler(sock, PERSIST_DIR);
  },
  onMessages: async (upsert) => {
    await router.handleMessagesUpsert(state.sock, upsert, IMAGES_DIR, PERSIST_DIR);
  },
  // group-participants.update: ترقية/تنزيل أدمن (الترحيب/الوداع محذوفين، مو معطّلين بس)
  onGroupUpdate: async (update) => {
    const sock = state.sock;
    if (!sock) return;
    await greetings.handleGroupParticipantsUpdate(sock, IMAGES_DIR, update, PERSIST_DIR);
  }
});

// groups.update: تغيير صورة الجروب / رابط الدعوة / الوصف
// (بيتسجل هون بعد ما state.sock يتحدد جوه startWhatsApp - نربطه أول ما يجهز)
const attachGroupsUpdateListener = () => {
  if (!state.sock) {
    setTimeout(attachGroupsUpdateListener, 1000);
    return;
  }
  state.sock.ev.on('groups.update', (updates) => {
    greetings.handleGroupsUpdate(state.sock, updates);
  });
};
attachGroupsUpdateListener();

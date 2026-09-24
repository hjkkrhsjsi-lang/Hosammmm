// ============ طبقة الاتصال بواتساب (Baileys) ============
// هذا الملف بديل كامل لجزء "إعداد عميل واتساب" اللي كان بـ index.js القديم
// (اللي كان مبني على whatsapp-web.js + Chromium).
//
// الفرق الجوهري عن قبل:
// - Baileys بيتصل مباشرة بواتساب عن طريق WebSocket، بدون متصفح Chromium خفي.
//   يعني ملغى تماماً: puppeteer, webVersionCache, resolveChromiumPath, والحارس التلقائي
//   (Watchdog) ضد هنج كروميوم - لأن السبب اللي كان يخلقه (كروميوم) مش موجود أصلاً هنا.
// - الجلسة بتتخزن بمجلد عادي (useMultiFileAuthState) بدل LocalAuth.
// - كود الربط برقم الهاتف: sock.requestPairingCode(number) - نفس الفكرة القديمة تماماً.
// - إعادة الاتصال التلقائي لسا موجودة (كانت مهمة قبل، وتضل مهمة هنا) لكن بمنطق Baileys
//   الرسمي: نفحص DisconnectReason، ولو مو "loggedOut" (يعني الجلسة لسا صالحة) نعيد الاتصال.

const path = require('path');
const fs = require('fs');
const pino = require('pino');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');

// ============ حالة عامة يقدر باقي البوت يقرأها (نفس دور المتغيرات القديمة lastQr/clientReady...) ============
const state = {
  sock: null,
  clientReady: false,
  lastQr: null,
  lastPairingCode: null,
  pairingInProgress: false,
  pairingError: null,
  reconnectAttempts: 0
};

const MAX_RECONNECT_DELAY_MS = 60000; // نفس القيمة القديمة: أقصى تأخير دقيقة بين المحاولات

// دالة يمررها اللي بيستدعي startWhatsApp عشان يوصل أحداث جاهزية/فصل لباقي البوت
// (مثلاً تشغيل سكيدولر الصلاة لما يجهز، أو ربط معالج الرسائل)
async function startWhatsApp({ persistDir, onReady, onMessages, onGroupUpdate }) {
  const authDir = path.join(persistDir, 'baileys_auth');
  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

  const { state: authState, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: authState,
    // مهم: نعطل QR الطرفية الافتراضي لأننا بنعرض QR/كود الربط بصفحة الويب بدل الكونسول
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }),
    browser: require('@whiskeysockets/baileys').Browsers.ubuntu('Chrome'),
    // خلي رسائل الحالة (status@broadcast) تتجاهل عشان ما تزيد حمل بلا داعي
    syncFullHistory: false
  });

  state.sock = sock;

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      state.lastQr = qr;
      state.clientReady = false;
      console.log('QR جديد جاهز! افتح رابط الويب لمسحه.');
    }

    if (connection === 'open') {
      state.clientReady = true;
      state.lastQr = null;
      state.lastPairingCode = null;
      state.reconnectAttempts = 0;
      console.log('✅ البوت جاهز ومتصل بواتساب!');
      if (onReady) onReady(sock);
    }

    if (connection === 'close') {
      state.clientReady = false;
      // ⚠️ ملاحظة مهمة (إصلاح خطأ): ما نمسح state.lastPairingCode هون -
      // كنا نمسحه هون قبل، بس هذا كان يبطل فحص "فيه كود ربط ينتظر" تحت
      // (سطر ~102) لأنه يشوفه فاضي دايماً ويعيد توليد كود جديد فوراً،
      // فيصير الكود "يطير" بثواني قبل ما المستخدم يلحق يدخله.
      // الحين نمسحه بس لما ينجح الربط فعلاً (بـ connection === 'open')
      // أو لما نطلب كود جديد يدوياً (requestPairingCode).
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;
      console.log('❌ انفصل البوت:', statusCode || lastDisconnect?.error?.message || 'سبب غير معروف');

      if (loggedOut) {
        // نفس فكرة RESET_SESSION القديمة: لو الجلسة اتسحبت فعلياً، لازم ربط جديد من الصفر
        console.log('🚪 تم تسجيل الخروج من واتساب (لوق آوت) - لازم ربط جديد (QR أو كود).');
        try {
          fs.rmSync(authDir, { recursive: true, force: true });
        } catch (err) {
          console.error('خطأ أثناء حذف الجلسة القديمة بعد تسجيل الخروج:', err.message);
        }
        setTimeout(() => startWhatsApp({ persistDir, onReady, onMessages, onGroupUpdate }), 3000);
        return;
      }

      // ⚠️ مهم: لو فيه كود ربط صادر ولسا ما تأكدش (المستخدم بيحاول يدخله بالهاتف الحين)،
      // ما نعيد إنشاء socket جديد فورًا، لأن هذا يبطل الكود القديم قبل ما يخلص المستخدم إدخاله.
      // (واتساب بيقفل الاتصال مؤقتاً وبشكل طبيعي بين توليد الكود ودخوله - هذا مو خطأ فعلي).
      const registered = authState?.creds?.registered;
      if (!registered && state.lastPairingCode) {
        console.log('⏳ الاتصال اتقفل مؤقتاً أثناء انتظار إدخال كود الربط - مش هعيد إنشاء اتصال جديد عشان ما يبطلش الكود. لو فشل الربط، اطلب كود جديد من الصفحة.');
        return;
      }

      // نفس منطق الباك-أوف القديم: تأخير بيكبر تدريجياً كل محاولة، بحد أقصى دقيقة
      state.reconnectAttempts += 1;
      const delay = Math.min(5000 * state.reconnectAttempts, MAX_RECONNECT_DELAY_MS);
      console.log(`🔄 هحاول أرجع أتصل بعد ${delay / 1000} ثانية (محاولة رقم ${state.reconnectAttempts})...`);
      setTimeout(() => startWhatsApp({ persistDir, onReady, onMessages, onGroupUpdate }), delay);
    }
  });

  if (onMessages) sock.ev.on('messages.upsert', onMessages);
  if (onGroupUpdate) {
    sock.ev.on('group-participants.update', onGroupUpdate);
  }

  return sock;
}

// ============ طلب كود ربط برقم هاتف (نفس فكرة requestPairingCode القديمة) ============
// الرقم لازم يكون بصيغة دولية بدون + وبدون صفر بالبداية، مثال: 9665xxxxxxxx
async function requestPairingCode(phoneNumber) {
  if (!state.sock) throw new Error('الاتصال لسا ما بدأش');
  state.pairingInProgress = true;
  state.pairingError = null;
  try {
    const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
    const code = await state.sock.requestPairingCode(cleanNumber);
    state.lastPairingCode = code;
    state.lastQr = null; // ما بنحتاج QR إذا في كود ربط
    return code;
  } catch (err) {
    state.pairingError = err.message || 'فشل توليد كود الربط';
    state.lastPairingCode = null;
    throw err;
  } finally {
    state.pairingInProgress = false;
  }
}

module.exports = {
  state,
  startWhatsApp,
  requestPairingCode
};

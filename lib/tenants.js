// ============ نظام الأرقام المتعددة (Tenants) ============
// الفكرة: صاحبك يكتب بجروب منصّب عندك: !تنصيب 2189xxxxxxxx
// 1) يوصلك طلب بالخاص، وإنت توافق: !مطورحسام+ ربط موافقة <رقم الطلب>
// 2) البوت يرسل لرقم صاحبك كود ربط (Pairing Code) يدخله بواتساب عنده
//    (الأجهزة المرتبطة ← ربط جهاز ← الربط برقم الهاتف)
// 3) من هالنقطة البوت يشتغل بجروبات صاحبك من رقمه هو، بجلسة مستقلة تماماً
//    (مجلد خاص فيه جلسة واتساب + بياناته: persist/tenants/<الرقم>)
// 4) إنت تشيله بأي وقت: !مطورحسام+ مشتركين ازالة <رقم> (بدون ما تدخل جروبه)
//
// كل جروبات الرقم المربوط تعتبر منصّبة تلقائياً (ملف .tenant داخل مجلده
// يخلي installations.isInstalled ترجع true) لأنه هو صاحب الرقم.

'use strict';

const fs = require('fs');
const path = require('path');
const pino = require('pino');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers
} = require('@whiskeysockets/baileys');

// أقصى عدد أرقام مربوطة بنفس الوقت (كل رقم = اتصال + ذاكرة + استهلاك مفاتيح AI عندك)
const MAX_TENANTS = parseInt(process.env.MAX_TENANTS || '100', 10);
const MAX_RECONNECT_DELAY_MS = 60000;
const CODE_WAIT_MS = 45000;

// 🆕 كود الربط المخصص: 8 خانات حروف إنجليزية كبيرة/أرقام (مثل LUNABOT1). غيّره من .env بـ CUSTOM_PAIRING_CODE
// أو اتركه فاضي (CUSTOM_PAIRING_CODE=) عشان يولّد واتساب كود عشوائي. أي قيمة مو 8 خانات تتجاهل.
const RAW_CUSTOM_CODE =
  process.env.CUSTOM_PAIRING_CODE === undefined ? 'LUNABOT1' : process.env.CUSTOM_PAIRING_CODE;
const CUSTOM_PAIRING_CODE = /^[A-Z0-9]{8}$/.test(String(RAW_CUSTOM_CODE).toUpperCase())
  ? String(RAW_CUSTOM_CODE).toUpperCase()
  : undefined;

let ctx = null; // { rootDir, imagesDir, router, prayer, greetings, getMainSock }
const sessions = new Map(); // number -> session

// ============ السجل (طلبات معلقة + أرقام فعالة) ============
function regFile() {
  return path.join(ctx.rootDir, 'tenants.json');
}

function loadReg() {
  try {
    const d = JSON.parse(fs.readFileSync(regFile(), 'utf8'));
    return { nextId: d.nextId || 1, pending: d.pending || {}, active: d.active || {} };
  } catch (err) {
    return { nextId: 1, pending: {}, active: {} };
  }
}

function saveReg(data) {
  const tmp = regFile() + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, regFile());
}

function tenantDir(number) {
  return path.join(ctx.rootDir, 'tenants', number);
}

// هل مجلد البيانات هذا يخص رقم مربوط (مو الرقم الرئيسي)؟
function isTenantDir(persistDir) {
  return fs.existsSync(path.join(persistDir, '.tenant'));
}

// يقبل الرقم بصيغة دولية بدون + (مثال 218912345678)
// كود الدولة الافتراضي للأرقام المحلية (اللي تبدأ بصفر مثل 0942301686). الافتراضي ليبيا 218،
// وتغيّره من .env بـ DEFAULT_COUNTRY_CODE (أو تخليه فاضي عشان ترفض الأرقام المحلية).
const DEFAULT_COUNTRY_CODE = String(
  process.env.DEFAULT_COUNTRY_CODE === undefined ? '218' : process.env.DEFAULT_COUNTRY_CODE
).replace(/\D/g, '');

function normalizeNumber(input) {
  let digits = String(input || '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  else if (digits.startsWith('0')) {
    if (!DEFAULT_COUNTRY_CODE) return null; // صيغة محلية وما عندنا كود دولة افتراضي
    digits = DEFAULT_COUNTRY_CODE + digits.slice(1);
  }
  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}

function mainSock() {
  return ctx && ctx.getMainSock ? ctx.getMainSock() : null;
}

async function notifyJid(jid, text) {
  const sock = mainSock();
  if (!sock) return false;
  try {
    await sock.sendMessage(jid, { text });
    return true;
  } catch (err) {
    console.error('خطأ بإرسال إشعار (tenants):', err.message);
    return false;
  }
}

// ============ إنشاء الاتصال لرقم واحد ============
function scheduleReconnect(number, sess) {
  if (sess.stopped) return;
  sess.attempts += 1;
  const delay = Math.min(5000 * sess.attempts, MAX_RECONNECT_DELAY_MS);
  console.log(`🔄 [tenant ${number}] إعادة اتصال بعد ${delay / 1000} ثانية (محاولة ${sess.attempts})`);
  setTimeout(() => {
    connect(number, sess).catch((err) => {
      console.error(`[tenant ${number}] فشل إعادة الاتصال:`, err.message);
      scheduleReconnect(number, sess);
    });
  }, delay);
}

async function connect(number, sess) {
  if (sess.stopped) return;

  const { state: authState, saveCreds } = await useMultiFileAuthState(sess.authDir);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: authState,
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }),
    browser: Browsers.ubuntu('Chrome'),
    syncFullHistory: false
  });
  sess.sock = sock;

  sock.ev.on('creds.update', saveCreds);

  let codeAsked = false;

  sock.ev.on('connection.update', async (update) => {
    if (sess.sock !== sock) return; // سوكت قديم استبدلناه
    const { connection, lastDisconnect, qr } = update;

    // سجل تشخيصي: يساعدنا نعرف وين يفشل الربط (وقت الكود، سبب الانفصال...)
    if (connection || qr || lastDisconnect) {
      console.log(
        `[tenant ${number}] ${new Date().toISOString()} update:`,
        JSON.stringify({
          connection: connection || null,
          qr: !!qr,
          statusCode: lastDisconnect?.error?.output?.statusCode || null,
          registered: !!authState.creds.registered
        })
      );
    }

    // وضع QR: نحفظ آخر QR فقط (يتجدد كل شوي) والمطور يطلبه كصورة. ما نطلب كود ربط بهالوضع
    // لأن طلب الكود يغيّر بيانات الجلسة ويخرّب الـQR.
    if (qr && !authState.creds.registered && sess.mode === 'qr') {
      sess.lastQr = qr;
      if (sess.resolveCode) {
        sess.resolveCode(qr);
        sess.resolveCode = null;
      }
    }

    // أول ما يجهز الاتصال وما فيه ربط، نطلب كود الربط (مرة وحدة بس، لأن كل طلب يبطل اللي قبله)
    if (qr && !authState.creds.registered && sess.mode !== 'qr' && !codeAsked && !sess.pairingCode) {
      codeAsked = true;
      try {
        const code = await sock.requestPairingCode(number, CUSTOM_PAIRING_CODE);
        sess.pairingCode = code;
        console.log(`[tenant ${number}] ${new Date().toISOString()} انولد كود الربط، بانتظار إدخاله`);
        if (sess.resolveCode) sess.resolveCode(code);
      } catch (err) {
        console.error(`[tenant ${number}] فشل توليد كود الربط:`, err.message);
        if (sess.resolveCode) sess.resolveCode(null);
      }
    }

    if (connection === 'open') {
      sess.ready = true;
      sess.unpaired = false;
      sess.attempts = 0;
      sess.pairingCode = null;
      console.log(`✅ [tenant ${number}] متصل`);

      const reg = loadReg();
      const entry = reg.active[number];
      const firstTime = entry && !entry.paired;
      if (entry && !entry.paired) {
        entry.paired = true;
        entry.pairedAt = Date.now();
        saveReg(reg);
      }
      if (firstTime) {
        // رسالة ترحيب لنفسه (Note to self) + إشعار للمطور
        try {
          await sock.sendMessage(`${number}@s.whatsapp.net`, {
            text: '✅ تم ربط البوت على رقمك. الجروبات اللي رقمك فيها صارت منصّبة تلقائياً، جرّب !اوامر بأي جروب.'
          });
        } catch (err) {
          console.error(`[tenant ${number}] فشل رسالة الترحيب:`, err.message);
        }
        const ownerJids = (ctx.ownerJids || []).slice();
        for (const jid of ownerJids) {
          await notifyJid(jid, `🟢 الرقم +${number} انربط بنجاح.`);
        }
      }

      try {
        if (ctx.prayer) ctx.prayer.startPrayerScheduler(sock, sess.dir);
      } catch (err) {
        console.error(`[tenant ${number}] خطأ بتشغيل سكيدولر الصلاة:`, err.message);
      }
    }

    if (connection === 'close') {
      sess.ready = false;
      if (sess.stopped) return;

      const statusCode = lastDisconnect?.error?.output?.statusCode;
      console.log(`❌ [tenant ${number}] انفصل:`, statusCode || lastDisconnect?.error?.message || 'غير معروف');

      if (statusCode === DisconnectReason.loggedOut) {
        await handleLoggedOut(number);
        return;
      }

      // بعد إدخال كود الربط، واتساب يطلب إعادة تشغيل الاتصال - هذا طبيعي
      if (statusCode === DisconnectReason.restartRequired) {
        setTimeout(() => {
          connect(number, sess).catch((err) => {
            console.error(`[tenant ${number}] فشل إعادة التشغيل بعد الربط:`, err.message);
            scheduleReconnect(number, sess);
          });
        }, 500);
        return;
      }

      // لسا ما انربط (الكود انتهى أو ما انكتب): ما نكرر المحاولات
      if (!authState.creds.registered) {
        sess.unpaired = true;
        sess.pairingCode = null;
        console.log(`⏳ [tenant ${number}] ما اكتمل الربط. تقدر تطلب كود جديد: !مطورحسام+ مشتركين كود <رقم>`);
        return;
      }

      scheduleReconnect(number, sess);
    }
  });

  sock.ev.on('messages.upsert', async (upsert) => {
    try {
      await ctx.router.handleMessagesUpsert(sock, upsert, ctx.imagesDir, sess.dir);
    } catch (err) {
      console.error(`[tenant ${number}] خطأ بمعالجة الرسائل:`, err?.message || err);
    }
  });

  sock.ev.on('group-participants.update', async (update) => {
    try {
      await ctx.greetings.handleGroupParticipantsUpdate(sock, ctx.imagesDir, update, sess.dir);
    } catch (err) {
      console.error(`[tenant ${number}] خطأ بتحديث المشاركين:`, err?.message || err);
    }
  });

  sock.ev.on('groups.update', (updates) => {
    try {
      Promise.resolve(ctx.greetings.handleGroupsUpdate(sock, updates)).catch((err) => {
        console.error(`[tenant ${number}] خطأ بتحديث الجروبات:`, err?.message || err);
      });
    } catch (err) {
      console.error(`[tenant ${number}] خطأ بتحديث الجروبات:`, err?.message || err);
    }
  });
}

// يبدأ جلسة جديدة لرقم. يرجّع Promise بكود الربط (أو null لو ما انولد/الرقم مربوط أصلاً)
function startSession(number, mode = 'code') {
  const dir = tenantDir(number);
  const authDir = path.join(dir, 'baileys_auth');
  fs.mkdirSync(authDir, { recursive: true });
  fs.writeFileSync(path.join(dir, '.tenant'), String(Date.now()));

  const sess = {
    number,
    dir,
    authDir,
    sock: null,
    ready: false,
    attempts: 0,
    pairingCode: null,
    stopped: false,
    unpaired: false,
    mode,
    lastQr: null,
    resolveCode: null
  };
  const codePromise = new Promise((resolve) => {
    sess.resolveCode = resolve;
    setTimeout(() => resolve(null), CODE_WAIT_MS);
  });

  sessions.set(number, sess);
  connect(number, sess).catch((err) => {
    console.error(`[tenant ${number}] فشل بدء الاتصال:`, err.message);
    scheduleReconnect(number, sess);
  });
  return codePromise;
}

async function stopSession(number, { logout = false } = {}) {
  const sess = sessions.get(number);
  if (!sess) return;
  sess.stopped = true;
  if (sess.sock) {
    if (logout) {
      try {
        await sess.sock.logout();
      } catch (err) {
        // لو فشل (غير متصل مثلاً) نكمل بقطع الاتصال عادي
      }
    }
    try {
      sess.sock.end(undefined);
    } catch (err) {
      // تجاهل
    }
  }
  sessions.delete(number);
}

function deleteTenantData(number) {
  try {
    fs.rmSync(tenantDir(number), { recursive: true, force: true });
  } catch (err) {
    console.error(`[tenant ${number}] خطأ بحذف الملفات:`, err.message);
  }
}

// صاحب الرقم فصل البوت من واتساب عنده (الأجهزة المرتبطة)
async function handleLoggedOut(number) {
  console.log(`🚪 [tenant ${number}] فصل الجهاز من هاتفه - نشيله من السجل`);
  await stopSession(number);
  deleteTenantData(number);
  const reg = loadReg();
  delete reg.active[number];
  saveReg(reg);
  for (const jid of ctx.ownerJids || []) {
    await notifyJid(jid, `🚪 الرقم +${number} فصل البوت من جهازه، انشال من القائمة.`);
  }
}

// ============ إزالة رقم (من عندك) ============
async function removeTenant(number) {
  await stopSession(number, { logout: true });
  deleteTenantData(number);
  const reg = loadReg();
  delete reg.active[number];
  saveReg(reg);
}

// ============ طلب كود جديد لرقم ما اكتمل ربطه ============
async function regenerateCode(number, mode = 'code') {
  const reg = loadReg();
  if (!reg.active[number]) return { ok: false, reason: 'notfound' };
  if (reg.active[number].paired) return { ok: false, reason: 'paired' };
  await stopSession(number);
  try {
    fs.rmSync(path.join(tenantDir(number), 'baileys_auth'), { recursive: true, force: true });
  } catch (err) {
    // تجاهل
  }
  const code = await startSession(number, mode); // بوضع qr يرجّع نص الـQR بدل الكود
  return { ok: !!code, code, reason: code ? null : 'nocode' };
}

// صورة QR (PNG) من نص الـQR - تحتاج مكتبة qrcode (موجودة بـ package.json)
async function qrToPng(qrText) {
  const QRCode = require('qrcode');
  return QRCode.toBuffer(qrText, { scale: 8, margin: 2 });
}

// ============ طلبات الربط ============
function requestLink({ chatId, groupName, requesterJid, number }) {
  const clean = normalizeNumber(number);
  if (!clean) return { ok: false, reason: 'invalid' };

  const reg = loadReg();
  if (reg.active[clean]) return { ok: false, reason: 'active' };
  for (const [id, p] of Object.entries(reg.pending)) {
    if (p.number === clean) return { ok: false, reason: 'pending', id };
  }
  if (Object.keys(reg.active).length >= MAX_TENANTS || Object.keys(reg.pending).length >= Math.max(20, MAX_TENANTS)) {
    return { ok: false, reason: 'limit' };
  }

  const id = reg.nextId++;
  reg.pending[id] = { number: clean, chatId, groupName, requesterJid, createdAt: Date.now() };
  saveReg(reg);
  return { ok: true, id, number: clean };
}

async function approve(id) {
  const reg = loadReg();
  const p = reg.pending[id];
  if (!p) return { ok: false, reason: 'notfound' };
  if (Object.keys(reg.active).length >= MAX_TENANTS) return { ok: false, reason: 'limit' };

  delete reg.pending[id];
  reg.active[p.number] = {
    number: p.number,
    requesterJid: p.requesterJid,
    chatId: p.chatId,
    groupName: p.groupName,
    approvedAt: Date.now(),
    paired: false
  };
  saveReg(reg);

  const code = await startSession(p.number);
  return { ok: true, number: p.number, code, pending: p };
}

function reject(id) {
  const reg = loadReg();
  const p = reg.pending[id];
  if (!p) return null;
  delete reg.pending[id];
  saveReg(reg);
  return p;
}

function codeMessage(code, number) {
  return (
    '🔐 *نظام البوتات الفرعية*\n' +
    '━━━━━━━━━━━━━━\n' +
    (number ? `📱 الرقم: +${number}\n` : '') +
    `🔑 الكود: *${code}*\n` +
    '━━━━━━━━━━━━━━\n' +
    '*خطوات ربط البوت:*\n' +
    '1️⃣ افتح تطبيق واتساب.\n' +
    '2️⃣ اذهب إلى الإعدادات ثم الأجهزة المرتبطة.\n' +
    '3️⃣ اضغط على ربط جهاز ثم اختر (الربط برقم الهاتف بدلاً من ذلك).\n' +
    '4️⃣ أدخل الكود الظاهر أعلاه في هاتفك.\n\n' +
    '⏳ الكود صالح لدقائق قليلة فقط.'
  );
}

// ============ أمر !تنصيب (من عضو، بجروب منصّب) ============
// الرقم اختياري: لو ما كتبه العضو ناخذ رقمه الحقيقي من رسالته (ownNumber).
// الإشعار للمطور ينزل بنفس الجروب اللي انكتب فيه الأمر، والمطور يرد هناك.
async function handleRequestCommand({ sock, msg, wa, chatId, authorId, argText, ownNumber, ownerJids, autoApprove }) {
  const wanted = argText || ownNumber;
  if (!wanted) {
    await wa.reply(
      sock,
      msg,
      'ما قدرت أعرف رقمك تلقائياً 😅\nاكتب رقمك بصيغة دولية بدون +:\n!تنصيب 218912345678'
    );
    return;
  }

  let groupName = '';
  try {
    const meta = await sock.groupMetadata(chatId);
    groupName = meta.subject || '';
  } catch (err) {
    console.error('خطأ بجيب اسم الجروب (طلب ربط):', err.message);
  }

  const res = requestLink({ chatId, groupName, requesterJid: authorId, number: wanted });
  if (!res.ok) {
    const texts = {
      invalid: 'الرقم غير صحيح. اكتبه بصيغة دولية بدون +\nمثال: !تنصيب 218912345678',
      active: 'هالرقم مربوط أصلاً ✅',
      pending: `⏳ فيه طلب ربط مرسل أصلاً لهالرقم (رقم #${res.id}), بانتظار موافقة المطور.`,
      limit: 'وصلنا الحد الأقصى حالياً، كلم المطور.'
    };
    await wa.reply(sock, msg, texts[res.reason] || 'ما قدرت أسجّل الطلب.');
    return;
  }

  // المطور طلب الربط بنفسه: موافقة مباشرة بدون انتظار
  if (autoApprove) {
    await wa.reply(sock, msg, `⏳ جاري تنصيب بوت للرقم +${res.number} ...`);
    const ap = await approve(res.id);
    if (!ap.ok || !ap.code) {
      await wa.reply(
        sock,
        msg,
        ap.ok
          ? 'ما انولد كود الربط. جرّب من الخاص: !مطورحسام+ مشتركين كود <رقمه من القائمة>'
          : 'ما قدرت أنصّب: ' + (ap.reason === 'limit' ? 'وصلت الحد الأقصى للأرقام.' : 'خطأ غير معروف.')
      );
      return;
    }
    await wa.reply(sock, msg, codeMessage(ap.code, res.number));
    await notifyJid(`${res.number}@s.whatsapp.net`, codeMessage(ap.code, res.number));
    return;
  }

  // رسالة وحدة بنفس الجروب: تأكيد للعضو + تعليمات للمطور
  await wa.reply(
    sock,
    msg,
    `📲 *طلب ربط بوت على رقم* #${res.id}\n\n` +
      `👤 الطالب: ${wa.tag(authorId)}\n` +
      `📞 الرقم: +${res.number}\n\n` +
      `🕵️ المطور يرد هنا:\n` +
      `للموافقة: !ربط موافقة ${res.id}\n` +
      `للرفض: !ربط رفض ${res.id}`
  );

  // نسخة بالخاص للمطور (إضافية، لو وصلت زين، لو لا ما يهم)
  for (const jid of ownerJids || ctx.ownerJids || []) {
    try {
      await sock.sendMessage(jid, {
        text:
          `📲 طلب ربط جديد #${res.id}\n` +
          `📞 +${res.number}\n` +
          `👥 ${groupName || '(بدون اسم)'}\n\n` +
          `من الخاص: !مطورحسام+ ربط موافقة ${res.id}`
      });
    } catch (err) {
      console.error('خطأ بإرسال نسخة الخاص للمطور:', err.message);
    }
  }
}

// ============ موافقة/رفض المطور من داخل الجروب: !ربط موافقة <رقم> | !ربط رفض <رقم> ============
// (تحقق المطور يصير بالراوتر قبل ما ينادى هذا)
async function handleGroupApproval({ sock, msg, wa, action, id }) {
  if (action === 'موافقة') {
    const res = await approve(id);
    if (!res.ok) {
      const t = {
        notfound: 'ما لقيت طلب بهالرقم.',
        limit: 'وصلت الحد الأقصى للأرقام. شيل رقم أول (!مطورحسام+ مشتركين بالخاص).'
      };
      await wa.reply(sock, msg, t[res.reason] || 'ما قدرت أوافق.');
      return;
    }
    if (!res.code) {
      await wa.reply(
        sock,
        msg,
        `⚠️ وافقت على +${res.number} بس ما انولد كود الربط.\nمن الخاص: !مطورحسام+ مشتركين كود <رقمه من القائمة>`
      );
      return;
    }
    // الكود ينزل بالجروب (صاحب الرقم موجود فيه) + نسخة بالخاص لرقمه
    await wa.reply(sock, msg, `✅ ${wa.tag(res.pending.requesterJid)} وافق المطور على ربط +${res.number}\n\n` + codeMessage(res.code, res.number));
    await notifyJid(`${res.number}@s.whatsapp.net`, codeMessage(res.code, res.number));
    return;
  }

  if (action === 'رفض') {
    const p = reject(id);
    if (!p) {
      await wa.reply(sock, msg, 'ما لقيت طلب بهالرقم.');
      return;
    }
    await wa.reply(sock, msg, `🚫 ${wa.tag(p.requesterJid)} انرفض طلب ربط +${p.number}.`);
    return;
  }
}

// ============ أوامر المطور: ربط / مشتركين ============
async function handleDevCommand({ sock, msg, wa, sub, rest }) {
  const [action, arg] = rest;

  if (sub === 'ربط') {
    if (!action || action === 'قائمة') {
      const reg = loadReg();
      const ids = Object.keys(reg.pending);
      if (!ids.length) {
        await wa.reply(sock, msg, '📭 ما فيه طلبات ربط معلقة.');
        return;
      }
      const lines = ids.map((id) => {
        const p = reg.pending[id];
        return `#${id} — +${p.number} — ${p.groupName || p.chatId}`;
      });
      await wa.reply(
        sock,
        msg,
        '📲 *طلبات الربط المعلقة:*\n\n' +
          lines.join('\n') +
          '\n\nللموافقة: !مطورحسام+ ربط موافقة <رقم>\nللرفض: !مطورحسام+ ربط رفض <رقم>'
      );
      return;
    }

    if (action === 'موافقة') {
      const res = await approve(arg);
      if (!res.ok) {
        const t = {
          notfound: 'ما لقيت طلب بهالرقم. اكتب !مطورحسام+ ربط عشان تشوف الطلبات.',
          limit: 'وصلت الحد الأقصى للأرقام. شيل رقم أول (!مطورحسام+ مشتركين).'
        };
        await wa.reply(sock, msg, t[res.reason] || 'ما قدرت أوافق.');
        return;
      }
      if (!res.code) {
        await wa.reply(
          sock,
          msg,
          `⚠️ وافقت على +${res.number} بس ما انولد كود الربط.\nجرّب: !مطورحسام+ مشتركين كود <رقمه من القائمة>`
        );
        return;
      }
      const sent = await notifyJid(`${res.number}@s.whatsapp.net`, codeMessage(res.code, res.number));
      await wa.reply(
        sock,
        msg,
        sent
          ? `✅ وافقت على +${res.number} وأرسلت له كود الربط بالخاص.\n(الكود: ${res.code})`
          : `✅ وافقت على +${res.number} بس ما قدرت أرسل له الكود.\nأرسله له بنفسك: ${res.code}`
      );
      return;
    }

    if (action === 'رفض') {
      const p = reject(arg);
      if (!p) {
        await wa.reply(sock, msg, 'ما لقيت طلب بهالرقم.');
        return;
      }
      await notifyJid(`${p.number}@s.whatsapp.net`, '❌ طلب ربط البوت على رقمك انرفض.');
      await wa.reply(sock, msg, `🚫 رفضت طلب +${p.number}.`);
      return;
    }

    await wa.reply(sock, msg, 'استخدم: !مطورحسام+ ربط قائمة | موافقة <رقم> | رفض <رقم>');
    return;
  }

  if (sub === 'مشتركين') {
    const reg = loadReg();
    const list = Object.values(reg.active).sort((a, b) => a.approvedAt - b.approvedAt);

    if (!action) {
      if (!list.length) {
        await wa.reply(sock, msg, '📭 ما فيه أرقام مربوطة.');
        return;
      }
      const lines = list.map((t, i) => {
        const s = sessions.get(t.number);
        const status = s && s.ready ? '🟢 متصل' : t.paired ? '🔴 غير متصل' : '🟡 بانتظار إدخال الكود';
        return `${i + 1}. +${t.number} — ${status}`;
      });
      await wa.reply(
        sock,
        msg,
        '👥 *الأرقام المربوطة:*\n\n' +
          lines.join('\n') +
          '\n\nللإزالة: !مطورحسام+ مشتركين ازالة <رقم>\nلكود جديد: !مطورحسام+ مشتركين كود <رقم>\nلصورة QR بدل الكود: !مطورحسام+ مشتركين qr <رقم>'
      );
      return;
    }

    const idx = parseInt(arg, 10);
    const target = list[idx - 1];
    if ((action === 'ازالة' || action === 'كود' || action === 'qr') && !target) {
      await wa.reply(sock, msg, 'رقم غير صحيح. اكتب !مطورحسام+ مشتركين عشان تشوف الأرقام.');
      return;
    }

    if (action === 'ازالة') {
      await removeTenant(target.number);
      await wa.reply(sock, msg, `🗑️ شلت +${target.number} وفصلت جلسته. البوت ما عاد يشتغل على رقمه.`);
      return;
    }

    if (action === 'كود') {
      const res = await regenerateCode(target.number);
      if (!res.ok) {
        const t = {
          paired: 'هالرقم مربوط أصلاً، ما يحتاج كود.',
          nocode: 'ما انولد كود، جرّب مرة ثانية بعد شوي.'
        };
        await wa.reply(sock, msg, t[res.reason] || 'ما قدرت أولّد كود.');
        return;
      }
      const sent = await notifyJid(`${target.number}@s.whatsapp.net`, codeMessage(res.code, target.number));
      await wa.reply(
        sock,
        msg,
        sent
          ? `🔗 أرسلت كود جديد لـ +${target.number}.\n(الكود: ${res.code})`
          : `🔗 الكود الجديد لـ +${target.number}: ${res.code}\n(ما قدرت أرسله له، أرسله بنفسك)`
      );
      return;
    }

    if (action === 'qr') {
      const res = await regenerateCode(target.number, 'qr');
      if (!res.ok) {
        const t = {
          paired: 'هالرقم مربوط أصلاً.',
          nocode: 'ما طلع QR، جرّب مرة ثانية بعد شوي.'
        };
        await wa.reply(sock, msg, t[res.reason] || 'ما قدرت أجيب QR.');
        return;
      }
      const sess = sessions.get(target.number);
      try {
        const png = await qrToPng((sess && sess.lastQr) || res.code);
        await sock.sendMessage(
          msg.key.remoteJid,
          {
            image: png,
            caption:
              `📷 QR لربط +${target.number}\n\n` +
              'من جوال الرقم نفسه: واتساب ← الأجهزة المرتبطة ← ربط جهاز، ووجّه الكاميرا على هالصورة (من جوال ثاني).\n' +
              'يتجدد بسرعة، لو انتهى اطلبه من جديد.'
          },
          { quoted: msg }
        );
      } catch (err) {
        console.error('خطأ بإرسال صورة QR:', err.message);
        await wa.reply(sock, msg, 'ما قدرت أرسل صورة الـQR: ' + err.message);
      }
      return;
    }

    await wa.reply(sock, msg, 'استخدم: !مطورحسام+ مشتركين | ازالة <رقم> | كود <رقم> | qr <رقم>');
  }
}

// ============ التهيئة والاستعادة ============
function init(options) {
  ctx = options;
  // أرقام المطور (من OWNER_NUMBERS بالراوتر) -> JIDs لإرسال الإشعارات
  ctx.ownerJids = (options.ownerNumbers || []).map((n) => String(n).replace(/\D/g, '') + '@s.whatsapp.net');
  fs.mkdirSync(path.join(ctx.rootDir, 'tenants'), { recursive: true });
}

// يرجّع تشغيل كل الأرقام اللي اكتمل ربطها (عند إعادة تشغيل السيرفر)
function restoreAll() {
  const reg = loadReg();
  const paired = Object.values(reg.active).filter((t) => t.paired);
  paired.forEach((t, i) => {
    // نبدأهم بالتدريج عشان ما يتصلوا كلهم بنفس اللحظة
    setTimeout(() => {
      if (!sessions.has(t.number)) startSession(t.number);
    }, i * 3000);
  });
  if (paired.length) console.log(`♻️ استعادة ${paired.length} رقم مربوط...`);
}

module.exports = {
  init,
  restoreAll,
  isTenantDir,
  handleRequestCommand,
  handleGroupApproval,
  handleDevCommand
};

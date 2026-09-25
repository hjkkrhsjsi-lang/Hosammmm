// ============ معالجة كل الرسائل (النسخة الكاملة - Baileys) ============
// نفس ترتيب الفحوصات والنصوص والمنطق من index.js القديم بالظبط، بس بواجهة Baileys.
// XP اتحذف بالكامل بطلب المستخدم، فكل نقاط تسجيل/مكافأة XP اتشالت من هون.

const fs = require('fs');
const path = require('path');
const wa = require('./wa-helpers');
const R = require('./responses'); // كل نصوص ردود البوت (راجع lib/responses.js)
const { jidToNumber, numberToJid, getCountryFlag } = require('./util');
const moderation = require('./moderation');
const imageGen = require('./image-gen');
const links = require('./links');
const marriage = require('./marriage');
const games = require('./games');
const ai = require('./ai');
const media = require('./media');
const banners = require('./banners');
const greetings = require('./greetings');
const { SHARED_LINK, GROQ_API_KEY } = require('./config');
const prayer = require('./prayer');
const { textToVoiceBuffer, transcribeVoiceBuffer } = require('./voice');
const cmdSettings = require('./command-settings');
const textStyler = require('./text-styler');
const fortune = require('./fortune');
const typingRace = require('./typing-race');
const triviaTF = require('./trivia-tf');
const gamesLiar = require('./games-liar');
const gamesWYR = require('./games-wyr');
const gamesDiff = require('./games-spot-diff');
const gamesEmotion = require('./games-emotion');
const gamesTreasure = require('./games-treasure');
const gamesScramble = require('./games-scramble');
const gamesProverb = require('./games-proverb');
const gamesMath = require('./games-math');
const gamesCapital = require('./games-capital');
const pinterestSearch = require('./pinterest-search');
const { sendAlbumMessage } = require('./send-album');
const tiktokSearch = require('./tiktok-search');
const browseSession = require('./browse-session');
const messageLogger = require('./message-logger');
const quoteCard = require('./quote-card');
const personalityAnalysis = require('./personality-analysis');
const styleDirective = require('./style-directive');
const stickerMaker = require('./sticker-maker');
const deletionWatch = require('./deletion-watch'); // 🆕 كشف حذف الرسائل (Delete for everyone) - ملف مستقل بالكامل

// 🔧 الأزرار التفاعلية (quick_reply) ترجع display_text زي ما هو **شامل الإيموجي**
// (مثلاً "🔥 !عام" أو "© حقوق بوت")، لكن نصوص أوامرنا نظيفة بدون إيموجي. هاي الدالة
// تشيل أي إيموجي/رمز/مسافات من بداية النص لحد أول حرف عربي أو "!"، عشان مطابقة
// body === '...' تشتغل سواء المستخدم كتب الأمر يدوياً أو ضغط الزر.
function stripButtonEmoji(text) {
  return (text || '').replace(/^[^\u0621-\u064A!]+/, '').trim();
}

// خرائط تحديد "أي أمر يطابق أي رسالة" — تُستخدم بس عشان نتحقق هل الأمر مفعّل
// من لوحة التحكم قبل ما نكمّل بمنطقه الأصلي (بدون ما نلمس كل بلوك على حدة)
const COMMAND_GATES = [
  { key: 'ليون', test: (b) => b.startsWith('!ليون') },
  { key: 'اشلي', test: (b) => b.startsWith('!اشلي') },
  { key: 'صليون', test: (b) => b.startsWith('!صليون') },
  { key: 'صاشلي', test: (b) => b.startsWith('!صاشلي') },
  { key: 'بروفايل', test: (b) => b.startsWith('!بروفايل') },
  { key: 'رابط', test: (b) => b === '!رابط' },
  { key: 'اوامر', test: (b) => b === '!اوامر' },
  { key: 'عام', test: (b) => stripButtonEmoji(b) === '!عام' },
  { key: 'العاب', test: (b) => stripButtonEmoji(b) === '!العاب' },
  { key: 'ادارة', test: (b) => stripButtonEmoji(b) === '!ادارة' },
  { key: 'قفل_فتح', test: (b) => b === '!قفل' || b === '!فتح' },
  { key: 'روابط_الجروب', test: (b) => b === '!فتح رابط' || b === '!قفل رابط' },
  { key: 'باند', test: (b) => b.startsWith('!باند') },
  { key: 'اصعد', test: (b) => b.startsWith('!اصعد') },
  { key: 'انزل', test: (b) => b.startsWith('!انزل') },
  { key: 'منشن', test: (b) => b.startsWith('!منشن') },
  { key: 'تغيير_صورة', test: (b) => b.startsWith('!تغيير_صورة') },
  { key: 'استريك', test: (b) => b.startsWith('!استريك') },
  { key: 'ازالة_تحذير', test: (b) => b.startsWith('!ازالة_تحذير') },
  { key: 'مخالفة', test: (b) => b.startsWith('!مخالفة') || b.startsWith('!مخالفه') },
  { key: 'توقف_تشغيل', test: (b) => b === '!توقف' || b === '!تشغيل' },
  { key: 'تحدي', test: (b) => b.startsWith('!تحدي') },
  { key: 'دين', test: (b) => b.startsWith('!دين') },
  { key: 'من_فينا', test: (b) => b.startsWith('!من_فينا') },
  { key: 'زواج', test: (b) => b.startsWith('!زواج') },
  { key: 'طلاق', test: (b) => b.startsWith('!طلاق') },
  { key: 'تفعيل_تنبيه_الصلاة', test: (b) => b.startsWith('!تفعيل_تنبيه_الصلاة') },
  { key: 'ايقاف_تنبيه_الصلاة', test: (b) => b.startsWith('!ايقاف_تنبيه_الصلاة') },
  { key: 'صلاة', test: (b) => b.startsWith('!صلاة') },
  { key: 'ستايل', test: (b) => b.startsWith('!ستايل') },
  { key: 'توقع', test: (b) => b === '!توقع' },
  { key: 'سباق', test: (b) => b.startsWith('!سباق') },
  { key: 'صح_غلط', test: (b) => b.startsWith('!صح_غلط') },
  { key: 'اقتباس', test: (b) => b.startsWith('!اقتباس') },
  { key: 'تحليل_شخصية', test: (b) => b.startsWith('!تحليل_شخصية') },
  { key: 'كذبة', test: (b) => b.startsWith('!كذبة') },
  { key: 'خيروك', test: (b) => b.startsWith('!خيروك') },
  { key: 'فرق', test: (b) => b.startsWith('!فرق') },
  { key: 'شعور', test: (b) => b.startsWith('!شعور') },
  { key: 'كنز', test: (b) => b.startsWith('!كنز') },
  { key: 'حروف', test: (b) => b.startsWith('!حروف') },
  { key: 'مثل', test: (b) => b.startsWith('!مثل') },
  { key: 'حساب', test: (b) => b.startsWith('!حساب') },
  { key: 'عاصمة', test: (b) => b.startsWith('!عاصمة') },
  { key: 'بن', test: (b) => b.startsWith('!بن') },
  { key: 'تك', test: (b) => b.startsWith('!تك') },
  { key: 'رابط', test: (b) => b.startsWith('!رابط') }
];

// ============ أزرار سريعة لكل أمر داخل قسم معيّن (تُستخدم بعد !عام / !العاب / !ادارة) ============
// بتاخد كل الأوامر المفعّلة بهاد القسم من COMMAND_DEFS (عبر command-settings.js، فلو حد
// عطّل أمر من لوحة التحكم بيختفي زره تلقائياً بدون أي تعديل هون) وتبعتها كأزرار quick_reply،
// مقسّمة كل 3 أزرار برسالة لحالها (واتساب ما يضمن أكتر من هيك بشكل موثوق بالرسالة الوحدة).
//
// بضغطة أي زر، واتساب يبعت display_text (= نص الأمر نفسه زي "!ليون") تماماً وكأن المستخدم
// كتبه يدوياً، فمنطق المعالجة العادي (COMMAND_GATES + كل بلوكات الأوامر تحت) بيستقبلها ويشتغل
// عليها تلقائياً بدون أي كود إضافي هون - حتى لو الأمر أصلاً بياخد نص/منشن بعده (زي !ليون أو
// !بروفايل)، لأن كل هاي الأوامر مبنية أصلاً إنها تشتغل بشكل افتراضي منطقي لو انضغطت بدون نص
// إضافي (!ليون بدون سؤال = سلام عادي، !بروفايل بدون منشن = بروفايل الضاغط نفسه، !صوت بدون نص
// = تطلب منه يكتب اللي يبيه يتحول لصوت... إلخ)، فما فيه احتمال تعليق أو كراش.
// ============ قوايم أوامر معلّقة (بديل الأزرار التفاعلية) ============
// واتساب بطّل دعم interactiveButtons/quick_reply للأرقام العادية (مش Business API)،
// فبدل الأزرار الفعلية بنبعت قايمة نصية مرقّمة، ولما المستخدم يرد برقم بس (زي "2")
// بنحوّله تلقائياً لنص الأمر الحقيقي المطابق ونكمل المعالجة العادية بالضبط وكأنه كتبه بنفسه.
// كل عنصر بالـ Map: chatId -> { map: {1: '!ليون', 2: '!اشلي', ...}, timer }
const pendingCommandLists = new Map();
const COMMAND_LIST_TIMEOUT_MS = 5 * 60 * 1000; // 5 دقايق كفاية يشوف القايمة ويرد برقم

const NUMBER_EMOJIS = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];
function numberToEmoji(n) {
  return String(n).split('').map((d) => NUMBER_EMOJIS[Number(d)]).join('');
}

async function sendCommandButtons(sock, chatId, persistDir, cat) {
  const commands = cmdSettings
    .listCommandsWithStatus(persistDir)
    .filter((c) => c.cat === cat && c.enabled);

  if (commands.length === 0) return;

  // 🔧 بعض أوامر COMMAND_DEFS اسمها المعروض مركّب من أمرين حقيقيين مفصولين بـ " / "
  // (زي '!قفل / !فتح' أو '!توقف / !تشغيل') - دول مش أمر واحد قابل للإرسال، فبند واحد
  // بالقايمة ما يقدر يمثلهم مع بعض (COMMAND_GATES بتوقع نص مطابق لواحد منهم بالظبط). لهيك
  // نفكّهم هون لبندين منفصلين، كل واحد نص الأمر الحقيقي القابل للمطابقة لحاله.
  const flatCommands = [];
  for (const c of commands) {
    const parts = c.name.split(' / ').map((p) => p.trim()).filter(Boolean);
    parts.forEach((part) => flatCommands.push(part));
  }

  const listMap = {};
  const lines = flatCommands.map((text, idx) => {
    const num = idx + 1;
    listMap[num] = text;
    return `${numberToEmoji(num)} ${text}`;
  });

  // لو فيه قايمة قديمة معلّقة لنفس الشات، نلغيها ونستبدلها بالجديدة
  const oldPending = pendingCommandLists.get(chatId);
  if (oldPending) clearTimeout(oldPending.timer);

  const timer = setTimeout(() => {
    pendingCommandLists.delete(chatId);
  }, COMMAND_LIST_TIMEOUT_MS);

  pendingCommandLists.set(chatId, { map: listMap, timer });

  try {
    await sock.sendMessage(chatId, {
      text: `${lines.join('\n')}`
    });
  } catch (listErr) {
    console.error(`تعذر إرسال قايمة أوامر قسم ${cat}:`, listErr.message);
  }
}

// حالة تفعيل الذكاء الصناعي (تتحكم فيها !توقف و !تشغيل) - بالذاكرة، نفس الأصل
let aiEnabled = true;

// هل حمّلنا ذاكرة المحادثات القديمة من الملف؟ (مرة وحدة بس، أول رسالة توصل بعد التشغيل)
let historyLoadedFromDisk = false;

// أسئلة !دين (محمّلة مرة وحدة عند تشغيل البوت)
let DEAN_QUESTIONS = [];

function initRouter(baseDir) {
  DEAN_QUESTIONS = games.loadDeanQuestions(baseDir);
}

// دالة موحّدة: هل المرسل أدمن بالجروب؟ (بترجع false لو مو جروب أصلاً)
async function senderIsAdmin(sock, chatId, authorId) {
  if (!wa.isGroupJid(chatId)) return false;
  const meta = await sock.groupMetadata(chatId);
  return wa.isParticipantAdmin(meta, authorId);
}

// بانر موحّد يطلع لأي عضو مش أدمن يحاول يستخدم أمر إداري (كل أوامر الإدارة تستخدمه بنفس الشكل)
function adminOnlyBanner() {
  return R.adminOnlyBanner;
}

// أداة صغيرة للانتظار (مللي ثانية) - تستخدم بإعادة محاولة فحص أدمن البوت
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function botIsAdminInGroup(sock, chatId) {
  // محاولة أولى فورية
  let meta = await sock.groupMetadata(chatId);
  let result = wa.isBotAdmin(meta, sock.user);

  // لو فشلت، ممكن يكون السبب إن واتساب لسا ما خلص يحدّث حالة الأدمن
  // (مثلاً لو المستخدم رفّع البوت أدمن قبل ثانية بس)، فنعيد المحاولة مرتين
  // بفاصل بسيط قبل ما نرفض نهائياً، بدل ما نطلع رسالة "خليني أدمن" كاذبة.
  if (!result) {
    for (let attempt = 0; attempt < 2 && !result; attempt++) {
      await sleep(1500);
      meta = await sock.groupMetadata(chatId);
      result = wa.isBotAdmin(meta, sock.user);
    }
  }

  // 🔧 تشخيص مؤقت - نشوف ليش المطابقة عم تفشل رغم إن البوت أدمن فعلياً بالجروب
  console.log('🔍 [DEBUG botIsAdminInGroup] sock.user:', JSON.stringify(sock.user));
  console.log('🔍 [DEBUG botIsAdminInGroup] النتيجة:', result);
  console.log('🔍 [DEBUG botIsAdminInGroup] كل المشاركين اللي عندهم admin:',
    JSON.stringify(meta.participants
      .filter((p) => p.admin === 'admin' || p.admin === 'superadmin')
      .map((p) => ({ id: p.id, jid: p.jid, phoneNumber: p.phoneNumber, lid: p.lid, pn: p.pn, admin: p.admin }))));

  return result;
}

// ============ المعالج الرئيسي - بينادى لكل رسالة توصل (messages.upsert) ============
async function handleMessagesUpsert(sock, upsert, imagesDir, persistDir) {
  if (upsert.type !== 'notify') return;

  if (!historyLoadedFromDisk) {
    ai.loadHistoryFromDisk(persistDir);
    historyLoadedFromDisk = true;
  }

  for (const msg of upsert.messages) {
    // -------- رياكشن تلقائي: ⏳ وقت المعالجة، ✅ لما يخلص --------
    // نتحقق هون بس (مو جوه handleSingleMessage) عشان ما نضطر نلمس
    // كل كتلة أمر على حدة - أي return جوه المعالجة يخلي finally يشتغل
    // ويحط ✅ تلقائي، حتى لو الأمر رجع خطأ متعامل معه بالداخل.
    const msgBody = wa.getMessageText(msg);
    const isRecognizedCommand =
      msgBody && msgBody.startsWith('!') && COMMAND_GATES.some((g) => g.test(msgBody));

    if (isRecognizedCommand) {
      try {
        await sock.sendMessage(wa.getChatId(msg), { react: { text: '⏳', key: msg.key } });
      } catch (reactErr) {
        console.error('خطأ برياكشن الانتظار:', reactErr.message);
      }
    }

    let processingCrashed = false;
    try {
      await handleSingleMessage(sock, msg, imagesDir, persistDir);
    } catch (err) {
      processingCrashed = true;
      console.error('خطأ بمعالجة الرسالة:');
      console.error('MSG:', err?.message || '(no message)');
      console.error('NAME:', err?.name || '(no name)');
      if (err?.stack) console.error('STACK:', err.stack);
    } finally {
      if (isRecognizedCommand) {
        try {
          await sock.sendMessage(wa.getChatId(msg), {
            react: { text: processingCrashed ? '❌' : '✅', key: msg.key }
          });
        } catch (reactErr) {
          console.error('خطأ برياكشن الاكتمال:', reactErr.message);
        }
      }
    }
  }
}

async function handleSingleMessage(sock, msg, imagesDir, persistDir) {
  if (!msg.message) return; // رسائل بروتوكول فاضية (زي حذف/رياكشن) - نتجاهلها

  const chatId = wa.getChatId(msg);
  const isGroup = wa.isGroupJid(chatId);
  const fromMe = wa.isFromMe(msg);

  // -------- 🆕 كشف حذف الرسائل (Delete for everyone) --------
  // لازم تنفحص قبل أي شي، لأن رسايل البروتوكول (REVOKE) بيوصلها msg.message
  // معبّى (فيه protocolMessage)، بس getMessageText بترجع فاضية لها، فلو خلّيناها
  // تكمل عادي رح تروح للـ catch-all وتضيع بصمت. deletionWatch بترجع true بس
  // لو فعلاً كانت رسالة حذف (سواء لقت نصها ونشرت البانر، أو تجاهلتها بهدوء لأنه
  // ما عندها نص محفوظ) - بالحالتين خلص الأمر وما في داعي نكمل بمعالجة عادية.
  if (await deletionWatch.tryHandleRevoke(sock, msg, persistDir, { wa, isGroup, fromMe })) {
    return;
  }

  let body = wa.getMessageText(msg);
  const authorId = wa.getAuthorId(msg);
  const convoKey = `${chatId}_${authorId}`;
  // الرقم الحقيقي لصاحب الرسالة - يحل مشكلة @lid بالجروبات الكبيرة (بدل jidToNumber المباشر)
  const authorNumber = await wa.resolveRealAuthorNumber(sock, msg);

  // تسجيل خفيف بالذاكرة لآخر رسايل كل عضو بالجروب - يخدم !اقتباس و!تحليل_شخصية بس
  if (isGroup && !fromMe && body) {
    messageLogger.logMessage(persistDir, chatId, authorNumber, body);
  }

  // 🆕 كاش مؤقت (ذاكرة فقط) بكل رسالة بالجروب عشان لو انحذفت بعدين نقدر نبلّغ
  // عنها: لو فيها ملف (صورة/فيديو/ملصق/صوت/رسالة صوتية/مستند) منسجل نوعه وكابشنه
  // بس (بدون تحميل أو حفظ الملف نفسه)، وإلا (رسالة نصية عادية) منسجل نصها كامل.
  if (isGroup && !fromMe) {
    const deletionMediaType = wa.getMediaType(msg);
    if (deletionMediaType) {
      deletionWatch.recordMedia(chatId, msg.key.id, authorId, authorNumber, deletionMediaType, body);
    } else if (body) {
      deletionWatch.recordMessage(chatId, msg.key.id, authorId, authorNumber, body);
    }
  }

  // -------- 🆕 رد أدمن (نعم/لا) على بانر رسالة محذوفة --------
  if (await deletionWatch.tryHandleAdminDecision(sock, msg, persistDir, {
    wa, isGroup, fromMe, body, authorId, senderIsAdmin, jidToNumber, moderation
  })) {
    return;
  }

  // -------- رد برقم على قايمة أوامر معلّقة (بديل ضغطة الزر) --------
  // لو المستخدم بعت رقم بس (زي "2") وفيه قايمة أوامر مبعوتة له بنفس الشات ولسا صالحة،
  // نحوّل body لنص الأمر الحقيقي المطابق ونكمل بنفس منطق المعالجة تحت وكأنه كتبه بإيده.
  if (!fromMe && body && /^\d+$/.test(body.trim())) {
    const pending = pendingCommandLists.get(chatId);
    if (pending) {
      const mapped = pending.map[Number(body.trim())];
      if (mapped) {
        clearTimeout(pending.timer);
        pendingCommandLists.delete(chatId);
        body = mapped;
      }
    }
  }

  // -------- بوابة التحكم: هل هذا الأمر مفعّل من لوحة تحكم البوت؟ --------
  if (body && body.startsWith('!')) {
    const gate = COMMAND_GATES.find((g) => g.test(body));
    if (gate && !cmdSettings.isCommandEnabled(persistDir, gate.key)) {
      await wa.reply(sock, msg, R.r001);
      return;
    }
  }

  // -------- فحص جواب تحدي معلّق --------
  if (!fromMe && body && !body.startsWith('!')) {
    const activeChallenge = games.pendingChallenges.get(chatId);
    if (activeChallenge && games.normalizeAnswer(body) === games.normalizeAnswer(activeChallenge.answer)) {
      clearTimeout(activeChallenge.timer);
      games.pendingChallenges.delete(chatId);
      try {
        await sock.sendMessage(chatId, {
          text: games.challengeWinnerBanner(wa.tag(authorId), activeChallenge.answer),
          mentions: [authorId]
        });
        await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } });
      } catch (challErr) {
        console.error('خطأ بمعالجة الفوز بالتحدي:', challErr.message);
      }
      return;
    }
  }

  // -------- فحص جواب سؤال ديني معلّق --------
  if (!fromMe && body && !body.startsWith('!')) {
    const activeDean = games.pendingDeanQuestions.get(chatId);
    if (activeDean && games.normalizeAnswer(body) === games.normalizeAnswer(activeDean.answer)) {
      clearTimeout(activeDean.timer);
      games.pendingDeanQuestions.delete(chatId);
      try {
        await sock.sendMessage(chatId, {
          text: games.deanWinnerBanner(wa.tag(authorId), activeDean.answer),
          mentions: [authorId]
        });
        await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } });
      } catch (deanErr) {
        console.error('خطأ بمعالجة الفوز بالسؤال الديني:', deanErr.message);
      }
      return;
    }
  }

  // -------- فحص جواب سباق سرعة الكتابة معلّق --------
  if (!fromMe && body && !body.startsWith('!')) {
    const activeRace = typingRace.pendingRaces.get(chatId);
    if (activeRace && typingRace.normalizeText(body) === typingRace.normalizeText(activeRace.sentence)) {
      clearTimeout(activeRace.timer);
      typingRace.pendingRaces.delete(chatId);
      try {
        await sock.sendMessage(chatId, {
          text: typingRace.raceWinnerBanner(wa.tag(authorId), Date.now() - activeRace.startedAt),
          mentions: [authorId]
        });
        await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } });
      } catch (raceErr) {
        console.error('خطأ بمعالجة الفوز بسباق الكتابة:', raceErr.message);
      }
      return;
    }
  }

  // -------- فحص جواب صح/غلط معلّق --------
  if (!fromMe && body && !body.startsWith('!')) {
    const activeTF = triviaTF.pendingTF.get(chatId);
    if (activeTF) {
      const userAnswer = triviaTF.normalizeTFAnswer(body);
      if (userAnswer !== null && userAnswer === activeTF.answer) {
        clearTimeout(activeTF.timer);
        triviaTF.pendingTF.delete(chatId);
        try {
          const total = triviaTF.addPoint(persistDir, authorNumber);
          await sock.sendMessage(chatId, {
            text: triviaTF.tfWinnerBanner(wa.tag(authorId), activeTF.answer, total),
            mentions: [authorId]
          });
          await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } });
        } catch (tfErr) {
          console.error('خطأ بمعالجة الفوز بصح/غلط:', tfErr.message);
        }
        return;
      }
    }
  }

  // -------- فحص جواب كذبة معلّق --------
  if (!fromMe && body && !body.startsWith('!')) {
    const activeLiar = gamesLiar.pendingLiar.get(chatId);
    if (activeLiar) {
      const userAnswer = gamesLiar.normalizeLiarAnswer(body);
      if (userAnswer !== null && userAnswer === activeLiar.set.lieIndex) {
        clearTimeout(activeLiar.timer);
        gamesLiar.pendingLiar.delete(chatId);
        try {
          const total = gamesLiar.addPoint(persistDir, authorNumber);
          await sock.sendMessage(chatId, {
            text: gamesLiar.liarWinnerBanner(wa.tag(authorId), activeLiar.set.lieIndex, total),
            mentions: [authorId]
          });
          await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } });
        } catch (liarErr) {
          console.error('خطأ بمعالجة الفوز بلعبة كذبة:', liarErr.message);
        }
        return;
      }
    }
  }

  // -------- فحص تصويت خيروك (بيجمع أصوات الكل، مش بيوقف عند أول رد) --------
  if (!fromMe && body && !body.startsWith('!')) {
    const activeWYR = gamesWYR.pendingWYR.get(chatId);
    if (activeWYR) {
      const vote = gamesWYR.normalizeWYRVote(body);
      if (vote !== null && !activeWYR.votes.has(authorNumber)) {
        activeWYR.votes.set(authorNumber, vote);
        try {
          await wa.reply(sock, msg, `✅ سُجّل صوتك (${vote === 'A' ? '1️⃣' : '2️⃣'})`);
          await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } });
        } catch (wyrErr) {
          console.error('خطأ بتأكيد صوت خيروك:', wyrErr.message);
        }
        return;
      }
    }
  }

  // -------- فحص جواب فرق معلّق --------
  if (!fromMe && body && !body.startsWith('!')) {
    const activeDiff = gamesDiff.pendingDiff.get(chatId);
    if (activeDiff && gamesDiff.checkDiffAnswer(body, activeDiff.set.answer)) {
      clearTimeout(activeDiff.timer);
      gamesDiff.pendingDiff.delete(chatId);
      try {
        await sock.sendMessage(chatId, {
          text: gamesDiff.diffWinnerBanner(wa.tag(authorId), activeDiff.set.answer),
          mentions: [authorId]
        });
        await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } });
      } catch (diffErr) {
        console.error('خطأ بمعالجة الفوز بلعبة فرق:', diffErr.message);
      }
      return;
    }
  }

  // -------- فحص جواب شعور معلّق --------
  if (!fromMe && body && !body.startsWith('!')) {
    const activeEmotion = gamesEmotion.pendingEmotion.get(chatId);
    if (activeEmotion && gamesEmotion.checkEmotionAnswer(body, activeEmotion.set.answers)) {
      clearTimeout(activeEmotion.timer);
      gamesEmotion.pendingEmotion.delete(chatId);
      try {
        const total = gamesEmotion.addPoint(persistDir, authorNumber);
        await sock.sendMessage(chatId, {
          text: gamesEmotion.emotionWinnerBanner(wa.tag(authorId), activeEmotion.set.answers[0], total),
          mentions: [authorId]
        });
        await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } });
      } catch (emoErr) {
        console.error('خطأ بمعالجة الفوز بلعبة شعور:', emoErr.message);
      }
      return;
    }
  }

  // -------- فحص جواب كنز معلّق --------
  if (!fromMe && body && !body.startsWith('!')) {
    const activeTreasure = gamesTreasure.pendingTreasure.get(chatId);
    if (activeTreasure && gamesTreasure.checkTreasureAnswer(body, activeTreasure.set.secret)) {
      clearTimeout(activeTreasure.timer);
      gamesTreasure.pendingTreasure.delete(chatId);
      try {
        const total = gamesTreasure.addPoints(persistDir, authorNumber, 50);
        await sock.sendMessage(chatId, {
          text: gamesTreasure.treasureWinnerBanner(wa.tag(authorId), activeTreasure.set.secret, total),
          mentions: [authorId]
        });
        await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } });
      } catch (treasureErr) {
        console.error('خطأ بمعالجة الفوز بلعبة كنز:', treasureErr.message);
      }
      return;
    }
  }

  // -------- فحص جواب حروف معلّق --------
  if (!fromMe && body && !body.startsWith('!')) {
    const activeScramble = gamesScramble.pendingScramble.get(chatId);
    if (activeScramble && gamesScramble.checkScrambleAnswer(body, activeScramble.set.word)) {
      clearTimeout(activeScramble.timer);
      gamesScramble.pendingScramble.delete(chatId);
      try {
        const total = gamesScramble.addPoint(persistDir, authorNumber);
        await sock.sendMessage(chatId, {
          text: gamesScramble.scrambleWinnerBanner(wa.tag(authorId), activeScramble.set.word, total),
          mentions: [authorId]
        });
        await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } });
      } catch (scrambleErr) {
        console.error('خطأ بمعالجة الفوز بلعبة حروف:', scrambleErr.message);
      }
      return;
    }
  }

  // -------- فحص جواب مثل معلّق --------
  if (!fromMe && body && !body.startsWith('!')) {
    const activeProverb = gamesProverb.pendingProverb.get(chatId);
    if (activeProverb && gamesProverb.checkProverbAnswer(body, activeProverb.set.answer)) {
      clearTimeout(activeProverb.timer);
      gamesProverb.pendingProverb.delete(chatId);
      try {
        const total = gamesProverb.addPoint(persistDir, authorNumber);
        await sock.sendMessage(chatId, {
          text: gamesProverb.proverbWinnerBanner(wa.tag(authorId), activeProverb.set, total),
          mentions: [authorId]
        });
        await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } });
      } catch (proverbErr) {
        console.error('خطأ بمعالجة الفوز بلعبة مثل:', proverbErr.message);
      }
      return;
    }
  }

  // -------- فحص جواب حساب معلّق --------
  if (!fromMe && body && !body.startsWith('!')) {
    const activeMath = gamesMath.pendingMath.get(chatId);
    if (activeMath && gamesMath.checkMathAnswer(body, activeMath.problem.answer)) {
      clearTimeout(activeMath.timer);
      gamesMath.pendingMath.delete(chatId);
      try {
        const total = gamesMath.addPoint(persistDir, authorNumber);
        await sock.sendMessage(chatId, {
          text: gamesMath.mathWinnerBanner(wa.tag(authorId), activeMath.problem, total),
          mentions: [authorId]
        });
        await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } });
      } catch (mathErr) {
        console.error('خطأ بمعالجة الفوز بلعبة حساب:', mathErr.message);
      }
      return;
    }
  }

  // -------- فحص جواب عاصمة معلّق --------
  if (!fromMe && body && !body.startsWith('!')) {
    const activeCapital = gamesCapital.pendingCapital.get(chatId);
    if (activeCapital && gamesCapital.checkCapitalAnswer(body, activeCapital.set.capital)) {
      clearTimeout(activeCapital.timer);
      gamesCapital.pendingCapital.delete(chatId);
      try {
        const total = gamesCapital.addPoint(persistDir, authorNumber);
        await sock.sendMessage(chatId, {
          text: gamesCapital.capitalWinnerBanner(wa.tag(authorId), activeCapital.set, total),
          mentions: [authorId]
        });
        await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } });
      } catch (capitalErr) {
        console.error('خطأ بمعالجة الفوز بلعبة عاصمة:', capitalErr.message);
      }
      return;
    }
  }

  // -------- فلتر الروابط --------
  if (isGroup && !fromMe && body && links.isLinksBlockEnabled(persistDir, chatId) && links.LINK_REGEX.test(body)) {
    try {
      const meta = await sock.groupMetadata(chatId);
      const senderIsAdminNow = wa.isParticipantAdmin(meta, authorId);
      if (!senderIsAdminNow) {
        try {
          await sock.sendMessage(chatId, { delete: msg.key });
        } catch (delErr) {
          console.error('ما قدرت أحذف الرابط:', delErr.message);
        }

        const newCount = moderation.addWarning(persistDir, authorId, chatId);
        if (newCount >= moderation.MAX_WARNINGS) {
          moderation.resetWarnings(persistDir, authorId, chatId);
          const botAdmin = wa.isBotAdmin(meta, sock.user);
          if (botAdmin) {
            await sock.groupParticipantsUpdate(chatId, [authorId], 'remove');
            await sock.sendMessage(chatId, {
              text: moderation.finalWarningKickBanner(wa.tag(authorId), 'تجاوز الحد الأقصى للمخالفات (روابط ممنوعة)'),
              mentions: [authorId]
            });
            moderation.logKick(persistDir, {
              chatId,
              targetNumber: jidToNumber(authorId),
              executorLine: 'ليون 🔥 (تلقائي)',
              reason: 'تجاوز التحذيرات (روابط)'
            });
          } else {
            await sock.sendMessage(chatId, {
              text: `${wa.tag(authorId)} وصل ${moderation.MAX_WARNINGS} تحذيرات وكان لازم يتطرد، بس أنا مش أدمن هنا، خلوني أدمن 🙏`,
              mentions: [authorId]
            });
          }
        } else {
          await sock.sendMessage(chatId, {
            text: moderation.newWarningBanner(wa.tag(authorId), 'إرسال رابط ممنوع', newCount, moderation.MAX_WARNINGS),
            mentions: [authorId]
          });
        }
        return;
      }
    } catch (linkErr) {
      console.error('خطأ بفلتر الروابط:', linkErr.message);
    }
  }

  // -------- فلتر الألفاظ (قائمة ثابتة + AI للكلام المموّه) --------
  if (isGroup && body && !body.startsWith('!')) {
    if (moderation.containsBadWord(body)) {
      await moderation.punishProfanity(sock, persistDir, chatId, msg, authorId);
      return;
    }
    const aiCheck = await moderation.moderateTextForProfanity(body);
    if (aiCheck.unsafe) {
      await moderation.punishProfanity(sock, persistDir, chatId, msg, authorId);
      return;
    }
  }

  // -------- فلتر الصور/الملصقات الإباحية --------
  const mediaType = wa.getMediaType(msg);
  if (isGroup && !fromMe && (mediaType === 'image' || mediaType === 'sticker')) {
    try {
      const meta = await sock.groupMetadata(chatId);
      const senderIsAdminNow = wa.isParticipantAdmin(meta, authorId);
      if (!senderIsAdminNow) {
        const downloaded = await wa.downloadMedia(msg);
        if (downloaded) {
          const base64Data = downloaded.buffer.toString('base64');
          const result = await moderation.moderateImageBuffer(base64Data, downloaded.mimetype);
          if (result.unsafe) {
            try {
              await sock.sendMessage(chatId, { delete: msg.key });
            } catch (delErr) {
              console.error('ما قدرت أحذف الصورة/الملصق المخالف:', delErr.message);
            }

            const isCritical = result.categories.some((c) => moderation.CRITICAL_NSFW_CATEGORIES.includes(c));
            if (isCritical) {
              const botAdmin = wa.isBotAdmin(meta, sock.user);
              if (botAdmin) {
                await sock.groupParticipantsUpdate(chatId, [authorId], 'remove');
                await sock.sendMessage(chatId, {
                  text: moderation.finalWarningKickBanner(wa.tag(authorId), 'إرسال محتوى محظور تماماً (طرد فوري)'),
                  mentions: [authorId]
                });
                moderation.logKick(persistDir, {
                  chatId,
                  targetNumber: jidToNumber(authorId),
                  executorLine: 'ليون 🔥 (تلقائي)',
                  reason: 'محتوى محظور تماماً (طرد فوري)'
                });
              } else {
                await sock.sendMessage(chatId, {
                  text: `${wa.tag(authorId)} بعت محتوى محظور تماماً وكان لازم يتطرد فوري، بس أنا مش أدمن هنا، خلوني أدمن 🙏`,
                  mentions: [authorId]
                });
              }
            } else {
              const newCount = moderation.addWarning(persistDir, authorId, chatId);
              if (newCount >= moderation.MAX_WARNINGS) {
                moderation.resetWarnings(persistDir, authorId, chatId);
                const botAdmin = wa.isBotAdmin(meta, sock.user);
                if (botAdmin) {
                  await sock.groupParticipantsUpdate(chatId, [authorId], 'remove');
                  await sock.sendMessage(chatId, {
                    text: moderation.finalWarningKickBanner(wa.tag(authorId), 'تجاوز الحد الأقصى للمخالفات (محتوى غير لائق)'),
                    mentions: [authorId]
                  });
                  moderation.logKick(persistDir, {
                    chatId,
                    targetNumber: jidToNumber(authorId),
                    executorLine: 'ليون 🔥 (تلقائي)',
                    reason: 'تجاوز التحذيرات (محتوى إباحي)'
                  });
                } else {
                  await sock.sendMessage(chatId, {
                    text: `${wa.tag(authorId)} وصل ${moderation.MAX_WARNINGS} تحذيرات وكان لازم يتطرد، بس أنا مش أدمن هنا، خلوني أدمن 🙏`,
                    mentions: [authorId]
                  });
                }
              } else {
                await sock.sendMessage(chatId, {
                  text: moderation.newWarningBanner(wa.tag(authorId), 'محتوى غير لائق (صورة/ملصق)', newCount, moderation.MAX_WARNINGS),
                  mentions: [authorId]
                });
              }
            }
            return;
          }
        }
      }
    } catch (mediaFilterErr) {
      console.error('خطأ بفلتر الصور/الملصقات:', mediaFilterErr.message);
    }
  }

  // -------- تعال [منشن] [رسالة] - أدمن بس، يبعت رسالة خاصة للمنشونين --------
  if (body.startsWith('تعال')) {
    if (isGroup && !(await senderIsAdmin(sock, chatId, authorId))) {
      await wa.reply(sock, msg, adminOnlyBanner());
      return;
    }
    const mentioned = wa.getMentionedJids(msg);
    if (mentioned.length > 0) {
      let textToSend = body.replace('تعال', '');
      mentioned.forEach((jid) => {
        textToSend = textToSend.replace(wa.tag(jid), '');
      });
      textToSend = textToSend.trim();

      if (textToSend.length > 0) {
        for (const jid of mentioned) {
          await sock.sendMessage(jid, { text: textToSend });
        }
        await wa.reply(sock, msg, R.r002);
      } else {
        await wa.reply(sock, msg, R.r003);
      }
    }
    return;
  }

  // -------- !توقف / !تشغيل --------
  if (body === '!توقف') {
    aiEnabled = false;
    await wa.reply(sock, msg, banners.muradBanner('🔇⃝⚡ *تـم إسـكـات مـراـد*'));
    return;
  }
  if (body === '!تشغيل') {
    aiEnabled = true;
    await wa.reply(sock, msg, banners.muradBanner('🎙️⃝⚡ *مـراـد رجـع لـلـحـكـي*'));
    return;
  }

  // -------- "مين مطورك" وصيغه المشابهة --------
  if (/مين\s*مطورك|من\s*مطورك|مطورك\s*مين|مين\s*سواك|من\s*صممك/i.test(body)) {
    await wa.reply(sock, msg, R.r004);
    return;
  }

  // -------- "حسام" (بدون !) - يرد بجيف + شعر + منشن --------
  if (body === 'حسام') {
    try {
      const husaamJid = numberToJid(media.HUSAAM_MENTION_NUMBER);
      const caption = [
        '╔═══ ⚔️🖤⚔️ ═══╗',
        '  ☠️ 𝑵𝒐𝒕 𝒆𝒗𝒆𝒓𝒚𝒐𝒏𝒆 𝒖𝒏𝒅𝒆𝒓𝒔𝒕𝒂𝒏𝒅𝒔 𝒎𝒚 𝒍𝒂𝒏𝒈𝒖𝒂𝒈𝒆 ☠️',
        '',
        '  ❤️ 𝑾𝒓𝒊𝒕𝒕𝒆𝒏 𝒊𝒏 𝒍𝒐𝒗𝒆',
        '  💎 𝑪𝒐𝒅𝒆𝒅 𝒊𝒏 𝒍𝒐𝒈𝒊𝒄',
        '  🛢️ 𝑭𝒖𝒆𝒍𝒆𝒅 𝒃𝒚 𝒐𝒊𝒍',
        '',
        '╚═══ ⚔️🖤⚔️ ═══╝',
        '',
        `*⃝🌙┆*المنشن: ${wa.tag(husaamJid)}`,
        `*⃝⚡┆الي منشن: ${wa.tag(authorId)}`,
        '',
        '⌬──══─┈•⤣⚡⤤•┈─══──⌬',
        '©️⃝⚡ *جـمـيـع الـحـقـوق مـحـفـوظـة*',
        '👨‍💻⃝⚡ *الـمـطـور:* 𓆩☠𓆪 𝐓𝐎𝐆𝐈 𝐁𝐎𝐓 𓆩☠𓆪',
        '⌬──══─┈•⤣⚡⤤•┈─══──⌬'
      ].join('\n');
      const husaamVideoBuffer = await media.getHusaamVideoBuffer(imagesDir);
      await sock.sendMessage(chatId, {
        video: husaamVideoBuffer,
        caption,
        mentions: [husaamJid, authorId]
      });
    } catch (husaamErr) {
      console.error('خطأ بأمر تكريم حسام:', husaamErr.message);
      // احتياط: نبعت النص والمنشن على الأقل حتى لو الجيف فشل (بدل ما نسكت بصمت تام)
      try {
        const husaamJid = numberToJid(media.HUSAAM_MENTION_NUMBER);
        const fallbackCaption = [
          '╔═══ ⚔️🖤⚔️ ═══╗',
          '  ☠️ 𝑵𝒐𝒕 𝒆𝒗𝒆𝒓𝒚𝒐𝒏𝒆 𝒖𝒏𝒅𝒆𝒓𝒔𝒕𝒂𝒏𝒅𝒔 𝒎𝒚 𝒍𝒂𝒏𝒈𝒖𝒂𝒈𝒆 ☠️',
          '',
          '  ❤️ 𝑾𝒓𝒊𝒕𝒕𝒆𝒏 𝒊𝒏 𝒍𝒐𝒗𝒆',
          '  💎 𝑪𝒐𝒅𝒆𝒅 𝒊𝒏 𝒍𝒐𝒈𝒊𝒄',
          '  🛢️ 𝑭𝒖𝒆𝒍𝒆𝒅 𝒃𝒚 𝒐𝒊𝒍',
          '',
          '╚═══ ⚔️🖤⚔️ ═══╝',
          '',
          `*⃝🌙┆*المنشن: ${wa.tag(husaamJid)}`,
          `*⃝⚡┆الي منشن: ${wa.tag(authorId)}`
        ].join('\n');
        await sock.sendMessage(chatId, { text: fallbackCaption, mentions: [husaamJid, authorId] });
      } catch (fallbackErr) {
        console.error('فشل حتى الاحتياط النصي لأمر حسام:', fallbackErr.message);
      }
    }
    return;
  }

  // -------- غيرة: أي حد (غير حسام) يعمل منشن لحسام مباشرة --------
  if (!fromMe && !media.HUSAAM_MENTION_NUMBERS.includes(jidToNumber(authorId))) {
    const mentioned = wa.getMentionedJids(msg);
    const mentionsHusaam = mentioned.some((jid) => media.HUSAAM_MENTION_NUMBERS.includes(jidToNumber(jid)));
    if (mentionsHusaam) {
      const jealousReplies = [
        'مين ذاكرك؟! وش تبونه من حسام، امشوا حالكم 😤',
        'لا لا لا، حسام مالي غيره، امنشنوا حد ثاني 🙄🔥',
        'وش هالمنشن المفاجئ؟ حسام مشغول، جربوا بعدين 😑',
        'غيرتي طلعت.. حسام ملكي وحدي، خلوه وشانه 😤💛',
        'لو تعرفون قد إيش أغار عليه كنتوا بطلتوا تمنشنوه أصلاً 😏🔒'
      ];
      await wa.reply(sock, msg, jealousReplies[Math.floor(Math.random() * jealousReplies.length)]);
      return;
    }
  }

  // -------- "حقوق بوت" (بدون !) - فيديو ثابت (دائري - بدون نص تحته) --------
  if (stripButtonEmoji(body) === 'حقوق بوت') {
    try {
      const ptvBuffer = await media.getHuqoqPtvBuffer(imagesDir);
      await sock.sendMessage(chatId, { video: ptvBuffer, ptv: true });
    } catch (huqoqErr) {
      console.error('خطأ بأمر حقوق بوت:', huqoqErr.message);
      await wa.reply(sock, msg, `ما قدرت أبعت الفيديو هلق 😅\n🔧 السبب: ${huqoqErr.message}`);
    }
    return;
  }

  // -------- "تواصل مع المطور" (بدون !) - رقم/رابط التواصل --------
  if (stripButtonEmoji(body) === 'تواصل مع المطور') {
    await wa.reply(sock, msg, R.devContactReply);
    return;
  }

  // -------- !قفل / !فتح --------
  if (body === '!قفل' || body === '!فتح') {
    if (!isGroup) { await wa.reply(sock, msg, R.r005); return; }
    if (!(await senderIsAdmin(sock, chatId, authorId))) { await wa.reply(sock, msg, adminOnlyBanner()); return; }
    if (!(await botIsAdminInGroup(sock, chatId))) { await wa.reply(sock, msg, R.r006); return; }

    // نتحقق من حالة الجروب الحالية قبل التنفيذ - لو نفس الحالة المطلوبة أصلاً، ما نكرر التنفيذ
    const groupMeta = await sock.groupMetadata(chatId);
    const isCurrentlyLocked = groupMeta.announce === true || groupMeta.announce === 'true';

    if (body === '!قفل') {
      if (isCurrentlyLocked) {
        await wa.reply(sock, msg, banners.noChangeBanner('🔐 *الـمـجـمـوعـة مـقـفـولـة أصـلاً يا قـمـر*'));
        return;
      }
      await sock.groupSettingUpdate(chatId, 'announcement');
      await wa.reply(sock, msg, banners.muradBanner('🔐 *قـفـلـت الـمـجـمـوعـة عـلـيـكـم* ⚔️'));
    } else {
      if (!isCurrentlyLocked) {
        await wa.reply(sock, msg, banners.noChangeBanner('🔓 *الـمـجـمـوعـة مـفـتـوحـة أصـلاً يا قـمـر*'));
        return;
      }
      await sock.groupSettingUpdate(chatId, 'not_announcement');
      await wa.reply(sock, msg, banners.muradBanner('🔓 *فـتـحـت الـمـجـمـوعـة لـكـم* 🩸'));
    }
    return;
  }

  // -------- !فتح رابط / !قفل رابط --------
  if (body === '!فتح رابط' || body === '!قفل رابط') {
    if (!isGroup) { await wa.reply(sock, msg, R.r007); return; }
    if (!(await senderIsAdmin(sock, chatId, authorId))) { await wa.reply(sock, msg, adminOnlyBanner()); return; }

    const actorTag = wa.tag(authorId);
    // نتحقق من حالة منع الروابط الحالية قبل التنفيذ - لو نفس الحالة المطلوبة أصلاً، ما نكرر التنفيذ
    const linksAlreadyBlocked = links.isLinksBlockEnabled(persistDir, chatId);

    if (body === '!فتح رابط') {
      if (linksAlreadyBlocked) {
        await wa.reply(sock, msg, banners.noChangeBanner('🔒⃝⚡ *الـروابـط مـمـنـوعـة بـالـفـعـل*'));
        return;
      }
      links.setLinksBlockEnabled(persistDir, chatId, true);
      await sock.sendMessage(chatId, { text: links.linksBanner(true, actorTag), mentions: [authorId] });
    } else {
      if (!linksAlreadyBlocked) {
        await wa.reply(sock, msg, banners.noChangeBanner('🔓⃝⚡ *الـروابـط مـسـمـوحـة بـالـفـعـل*'));
        return;
      }
      links.setLinksBlockEnabled(persistDir, chatId, false);
      await sock.sendMessage(chatId, { text: links.linksBanner(false, actorTag), mentions: [authorId] });
    }
    return;
  }

  // -------- !رابط - رابط دعوة الجروب الحقيقي (يتجاب لحظياً من واتساب، مش رابط ثابت) --------
  if (body === '!رابط') {
    if (!isGroup) { await wa.reply(sock, msg, R.r008); return; }
    try {
      const inviteCode = await sock.groupInviteCode(chatId);
      await wa.reply(sock, msg, `↜ رابط المجموعة\nhttps://chat.whatsapp.com/${inviteCode}`);
    } catch (err) {
      console.error('ما قدرت أجيب رابط الجروب:', err.message);
      await wa.reply(sock, msg, R.r009);
    }
    return;
  }

  // -------- !ستايل [نص] - تحويل نص لأشكال مزخرفة --------
  if (body.startsWith('!ستايل')) {
    const text = body.replace('!ستايل', '').trim();
    if (!text) { await wa.reply(sock, msg, R.r010); return; }
    await wa.reply(sock, msg, textStyler.styleBanner(text));
    return;
  }

  // -------- !توقع - فأل يومي مرح --------
  if (body === '!توقع') {
    const nameTag = wa.tag(authorId);
    await sock.sendMessage(chatId, { text: fortune.fortuneBanner(nameTag), mentions: [authorId] });
    return;
  }

  // -------- !اقتباس @شخص - رسالة قديمة عشوائية لعضو --------
  if (body.startsWith('!اقتباس')) {
    if (!isGroup) { await wa.reply(sock, msg, R.r011); return; }
    const targets = wa.resolveTargets(msg);
    if (targets.length === 0) { await wa.reply(sock, msg, R.r012); return; }

    const targetJid = targets[0];
    const targetNumber = await wa.resolveRealNumberForJid(sock, chatId, targetJid);
    const picked = messageLogger.getRandomMessage(persistDir, chatId, targetNumber);
    if (!picked) { await wa.reply(sock, msg, quoteCard.noQuoteFoundMessage()); return; }

    await sock.sendMessage(chatId, {
      text: quoteCard.quoteBanner(wa.tag(targetJid), picked.text, picked.ts),
      mentions: [targetJid]
    });
    return;
  }

  // -------- !تحليل_شخصية @شخص --------
  if (body.startsWith('!تحليل_شخصية')) {
    if (!isGroup) { await wa.reply(sock, msg, R.r013); return; }
    const targets = wa.resolveTargets(msg);
    if (targets.length === 0) { await wa.reply(sock, msg, R.r014); return; }

    const targetJid = targets[0];
    const targetNumber = await wa.resolveRealNumberForJid(sock, chatId, targetJid);
    const history = messageLogger.getMessages(persistDir, chatId, targetNumber);
    if (history.length < 3) { await wa.reply(sock, msg, personalityAnalysis.notEnoughDataMessage()); return; }

    const userPrompt = personalityAnalysis.buildUserPrompt(history);
    const analysisText = await ai.askAI(userPrompt, [], 'murad', personalityAnalysis.ANALYSIS_SYSTEM_PROMPT);
    await sock.sendMessage(chatId, {
      text: personalityAnalysis.analysisBanner(wa.tag(targetJid), analysisText),
      mentions: [targetJid]
    });
    return;
  }

  // -------- !سباق --------
  if (body.startsWith('!سباق')) {
    if (!isGroup) { await wa.reply(sock, msg, R.r015); return; }
    if (typingRace.pendingRaces.has(chatId)) { await wa.reply(sock, msg, R.r016); return; }

    const sentence = typingRace.pickSentence();
    const startedAt = Date.now();
    const raceTimer = setTimeout(async () => {
      if (typingRace.pendingRaces.has(chatId)) {
        typingRace.pendingRaces.delete(chatId);
        try {
          await sock.sendMessage(chatId, { text: typingRace.raceTimeoutBanner(sentence) });
        } catch (timeoutErr) {
          console.error('خطأ بإرسال بانر انتهاء السباق:', timeoutErr.message);
        }
      }
    }, typingRace.RACE_TIMEOUT_MS);

    typingRace.pendingRaces.set(chatId, { sentence, startedAt, timer: raceTimer });
    await sock.sendMessage(chatId, { text: typingRace.raceBanner(sentence) });
    return;
  }

  // -------- !صح_غلط --------
  if (body.startsWith('!صح_غلط')) {
    if (!isGroup) { await wa.reply(sock, msg, R.r017); return; }
    if (triviaTF.pendingTF.has(chatId)) { await wa.reply(sock, msg, R.r018); return; }

    const pickedTF = triviaTF.pickQuestion();
    const tfTimer = setTimeout(async () => {
      if (triviaTF.pendingTF.has(chatId)) {
        triviaTF.pendingTF.delete(chatId);
        try {
          await sock.sendMessage(chatId, { text: triviaTF.tfTimeoutBanner(pickedTF.answer) });
        } catch (timeoutErr) {
          console.error('خطأ بإرسال بانر انتهاء صح/غلط:', timeoutErr.message);
        }
      }
    }, triviaTF.TF_TIMEOUT_MS);

    triviaTF.pendingTF.set(chatId, { question: pickedTF.question, answer: pickedTF.answer, askedBy: authorId, timer: tfTimer });
    await sock.sendMessage(chatId, { text: triviaTF.tfBanner(pickedTF.question) });
    return;
  }

  // -------- !كذبة - من فينا الكاذب --------
  if (body.startsWith('!كذبة')) {
    if (!isGroup) { await wa.reply(sock, msg, R.r019); return; }
    if (gamesLiar.pendingLiar.has(chatId)) { await wa.reply(sock, msg, R.r020); return; }

    const pickedLiar = gamesLiar.pickSet();
    const liarTimer = setTimeout(async () => {
      if (gamesLiar.pendingLiar.has(chatId)) {
        gamesLiar.pendingLiar.delete(chatId);
        try {
          await sock.sendMessage(chatId, { text: gamesLiar.liarTimeoutBanner(pickedLiar.lieIndex) });
        } catch (timeoutErr) {
          console.error('خطأ بإرسال بانر انتهاء كذبة:', timeoutErr.message);
        }
      }
    }, gamesLiar.LIAR_TIMEOUT_MS);

    gamesLiar.pendingLiar.set(chatId, { set: pickedLiar, askedBy: authorId, timer: liarTimer });
    await sock.sendMessage(chatId, { text: gamesLiar.liarBanner(pickedLiar) });
    return;
  }

  // -------- !خيروك - سؤال اختيار جماعي بتصويت --------
  if (body.startsWith('!خيروك')) {
    if (!isGroup) { await wa.reply(sock, msg, R.r021); return; }
    if (gamesWYR.pendingWYR.has(chatId)) { await wa.reply(sock, msg, R.r022); return; }

    const pickedWYR = gamesWYR.pickQuestion();
    const wyrTimer = setTimeout(async () => {
      const active = gamesWYR.pendingWYR.get(chatId);
      if (active) {
        gamesWYR.pendingWYR.delete(chatId);
        let votesA = 0;
        let votesB = 0;
        for (const v of active.votes.values()) {
          if (v === 'A') votesA++;
          else votesB++;
        }
        try {
          await sock.sendMessage(chatId, { text: gamesWYR.wyrResultBanner(active.question, votesA, votesB) });
        } catch (timeoutErr) {
          console.error('خطأ بإرسال نتيجة خيروك:', timeoutErr.message);
        }
      }
    }, gamesWYR.WYR_TIMEOUT_MS);

    gamesWYR.pendingWYR.set(chatId, { question: pickedWYR, votes: new Map(), timer: wyrTimer });
    await sock.sendMessage(chatId, { text: gamesWYR.wyrBanner(pickedWYR) });
    return;
  }

  // -------- !فرق - لاقي الفرق بين قائمتين --------
  if (body.startsWith('!فرق')) {
    if (!isGroup) { await wa.reply(sock, msg, R.r023); return; }
    if (gamesDiff.pendingDiff.has(chatId)) { await wa.reply(sock, msg, R.r024); return; }

    const pickedDiff = gamesDiff.pickSet();
    const diffTimer = setTimeout(async () => {
      if (gamesDiff.pendingDiff.has(chatId)) {
        gamesDiff.pendingDiff.delete(chatId);
        try {
          await sock.sendMessage(chatId, { text: gamesDiff.diffTimeoutBanner(pickedDiff.answer) });
        } catch (timeoutErr) {
          console.error('خطأ بإرسال بانر انتهاء فرق:', timeoutErr.message);
        }
      }
    }, gamesDiff.DIFF_TIMEOUT_MS);

    gamesDiff.pendingDiff.set(chatId, { set: pickedDiff, askedBy: authorId, timer: diffTimer });
    await sock.sendMessage(chatId, { text: gamesDiff.diffBanner(pickedDiff) });
    return;
  }

  // -------- !شعور - احزر المشاعر من إيموجي --------
  if (body.startsWith('!شعور')) {
    if (!isGroup) { await wa.reply(sock, msg, R.r025); return; }
    if (gamesEmotion.pendingEmotion.has(chatId)) { await wa.reply(sock, msg, R.r026); return; }

    const pickedEmotion = gamesEmotion.pickSet();
    const emotionTimer = setTimeout(async () => {
      if (gamesEmotion.pendingEmotion.has(chatId)) {
        gamesEmotion.pendingEmotion.delete(chatId);
        try {
          await sock.sendMessage(chatId, { text: gamesEmotion.emotionTimeoutBanner(pickedEmotion.answers[0]) });
        } catch (timeoutErr) {
          console.error('خطأ بإرسال بانر انتهاء شعور:', timeoutErr.message);
        }
      }
    }, gamesEmotion.EMOTION_TIMEOUT_MS);

    gamesEmotion.pendingEmotion.set(chatId, { set: pickedEmotion, timer: emotionTimer });
    await sock.sendMessage(chatId, { text: gamesEmotion.emotionBanner(pickedEmotion) });
    return;
  }

  // -------- !كنز - الغميضة الرقمية --------
  if (body.startsWith('!كنز')) {
    if (!isGroup) { await wa.reply(sock, msg, R.r027); return; }
    if (gamesTreasure.pendingTreasure.has(chatId)) { await wa.reply(sock, msg, R.r028); return; }

    const pickedTreasure = gamesTreasure.pickSet();
    const treasureTimer = setTimeout(async () => {
      if (gamesTreasure.pendingTreasure.has(chatId)) {
        gamesTreasure.pendingTreasure.delete(chatId);
        try {
          await sock.sendMessage(chatId, { text: gamesTreasure.treasureTimeoutBanner(pickedTreasure.secret) });
        } catch (timeoutErr) {
          console.error('خطأ بإرسال بانر انتهاء كنز:', timeoutErr.message);
        }
      }
    }, gamesTreasure.TREASURE_TIMEOUT_MS);

    gamesTreasure.pendingTreasure.set(chatId, { set: pickedTreasure, timer: treasureTimer });
    await sock.sendMessage(chatId, { text: gamesTreasure.treasureBanner(pickedTreasure) });
    return;
  }

  // -------- !حروف - أسرع واحد (رتب الحروف) --------
  if (body.startsWith('!حروف')) {
    if (!isGroup) { await wa.reply(sock, msg, R.r029); return; }
    if (gamesScramble.pendingScramble.has(chatId)) { await wa.reply(sock, msg, R.r030); return; }

    const pickedScramble = gamesScramble.pickSet();
    const scrambleTimer = setTimeout(async () => {
      if (gamesScramble.pendingScramble.has(chatId)) {
        gamesScramble.pendingScramble.delete(chatId);
        try {
          await sock.sendMessage(chatId, { text: gamesScramble.scrambleTimeoutBanner(pickedScramble.word) });
        } catch (timeoutErr) {
          console.error('خطأ بإرسال بانر انتهاء حروف:', timeoutErr.message);
        }
      }
    }, gamesScramble.SCRAMBLE_TIMEOUT_MS);

    gamesScramble.pendingScramble.set(chatId, { set: pickedScramble, timer: scrambleTimer });
    await sock.sendMessage(chatId, { text: gamesScramble.scrambleBanner(pickedScramble) });
    return;
  }

  // -------- !مثل - تكملة المثل الشعبي --------
  if (body.startsWith('!مثل')) {
    if (!isGroup) { await wa.reply(sock, msg, R.r031); return; }
    if (gamesProverb.pendingProverb.has(chatId)) { await wa.reply(sock, msg, R.r032); return; }

    const pickedProverb = gamesProverb.pickSet();
    const proverbTimer = setTimeout(async () => {
      if (gamesProverb.pendingProverb.has(chatId)) {
        gamesProverb.pendingProverb.delete(chatId);
        try {
          await sock.sendMessage(chatId, { text: gamesProverb.proverbTimeoutBanner(pickedProverb) });
        } catch (timeoutErr) {
          console.error('خطأ بإرسال بانر انتهاء مثل:', timeoutErr.message);
        }
      }
    }, gamesProverb.PROVERB_TIMEOUT_MS);

    gamesProverb.pendingProverb.set(chatId, { set: pickedProverb, timer: proverbTimer });
    await sock.sendMessage(chatId, { text: gamesProverb.proverbBanner(pickedProverb) });
    return;
  }

  // -------- !حساب - رياضيات سريعة --------
  if (body.startsWith('!حساب')) {
    if (!isGroup) { await wa.reply(sock, msg, R.r033); return; }
    if (gamesMath.pendingMath.has(chatId)) { await wa.reply(sock, msg, R.r034); return; }

    const pickedMath = gamesMath.pickSet();
    const mathTimer = setTimeout(async () => {
      if (gamesMath.pendingMath.has(chatId)) {
        gamesMath.pendingMath.delete(chatId);
        try {
          await sock.sendMessage(chatId, { text: gamesMath.mathTimeoutBanner(pickedMath) });
        } catch (timeoutErr) {
          console.error('خطأ بإرسال بانر انتهاء حساب:', timeoutErr.message);
        }
      }
    }, gamesMath.MATH_TIMEOUT_MS);

    gamesMath.pendingMath.set(chatId, { problem: pickedMath, timer: mathTimer });
    await sock.sendMessage(chatId, { text: gamesMath.mathBanner(pickedMath) });
    return;
  }

  // -------- !عاصمة - احزر العاصمة --------
  if (body.startsWith('!عاصمة')) {
    if (!isGroup) { await wa.reply(sock, msg, R.r035); return; }
    if (gamesCapital.pendingCapital.has(chatId)) { await wa.reply(sock, msg, R.r036); return; }

    const pickedCapital = gamesCapital.pickSet();
    const capitalTimer = setTimeout(async () => {
      if (gamesCapital.pendingCapital.has(chatId)) {
        gamesCapital.pendingCapital.delete(chatId);
        try {
          await sock.sendMessage(chatId, { text: gamesCapital.capitalTimeoutBanner(pickedCapital) });
        } catch (timeoutErr) {
          console.error('خطأ بإرسال بانر انتهاء عاصمة:', timeoutErr.message);
        }
      }
    }, gamesCapital.CAPITAL_TIMEOUT_MS);

    gamesCapital.pendingCapital.set(chatId, { set: pickedCapital, timer: capitalTimer });
    await sock.sendMessage(chatId, { text: gamesCapital.capitalBanner(pickedCapital) });
    return;
  }

  // -------- مساعد: يبني كابشن نظيف لنتيجة بنترست/تيك توك --------
  function pinCaption(item, index, total) {
    const lines = [`📌 ${index}/${total}`];
    if (item.title && item.title !== 'صورة بنترست') lines.push(item.title);
    lines.push(item.pinUrl);
    if (index < total) lines.push('', '↪️ !تالي');
    return lines.join('\n');
  }

  function tikCaption(item, index, total) {
    const lines = [`🎵 ${index}/${total}${item.author ? ' · @' + item.author : ''}`];
    if (item.title && item.title !== 'فيديو تيك توك') lines.push(item.title);
    lines.push(item.videoUrl);
    if (index < total) lines.push('', '↪️ !تالي');
    return lines.join('\n');
  }

  // -------- !بن - بحث صور بنترست --------
  if (body.startsWith('!بن')) {
    const pinQuery = body.replace('!بن', '').trim();
    if (!pinQuery) {
      await wa.reply(sock, msg, R.r037);
      return;
    }

    try {
      const results = await pinterestSearch.searchPinterest(pinQuery);
      if (!results.length) {
        await wa.reply(sock, msg, `ما لقيت نتايج لـ "${pinQuery}" ببنترست 🤔`);
        return;
      }

      const medias = results.map((r) => ({ type: 'image', data: { url: r.imageUrl } }));
      const albumCaption = `📌 نتائج "${pinQuery}" ببنترست (${results.length}) — اسحب يمين لتشوف الباقي`;

      try {
        await sendAlbumMessage(sock, chatId, medias, { caption: albumCaption });
      } catch (albumErr) {
        console.error('[بنترست] فشل إرسال الألبوم، رجعنا لطريقة !تالي:', albumErr.message);
        browseSession.startSession(chatId, 'pinterest', results);
        const first = results[0];
        await sock.sendMessage(chatId, {
          image: { url: first.imageUrl },
          caption: pinCaption(first, 1, results.length)
        });
      }
    } catch (pinErr) {
      console.error('خطأ بأمر !بن:', pinErr.message);
      await wa.reply(sock, msg, R.r038);
    }
    return;
  }

  // -------- !تك - بحث فيديوهات تيك توك --------
  if (body.startsWith('!تك')) {
    const tikQuery = body.replace('!تك', '').trim();
    if (!tikQuery) {
      await wa.reply(sock, msg, R.r039);
      return;
    }

    try {
      const results = await tiktokSearch.searchTiktok(tikQuery);
      if (!results.length) {
        await wa.reply(sock, msg, `ما لقيت نتايج لـ "${tikQuery}" بتيك توك 🤔`);
        return;
      }
      browseSession.startSession(chatId, 'tiktok', results);
      const first = results[0];
      await sock.sendMessage(chatId, {
        image: { url: first.thumbUrl },
        caption: tikCaption(first, 1, results.length)
      });
    } catch (tikErr) {
      console.error('خطأ بأمر !تك:', tikErr.message);
      await wa.reply(sock, msg, R.r040);
    }
    return;
  }

  // -------- !صمم - توليد صورة بالذكاء الاصطناعي (Pollinations.ai) --------
  if (body.startsWith('!صمم')) {
    const designPrompt = body.replace('!صمم', '').trim();
    if (!designPrompt) {
      await wa.reply(sock, msg, R.r041);
      return;
    }
    try {
      await wa.reply(sock, msg, R.r042);
      const imageBuffer = await imageGen.generateImage(designPrompt);
      await sock.sendMessage(chatId, { image: imageBuffer, caption: `🎨 "${designPrompt}"` });
    } catch (designErr) {
      console.error('خطأ بأمر !صمم:', designErr.message);
      await wa.reply(sock, msg, R.r043);
    }
    return;
  }

  // -------- !عدل - تعديل صورة موجودة بالذكاء الاصطناعي (Pollinations.ai) --------
  if (body.startsWith('!عدل')) {
    const editInstruction = body.replace('!عدل', '').trim();
    const quotedInfo = wa.getQuotedInfo(msg);
    const quotedMessage = quotedInfo && quotedInfo.message;

    if (!quotedMessage || !quotedMessage.imageMessage) {
      await wa.reply(sock, msg, R.r044);
      return;
    }
    if (!editInstruction) {
      await wa.reply(sock, msg, R.r045);
      return;
    }
    try {
      await wa.reply(sock, msg, R.r046);
      const media = await wa.downloadQuotedMedia(quotedMessage);
      if (!media) {
        await wa.reply(sock, msg, R.r047);
        return;
      }
      const editedBuffer = await imageGen.editImage(media.buffer, media.mimetype, editInstruction);
      await sock.sendMessage(chatId, { image: editedBuffer, caption: `🖌️ "${editInstruction}"` });
    } catch (editErr) {
      console.error('خطأ بأمر !عدل:', editErr.message);
      await wa.reply(sock, msg, R.r048);
    }
    return;
  }

  // -------- !تالي - النتيجة الجاية بجلسة تصفح !بن/!تك --------
  if (body.startsWith('!تالي')) {
    const advanced = browseSession.advance(chatId);
    if (!advanced) {
      await wa.reply(sock, msg, R.r049);
      return;
    }
    if (advanced === 'END') {
      await wa.reply(sock, msg, R.r050);
      return;
    }

    const item = advanced.results[advanced.index];
    try {
      if (advanced.type === 'pinterest') {
        await sock.sendMessage(chatId, {
          image: { url: item.imageUrl },
          caption: pinCaption(item, advanced.index + 1, advanced.results.length)
        });
      } else {
        await sock.sendMessage(chatId, {
          image: { url: item.thumbUrl },
          caption: tikCaption(item, advanced.index + 1, advanced.results.length)
        });
      }
    } catch (nextErr) {
      console.error('خطأ بأمر !تالي:', nextErr.message);
      await wa.reply(sock, msg, R.r051);
    }
    return;
  }

  // -------- !رابط - كرت رابط الجروب (بانر ثابت + معلومات) --------
  if (body.startsWith('!رابط')) {
    if (!isGroup) { await wa.reply(sock, msg, R.r052); return; }

    try {
      const meta = await sock.groupMetadata(chatId);
      const inviteCode = await sock.groupInviteCode(chatId);
      const link = `https://chat.whatsapp.com/${inviteCode}`;

      const caption = [
        '🔗 *رابط المجموعة*',
        '',
        `📌 الاسم: ${meta.subject}`,
        `👥 الأعضاء: ${meta.participants.length}`,
        `🔗 الرابط: ${link}`
      ].join('\n');

      // بانر ثابت واحد لكل الجروبات
      // 🔧 مؤقت: بانر !رابط الأصلي '24f1b9067ea18a809f638282b1b8898c.jpg' مش مرفوع
      // بالسيرفر، فبنستخدم 'promote.jpg' (موجودة فعلاً وبانر عام بدون دائرة أفتار)
      // كبديل مؤقت لحد ما يترفع بانر مخصص للرابط. لو رفعتي واحدة جديدة بنفس اسم
      // '24f1b9067ea18a809f638282b1b8898c.jpg' وبدّلتي المسار تحت، بترجع تلقائي.
      const bannerPath = path.join(imagesDir, 'promote.jpg');
      if (fs.existsSync(bannerPath)) {
        await sock.sendMessage(chatId, { image: fs.readFileSync(bannerPath), caption });
      } else {
        // احتياط إضافي: لو حتى البديل مش موجود لأي سبب، نبعت النص بس بدل ما نفشل بصمت
        await sock.sendMessage(chatId, { text: caption });
      }
    } catch (err) {
      console.error('خطأ بأمر !رابط:', err.message);
      await wa.reply(sock, msg, R.r053);
    }
    return;
  }

  // -------- !باند - طرد عضو --------
  if (body.startsWith('!باند')) {
    if (!isGroup) { await wa.reply(sock, msg, R.r054); return; }
    if (!(await senderIsAdmin(sock, chatId, authorId))) { await wa.reply(sock, msg, adminOnlyBanner()); return; }
    if (!(await botIsAdminInGroup(sock, chatId))) { await wa.reply(sock, msg, R.r055); return; }

    const mentioned = wa.resolveTargets(msg);
    if (mentioned.length === 0) { await wa.reply(sock, msg, R.r056); return; }

    const banMeta = await sock.groupMetadata(chatId);
    const targetIsAdmin = mentioned.some((jid) => wa.isParticipantAdmin(banMeta, jid));
    if (targetIsAdmin) {
      await wa.reply(sock, msg, R.r057);
      return;
    }

    await sock.groupParticipantsUpdate(chatId, mentioned, 'remove');
    const targetLine = mentioned.map((jid) => wa.tag(jid)).join('، ');
    await sock.sendMessage(chatId, {
      text: moderation.kickBanner(targetLine, wa.tag(authorId)),
      mentions: [...mentioned, authorId]
    });
    mentioned.forEach((jid) => {
      moderation.logKick(persistDir, {
        chatId,
        targetNumber: jidToNumber(jid),
        executorLine: wa.tag(authorId),
        reason: 'طرد يدوي (!باند)'
      });
    });
    return;
  }

  // -------- !اصعد @شخص --------
  if (body.startsWith('!اصعد')) {
    if (!isGroup) { await wa.reply(sock, msg, R.r058); return; }
    if (!(await senderIsAdmin(sock, chatId, authorId))) { await wa.reply(sock, msg, adminOnlyBanner()); return; }
    if (!(await botIsAdminInGroup(sock, chatId))) { await wa.reply(sock, msg, R.r059); return; }

    const rawMentioned = wa.resolveTargets(msg);
    if (rawMentioned.length === 0) { await wa.reply(sock, msg, R.r060); return; }

    try {
      // نطابق كل JID مع الصيغة الحقيقية المسجلة بلستة المشاركين (يحل مشكلة @lid)
      const groupMetaForPromote = await sock.groupMetadata(chatId);
      const mentioned = rawMentioned.map((jid) => wa.resolveParticipantId(groupMetaForPromote, jid));

      await sock.groupParticipantsUpdate(chatId, mentioned, 'promote');
      const promotedLine = mentioned.map((jid) => wa.tag(jid)).join('، ');
      const banner = [
        `╭━━━ ☠️ 『 ⚠️ ${R.BOT_NAME_STYLED} ⚠️ 』 ☠️ ━━━╮`,
        '┃  👑 *تــرقــيــة مــشــرف جــديــد*',
        '┣━━━━━━━━━━━━━━━━━━━━━━━━━━⫸',
        `┃  👤 *الــمــشــرف الــجــديــد :* ${promotedLine}`,
        `┃  ⏰ *الــتــوقــيــت :* ${greetings.formatTripoliTime()}`,
        '┃  ⚡ *الــحــالــة :* تم الانضمام لطاقم الإدارة ☠️',
        '╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯',
        '',
        `⚠️ *تنويه من ${R.BOT_NAME}:*`,
        'ألف مبروك الترقية يا بطل، منور الإدارة وواثقين إنك تزبط الأجواء. 🩸',
        '',
        `˼☠️˹ ┃ *${R.BOT_NAME} يراقب كل تحرك* ⚔️`
      ].join('\n');
      const promoteImagePath = path.join(imagesDir, 'promote.jpg');
      if (fs.existsSync(promoteImagePath)) {
        await sock.sendMessage(chatId, { image: fs.readFileSync(promoteImagePath), caption: banner, mentions: mentioned });
      } else {
        await sock.sendMessage(chatId, { text: banner, mentions: mentioned });
      }
    } catch (err) {
      console.error('خطأ برفع أدمن:', err?.message, err?.data || err?.output?.payload || '');
      await wa.reply(sock, msg, `ما قدرت أرفعه أدمن، تأكد إني أدمن وعندي صلاحية 🙏\n🔧 تفاصيل الخطأ: ${err?.message || '(بدون رسالة)'}${err?.data ? ' | data: ' + JSON.stringify(err.data) : ''}`);
    }
    return;
  }

  // -------- !انزل @شخص --------
  if (body.startsWith('!انزل')) {
    if (!isGroup) { await wa.reply(sock, msg, R.r061); return; }
    if (!(await senderIsAdmin(sock, chatId, authorId))) { await wa.reply(sock, msg, adminOnlyBanner()); return; }
    if (!(await botIsAdminInGroup(sock, chatId))) { await wa.reply(sock, msg, R.r062); return; }

    const rawMentioned = wa.resolveTargets(msg);
    if (rawMentioned.length === 0) { await wa.reply(sock, msg, R.r063); return; }

    try {
      // نطابق كل JID مع الصيغة الحقيقية المسجلة بلستة المشاركين (يحل مشكلة @lid)
      const groupMetaForDemote = await sock.groupMetadata(chatId);
      const mentioned = rawMentioned.map((jid) => wa.resolveParticipantId(groupMetaForDemote, jid));

      // لو الهدف مو أدمن أصلاً بالجروب، ما فيه داعي نحاول ننزّله ونطلع بخطأ عام
      const targetIsAdmin = mentioned.some((jid) => wa.isParticipantAdmin(groupMetaForDemote, jid));
      if (!targetIsAdmin) { await wa.reply(sock, msg, R.r064); return; }

      await sock.groupParticipantsUpdate(chatId, mentioned, 'demote');
      const demotedLine = mentioned.map((jid) => wa.tag(jid)).join('، ');
      const banner = [
        `╭━━━ ☠️ 『 ⚠️ ${R.BOT_NAME_STYLED} ⚠️ 』 ☠️ ━━━╮`,
        '┃  📉 *إعــفــاء مــن الإدارة*',
        '┣━━━━━━━━━━━━━━━━━━━━━━━━━━⫸',
        `┃  👤 *الــعــضــو :* ${demotedLine}`,
        `┃  ⏰ *الــتــوقــيــت :* ${greetings.formatTripoliTime()}`,
        '┃  ⚡ *الــحــالــة :* تم الإعفاء والعودة لرتبة عضو ☠️',
        '╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯',
        '',
        `⚠️ *تنويه من ${R.BOT_NAME}:*`,
        'شكراً على كل جهودك، ترجع عضو بالجروب متى ما حبيت. 🩸',
        '',
        `˼☠️˹ ┃ *${R.BOT_NAME} يراقب كل تحرك* ⚔️`
      ].join('\n');
      const demoteImagePath = path.join(imagesDir, 'demote.jpg');
      if (fs.existsSync(demoteImagePath)) {
        await sock.sendMessage(chatId, { image: fs.readFileSync(demoteImagePath), caption: banner, mentions: mentioned });
      } else {
        await sock.sendMessage(chatId, { text: banner, mentions: mentioned });
      }
    } catch (err) {
      console.error('خطأ بتنزيل أدمن:', err?.message, err?.data || err?.output?.payload || '');
      await wa.reply(sock, msg, `ما قدرت أنزله من الأدمن، تأكد إني أدمن وعندي صلاحية 🙏\n🔧 تفاصيل الخطأ: ${err?.message || '(بدون رسالة)'}${err?.data ? ' | data: ' + JSON.stringify(err.data) : ''}`);
    }
    return;
  }

  // -------- !منشن [رسالة] - منشن جماعي --------
  if (body.startsWith('!منشن')) {
    if (!isGroup) { await wa.reply(sock, msg, R.r065); return; }
    if (!(await senderIsAdmin(sock, chatId, authorId))) { await wa.reply(sock, msg, adminOnlyBanner()); return; }

    try {
      const meta = await sock.groupMetadata(chatId);
      const extraText = body.replace('!منشن', '').trim();
      const admins = meta.participants.filter((p) => p.admin === 'admin' || p.admin === 'superadmin');
      const members = meta.participants.filter((p) => !(p.admin === 'admin' || p.admin === 'superadmin'));
      const mentionIds = meta.participants.map((p) => p.id);

      const adminLines = admins.map((p) => `˼🌝˹ ┃${getCountryFlag(wa.bestDisplayNumber(p))} @${wa.bestDisplayNumber(p)}`);
      const memberLines = members.map((p, idx) => {
        const moon = idx === members.length - 1 ? '🌚' : '🌝';
        return `˼${moon}˹ ┃${getCountryFlag(wa.bestDisplayNumber(p))} @${wa.bestDisplayNumber(p)}`;
      });

      const banner = [
        '☠️ ══════ ⛓️ ══════ ☠️',
        `*❍ ꧁☠️ ${R.BOT_NAME_STYLED} ☠️꧂*  🩸╵𖣔╷↶`,
        '☠️ ══════ ⛓️ ══════ ☠️',
        'اصحوا يا ناس ونوروا الدردشة! ⚔️',
        ...(extraText ? [extraText] : []),
        '☠️ ══════ ⛓️ ══════ ☠️',
        '',
        `*المشرفون (${admins.length})*`,
        ...adminLines,
        '',
        `*الأعضاء (${members.length})*`,
        ...memberLines,
        '',
        '☠️ ══════ ⚔️ ══════ ☠️',
        '˼⚠️˹ ┃منورين بيتنا اللطيف ويسعدلي أوقاتكم… 🩸',
        `˼🩸˹ ┃${R.BOT_NAME} يتمنى لكم أجمل الأوقات دائماً ☠️`,
        '☠️ ══════ ⚔️ ══════ ☠️'
      ].join('\n');
      await sock.sendMessage(chatId, { text: banner, mentions: mentionIds });
    } catch (err) {
      console.error('خطأ بأمر المنشن الجماعي:', err.message);
      await wa.reply(sock, msg, R.r066);
    }
    return;
  }

  // -------- !تغيير_صورة --------
  if (body.startsWith('!تغيير_صورة')) {
    if (!isGroup) { await wa.reply(sock, msg, R.r067); return; }
    if (!(await senderIsAdmin(sock, chatId, authorId))) { await wa.reply(sock, msg, adminOnlyBanner()); return; }
    if (!(await botIsAdminInGroup(sock, chatId))) { await wa.reply(sock, msg, R.r068); return; }

    try {
      let downloaded = wa.getMediaType(msg) === 'image' ? await wa.downloadMedia(msg) : null;
      if (!downloaded && wa.hasQuotedMessage(msg)) {
        const quotedInfo = wa.getQuotedInfo(msg);
        downloaded = await wa.downloadQuotedMedia(quotedInfo.message);
      }
      if (!downloaded) {
        await wa.reply(sock, msg, R.r069);
        return;
      }
      await sock.updateProfilePicture(chatId, downloaded.buffer);
      await wa.reply(sock, msg, R.r070);
    } catch (err) {
      console.error('خطأ بتغيير صورة الجروب:', err.message);
      await wa.reply(sock, msg, R.r071);
    }
    return;
  }

  // -------- !استريك [رد على صورة/جيف، أو ابعتها مع الأمر] --------
  if (body.startsWith('!استريك')) {
    try {
      let downloaded = null;
      const currentType = wa.getMediaType(msg);
      if (currentType === 'image' || currentType === 'video') {
        downloaded = await wa.downloadMedia(msg);
      }
      if (!downloaded && wa.hasQuotedMessage(msg)) {
        const quotedInfo = wa.getQuotedInfo(msg);
        downloaded = await wa.downloadQuotedMedia(quotedInfo.message);
      }
      if (!downloaded) {
        await wa.reply(sock, msg, 'ابعت صورة أو جيف مع الأمر، أو رد (Reply) على وحدة فيهم بـ !استريك 🖼️');
        return;
      }

      const stickerBuffer = await stickerMaker.mediaBufferToStickerBuffer(downloaded.buffer, downloaded.mimetype);
      await sock.sendMessage(chatId, { sticker: stickerBuffer }, { quoted: msg });
    } catch (err) {
      console.error('خطأ بتحويل الاستيكر:', err.message);
      await wa.reply(sock, msg, `ما قدرت أسوي الاستيكر هلق 😅\n🔧 تفاصيل الخطأ: ${err.message}`);
    }
    return;
  }

  // -------- !تحذير @شخص - عرض عدد التحذيرات --------
  if (body.startsWith('!تحذير') && !body.startsWith('!تحذيرات')) {
    if (!isGroup) { await wa.reply(sock, msg, R.r072); return; }
    const mentioned = wa.getMentionedJids(msg);
    const targetId = mentioned.length > 0 ? mentioned[0] : authorId;
    const count = moderation.getWarningCount(persistDir, targetId, chatId);
    await sock.sendMessage(chatId, {
      text: moderation.warningCountBanner(wa.tag(targetId), count, moderation.MAX_WARNINGS),
      mentions: [targetId]
    });
    return;
  }

  // -------- !ازالة_تحذير @شخص --------
  if (body.startsWith('!ازالة_تحذير')) {
    if (!isGroup) { await wa.reply(sock, msg, R.r073); return; }
    if (!(await senderIsAdmin(sock, chatId, authorId))) { await wa.reply(sock, msg, adminOnlyBanner()); return; }
    const mentioned = wa.resolveTargets(msg);
    if (mentioned.length === 0) { await wa.reply(sock, msg, R.r074); return; }
    const target = mentioned[0];
    moderation.resetWarnings(persistDir, target, chatId);
    await sock.sendMessage(chatId, { text: moderation.warningsResetBanner(wa.tag(target), wa.tag(authorId)), mentions: [target, authorId] });
    return;
  }

  // -------- !مخالفة / !مخالفه @شخص [سبب] --------
  if (body.startsWith('!مخالفة') || body.startsWith('!مخالفه')) {
    if (!isGroup) { await wa.reply(sock, msg, R.r075); return; }
    if (!(await senderIsAdmin(sock, chatId, authorId))) { await wa.reply(sock, msg, adminOnlyBanner()); return; }
    const mentioned = wa.resolveTargets(msg);
    if (mentioned.length === 0) { await wa.reply(sock, msg, R.r076); return; }
    const target = mentioned[0];

    const reason = body.replace(/^!مخالفة|^!مخالفه/, '').replace(/@\d+/g, '').trim();
    const finalReason = reason.length === 0 ? 'مخالفة لقوانين الجروب' : reason;

    const newCount = moderation.addWarning(persistDir, target, chatId);
    try {
      await sock.sendMessage(target, {
        text: moderation.violationDmBanner(finalReason, wa.tag(target), newCount, moderation.MAX_WARNINGS)
      });
    } catch (dmErr) {
      console.error('ما قدرت أبعت رسالة خاص للعضو المخالف:', dmErr.message);
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
          reason: 'تجاوز التحذيرات (مخالفة يدوية)'
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
    return;
  }

  // -------- !اوامر (القائمة الرئيسية المختصرة - توجّه لـ !عام / !العاب / !ادارة) --------
  if (body === '!اوامر') {
    const mainMenu = R.mainMenu;

    try {
      const menuVideoBuffer = await media.getMenuVideoBuffer(imagesDir);
      await sock.sendMessage(chatId, { video: menuVideoBuffer, caption: mainMenu });
    } catch (imgErr) {
      console.error('فشل تجهيز فيديو القائمة:', imgErr.message);
      await wa.reply(sock, msg, mainMenu);
    }

    // -------- أزرار تفاعلية حقيقية (quick_reply) للأقسام الثلاثة --------
    // ملاحظة: هذي ميزة اسمها "native flow buttons"، متاحة لأن package.json عندك
    // يحوّل @whiskeysockets/baileys لفورك @itsukichan/baileys اللي يدعمها فعلياً
    // (المكتبة الرسمية العادية عندها مشكلة معروفة إن الأزرار ما توصل/ما تظهر).
    // لما المستخدم يضغط زر quick_reply، واتساب يبعت display_text كأنه كتبها
    // بنفسه بالضبط، فمنطق المطابقة النصي الموجود أصلاً (!عام / !العاب / !ادارة)
    // بيشتغل عليها تلقائياً بدون أي تعديل ثاني.
    try {
      await sock.sendMessage(chatId, {
        text: 'اختصر عليك واضغط القسم اللي تبيه 👇',
        footer: `${R.BOT_NAME || ''}`.trim() || 'القائمة',
        interactiveButtons: [
          { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '🔥 !عام', id: 'menu_general' }) },
          { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '🎮 !العاب', id: 'menu_games' }) },
          { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '👑 !ادارة', id: 'menu_admin' }) },
          { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '🛠️ تواصل مع المطور', id: 'menu_dev' }) },
          { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '© حقوق بوت', id: 'menu_rights' }) }
        ]
      });
    } catch (btnErr) {
      // fail-open: لو الأزرار فشلت لأي سبب (مثلاً حساب مو مدعوم)، القائمة النصية
      // اللي اترسلت فوق كافية وحدها، ما نكسر الأمر كامل بسببها.
      console.error('تعذر إرسال أزرار !اوامر التفاعلية:', btnErr.message);
    }
    return;
  }

  // -------- !عام (قسم الأوامر العامة) --------
  if (stripButtonEmoji(body) === '!عام') {
    const generalSection = R.generalSection;

    try {
      const generalVideoBuffer = fs.readFileSync(path.join(imagesDir, 'VID_20260806_201931.mp4'));
      await sock.sendMessage(chatId, { video: generalVideoBuffer, caption: generalSection });
    } catch (imgErr) {
      console.error('فشل تجهيز فيديو قسم !عام:', imgErr.message);
      await wa.reply(sock, msg, generalSection);
    }
    return;
  }

  // -------- !العاب (قسم أوامر الألعاب) --------
  if (stripButtonEmoji(body) === '!العاب') {
    const gamesSection = R.gamesSection;

    try {
      const gamesVideoBuffer = fs.readFileSync(path.join(imagesDir, 'VID_20260806_202831.mp4'));
      await sock.sendMessage(chatId, { video: gamesVideoBuffer, caption: gamesSection });
    } catch (imgErr) {
      console.error('فشل تجهيز فيديو قسم !العاب:', imgErr.message);
      await wa.reply(sock, msg, gamesSection);
    }
    return;
  }

  // -------- !ادارة (قسم أوامر الإدارة - أدمن الجروب بس) --------
  if (stripButtonEmoji(body) === '!ادارة') {
    if (!(await senderIsAdmin(sock, chatId, authorId))) {
      await wa.reply(sock, msg, adminOnlyBanner());
      return;
    }

    // 🔒 لو البوت نفسه مش أدمن بالجروب، ما تطلعش قائمة الإدارة (لأن أوامرها أصلاً
    // محتاجة البوت يكون أدمن عشان تشتغل) - حتى لو الطالب أدمن فعلاً
    if (!(await botIsAdminInGroup(sock, chatId))) {
      const botNotAdminBanner = R.botNotAdminBanner;
      await wa.reply(sock, msg, botNotAdminBanner);
      return;
    }

    const adminSection = R.adminSection;

    try {
      const adminVideoBuffer = fs.readFileSync(path.join(imagesDir, 'VID_20260806_202522.mp4'));
      await sock.sendMessage(chatId, { video: adminVideoBuffer, caption: adminSection });
    } catch (imgErr) {
      console.error('فشل تجهيز فيديو قسم !ادارة:', imgErr.message);
      await wa.reply(sock, msg, adminSection);
    }
    return;
  }

  // -------- !بروفايل @شخص --------
  if (body.startsWith('!بروفايل')) {
    const mentioned = wa.getMentionedJids(msg);
    let target = mentioned.length > 0 ? mentioned[0] : authorId;

    // لو بجروب: نطابق الـ JID مع الصيغة الحقيقية المسجلة بلستة المشاركين
    // (يحل مشكلة @lid - نفس اللي بنسويه بـ !اصعد و!انزل)
    if (isGroup && mentioned.length > 0) {
      try {
        const groupMetaForProfile = await sock.groupMetadata(chatId);
        target = wa.resolveParticipantId(groupMetaForProfile, target);
      } catch (metaErr) {
        console.error('خطأ بجلب معلومات الجروب لأمر البروفايل:', metaErr.message);
      }
    }

    const picBuffer = await media.getProfilePicBuffer(sock, target);
    if (!picBuffer) {
      await wa.reply(sock, msg, R.r077);
      return;
    }
    const targetTag = wa.tag(target);
    const caption = [
      `╭━━━ ☠️ 『 ✨ ${R.BOT_NAME_STYLED} ✨ 』 ☠️ ━━━╮`,
      '┃ ✦ تــم اســتــخــراج الــبــروفــايــل بــنــجــاح ⚔️',
      '┃',
      `┃ *👤 الـمـسـتـخـدم :* ${targetTag}`,
      '┃ *📸 الـصـورة :* مـتـاحـة ☠️',
      '┃ *⚡ الـحـالـة :* نـشـط بـيـن صـفـوفـنـا 🩸',
      '╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯',
      '',
      `⚠️ *تنويه من ${R.BOT_NAME}:*`,
      'هاك البروفايل يا ضلع.. وجهك حلو ومنور الجروب اليوم. ☠️',
      '',
      `˼🩸˹ ┃ *${R.BOT_NAME} في خدمتكم دائماً* ⚔️`
    ].join('\n');
    await sock.sendMessage(chatId, { image: picBuffer, caption, mentions: [target] });
    return;
  }

  // -------- !تحدي --------
  if (body.startsWith('!تحدي')) {
    if (!isGroup) { await wa.reply(sock, msg, R.r078); return; }
    if (games.pendingChallenges.has(chatId)) { await wa.reply(sock, msg, R.r079); return; }

    const picked = games.CHALLENGE_QUESTIONS[Math.floor(Math.random() * games.CHALLENGE_QUESTIONS.length)];
    const timer = setTimeout(async () => {
      if (games.pendingChallenges.get(chatId)?.answer === picked.answer) {
        games.pendingChallenges.delete(chatId);
        try {
          await sock.sendMessage(chatId, { text: games.challengeTimeoutBanner(picked.answer) });
        } catch (timeoutErr) {
          console.error('خطأ بإرسال بانر انتهاء التحدي:', timeoutErr.message);
        }
      }
    }, games.CHALLENGE_TIMEOUT_MS);

    games.pendingChallenges.set(chatId, { question: picked.question, answer: picked.answer, askedBy: authorId, timer });
    await sock.sendMessage(chatId, { text: games.challengeBanner(picked.question) });
    return;
  }

  // -------- !دين --------
  if (body.startsWith('!دين')) {
    if (DEAN_QUESTIONS.length === 0) {
      await wa.reply(sock, msg, R.r080);
      return;
    }
    if (!isGroup) { await wa.reply(sock, msg, R.r081); return; }
    if (games.pendingDeanQuestions.has(chatId)) { await wa.reply(sock, msg, R.r082); return; }

    const pickedDean = DEAN_QUESTIONS[Math.floor(Math.random() * DEAN_QUESTIONS.length)];
    const deanTimer = setTimeout(async () => {
      if (games.pendingDeanQuestions.get(chatId)?.answer === pickedDean.response) {
        games.pendingDeanQuestions.delete(chatId);
        try {
          await sock.sendMessage(chatId, { text: games.deanTimeoutBanner(pickedDean.response) });
        } catch (timeoutErr) {
          console.error('خطأ بإرسال بانر انتهاء السؤال الديني:', timeoutErr.message);
        }
      }
    }, games.DEAN_TIMEOUT_MS);

    games.pendingDeanQuestions.set(chatId, {
      question: pickedDean.question, answer: pickedDean.response, askedBy: authorId, timer: deanTimer
    });
    await sock.sendMessage(chatId, { text: games.deanBanner(pickedDean.question) });
    return;
  }

  // -------- !من_فينا --------
  if (body.startsWith('!من_فينا')) {
    if (!isGroup) { await wa.reply(sock, msg, R.r083); return; }
    const meta = await sock.groupMetadata(chatId);
    const participants = meta.participants.filter((p) => jidToNumber(p.id) !== jidToNumber(sock.user?.id));
    if (participants.length === 0) { await wa.reply(sock, msg, R.r084); return; }

    const chosen = participants[Math.floor(Math.random() * participants.length)];
    const question = games.MIN_FIINA_QUESTIONS[Math.floor(Math.random() * games.MIN_FIINA_QUESTIONS.length)];
    await sock.sendMessage(chatId, { text: games.minFiinaBanner(question, wa.tag(chosen.id)), mentions: [chosen.id] });
    return;
  }

  // -------- !زواج @شخص [مهر] --------
  if (body.startsWith('!زواج')) {
    if (!isGroup) { await wa.reply(sock, msg, R.r085); return; }
    const mentioned = wa.getMentionedJids(msg);
    if (mentioned.length !== 1) { await wa.reply(sock, msg, R.r086); return; }
    const husbandId = authorId;
    const wifeId = mentioned[0];

    if (husbandId === wifeId) { await wa.reply(sock, msg, R.r087); return; }

    if (marriage.findActiveMarriageAsWife(persistDir, wifeId, chatId)) {
      await wa.reply(sock, msg, R.r088);
      return;
    }

    const husbandWives = marriage.findActiveWivesOfHusband(persistDir, husbandId, chatId);
    if (husbandWives.length >= marriage.MAX_WIVES_PER_HUSBAND) {
      await wa.reply(sock, msg, `خلاص وصلت الحد يا بطل، عندك ${marriage.MAX_WIVES_PER_HUSBAND} وكفاية عليك 😅`);
      return;
    }

    const requestKey = `${chatId}_${wifeId}`;
    if (marriage.pendingMarriageRequests.has(requestKey)) {
      await wa.reply(sock, msg, R.r089);
      return;
    }

    let mahrText = body.replace('!زواج', '');
    mentioned.forEach((jid) => { mahrText = mahrText.replace(wa.tag(jid), ''); });
    mahrText = mahrText.trim();
    const mahr = mahrText.length > 0 ? mahrText : marriage.randomMahr();

    const timer = setTimeout(async () => {
      if (marriage.pendingMarriageRequests.has(requestKey)) {
        marriage.pendingMarriageRequests.delete(requestKey);
        try {
          await sock.sendMessage(chatId, { text: `${wa.tag(wifeId)} ما ردت بالوقت، الطلب اتلغى ⏳💔`, mentions: [wifeId] });
        } catch (_) {}
      }
    }, marriage.MARRIAGE_REQUEST_TIMEOUT_MS);

    marriage.pendingMarriageRequests.set(requestKey, { husbandId, wifeId, chatId, mahr, timer });

    const proposalBanner = [
      '╔════════════════════════════╗',
      '║        💍   طـلـب زواج 💍       ║',
      '╠════════════════════════════╣',
      `║  🤵 *الــعــريــس:* ${wa.tag(husbandId)}`,
      `║  👰 *الــعــروســة:* ${wa.tag(wifeId)}`,
      `║  💰 *الــمــهــر:* ${mahr}`,
      '║  ⏳ *الــحــالــة:* بـانـتـظـار الـرد',
      '╚════════════════════════════╝',
      '',
      `يا ${wa.tag(wifeId)}، عندك دقيقتين، اكتبي *قبول* أو *رفض* 💌`
    ].join('\n');

    await sock.sendMessage(chatId, { text: proposalBanner, mentions: [wifeId, husbandId] });
    return;
  }

  // -------- قبول / رفض --------
  if (body === 'قبول' || body === 'رفض') {
    const requestKey = `${chatId}_${authorId}`;
    const pending = marriage.pendingMarriageRequests.get(requestKey);

    if (pending) {
      clearTimeout(pending.timer);
      marriage.pendingMarriageRequests.delete(requestKey);

      if (body === 'رفض') {
        await wa.reply(sock, msg, R.r090);
        return;
      }

      const marriages = marriage.loadMarriages(persistDir);
      marriages.push({
        husbandId: pending.husbandId,
        wifeId: pending.wifeId,
        chatId: pending.chatId,
        mahr: pending.mahr,
        date: new Date().toISOString(),
        status: 'قائم'
      });
      marriage.saveMarriages(persistDir, marriages);

      const marriageBanner = [
        '╔════════════════════════════╗',
        '║       💍   مـبـروك الـزواج 💍     ║',
        '╠════════════════════════════╣',
        `║  🤵 *الــزوج:* ${wa.tag(pending.husbandId)}`,
        `║  👰 *الــزوجــة:* ${wa.tag(pending.wifeId)}`,
        `║  💰 *الــمــهــر:* ${pending.mahr}`,
        '║  💚 *الــحــالــة:* قـائـم',
        '╚════════════════════════════╝',
        '',
        '🎉 *ألـف مـبـروك ونـتـمـنـى لـكـمـا حـيـاة سـعـيـدة* 🎉'
      ].join('\n');
      await sock.sendMessage(chatId, { text: marriageBanner, mentions: [pending.husbandId, pending.wifeId] });

      const husbandWivesNow = marriage.findActiveWivesOfHusband(persistDir, pending.husbandId, pending.chatId);
      if (husbandWivesNow.length === 2) {
        const firstWife = husbandWivesNow[0];
        try {
          await sock.sendMessage(chatId, {
            text: `${wa.tag(firstWife.wifeId)} يا حرام، ${wa.tag(pending.husbandId)} جاب وحدة ثانية معاك 😂 قومي ديري لِه فنجان قهوة وسكتي 🙃`,
            mentions: [firstWife.wifeId, pending.husbandId]
          });
        } catch (err) {
          console.error('فشل إرسال رسالة الزوجة الأولى:', err.message);
        }
      }
      return;
    }
    // لو ماله طلب معلق، نتجاهل الرسالة عادي
  }

  // -------- !طلاق @شخص --------
  if (body.startsWith('!طلاق')) {
    if (!isGroup) { await wa.reply(sock, msg, R.r091); return; }
    const mentioned = wa.getMentionedJids(msg);
    if (mentioned.length !== 1) { await wa.reply(sock, msg, R.r092); return; }
    const target = mentioned[0];

    const marriages = marriage.loadMarriages(persistDir);
    let m = marriages.find((mm) => mm.husbandId === authorId && mm.wifeId === target && mm.chatId === chatId && mm.status === 'قائم');

    if (m) {
      m.status = 'منتهي';
      marriage.saveMarriages(persistDir, marriages);
      const banner = [
        '╔════════════════════════════╗',
        '║        💔    طـلاق 💔          ║',
        '╠════════════════════════════╣',
        `║  👨‍💼 *الــزوج:* ${wa.tag(authorId)}`,
        `║  👰‍♀️ *الــزوجــة:* ${wa.tag(target)}`,
        '║  💔 *الــحــالــة:* مـطـلـق',
        '╚════════════════════════════╝',
        '',
        '😔 *نـتـمـنـى لـهـمـا كـل الـخـيـر* 😔',
        '',
        '*ربـي يـعـوضـهـمـا خـيـر ويـكـتـب لـهـمـا الـسـعـادة*'
      ].join('\n');
      await sock.sendMessage(chatId, { text: banner, mentions: [authorId, target] });
      return;
    }

    const wifeTrying = marriages.find((mm) => mm.wifeId === authorId && mm.husbandId === target && mm.chatId === chatId && mm.status === 'قائم');
    if (wifeTrying) {
      await wa.reply(sock, msg, R.r093);
      return;
    }

    await wa.reply(sock, msg, R.r094);
    return;
  }

  // -------- !ليون --------
  if (body.startsWith('!ليون')) {
    if (!aiEnabled) { await wa.reply(sock, msg, ai.personaOfflineMessage('murad')); return; }
    const question = body.replace('!ليون', '').trim();
    const rawPrompt = question.length > 0 ? question : 'سلم علينا يا ليون';
    const { cleanText, styleWord } = styleDirective.extractStyleDirective(rawPrompt);
    const prompt = cleanText;
    const history = ai.PERSONAS.murad.history.get(convoKey) || [];
    const systemOverride = styleWord
      ? `${ai.PERSONAS.murad.systemPrompt}\n\n${styleDirective.buildStyleNote(styleWord)}`
      : null;
    const replyText = await ai.askAI(prompt, history, 'murad', systemOverride);
    ai.pushToHistory(ai.PERSONAS.murad.history, convoKey, 'user', prompt);
    ai.pushToHistory(ai.PERSONAS.murad.history, convoKey, 'assistant', replyText);
    ai.saveHistoryToDisk(persistDir);
    const sent = await sock.sendMessage(chatId, { text: replyText }, { quoted: msg });
    ai.rememberSentMessage(sent.key.id, 'murad');
    return;
  }

  // -------- !اشلي --------
  if (body.startsWith('!اشلي')) {
    if (!aiEnabled) { await wa.reply(sock, msg, ai.personaOfflineMessage('souad')); return; }
    const question = body.replace('!اشلي', '').trim();
    const rawPrompt = question.length > 0 ? question : 'سلمي علينا يا اشلي';
    const { cleanText, styleWord } = styleDirective.extractStyleDirective(rawPrompt);
    const prompt = cleanText;
    const history = ai.PERSONAS.souad.history.get(convoKey) || [];
    const isLoved = ai.SOUAD_LOVED_NUMBERS.includes(authorNumber);
    const baseSouadPrompt = ai.getSouadSystemPrompt(isLoved);
    const systemOverride = styleWord
      ? `${baseSouadPrompt}\n\n${styleDirective.buildStyleNote(styleWord)}`
      : baseSouadPrompt;
    const replyText = await ai.askAI(prompt, history, 'souad', systemOverride);
    ai.pushToHistory(ai.PERSONAS.souad.history, convoKey, 'user', prompt);
    ai.pushToHistory(ai.PERSONAS.souad.history, convoKey, 'assistant', replyText);
    ai.saveHistoryToDisk(persistDir);
    const sent = await sock.sendMessage(chatId, { text: replyText }, { quoted: msg });
    ai.rememberSentMessage(sent.key.id, 'souad');
    return;
  }

  // -------- رد (Reply) على رسالة من ليون أو اشلي = ترد بنفس الشخصية بدون أمر --------
  if (aiEnabled && wa.hasQuotedMessage(msg) && body.length > 1 && !body.startsWith('!')) {
    const quotedInfo = wa.getQuotedInfo(msg);
    if (ai.isTrackedBotMessage(quotedInfo.stanzaId)) {
      const personaKey = ai.getPersonaForQuotedMessage(quotedInfo.stanzaId);
      const persona = ai.PERSONAS[personaKey];
      const history = persona.history.get(convoKey) || [];
      const promptOverride = personaKey === 'souad'
        ? ai.getSouadSystemPrompt(ai.SOUAD_LOVED_NUMBERS.includes(authorNumber))
        : null;
      const replyText = await ai.askAI(body, history, personaKey, promptOverride);
      ai.pushToHistory(persona.history, convoKey, 'user', body);
      ai.pushToHistory(persona.history, convoKey, 'assistant', replyText);
      ai.saveHistoryToDisk(persistDir);

      // لو الرسالة اللي رد عليها المستخدم كانت صوتية أصلاً من البوت،
      // نرد عليه بصوت هو كمان (حتى لو رد هو بكتابة عادية) - مش نكسر توقعه بكتابة.
      const shouldReplyWithVoice = ai.wasQuotedMessageVoice(quotedInfo.stanzaId);
      if (shouldReplyWithVoice) {
        try {
          const voiceBuffer = await textToVoiceBuffer(replyText, GROQ_API_KEY, persona.voice);
          const sent = await sock.sendMessage(chatId, { audio: voiceBuffer, mimetype: 'audio/ogg; codecs=opus', ptt: true }, { quoted: msg });
          ai.rememberSentMessage(sent.key.id, personaKey, true);
        } catch (voiceErr) {
          console.error('خطأ بتحويل رد الريبلاي لصوت:', voiceErr.message);
          const sent = await sock.sendMessage(chatId, { text: replyText }, { quoted: msg });
          ai.rememberSentMessage(sent.key.id, personaKey);
        }
      } else {
        const sent = await sock.sendMessage(chatId, { text: replyText }, { quoted: msg });
        ai.rememberSentMessage(sent.key.id, personaKey);
      }
      return;
    }
  }

  // -------- !صلاة / !تفعيل_تنبيه_الصلاة / !ايقاف_تنبيه_الصلاة (بالخاص بس) --------
  if (body.startsWith('!صلاة')) {
    if (isGroup) { await wa.reply(sock, msg, R.r095); return; }
    const countryKey = prayer.detectCountryFromNumber(jidToNumber(chatId));
    if (!countryKey) { await wa.reply(sock, msg, prayer.unsupportedCountryMessage()); return; }
    const timings = await prayer.getTodayTimings(countryKey);
    if (!timings) { await wa.reply(sock, msg, R.r096); return; }
    await wa.reply(sock, msg, prayer.formatPrayerTimesMessage(countryKey, timings));
    return;
  }

  if (body.startsWith('!تفعيل_تنبيه_الصلاة')) {
    if (isGroup) { await wa.reply(sock, msg, R.r097); return; }
    const countryKey = prayer.detectCountryFromNumber(jidToNumber(chatId));
    if (!countryKey) { await wa.reply(sock, msg, prayer.unsupportedCountryMessage()); return; }
    prayer.subscribeUser(persistDir, chatId, countryKey);
    await wa.reply(sock, msg, prayer.subscribedBanner(prayer.COUNTRIES[countryKey].name));
    return;
  }

  if (body.startsWith('!ايقاف_تنبيه_الصلاة')) {
    if (isGroup) { await wa.reply(sock, msg, R.r098); return; }
    prayer.unsubscribeUser(persistDir, chatId);
    await wa.reply(sock, msg, prayer.unsubscribedBanner());
    return;
  }

  // -------- !صوت / !صليون / !صاشلي (منطق مشترك) --------
  // forcedPersonaKey = null  -> زي القديم بالضبط (!صوت): ياخد الشخصية من الرسالة المردود عليها لو فيه، وإلا الافتراضي (ليون)
  // forcedPersonaKey = 'murad' أو 'souad' -> يفرض الشخصية والصوت بغض النظر عن أي رد (!صليون / !صاشلي)
  //
  // تحديث: !صليون/!صاشلي صارت تسأل الذكاء الاصطناعي فعلياً وتحكي جوابه الحقيقي بصوت
  // (بدل ما تاخذ نصك وتقرأه حرفياً بدون فهم زي قبل). الاستثناء الوحيد: لو رديت
  // (Reply) على رسالة قديمة من نفس الشخصية بدون ما تكتب نص إضافي، بنعيدها بصوت
  // زي ما هي (لأنها أصلاً رد جاهز سابق، ما فيه داعي نسأل الذكاء الاصطناعي مرة ثانية).
  async function handleVoiceCommand(commandPrefix, forcedPersonaKey) {
    const typedText = body.replace(commandPrefix, '').trim();
    let promptText = typedText;
    let personaKeyForVoice = forcedPersonaKey || ai.DEFAULT_PERSONA_KEY;
    let repeatOldReplyAsIs = false;
    let quotedText = '';

    if (wa.hasQuotedMessage(msg)) {
      const quotedInfo = wa.getQuotedInfo(msg);
      if (!forcedPersonaKey && ai.isTrackedBotMessage(quotedInfo.stanzaId)) {
        personaKeyForVoice = ai.getPersonaForQuotedMessage(quotedInfo.stanzaId);
        // ريبلاي على رد قديم لنفس الشخصية بدون نص إضافي = بس أعيدها بصوت كما هي
        if (typedText.length === 0) repeatOldReplyAsIs = true;
      }
      quotedText = wa.getQuotedText(quotedInfo.message);
      if (promptText.length === 0) promptText = quotedText;
    }

    if (!aiEnabled) { await wa.reply(sock, msg, ai.personaOfflineMessage(personaKeyForVoice)); return; }
    if (promptText.length === 0) {
      await wa.reply(sock, msg, `اكتب سؤالك أو كلامك وبيرد عليك بصوته، أو رد (Reply) على رسالة بـ ${commandPrefix} 🎙️`);
      return;
    }

    try {
      const persona = ai.PERSONAS[personaKeyForVoice];
      let textForVoice;

      if (repeatOldReplyAsIs) {
        textForVoice = quotedText;
      } else {
        // نسأل الذكاء الاصطناعي فعلياً ونجيب رد حقيقي مبني على السؤال (وعلى ذاكرة المحادثة)
        const history = persona.history.get(convoKey) || [];
        const promptOverride = personaKeyForVoice === 'souad'
          ? ai.getSouadSystemPrompt(ai.SOUAD_LOVED_NUMBERS.includes(authorNumber))
          : null;
        const aiReply = await ai.askAI(promptText, history, personaKeyForVoice, promptOverride);
        ai.pushToHistory(persona.history, convoKey, 'user', promptText);
        ai.pushToHistory(persona.history, convoKey, 'assistant', aiReply);
        ai.saveHistoryToDisk(persistDir);
        textForVoice = (aiReply && aiReply.trim()) ? aiReply : ai.personaBusyMessage(personaKeyForVoice);
      }

      const voiceBuffer = await textToVoiceBuffer(textForVoice, GROQ_API_KEY, persona.voice);
      const sent = await sock.sendMessage(chatId, { audio: voiceBuffer, mimetype: 'audio/ogg; codecs=opus', ptt: true });
      ai.rememberSentMessage(sent.key.id, personaKeyForVoice, true);
    } catch (err) {
      console.error('خطأ بتحويل النص لصوت:', err.message);
      await wa.reply(sock, msg, `ما قدرت أسوي الصوت هلق 😅\n🔧 تفاصيل الخطأ: ${err.message}`);
    }
  }

  // -------- !صليون [نص] --------
  if (body.startsWith('!صليون')) {
    await handleVoiceCommand('!صليون', 'murad');
    return;
  }

  // -------- !صاشلي [نص] --------
  if (body.startsWith('!صاشلي')) {
    await handleVoiceCommand('!صاشلي', 'souad');
    return;
  }

  // -------- رسالة صوتية (Reply على رسالة البوت) = STT + AI + TTS --------
  const msgMediaType = wa.getMediaType(msg);
  if (aiEnabled && (msgMediaType === 'ptt' || msgMediaType === 'audio') && wa.hasQuotedMessage(msg)) {
    const quotedInfo = wa.getQuotedInfo(msg);
    if (ai.isTrackedBotMessage(quotedInfo.stanzaId)) {
      try {
        const downloaded = await wa.downloadMedia(msg);
        if (!downloaded) { await wa.reply(sock, msg, R.r099); return; }

        const transcribedText = await transcribeVoiceBuffer(downloaded.buffer, downloaded.mimetype, GROQ_API_KEY);
        if (!transcribedText) { await wa.reply(sock, msg, R.r100); return; }

        const personaKey = ai.getPersonaForQuotedMessage(quotedInfo.stanzaId);
        const persona = ai.PERSONAS[personaKey];
        const history = persona.history.get(convoKey) || [];
        const voicePromptOverride = personaKey === 'souad'
          ? ai.getSouadSystemPrompt(ai.SOUAD_LOVED_NUMBERS.includes(authorNumber))
          : null;
        const aiReply = await ai.askAI(transcribedText, history, personaKey, voicePromptOverride);
        ai.pushToHistory(persona.history, convoKey, 'user', transcribedText);
        ai.pushToHistory(persona.history, convoKey, 'assistant', aiReply);
        ai.saveHistoryToDisk(persistDir);

        // حماية: لو الرد وصل فاضي لأي سبب، نستبدله بجملة بديلة قصيرة
        // (بدل ما نبعت صوتية فاضية) - بتضل صوتية زي ما المستخدم يتوقع، مش نص
        const textForVoice = (aiReply && aiReply.trim()) ? aiReply : ai.personaBusyMessage(personaKey);

        const voiceBuffer = await textToVoiceBuffer(textForVoice, GROQ_API_KEY, persona.voice);
        const sent = await sock.sendMessage(chatId, { audio: voiceBuffer, mimetype: 'audio/ogg; codecs=opus', ptt: true });
        ai.rememberSentMessage(sent.key.id, personaKey, true);
      } catch (err) {
        console.error('خطأ بمعالجة الرسالة الصوتية:', err.message);
        await wa.reply(sock, msg, R.r101);
      }
      return;
    }
  }

  // -------- رسالة قصيرة فيها "بروفايل" بصيغة غلط --------
  if (!body.startsWith('!') && body.length > 0) {
    const words = body.split(/\s+/).filter(Boolean);
    if (words.length > 0 && words.length <= 3 && /بروفايل/i.test(body)) {
      await wa.reply(sock, msg, banners.wrongCommandBanner());
      return;
    }
  }

  // -------- كاتش-أول: أي أمر يبدأ بـ ! وما تطابقش مع ولا أمر معروف --------
  if (body.startsWith('!')) {
    await wa.reply(sock, msg, banners.wrongCommandBanner());
    return;
  }
}

module.exports = {
  initRouter,
  handleMessagesUpsert
};
